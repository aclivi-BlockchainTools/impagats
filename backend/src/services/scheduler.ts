// Scheduler en segon pla: outbox retry, promeses vençudes, timeout agent, recordatoris
// Tick configurable via AppSettings (amb fallback a env i defaults).
// S'engega des de index.ts (no des d'app.ts per evitar que els tests l'arrenquin).

import prisma from "../lib/prisma";
import { logger } from "../lib/logger";
import { processOutbox } from "./outboxService";
import { enqueueMessage } from "./outboxService";
import { recordStatusChange } from "./statusHistory";
import { render, filterByLanguage, TEMPLATE_REMINDER, TemplateVars } from "./replyTemplates";

let intervalId: ReturnType<typeof setInterval> | null = null;

// --- Config ---
async function getSchedulerConfig(): Promise<{
  enabled: boolean;
  intervalMinutes: number;
  agentTimeoutHours: number;
  reminderIntervalDays: number;
  reminderMax: number;
}> {
  const settings = await prisma.appSettings.findMany();
  const get = (key: string, envKey: string, fallback: string): string => {
    const db = settings.find((s) => s.key === key);
    return db?.value || process.env[envKey] || fallback;
  };

  return {
    enabled: get("scheduler_enabled", "SCHEDULER_ENABLED", "true") !== "false",
    intervalMinutes: parseInt(get("scheduler_interval_minutes", "SCHEDULER_INTERVAL_MINUTES", "5")),
    agentTimeoutHours: parseInt(get("agent_timeout_hours", "AGENT_TIMEOUT_HOURS", "48")),
    reminderIntervalDays: parseInt(get("reminder_interval_days", "REMINDER_INTERVAL_DAYS", "4")),
    reminderMax: parseInt(get("reminder_max", "REMINDER_MAX", "2")),
  };
}

