// Webhook d'OpenWA — rep missatges entrants
// Ordre de processament:
//   1. Validar secret
//   2. Identificar client
//   3. Identificar rebut obert
//   4. Guardar missatge entrant
//   5. Descarregar media (si n'hi ha)
//   6. Guardar fitxer → PaymentProof (només si OK)
//   7. Classificar missatge
//   8. Actualitzar estat del rebut
//   9. Enviar resposta (via outbox)
//  10. Guardar missatge sortint
//  11. Registrar errors sense trencar

import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { config } from "../lib/config";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";
import { classify } from "../services/messageClassifier";
import { downloadMedia, saveProof } from "../services/proofService";
import { getReplyTemplate, TEMPLATE_TECHNICAL_ERROR } from "../services/replyTemplates";
import { enqueueMessage, processOneMessage } from "../services/outboxService";
import { recordStatusChange } from "../services/statusHistory";
import { openwa } from "../connectors/OpenWAConnector";

const router = Router();

function validateSecret(req: Request): boolean {
  // Suport per header X-Webhook-Secret (recomanat)
  const headerSecret = req.headers["x-webhook-secret"] || req.headers["X-Webhook-Secret"];
  if (headerSecret && config.webhookSecret) {
    return headerSecret === config.webhookSecret;
  }
  // Compatibilitat amb query string
  if (config.webhookSecret && req.query.secret !== config.webhookSecret) {
    return false;
  }
  if (!config.webhookSecret) return true; // Si no hi ha secret configurat, permetre
  return req.query.secret === config.webhookSecret;
}

