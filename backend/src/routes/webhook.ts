// Webhook d'OpenWA — rep missatges entrants
// Ordre de processament:
//   1. Validar secret
//   2. Identificar client
//   3. Identificar rebut obert
//   4. Guardar missatge entrant
//   5. Descarregar media (si n'hi ha)
//   6. Guardar fitxer → PaymentProof (només si OK)
//   7. Classificar missatge
//   8. Anti-repetició (30 min, 3 consecutius fora de flux)
//   9. Actualitzar estat del rebut
//  10. Enviar resposta (via outbox)
//  11. Guardar missatge sortint
//  12. Registrar errors sense trencar

import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { config } from "../lib/config";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";
import { classify } from "../services/messageClassifier";
import { downloadMedia, saveProof } from "../services/proofService";
import {
  getReplyTemplate,
  render,
  TEMPLATE_TECHNICAL_ERROR,
  TEMPLATE_PROOF_SAVE_ERROR,
} from "../services/replyTemplates";
import { enqueueMessage, processOneMessage } from "../services/outboxService";
import { recordStatusChange } from "../services/statusHistory";
import { openwa } from "../connectors/OpenWAConnector";

const router = Router();

// Intents que són "fora de flux" (respostes de derivació, no fan avançar el procés)
// greeting_or_identity, question_about_debt, complaint_or_problem i unknown
// Compten pel límit de 3 consecutius → REVISAR
const OUT_OF_FLOW_INTENTS = new Set([
  "unknown",
  "greeting_or_identity",
  "question_about_debt",
  "complaint_or_problem",
  "pending_review_status",
]);

// Anti-repetició: temps mínim entre dues respostes amb la mateixa plantilla (ms)
const ANTI_REPEAT_WINDOW_MS = 30 * 60 * 1000; // 30 minuts

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

// Comprova si ja s'ha enviat la mateixa plantilla recentment
async function wasRecentlyReplied(
  receiptId: number,
  intent: string,
  windowMs: number,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - windowMs);

  const recent = await prisma.message.findFirst({
    where: {
      receiptId,
      direction: "OUTBOUND",
      agentIntent: intent,
      sentAt: { gte: cutoff },
    },
    orderBy: { sentAt: "desc" },
  });

  return !!recent;
}

