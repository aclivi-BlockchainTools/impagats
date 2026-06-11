import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { config } from "../lib/config";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";
import { openwa } from "../connectors/OpenWAConnector";
import { handleIncomingMessage, checkConversationTimeout } from "../services/conversationAgent";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const router = Router();

router.post("/", asyncHandler(async (req: Request, res: Response) => {
  // Verify webhook secret if configured
  if (config.webhookSecret && req.query.secret !== config.webhookSecret) {
    return res.status(403).json({ error: "Accés no autoritzat" });
  }

  const from = req.body.from || "";
  const text = req.body.body || "";
  const media = req.body.media;

  const cleanPhone = from.replace(/@c\.us$/, "");

  const client = await prisma.client.findFirst({
    where: { whatsapp: cleanPhone, active: true },
  });

  if (!client) return res.status(200).json({ status: "ignored" });

  const openReceipt = await prisma.returnedReceipt.findFirst({
    where: {
      clientId: client.id,
      status: { in: ["NOTIFICAT", "ESPERANT_DETALLS", "DETECTAT", "EMPARELLAT", "REVISAR"] },
    },
    orderBy: { returnDate: "desc" },
  });

  if (!openReceipt) return res.status(200).json({ status: "ignored" });

  // Save incoming message
  await prisma.message.create({
    data: {
      receiptId: openReceipt.id,
      direction: "INBOUND",
      content: text || "",
    },
  });

  // --- AGENT: only for NOTIFICAT or ESPERANT_DETALLS ---
  const agentEligible = openReceipt.status === "NOTIFICAT" || openReceipt.status === "ESPERANT_DETALLS";

  if (agentEligible) {
    try {
      // Check if agent is globally enabled
      const agentEnabledSetting = await prisma.appSettings.findFirst({ where: { key: "agent.enabled" } });
      if (agentEnabledSetting?.value === "false") {
        logger.info({ receiptId: openReceipt.id }, "Agent desactivat");
        return res.status(200).json({ status: "agent_disabled" });
      }

      if (openReceipt.status === "ESPERANT_DETALLS") {
        const timedOut = await checkConversationTimeout(openReceipt.id);
        if (timedOut) {
          logger.info({ receiptId: openReceipt.id }, "Conversation timeout, agent silenced");
          return res.status(200).json({ status: "timeout" });
        }
      }

      const hasMedia = !!media;
      const result = await handleIncomingMessage(
        text || "",
        hasMedia,
        openReceipt.id,
        client.name,
      );

      await openwa.sendMessage(cleanPhone, result.replyText);

      await prisma.message.create({
        data: {
          receiptId: openReceipt.id,
          direction: "OUTBOUND",
          content: result.replyText,
          agentIntent: result.intent,
          agentAction: result.action,
          agentMetadata: result.metadata,
          needsReview: result.intent === "altres_temes",
        },
      });

      const updateData: any = {};
      if (result.receiptNewStatus) {
        updateData.status = result.receiptNewStatus;
        if (result.intent === "pagament_clar" || result.intent === "comprovant_enviat") {
          updateData.proofReceivedAt = new Date();
        }
      }
      const currentNotes = openReceipt.notes || "";
      const conversationNote = `[Agent: ${result.intent} → ${result.action}]`;
      updateData.notes = currentNotes ? `${currentNotes} ${conversationNote}` : conversationNote;

      await prisma.returnedReceipt.update({
        where: { id: openReceipt.id },
        data: updateData,
      });
    } catch (err) {
      logger.error({ err, receiptId: openReceipt.id }, "Agent error - notificant al client que contacti per vies habituals");
      // Even on error, try to send a fallback message so the debtor isn't ignored
      try {
        const fallbackText = "Gràcies per contactar-nos. Hem tingut un problema tècnic processant el teu missatge. Si us plau, contacta amb nosaltres per les vies de comunicació habituals. Disculpa les molèsties.";
        await openwa.sendMessage(cleanPhone, fallbackText);
        await prisma.message.create({
          data: {
            receiptId: openReceipt.id,
            direction: "OUTBOUND",
            content: fallbackText,
            agentIntent: "altres_temes",
            agentAction: "error_fallback",
            needsReview: true,
          },
        });
        // Mark receipt as REVISAR so user sees there's an issue
        const currentNotes = openReceipt.notes || "";
        await prisma.returnedReceipt.update({
          where: { id: openReceipt.id },
          data: {
            status: "REVISAR",
            notes: currentNotes ? `${currentNotes} [Agent error]` : "[Agent error]",
          },
        });
      } catch (fallbackErr) {
        logger.error({ fallbackErr, receiptId: openReceipt.id }, "Even fallback message failed");
      }
    }
  }

  // Handle media attachments
  if (media) {
    try {
      let fileBuffer: Buffer | null = null;
      let ext = ".jpg";

      if (media.url) {
        const response = await fetch(media.url);
        if (response.ok) {
          fileBuffer = Buffer.from(await response.arrayBuffer());
          ext = path.extname(new URL(media.url).pathname) || ".jpg";
        }
      } else if (media.base64) {
        fileBuffer = Buffer.from(media.base64, "base64");
        ext = media.mimetype ? `.${media.mimetype.split("/")[1]}` : ".jpg";
      }

      if (fileBuffer) {
        const uploadsDir = path.join(__dirname, "../../uploads/webhook");
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const filename = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
        const filePath = path.join(uploadsDir, filename);
        fs.writeFileSync(filePath, fileBuffer);

        await prisma.paymentProof.create({
          data: {
            receiptId: openReceipt.id,
            filePath,
            status: "RECEIVED",
          },
        });
      }
    } catch (err) {
      logger.error({ err }, "Error processing webhook media");
    }
  }

  res.status(200).json({ status: "ok" });
}));

export default router;