router.post("/", asyncHandler(async (req: Request, res: Response) => {
  // === 1. Validar secret ===
  if (!validateSecret(req)) {
    logger.warn("Webhook: secret invàlid");
    return res.status(403).json({ error: "Accés no autoritzat" });
  }

  // === 2. Validar payload bàsic ===
  // OpenWA envia: {event, data: {from, body, media, author, ...}}
  // Per missatges de grup/llista: from=@g.us/@lid, author=numero real
  const data = req.body.data || req.body.payload || req.body;
  const rawFrom = data.from || data.sender || data.chatId || "";
  const author = data.author || data.sender || "";
  // Si és un grup/llista (@g.us, @lid, @broadcast), usar author com a remitent real
  const isGroup = /@(g\.us|lid|broadcast)$/.test(rawFrom);
  const from = isGroup ? (author || rawFrom) : rawFrom;
  const text = data.body || data.message || data.text || "";
  const media = data.media || null;

  if (!from) {
    logger.warn({ rawFrom, author, keys: Object.keys(data) }, "Webhook: sense remitent");
    return res.status(200).json({ status: "ignored", reason: "no_sender" });
  }

  const cleanPhone = from.replace(/@[\w.]+$/, "");

  // === 3. Identificar client ===
  let client = await prisma.client.findFirst({
    where: { whatsapp: cleanPhone, active: true },
  });

  // Si no es troba i el format és @lid/@g.us, intentar resoldre el contacte via OpenWA
  if (!client && /@(lid|g\.us)$/.test(from)) {
    try {
      const { baseUrl, apiKey, sessionId } = await openwa.getConfig();
      const contactRes = await fetch(`${baseUrl}/api/sessions/${sessionId}/contacts/${encodeURIComponent(from)}`, {
        headers: { "X-Api-Key": apiKey },
      });
      if (contactRes.ok) {
        const contact = await contactRes.json() as any;
        if (contact.id) {
          const contactPhone = contact.id.replace(/@[\w.]+$/, "");
          client = await prisma.client.findFirst({
            where: { whatsapp: contactPhone, active: true },
          });
          if (client) {
            logger.info({ from, contactPhone, clientId: client.id }, "Client resolt via OpenWA contact");
          }
        }
      }
    } catch (err: any) {
      logger.warn({ err: err.message, from }, "Error resolent contacte OpenWA");
    }
  }

  if (!client) {
    logger.info({ cleanPhone, from }, "Webhook: client no trobat");
    return res.status(200).json({ status: "ignored", reason: "unknown_client" });
  }

  // === 4. Identificar rebut obert ===
  const openReceipt = await prisma.returnedReceipt.findFirst({
    where: {
      clientId: client.id,
      status: {
        in: [
          "NOTIFICAT", "ESPERANT_JUSTIFICANT", "PAGAMENT_DECLARAT",
          "DETECTAT", "EMPARELLAT", "REVISAR", "JUSTIFICANT_REBUT",
        ],
      },
    },
    orderBy: { returnDate: "desc" },
  });

  if (!openReceipt) {
    logger.info({ clientId: client.id }, "Webhook: sense rebut obert");
    return res.status(200).json({ status: "ignored", reason: "no_open_receipt" });
  }

  const receiptId = openReceipt.id;
  logger.info({ receiptId, from: cleanPhone, hasMedia: !!media }, "Webhook: missatge rebut");

  // === 5. Guardar missatge entrant ===
  const inboundMsg = await prisma.message.create({
    data: {
      receiptId,
      direction: "INBOUND",
      content: text || "(missatge sense text)",
    },
  });

  // === 6. Descarregar i guardar media ===
  let proofSaved = false;
  let mediaType: string | undefined;
  let proofId: number | undefined;

  if (media) {
    try {
      let fileBuffer: Buffer | null = null;
      let detectedMimeType: string | undefined;

      if (media.mimetype) {
        detectedMimeType = media.mimetype;
      }

      if (media.url) {
        const download = await downloadMedia(media.url);
        if (download.success && download.buffer) {
          fileBuffer = download.buffer;
          detectedMimeType = download.mimeType || detectedMimeType;
        } else {
          logger.warn({ receiptId, error: download.error }, "Error descarregant media");
        }
      } else if (media.base64) {
        fileBuffer = Buffer.from(media.base64, "base64");
        if (media.mimetype) detectedMimeType = media.mimetype;
      }

      mediaType = detectedMimeType;

      // === 7. Crear PaymentProof només si el fitxer s'ha descarregat correctament ===
      if (fileBuffer && fileBuffer.length > 0) {
        const result = await saveProof({
          receiptId,
          messageId: inboundMsg.id,
          originalName: media.filename || media.caption || undefined,
          mimeType: detectedMimeType || "application/octet-stream",
          buffer: fileBuffer,
        });

        if (result.success) {
          proofSaved = true;
          proofId = result.proofId;
          logger.info({ receiptId, proofId, sha256: result.sha256 }, "Proof guardat via webhook");
        } else {
          logger.warn({ receiptId, error: result.error }, "Error guardant proof via webhook");
        }
      }
    } catch (err: any) {
      logger.error({ err, receiptId }, "Error processant media del webhook");
    }
  }

  // === 8. Classificar missatge amb informació real ===
  const classification = classify({
    body: text || "",
    hasMedia: !!media,
    mediaType,
    proofSaved,
  });

  logger.info({
    receiptId,
    intent: classification.intent,
    proofSaved,
    mediaType,
  }, "Classificació");

  // === 9. Actualitzar estat del rebut ===
  try {
    const updateData: any = {};
    const newNotes: string[] = [];
    const currentNotes = openReceipt.notes || "";

    if (classification.shouldMarkJustificantRebut) {
      updateData.status = "JUSTIFICANT_REBUT";
      updateData.proofReceivedAt = new Date();
      newNotes.push("[Justificant rebut via WhatsApp]");
    } else if (classification.shouldMarkPagamentDeclarat) {
      updateData.status = "PAGAMENT_DECLARAT";
      newNotes.push("[Client declara pagament sense justificant]");
    } else if (classification.shouldMarkRevisar) {
      updateData.status = "REVISAR";
      newNotes.push(`[Derivat a revisió: ${classification.intent}]`);
    }

    if (newNotes.length > 0) {
      updateData.notes = currentNotes
        ? `${currentNotes} ${newNotes.join(" ")}`
        : newNotes.join(" ");
    }

    if (Object.keys(updateData).length > 0) {
      const oldStatus = openReceipt.status;
      await prisma.returnedReceipt.update({
        where: { id: receiptId },
        data: updateData,
      });
      if (updateData.status && updateData.status !== oldStatus) {
        await recordStatusChange({
          receiptId,
          fromStatus: oldStatus,
          toStatus: updateData.status,
          reason: `Webhook: ${classification.intent}`,
          actorType: "OPENWA",
        });
      }
    }
  } catch (err: any) {
    logger.error({ err, receiptId }, "Error actualitzant estat del rebut");
  }

  // === 10. Enviar resposta (via outbox) ===
  if (classification.shouldReply && client.whatsapp) {
    try {
      const replyText = getReplyTemplate(classification.intent);

      const outboxId = await enqueueMessage({
        receiptId,
        clientId: client.id,
        phone: client.whatsapp,
        message: replyText,
      });

      // Processar immediatament
      if (outboxId) {
        await processOneMessage(outboxId);
      }

      // També guardar el missatge sortint al historial immediatament
      await prisma.message.create({
        data: {
          receiptId,
          direction: "OUTBOUND",
          content: replyText,
          status: outboxId ? "sent" : "failed",
          agentIntent: classification.intent,
          agentAction: classification.intent,
        },
      });
    } catch (err: any) {
      logger.error({ err, receiptId }, "Error encuant resposta");
    }
  }

  // === 11. Resposta OK (sempre, perquè OpenWA no reenvii) ===
  res.status(200).json({
    status: "ok",
    classified: classification.intent,
    proofSaved,
  });
}));

export default router;