// Compta quants missatges consecutius fora de flux hi ha
async function countConsecutiveOutOfFlow(receiptId: number): Promise<number> {
  const recentMessages = await prisma.message.findMany({
    where: { receiptId, direction: "OUTBOUND" },
    orderBy: { sentAt: "desc" },
    take: 10,
  });

  let count = 0;
  for (const msg of recentMessages) {
    if (msg.agentIntent && OUT_OF_FLOW_INTENTS.has(msg.agentIntent)) {
      count++;
    } else {
      break; // Trencar al primer missatge que NO sigui fora de flux
    }
  }
  return count;
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
          "PENDENT_REVISIO",
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

  // === 6. Extreure i guardar media ===
  // OpenWA envia el media al webhook amb:
  //   media.mimetype  → MIME type (ex: "image/jpeg")
  //   media.filename  → nom original (opcional)
  //   media.data      → contingut del fitxer en base64
  // NO envia media.url ni media.base64.
  let proofSaved = false;
  let mediaType: string | undefined;
  let proofId: number | undefined;
  let proofSaveError: string | undefined;

  if (media) {
    try {
      // 6a. Detectar MIME type (OpenWA: mimetype, whatsapp-web.js: mimeType)
      let detectedMimeType: string | undefined =
        media.mimetype || media.mimeType || media.type || undefined;
      const filename = media.filename || undefined;

      logger.info({
        receiptId,
        mediaKeys: Object.keys(media),
        detectedMimeType,
        filename,
        hasData: !!media.data,
        dataLen: typeof media.data === "string" ? media.data.length : (media.data ? "non-string" : undefined),
      }, "Media rebut al webhook");

      // 6b. Extreure buffer del camp data (base64)
      let fileBuffer: Buffer | null = null;

      if (media.data) {
        if (typeof media.data === "string") {
          fileBuffer = Buffer.from(media.data, "base64");
        } else if (Buffer.isBuffer(media.data)) {
          fileBuffer = media.data;
        } else if (typeof media.data === "object") {
          // Podria ser un objecte amb propietats (poc probable)
          logger.warn({ receiptId, dataType: typeof media.data, dataKeys: Object.keys(media.data) }, "media.data és un objecte, no string/base64 — format inesperat");
          fileBuffer = null;
        }
      }

      // 6c. Fallback 1: media.url (pot existir en versions futures d'OpenWA)
      if ((!fileBuffer || fileBuffer.length === 0) && media.url) {
        logger.info({ receiptId, url: String(media.url).substring(0, 100) }, "Intentant descàrrega per URL (fallback)");
        const { apiKey } = await openwa.getConfig();
        const download = await downloadMedia(media.url, apiKey);
        if (download.success && download.buffer && download.buffer.length > 0) {
          fileBuffer = download.buffer;
          if (!detectedMimeType && download.mimeType) detectedMimeType = download.mimeType;
        } else {
          logger.warn({ receiptId, error: download.error }, "Fallback URL també ha fallat");
        }
      }

      // 6d. Fallback 2: media.base64 (format antic)
      if ((!fileBuffer || fileBuffer.length === 0) && media.base64) {
        logger.info({ receiptId }, "Intentant descodificar base64 (fallback)");
        fileBuffer = Buffer.from(media.base64, "base64");
      }

      // 6e. Inferir MIME de l'extensió si encara no el tenim
      if (!detectedMimeType || detectedMimeType === "application/octet-stream") {
        const fname = filename || "";
        if (/\.jpe?g$/i.test(fname)) detectedMimeType = "image/jpeg";
        else if (/\.png$/i.test(fname)) detectedMimeType = "image/png";
        else if (/\.webp$/i.test(fname)) detectedMimeType = "image/webp";
        else if (/\.gif$/i.test(fname)) detectedMimeType = "image/gif";
        else if (/\.pdf$/i.test(fname)) detectedMimeType = "application/pdf";
        if (detectedMimeType && detectedMimeType !== "application/octet-stream") {
          logger.info({ receiptId, filename, detectedMimeType }, "MIME inferit de l'extensió");
        }
      }

      mediaType = detectedMimeType;

      // 6f. Guardar fitxer i crear PaymentProof
      if (fileBuffer && fileBuffer.length > 0) {
        logger.info({ receiptId, bufferSize: fileBuffer.length, mimeType: detectedMimeType }, "Buffer extret, guardant proof...");
        const result = await saveProof({
          receiptId,
          messageId: inboundMsg.id,
          originalName: filename,
          mimeType: detectedMimeType || "application/octet-stream",
          buffer: fileBuffer,
        });

        if (result.success) {
          proofSaved = true;
          proofId = result.proofId;
          logger.info({ receiptId, proofId, sha256: result.sha256, sizeBytes: result.sizeBytes }, "Proof guardat correctament");
        } else {
          proofSaveError = result.error;
          logger.warn({ receiptId, error: result.error, mimeType: detectedMimeType, bufferSize: fileBuffer.length }, "saveProof ha fallat");
        }
      } else {
        proofSaveError = "Buffer buit o nul després d'intentar totes les fonts (data, url, base64)";
        logger.warn({
          receiptId,
          hasData: !!media.data,
          hasUrl: !!media.url,
          hasBase64: !!media.base64,
          dataType: typeof media.data,
        }, "Media rebut però buffer buit — comprova format del payload d'OpenWA");
      }
    } catch (err: any) {
      proofSaveError = err.message;
      logger.error({ err, receiptId, mediaKeys: Object.keys(media) }, "Excepció processant media");
    }
  }

  // === 8. Obtenir context del rebut (per classificació contextual) ===
  const existingProofCount = await prisma.paymentProof.count({
    where: { receiptId, status: "RECEIVED" },
  });
  const currentStatus = openReceipt.status;
  const hasExistingProof = existingProofCount > 0;

  // === 9. Classificar missatge amb informació real + context ===
  const classification = classify({
    body: text || "",
    hasMedia: !!media,
    mediaType,
    proofSaved,
    currentStatus,
    hasExistingProof,
  });

  logger.info({
    receiptId,
    intent: classification.intent,
    proofSaved,
    mediaType,
    proofSaveError,
  }, "Classificació");

  // === 9. Anti-repetició ===
  // Nota: proof_media i errors de guardat NO estan subjectes a anti-repetició
  // (són respostes operacionals, no canned responses)

  const isProofRelated =
    classification.intent === "proof_media" ||
    classification.intent === "additional_proof_received" ||
    (!!media && !proofSaved && !!proofSaveError && !(mediaType?.startsWith("audio/") || mediaType === "audio/ogg; codecs=opus"));

  let shouldActuallyReply = classification.shouldReply;
  let forceRevisar = false;

  if (!isProofRelated) {
    // 9a. Comprovar si ja s'ha respost amb la mateixa plantilla recentment
    const alreadyReplied = await wasRecentlyReplied(receiptId, classification.intent, ANTI_REPEAT_WINDOW_MS);

    // 9b. Comprovar límit de 3 missatges consecutius fora de flux
    const outOfFlowCount = await countConsecutiveOutOfFlow(receiptId);
    const isOutOfFlow = OUT_OF_FLOW_INTENTS.has(classification.intent);
    const exceededOutOfFlowLimit = isOutOfFlow && outOfFlowCount >= 3;

    if (alreadyReplied) {
      logger.info({ receiptId, intent: classification.intent }, "Anti-repetició: mateixa plantilla ja enviada fa <30 min");
      shouldActuallyReply = false;
    }

    if (exceededOutOfFlowLimit) {
      logger.info({ receiptId, outOfFlowCount }, "Anti-repetició: 3+ missatges consecutius fora de flux → REVISAR");
      forceRevisar = true;
      shouldActuallyReply = false; // Deixar de respondre automàticament
    }
  }

  // === 10. Actualitzar estat del rebut ===
  try {
    const updateData: any = {};
    const newNotes: string[] = [];
    const currentNotes = openReceipt.notes || "";

    if (classification.shouldMarkPendentRevisio) {
      // proof_media guardat correctament → PENDENT_REVISIO
      updateData.status = "PENDENT_REVISIO";
      updateData.proofReceivedAt = new Date();
      newNotes.push("[Justificant rebut via WhatsApp — pendent de revisió]");
    } else if (classification.shouldMarkJustificantRebut) {
      // Legacy: no s'hauria d'usar, però mantenim per compatibilitat
      updateData.status = "JUSTIFICANT_REBUT";
      updateData.proofReceivedAt = new Date();
      newNotes.push("[Justificant rebut via WhatsApp]");
    } else if (classification.shouldMarkPagamentDeclarat) {
      // Client declara pagament sense justificant → PAGAMENT_DECLARAT
      updateData.status = "PAGAMENT_DECLARAT";
      newNotes.push("[Client declara pagament sense justificant]");
    } else if (classification.shouldMarkEsperantJustificant) {
      // Promesa de pagament futur → ESPERANT_JUSTIFICANT
      updateData.status = "ESPERANT_JUSTIFICANT";
      newNotes.push("[Client promet pagament futur]");
    } else if (classification.shouldMarkRevisar || forceRevisar) {
      updateData.status = "REVISAR";
      if (forceRevisar) {
        newNotes.push("[Derivat a revisió: 3+ missatges consecutius fora de flux]");
      } else {
        newNotes.push(`[Derivat a revisió: ${classification.intent}]`);
      }
    }

    // Filtrar notes que ja existeixen (evitar duplicats en converses llargues)
    const dedupedNotes = newNotes.filter((n) => !currentNotes.includes(n));
    if (dedupedNotes.length > 0) {
      updateData.notes = currentNotes
        ? `${currentNotes} ${dedupedNotes.join(" ")}`
        : dedupedNotes.join(" ");
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
          reason: `Webhook: ${classification.intent}${forceRevisar ? " (anti-repetició)" : ""}`,
          actorType: "OPENWA",
        });
      }
    }
  } catch (err: any) {
    logger.error({ err, receiptId }, "Error actualitzant estat del rebut");
  }

  // === 11. Enviar resposta (via outbox) ===
  if (shouldActuallyReply && client.whatsapp) {
    try {
      // Determinar quina plantilla usar
      let replyText: string;

      // Si hi ha hagut media però no s'ha pogut guardar, usar plantilla d'error
      const isAudioMedia = mediaType?.startsWith("audio/") || mediaType === "audio/ogg; codecs=opus";
      if (media && !proofSaved && proofSaveError && !isAudioMedia) {
        // Buscar plantilla d'error custom
        const custom = await prisma.appSettings.findUnique({ where: { key: "template_proof_media_error" } });
        replyText = custom?.value?.trim() || TEMPLATE_PROOF_SAVE_ERROR;
        logger.info({ receiptId, proofSaveError }, "Usant plantilla d'error de guardat de fitxer");
      } else {
        // Buscar plantilla custom per aquest intent
        const templateKey = `template_${classification.intent}`;
        const custom = await prisma.appSettings.findUnique({ where: { key: templateKey } });
        replyText = custom?.value?.trim() || getReplyTemplate(classification.intent);
        // Renderitzar {{company_name}} si cal
        if (replyText.includes("{{company_name}}")) {
          const nameSetting = await prisma.appSettings.findUnique({ where: { key: "company_name" } });
          replyText = render(replyText, { company_name: nameSetting?.value || "l'empresa" });
        }
      }

      // Guardar el missatge sortint PRIMER (abans d'enviar)
      // Així queda registre encara que processOneMessage falli
      const outboundMsg = await prisma.message.create({
        data: {
          receiptId,
          direction: "OUTBOUND",
          content: replyText,
          status: "pending",
          agentIntent: classification.intent,
          agentAction: classification.intent,
        },
      });

      // Encuar i processar
      let outboxId: number | null = null;
      try {
        outboxId = await enqueueMessage({
          receiptId,
          clientId: client.id,
          phone: client.whatsapp,
          message: replyText,
        });
      } catch (err: any) {
        logger.error({ err, receiptId }, "Error encuant missatge a outbox");
      }

      if (outboxId) {
        try {
          const sent = await processOneMessage(outboxId);
          // Actualitzar estat del missatge
          await prisma.message.update({
            where: { id: outboundMsg.id },
            data: { status: sent.success ? "sent" : "failed" },
          });
          logger.info({ receiptId, outboxId, sent: sent.success }, "Resposta processada via outbox");
        } catch (err: any) {
          logger.error({ err, receiptId, outboxId }, "Error processant outbox");
          await prisma.message.update({
            where: { id: outboundMsg.id },
            data: { status: "failed" },
          });
        }
      } else {
        // Sense outbox (rebut tancat/confirmat)
        await prisma.message.update({
          where: { id: outboundMsg.id },
          data: { status: "failed" },
        });
        logger.warn({ receiptId }, "Missatge no encuat (outboxId=0)");
      }
    } catch (err: any) {
      logger.error({ err, receiptId }, "Error preparant resposta");
    }
  } else if (!shouldActuallyReply) {
    logger.info({ receiptId, intent: classification.intent }, "Resposta suprimida per anti-repetició");
  }

  // === 12. Resposta OK (sempre, perquè OpenWA no reenvii) ===
  res.status(200).json({
    status: "ok",
    classified: classification.intent,
    proofSaved,
    replied: shouldActuallyReply,
  });
}));

export default router;
