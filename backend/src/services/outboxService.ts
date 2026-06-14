// Cua d'enviaments WhatsApp (outbox pattern)
// Els missatges s'encuen a WhatsappOutbox i un worker els envia amb delay i retry

import prisma from "../lib/prisma";
import { openwa } from "../connectors/OpenWAConnector";
import { logger } from "../lib/logger";
import { recordStatusChange } from "./statusHistory";

export async function enqueueMessage(params: {
  receiptId: number;
  clientId?: number | null;
  phone: string;
  message: string;
  scheduledAt?: Date;
}): Promise<number> {
  // No encuar si el client té WhatsApp bloquejat
  if (params.clientId) {
    const client = await prisma.client.findUnique({
      where: { id: params.clientId },
      select: { whatsappBlocked: true },
    });
    if (client?.whatsappBlocked) {
      logger.info({ clientId: params.clientId, receiptId: params.receiptId }, "No s'encua: WhatsApp bloquejat per al client");
      return 0;
    }
  }

  // No encuar si el rebut ja està TANCAT o PAGAMENT_CONFIRMAT
  const receipt = await prisma.returnedReceipt.findUnique({
    where: { id: params.receiptId },
    select: { status: true },
  });

  if (receipt && ["TANCAT", "PAGAMENT_CONFIRMAT"].includes(receipt.status)) {
    logger.info({ receiptId: params.receiptId, status: receipt.status }, "No s'encua: rebut tancat o confirmat");
    return 0;
  }

  // Cancel·lar qualsevol missatge PENDING o SENDING anterior del mateix rebut
  // (per evitar acumular missatges obsolets, especialment en auto-respostes del webhook)
  await prisma.whatsappOutbox.updateMany({
    where: {
      receiptId: params.receiptId,
      status: { in: ["PENDING", "SENDING"] },
    },
    data: { status: "CANCELLED", lastError: "Substituït per un missatge més recent" },
  });

  const outbox = await prisma.whatsappOutbox.create({
    data: {
      receiptId: params.receiptId,
      clientId: params.clientId || null,
      phone: params.phone,
      message: params.message,
      status: "PENDING",
      scheduledAt: params.scheduledAt || new Date(),
    },
  });

  logger.info({ outboxId: outbox.id, receiptId: params.receiptId }, "Missatge encuat");
  return outbox.id;
}

// Processa un sol missatge de la cua
async function processOne(outboxId: number): Promise<boolean> {
  const outbox = await prisma.whatsappOutbox.findUnique({
    where: { id: outboxId },
  });

  if (!outbox || outbox.status !== "PENDING") return false;

  // Verificar que el rebut no està tancat
  const receipt = await prisma.returnedReceipt.findUnique({
    where: { id: outbox.receiptId },
    select: { status: true },
  });

  if (receipt && ["TANCAT", "PAGAMENT_CONFIRMAT"].includes(receipt.status)) {
    await prisma.whatsappOutbox.update({
      where: { id: outboxId },
      data: { status: "CANCELLED", lastError: "Rebut tancat o confirmat" },
    });
    logger.info({ outboxId, receiptStatus: receipt.status }, "Missatge cancel·lat: rebut tancat");
    return true;
  }

  // Marcar com SENDING
  await prisma.whatsappOutbox.update({
    where: { id: outboxId },
    data: { status: "SENDING", attempts: outbox.attempts + 1 },
  });

  // Enviar
  const result = await openwa.sendMessage(outbox.phone, outbox.message);

  if (result.success) {
    await prisma.whatsappOutbox.update({
      where: { id: outboxId },
      data: { status: "SENT", sentAt: new Date() },
    });

    // Guardar el missatge sortint al historial
    await prisma.message.create({
      data: {
        receiptId: outbox.receiptId,
        direction: "OUTBOUND",
        content: outbox.message,
        status: "sent",
        externalId: result.externalId,
      },
    });

    // Actualitzar rebut a NOTIFICAT si cal
    const receipt = await prisma.returnedReceipt.findUnique({
      where: { id: outbox.receiptId },
      select: { status: true },
    });

    if (receipt && ["DETECTAT", "EMPARELLAT", "REVISAR"].includes(receipt.status)) {
      const oldStatus = receipt.status;
      await prisma.returnedReceipt.update({
        where: { id: outbox.receiptId },
        data: { status: "NOTIFICAT", notifiedAt: new Date() },
      });
      await recordStatusChange({
        receiptId: outbox.receiptId,
        fromStatus: oldStatus,
        toStatus: "NOTIFICAT",
        reason: "WhatsApp enviat via outbox",
        actorType: "SYSTEM",
      });
    }

    logger.info({ outboxId, externalId: result.externalId }, "WhatsApp enviat correctament");
    return true;
  }

  // Error — comprovar si queden intents
  const maxAttempts = outbox.maxAttempts || 3;
  if (outbox.attempts >= maxAttempts) {
    await prisma.whatsappOutbox.update({
      where: { id: outboxId },
      data: {
        status: "FAILED",
        lastError: result.error || "Error desconegut",
      },
    });

    // Marcar rebut com ERROR_WHATSAPP
    const oldStatus = await prisma.returnedReceipt.findUnique({
      where: { id: outbox.receiptId },
      select: { status: true },
    });
    await prisma.returnedReceipt.update({
      where: { id: outbox.receiptId },
      data: { status: "ERROR_WHATSAPP" },
    });
    await recordStatusChange({
      receiptId: outbox.receiptId,
      fromStatus: oldStatus?.status || null,
      toStatus: "ERROR_WHATSAPP",
      reason: `WhatsApp fallit després de ${outbox.attempts} intents: ${result.error}`,
      actorType: "SYSTEM",
    });

    logger.error({ outboxId, error: result.error }, "WhatsApp fallit definitivament");
    return true;
  }

  // Tornar a PENDING per reintent
  await prisma.whatsappOutbox.update({
    where: { id: outboxId },
    data: {
      status: "PENDING",
      lastError: result.error || "Error desconegut",
    },
  });

  logger.warn({ outboxId, attempt: outbox.attempts, error: result.error }, "WhatsApp fallit, es reintentarà");
  return false;
}