// --- Tick ---
export async function schedulerTick(now: Date = new Date()): Promise<{
  outboxProcessed: number;
  outboxSent: number;
  outboxFailed: number;
  promisesBroken: number;
  agentTimeouts: number;
  remindersSent: number;
}> {
  let outboxProcessed = 0, outboxSent = 0, outboxFailed = 0;
  let promisesBroken = 0, agentTimeouts = 0, remindersSent = 0;

  // 1. Outbox — processar PENDING amb backoff
  try {
    const result = await processOutbox();
    outboxProcessed = result.processed;
    outboxSent = result.sent;
    outboxFailed = result.failed;
  } catch (err: any) {
    logger.error({ err }, "[scheduler] Error processant outbox");
  }

  // 2. Promeses vençudes
  try {
    const brokenPromises = await prisma.paymentPromise.findMany({
      where: {
        status: "ACTIVE",
        promisedDate: { lt: now },
        receipt: {
          status: { notIn: ["PAGAMENT_CONFIRMAT", "TANCAT"] },
        },
      },
      include: { receipt: { select: { id: true, status: true, notes: true } } },
    });

    for (const p of brokenPromises) {
      await prisma.paymentPromise.update({
        where: { id: p.id },
        data: { status: "BROKEN" },
      });

      const promisedStr = p.promisedDate
        ? new Date(p.promisedDate).toLocaleDateString("ca-ES")
        : "data desconeguda";

      await prisma.returnedReceipt.update({
        where: { id: p.receiptId },
        data: {
          status: "REVISAR",
          notes: `${p.receipt?.notes || ""}\n[Promesa vençuda — el client va dir que pagaria abans del ${promisedStr}]`.trim(),
        },
      });

      await recordStatusChange({
        receiptId: p.receiptId,
        fromStatus: p.receipt?.status || null,
        toStatus: "REVISAR",
        reason: `Promesa vençuda (promisedDate: ${promisedStr})`,
        actorType: "SYSTEM",
      });

      promisesBroken++;
    }

    if (promisesBroken > 0) {
      logger.info({ count: promisesBroken }, "[scheduler] Promeses vençudes processades");
    }
  } catch (err: any) {
    logger.error({ err }, "[scheduler] Error processant promeses");
  }

  // 3. Timeout d'agent
  try {
    const config = await getSchedulerConfig();
    const timeoutAgo = new Date(now.getTime() - config.agentTimeoutHours * 60 * 60 * 1000);

    const timedOutReceipts = await prisma.returnedReceipt.findMany({
      where: {
        status: { in: ["ESPERANT_JUSTIFICANT", "PAGAMENT_DECLARAT"] },
        updatedAt: { lt: timeoutAgo },
      },
    });

    for (const r of timedOutReceipts) {
      await prisma.returnedReceipt.update({
        where: { id: r.id },
        data: {
          status: "REVISAR",
          notes: `${r.notes || ""}\n[Timeout agent — sense resposta en ${config.agentTimeoutHours}h]`.trim(),
        },
      });

      await recordStatusChange({
        receiptId: r.id,
        fromStatus: r.status,
        toStatus: "REVISAR",
        reason: `Timeout agent (${config.agentTimeoutHours}h sense resposta)`,
        actorType: "SYSTEM",
      });

      agentTimeouts++;
    }

    if (agentTimeouts > 0) {
      logger.info({ count: agentTimeouts }, "[scheduler] Timeouts d'agent processats");
    }
  } catch (err: any) {
    logger.error({ err }, "[scheduler] Error processant timeouts");
  }

  // 4. Recordatoris
  try {
    const config = await getSchedulerConfig();
    const reminderAgo = new Date(now.getTime() - config.reminderIntervalDays * 24 * 60 * 60 * 1000);

    const reminderCandidates = await prisma.returnedReceipt.findMany({
      where: {
        status: "NOTIFICAT",
        reminderCount: { lt: config.reminderMax },
        client: {
          whatsapp: { not: null },
          whatsappBlocked: false,
          baixa: null,
        },
        messages: { none: { direction: "INBOUND" } },
        OR: [
          // Primer recordatori: esperar X dies des de la notificació
          { AND: [{ lastReminderAt: null }, { notifiedAt: { lt: reminderAgo } }] },
          // Recordatoris posteriors: esperar X dies des de l'últim
          { lastReminderAt: { lt: reminderAgo } },
        ],
      },
      include: {
        client: true,
        invoice: true,
      },
    });

    const settings = await prisma.appSettings.findMany();
    const templateSetting = settings.find((s) => s.key === "whatsapp_template_reminder");
    const nameSetting = settings.find((s) => s.key === "company_name");

    const template = templateSetting?.value?.trim() || TEMPLATE_REMINDER;
    const companyName = nameSetting?.value || "Empresa";

    for (const r of reminderCandidates) {
      const vars: TemplateVars = {
        client_name: r.client!.name,
        invoice_number: r.invoice?.invoiceNumber || r.receiptReference || "N/A",
        amount: r.returnedAmount.toString(),
        service_period: r.servicePeriod || "",
        company_name: companyName,
      };

      const text = filterByLanguage(render(template, vars), r.client?.language);

      await enqueueMessage({
        receiptId: r.id,
        clientId: r.clientId,
        phone: r.client!.whatsapp!,
        message: text,
      });

      await prisma.returnedReceipt.update({
        where: { id: r.id },
        data: {
          reminderCount: r.reminderCount + 1,
          lastReminderAt: now,
        },
      });

      remindersSent++;
    }

    if (remindersSent > 0) {
      logger.info({ count: remindersSent }, "[scheduler] Recordatoris encuats");
    }
  } catch (err: any) {
    logger.error({ err }, "[scheduler] Error processant recordatoris");
  }

  return { outboxProcessed, outboxSent, outboxFailed, promisesBroken, agentTimeouts, remindersSent };
}

// --- Arrencar / aturar ---
export function startScheduler(): void {
  if (intervalId) return;

  // Tick inicial al cap de 10s (esperar que el servidor estigui llest)
  setTimeout(async () => {
    try {
      const config = await getSchedulerConfig();
      if (!config.enabled) {
        logger.info("[scheduler] Desactivat per configuració");
        return;
      }

      logger.info({ intervalMinutes: config.intervalMinutes }, "[scheduler] Iniciat");

      // Primer tick immediat
      const summary = await schedulerTick();
      logger.info({ ...summary }, "[scheduler] Tick inicial completat");

      // Ticks periòdics
      intervalId = setInterval(async () => {
        const s = await schedulerTick();
        logger.info({ ...s }, "[scheduler] Tick completat");
      }, config.intervalMinutes * 60 * 1000);
    } catch (err: any) {
      logger.error({ err }, "[scheduler] Error iniciant");
    }
  }, 10000);
}

export function stopScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info("[scheduler] Aturat");
  }
}
