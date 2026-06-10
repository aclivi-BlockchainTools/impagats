import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import multer from "multer";
import path from "path";

const upload = multer({ dest: path.join(__dirname, "../../uploads/webhook") });
const router = Router();

// OpenWA webhook for incoming messages
router.post("/", upload.single("file"), async (req: Request, res: Response) => {
  const { from, body, type } = req.body;

  // Find client by WhatsApp number
  const client = await prisma.client.findFirst({
    where: { whatsapp: from, active: true },
  });

  if (!client) return res.status(200).json({ status: "ignored" });

  // Find open receipts for this client
  const openReceipt = await prisma.returnedReceipt.findFirst({
    where: {
      clientId: client.id,
      status: { in: ["NOTIFIED", "DETECTED", "MATCHED", "NEEDS_REVIEW"] },
    },
    orderBy: { returnDate: "desc" },
  });

  if (!openReceipt) return res.status(200).json({ status: "ignored" });

  // Save incoming message
  await prisma.message.create({
    data: {
      receiptId: openReceipt.id,
      direction: "INBOUND",
      content: body || "",
    },
  });

  // If file attached, save as payment proof
  if (req.file) {
    await prisma.paymentProof.create({
      data: {
        receiptId: openReceipt.id,
        filePath: req.file.path,
        status: "RECEIVED",
      },
    });

    await prisma.returnedReceipt.update({
      where: { id: openReceipt.id },
      data: { status: "PROOF_RECEIVED", proofReceivedAt: new Date() },
    });
  }

  res.status(200).json({ status: "ok" });
});

export default router;
