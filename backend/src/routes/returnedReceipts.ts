import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { auditLog } from "../middleware/auditLog";
import { asyncHandler } from "../middleware/errorHandler";
import { validate, createReceiptSchema, updateReceiptSchema, matchReceiptSchema, manualReplySchema } from "../lib/validation";
import { sendWhatsApp, sendBulkWhatsApp } from "../services/notificationService";
import { handleIncomingMessage } from "../services/conversationAgent";
import { openwa } from "../connectors/OpenWAConnector";
import multer from "multer";
import path from "path";

const proofUpload = multer({
  dest: path.join(__dirname, "../../uploads/proofs"),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    cb(null, allowed.includes(file.mimetype));
  },
});

const router = Router();

router.get("/", asyncHandler(async (req: Request, res: Response) => {
  const { status, clientId, minAmount, maxAmount, from, to } = req.query;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
  const skip = (page - 1) * limit;
  const where: any = {};

  if (status) where.status = status as string;
  if (clientId) where.clientId = parseInt(clientId as string);
  if (minAmount || maxAmount) {
    where.returnedAmount = {};
    if (minAmount) where.returnedAmount.gte = parseFloat(minAmount as string);
    if (maxAmount) where.returnedAmount.lte = parseFloat(maxAmount as string);
  }
  if (from || to) {
    where.returnDate = {};
    if (from) where.returnDate.gte = new Date(from as string);
    if (to) where.returnDate.lte = new Date(to as string);
  }

  const [receipts, total] = await Promise.all([
    prisma.returnedReceipt.findMany({
      where,
      skip,
      take: limit,
      include: { client: true, invoice: true, bankMovement: true },
      orderBy: { returnDate: "desc" },
    }),
    prisma.returnedReceipt.count({ where }),
  ]);
  res.json({ data: receipts, total, page, limit });
}));

router.post("/", asyncHandler(async (req: Request, res: Response) => {
  const v = validate(createReceiptSchema, req.body);
  if (!v.success) return res.status(400).json({ error: v.error });

  const { clientId, invoiceId, returnedAmount, returnDate, receiptDate, receiptReference, returnReason, notes } = v.data;

  const rawData: any = { manual: true };
  if (receiptDate) rawData.Valor = receiptDate;

  // Calculate service period from receiptDate (month before)
  let servicePeriod: string | null = null;
  if (receiptDate) {
    const months = ["Gener", "Febrer", "Març", "Abril", "Maig", "Juny",
      "Juliol", "Agost", "Setembre", "Octubre", "Novembre", "Desembre"];
    const dm = String(receiptDate).trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (dm) {
      const m = parseInt(dm[2]);
      let y = parseInt(dm[3]);
      if (y < 100) y += 2000;
      const sm = m - 1 < 1 ? 12 : m - 1;
      const sy = m - 1 < 1 ? y - 1 : y;
      servicePeriod = `${months[sm - 1]} ${sy}`;
    }
  }

  const movement = await prisma.bankMovement.create({
    data: {
      rawData,
      concept: receiptReference || returnReason || "Manual",
      amount: -(returnedAmount),
      date: new Date(returnDate),
      reference: receiptReference || null,
      isReturn: true,
    },
  });

  const receipt = await prisma.returnedReceipt.create({
    data: {
      clientId,
      invoiceId: invoiceId || null,
      bankMovementId: movement.id,
      returnedAmount,
      returnDate: new Date(returnDate),
      receiptReference: receiptReference || null,
      returnReason: returnReason || null,
      notes: notes || null,
      servicePeriod,
      status: clientId ? "EMPARELLAT" : "DETECTAT",
    },
  });

  await auditLog("CREATE_MANUAL", "ReturnedReceipt", receipt.id, req.body);
  res.status(201).json(receipt);
}));

router.get("/:id", asyncHandler(async (req: Request, res: Response) => {
  const receipt = await prisma.returnedReceipt.findUnique({
    where: { id: parseInt(req.params.id as string) },
    include: {
      client: true,
      invoice: true,
      bankMovement: true,
      messages: { orderBy: { sentAt: "desc" } },
      proofs: true,
    },
  });
  if (!receipt) return res.status(404).json({ error: "Impagat no trobat" });
  res.json(receipt);
}));

