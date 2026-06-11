import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { config } from "../lib/config";
import { logger } from "../lib/logger";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const router = Router();

// OpenWA webhook for incoming messages
// OpenWA sends JSON (not multipart), but may include media via base64 or URL in the body
router.post("/", async (req: Request, res: Response) => {
  // Verify webhook secret
  if (req.query.secret !== config.webhookSecret) {
    return res.status(403).json({ error: "Accés no autoritzat" });
  }

  const from = req.body.from || "";
  const text = req.body.body || "";
  const media = req.body.media; // OpenWA may send media object with url/base64

  // Clean WhatsApp ID: remove @c.us suffix if present
  const cleanPhone = from.replace(/@c\.us$/, "");

  // Find client by WhatsApp number (try both with and without @c.us)
  const client = await prisma.client.findFirst({
    where: { whatsapp: cleanPhone, active: true },
  });

  if (!client) return res.status(200).json({ status: "ignored" });

  // Find open receipts for this client
  const openReceipt = await prisma.returnedReceipt.findFirst({
    where: {
      clientId: client.id,
      status: { in: ["NOTIFICAT", "DETECTAT", "EMPARELLAT", "REVISAR"] },
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

  // If media attached (image/proof), download and save as payment proof
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

        await prisma.returnedReceipt.update({
          where: { id: openReceipt.id },
          data: { status: "JUSTIFICANT_REBUT", proofReceivedAt: new Date() },
        });
      }
    } catch (err) {
      logger.error({ err }, "Error processing webhook media");
    }
  }

  res.status(200).json({ status: "ok" });
});

export default router;