// Worker: processa tots els PENDING
function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min) * 1000;
}

let running = false;

export async function processOutbox(): Promise<{ processed: number; sent: number; failed: number }> {
  if (running) {
    logger.info("Worker ja en execució, saltant");
    return { processed: 0, sent: 0, failed: 0 };
  }

  running = true;
  let processed = 0;
  let sent = 0;
  let failed = 0;

  try {
    const pending = await prisma.whatsappOutbox.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: 10,
    });

    for (const item of pending) {
      const success = await processOne(item.id);
      processed++;

      if (success) {
        // Comprovar si es va enviar o fallar
        const updated = await prisma.whatsappOutbox.findUnique({
          where: { id: item.id },
          select: { status: true },
        });
        if (updated?.status === "SENT") sent++;
        else if (updated?.status === "FAILED") failed++;
      }

      // Delay entre enviaments (8-20s)
      if (processed < pending.length) {
        await new Promise((resolve) => setTimeout(resolve, randomDelay(8, 20)));
      }
    }
  } catch (err: any) {
    logger.error({ err }, "Error processant outbox");
  } finally {
    running = false;
  }

  return { processed, sent, failed };
}

// Processa un sol missatge (per endpoints d'acció manual)
export async function processOneMessage(outboxId: number): Promise<{ success: boolean; status?: string; error?: string }> {
  const outbox = await prisma.whatsappOutbox.findUnique({ where: { id: outboxId } });
  if (!outbox) return { success: false, error: "Missatge no trobat" };
  if (outbox.status === "SENT") return { success: true, status: "SENT" };
  if (outbox.status === "FAILED") return { success: false, status: "FAILED", error: outbox.lastError || "Error desconegut" };

  const success = await processOne(outboxId);
  const updated = await prisma.whatsappOutbox.findUnique({
    where: { id: outboxId },
    select: { status: true, lastError: true },
  });

  return {
    success: updated?.status === "SENT",
    status: updated?.status,
    error: updated?.lastError || undefined,
  };
}

// Obtenir estat de la cua
export async function getOutboxStats(): Promise<{
  pending: number;
  sending: number;
  sent: number;
  failed: number;
  cancelled: number;
}> {
  const [pending, sending, sent, failed, cancelled] = await Promise.all([
    prisma.whatsappOutbox.count({ where: { status: "PENDING" } }),
    prisma.whatsappOutbox.count({ where: { status: "SENDING" } }),
    prisma.whatsappOutbox.count({ where: { status: "SENT" } }),
    prisma.whatsappOutbox.count({ where: { status: "FAILED" } }),
    prisma.whatsappOutbox.count({ where: { status: "CANCELLED" } }),
  ]);

  return { pending, sending, sent, failed, cancelled };
}