router.put("/:id", asyncHandler(async (req: Request, res: Response) => {
  const v = validate(updateReceiptSchema, req.body);
  if (!v.success) return res.status(400).json({ error: v.error });

  const body = v.data;
  const updateData: any = { ...body };

  if (updateData.returnDate && typeof updateData.returnDate === "string") {
    updateData.returnDate = new Date(updateData.returnDate);
  }
  if (updateData.status === "NOTIFICAT") updateData.notifiedAt = new Date();
  if (updateData.status === "JUSTIFICANT_REBUT") updateData.proofReceivedAt = new Date();
  if (updateData.status === "PAGAMENT_CONFIRMAT") updateData.paymentConfirmedAt = new Date();
  if (updateData.status === "TANCAT") updateData.closedAt = new Date();

  const receipt = await prisma.returnedReceipt.update({
    where: { id: parseInt(req.params.id as string) },
    data: updateData,
  });

  await auditLog("UPDATE_STATUS", "ReturnedReceipt", receipt.id, { from: req.body, to: updateData });
  res.json(receipt);
}));

router.post("/:id/match", asyncHandler(async (req: Request, res: Response) => {
  const v = validate(matchReceiptSchema, req.body);
  if (!v.success) return res.status(400).json({ error: v.error });

  const receipt = await prisma.returnedReceipt.update({
    where: { id: parseInt(req.params.id as string) },
    data: { clientId: v.data.clientId, invoiceId: v.data.invoiceId, status: "EMPARELLAT" },
  });
  await auditLog("MANUAL_MATCH", "ReturnedReceipt", receipt.id, v.data);
  res.json(receipt);
}));

router.post("/:id/send-whatsapp", asyncHandler(async (req: Request, res: Response) => {
  const result = await sendWhatsApp(parseInt(req.params.id as string));
  if (!result.success) return res.status(400).json({ error: result.error });
  res.json(result);
}));

// Simulate agent response — preview what the agent would reply without sending
router.post("/:id/simulate-agent", asyncHandler(async (req: Request, res: Response) => {
  const { text, hasMedia } = req.body;
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "text requerit" });
  }

  const receipt = await prisma.returnedReceipt.findUnique({
    where: { id: parseInt(req.params.id as string) },
    include: { client: true },
  });

  if (!receipt) return res.status(404).json({ error: "Impagat no trobat" });
  if (!receipt.client) return res.status(400).json({ error: "Sense client assignat" });

  const result = await handleIncomingMessage(
    text,
    !!hasMedia,
    receipt.id,
    receipt.client.name,
  );

  res.json({
    intent: result.intent,
    action: result.action,
    replyText: result.replyText,
    receiptNewStatus: result.receiptNewStatus,
    metadata: result.metadata,
  });
}));

