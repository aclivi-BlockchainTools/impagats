import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { config } from "../lib/config";
import { logger } from "../lib/logger";
import { openwa } from "../connectors/OpenWAConnector";
import { handleIncomingMessage, checkConversationTimeout } from "../services/conversationAgent";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  // Verify webhook secret
  if (req.query.secret !== config.webhookSecret) {
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

  // Find open receipts for this client
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
      // Check for timeout on ESPERANT_DETALLS
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

      // Send agent response via WhatsApp
      await openwa.sendMessage(cleanPhone, result.replyText);

      // Save agent message
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

      // Update receipt status if needed
      const updateData: any = {};
      if (result.receiptNewStatus) {
        updateData.status = result.receiptNewStatus;
        updateData.proofReceivedAt = new Date();
      }
      // Track conversation state in notes
      const currentNotes = openReceipt.notes || "";
      const conversationNote = `[Agent: ${result.intent} → ${result.action}]`;
      updateData.notes = currentNotes ? `${currentNotes} ${conversationNote}` : conversationNote;

      await prisma.returnedReceipt.update({
        where: { id: openReceipt.id },
        data: updateData,
      });
    } catch (err) {
      logger.error({ err, receiptId: openReceipt.id }, "Agent error");
      // Don't block — the message was already saved
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
});

export default router;