// Execute agent — runs the full agent flow and sends the reply via WhatsApp
router.post("/:id/execute-agent", asyncHandler(async (req: Request, res: Response) => {
  const { text } = req.body;
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "text requerit" });
  }

  const receipt = await prisma.returnedReceipt.findUnique({
    where: { id: parseInt(req.params.id as string) },
    include: { client: true },
  });

  if (!receipt) return res.status(404).json({ error: "Impagat no trobat" });
  if (!receipt.client) return res.status(400).json({ error: "Sense client assignat" });
  if (!receipt.client.whatsapp) return res.status(400).json({ error: "Client sense WhatsApp" });

  // Save the simulated INBOUND message
  await prisma.message.create({
    data: {
      receiptId: receipt.id,
      direction: "INBOUND",
      content: text.trim(),
    },
  });

  // Run agent
  const result = await handleIncomingMessage(
    text.trim(),
    false,
    receipt.id,
    receipt.client.name,
  );

  // Send agent reply via WhatsApp (non-blocking — agent result is valid even if send fails)
  let sendResult: { success: boolean; error?: string } = { success: false, error: "No intentat" };
  try {
    sendResult = await openwa.sendMessage(receipt.client.whatsapp, result.replyText);
  } catch (err: any) {
    sendResult = { success: false, error: err.message };
  }

  // Save agent OUTBOUND message (always, even if send failed)
  await prisma.message.create({
    data: {
      receiptId: receipt.id,
      direction: "OUTBOUND",
      content: result.replyText,
      status: sendResult.success ? "sent" : "failed",
      agentIntent: result.intent,
      agentAction: result.action,
      agentMetadata: result.metadata,
      needsReview: result.intent === "altres_temes",
    },
  });

  // Update receipt status
  const updateData: any = {};
  if (result.receiptNewStatus) {
    updateData.status = result.receiptNewStatus;
    if (result.intent === "pagament_clar" || result.intent === "comprovant_enviat") {
      updateData.proofReceivedAt = new Date();
    }
  }
  const currentNotes = receipt.notes || "";
  const conversationNote = `[Agent: ${result.intent} → ${result.action}]`;
  updateData.notes = currentNotes ? `${currentNotes} ${conversationNote}` : conversationNote;

  await prisma.returnedReceipt.update({
    where: { id: receipt.id },
    data: updateData,
  });

  await auditLog("EXECUTE_AGENT", "ReturnedReceipt", receipt.id, {
    intent: result.intent,
    action: result.action,
    sent: sendResult.success,
  });

  res.json({
    success: true,
    whatsappSent: sendResult.success,
    whatsappError: sendResult.error,
    intent: result.intent,
    action: result.action,
    replyText: result.replyText,
    receiptNewStatus: result.receiptNewStatus,
    metadata: result.metadata,
  });
}));

router.post("/send-bulk-whatsapp", asyncHandler(async (req: Request, res: Response) => {
  const { receiptIds } = req.body;
  if (!receiptIds || !Array.isArray(receiptIds) || receiptIds.length < 2) {
    return res.status(400).json({ error: "Cal un array receiptIds amb almenys 2 IDs" });
  }
  const result = await sendBulkWhatsApp(receiptIds);
  if (!result.success) return res.status(400).json({ error: result.error });
  res.json(result);
}));

router.post("/:id/proof", proofUpload.single("file"), asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "Fitxer requerit" });

  const proof = await prisma.paymentProof.create({
    data: {
      receiptId: parseInt(req.params.id as string),
      filePath: req.file.path,
      status: "RECEIVED",
    },
  });

  await prisma.returnedReceipt.update({
    where: { id: parseInt(req.params.id as string) },
    data: { status: "JUSTIFICANT_REBUT", proofReceivedAt: new Date() },
  });

  await auditLog("UPLOAD_PROOF", "ReturnedReceipt", parseInt(req.params.id as string));
  res.status(201).json(proof);
}));

router.post("/:id/reply", asyncHandler(async (req: Request, res: Response) => {
  const v = validate(manualReplySchema, req.body);
  if (!v.success) return res.status(400).json({ error: v.error });

  const receipt = await prisma.returnedReceipt.findUnique({
    where: { id: parseInt(req.params.id as string) },
    include: { client: true },
  });

  if (!receipt) return res.status(404).json({ error: "Impagat no trobat" });
  if (!receipt.client?.whatsapp) return res.status(400).json({ error: "Client sense WhatsApp" });

  const result = await openwa.sendMessage(receipt.client.whatsapp, v.data.text.trim());

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  const message = await prisma.message.create({
    data: {
      receiptId: receipt.id,
      direction: "OUTBOUND",
      content: v.data.text.trim(),
      externalId: result.externalId,
    },
  });

  await prisma.returnedReceipt.update({
    where: { id: receipt.id },
    data: { status: "JUSTIFICANT_REBUT" },
  });

  await auditLog("MANUAL_REPLY", "ReturnedReceipt", receipt.id, { text: v.data.text.trim() });
  res.json({ success: true, message });
}));

router.delete("/:id", asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  await prisma.message.deleteMany({ where: { receiptId: id } });
  await prisma.paymentProof.deleteMany({ where: { receiptId: id } });
  await prisma.reconciliationMatch.deleteMany({ where: { receiptId: id } });
  await prisma.returnedReceipt.delete({ where: { id } });
  await auditLog("DELETE", "ReturnedReceipt", id);
  res.status(204).send();
}));

export default router;
