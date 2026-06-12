import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { auditLog } from "../middleware/auditLog";
import { asyncHandler } from "../middleware/errorHandler";
import { validate, createReceiptSchema, updateReceiptSchema, matchReceiptSchema, manualReplySchema } from "../lib/validation";
import { sendWhatsApp, sendBulkWhatsApp } from "../services/notificationService";
import { classify } from "../services/messageClassifier";
import { getReplyTemplate } from "../services/replyTemplates";
import { enqueueMessage, processOneMessage } from "../services/outboxService";
import { recordStatusChange } from "../services/statusHistory";
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

  const oldReceipt = await prisma.returnedReceipt.findUnique({
    where: { id: parseInt(req.params.id as string) },
    select: { status: true },
  });

  const receipt = await prisma.returnedReceipt.update({
    where: { id: parseInt(req.params.id as string) },
    data: updateData,
  });

  if (updateData.status && oldReceipt && updateData.status !== oldReceipt.status) {
    await recordStatusChange({
      receiptId: receipt.id,
      fromStatus: oldReceipt.status,
      toStatus: updateData.status,
      reason: "Manual update via API",
      actorType: "ADMIN",
    });
  }

  await auditLog("UPDATE_STATUS", "ReturnedReceipt", receipt.id, { from: req.body, to: updateData });
  res.json(receipt);
}));

router.post("/:id/match", asyncHandler(async (req: Request, res: Response) => {
  const v = validate(matchReceiptSchema, req.body);
  if (!v.success) return res.status(400).json({ error: v.error });

  const oldReceipt = await prisma.returnedReceipt.findUnique({
    where: { id: parseInt(req.params.id as string) },
    select: { status: true },
  });

  const receipt = await prisma.returnedReceipt.update({
    where: { id: parseInt(req.params.id as string) },
    data: { clientId: v.data.clientId, invoiceId: v.data.invoiceId, status: "EMPARELLAT" },
  });

  if (oldReceipt && oldReceipt.status !== "EMPARELLAT") {
    await recordStatusChange({
      receiptId: receipt.id,
      fromStatus: oldReceipt.status,
      toStatus: "EMPARELLAT",
      reason: "Match manual",
      actorType: "ADMIN",
    });
  }

  await auditLog("MANUAL_MATCH", "ReturnedReceipt", receipt.id, v.data);
  res.json(receipt);
}));

router.post("/:id/send-whatsapp", asyncHandler(async (req: Request, res: Response) => {
  const result = await sendWhatsApp(parseInt(req.params.id as string));
  if (!result.success) return res.status(400).json({ error: result.error });

  // Processar immediatament l'outbox per enviar el missatge ja
  if (result.outboxId) {
    const sent = await processOneMessage(result.outboxId);
    if (!sent.success) {
      return res.status(400).json({ error: sent.error || "Error enviant WhatsApp" });
    }
  }

  res.json(result);
}));

// Simulate classifier — preview what the classifier would decide without sending
router.post("/:id/simulate-agent", asyncHandler(async (req: Request, res: Response) => {
  const { text, hasMedia, mediaType, proofSaved } = req.body;
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "text requerit" });
  }

  const classification = classify({
    body: text,
    hasMedia: !!hasMedia,
    mediaType: mediaType || undefined,
    proofSaved: !!proofSaved,
  });

  const replyText = getReplyTemplate(classification.intent);

  res.json({
    intent: classification.intent,
    replyText,
    shouldMarkJustificantRebut: classification.shouldMarkJustificantRebut,
    shouldMarkPagamentDeclarat: classification.shouldMarkPagamentDeclarat,
    shouldMarkRevisar: classification.shouldMarkRevisar,
  });
}));

// Execute agent — classifies and sends reply via outbox
router.post("/:id/execute-agent", asyncHandler(async (req: Request, res: Response) => {
  const { text, hasMedia, mediaType, proofSaved } = req.body;
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

  // Save the INBOUND message
  await prisma.message.create({
    data: {
      receiptId: receipt.id,
      direction: "INBOUND",
      content: text.trim(),
    },
  });

  // Classify
  const classification = classify({
    body: text.trim(),
    hasMedia: !!hasMedia,
    mediaType: mediaType || undefined,
    proofSaved: !!proofSaved,
  });

  const replyText = getReplyTemplate(classification.intent);

  // Encuar resposta via outbox
  let outboxId: number | null = null;
  try {
    outboxId = await enqueueMessage({
      receiptId: receipt.id,
      clientId: receipt.client.id,
      phone: receipt.client.whatsapp,
      message: replyText,
    });
  } catch (err: any) {
    // continue — outbox failure is not fatal
  }

  // Save OUTBOUND message
  await prisma.message.create({
    data: {
      receiptId: receipt.id,
      direction: "OUTBOUND",
      content: replyText,
      status: outboxId ? "queued" : "failed",
      agentIntent: classification.intent,
      agentAction: classification.intent,
      needsReview: classification.shouldMarkRevisar,
    },
  });

  // Update receipt status
  const updateData: any = {};
  if (classification.shouldMarkJustificantRebut) {
    updateData.status = "JUSTIFICANT_REBUT";
    updateData.proofReceivedAt = new Date();
  } else if (classification.shouldMarkPagamentDeclarat) {
    updateData.status = "PAGAMENT_DECLARAT";
  } else if (classification.shouldMarkRevisar) {
    updateData.status = "REVISAR";
  }

  const currentNotes = receipt.notes || "";
  const conversationNote = `[Classificat: ${classification.intent}]`;
  updateData.notes = currentNotes ? `${currentNotes} ${conversationNote}` : conversationNote;

  await prisma.returnedReceipt.update({
    where: { id: receipt.id },
    data: updateData,
  });

  await auditLog("EXECUTE_AGENT", "ReturnedReceipt", receipt.id, {
    intent: classification.intent,
    outboxId,
  });

  res.json({
    success: true,
    outboxId,
    intent: classification.intent,
    replyText,
    newStatus: updateData.status || receipt.status,
  });
}));

router.post("/send-bulk-whatsapp", asyncHandler(async (req: Request, res: Response) => {
  const { receiptIds } = req.body;
  if (!receiptIds || !Array.isArray(receiptIds) || receiptIds.length < 2) {
    return res.status(400).json({ error: "Cal un array receiptIds amb almenys 2 IDs" });
  }
  const result = await sendBulkWhatsApp(receiptIds);
  if (!result.success) return res.status(400).json({ error: result.error });

  // Processar immediatament
  if (result.outboxIds) {
    for (const outboxId of result.outboxIds) {
      await processOneMessage(outboxId);
    }
  }

  res.json(result);
}));

router.post("/:id/proof", proofUpload.single("file"), asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "Fitxer requerit" });

  const proof = await prisma.paymentProof.create({
    data: {
      receiptId: parseInt(req.params.id as string),
      storagePath: req.file.path,
      status: "RECEIVED",
    },
  });

  const receiptId = parseInt(req.params.id as string);
  const oldReceipt = await prisma.returnedReceipt.findUnique({
    where: { id: receiptId },
    select: { status: true },
  });

  await prisma.returnedReceipt.update({
    where: { id: receiptId },
    data: { status: "JUSTIFICANT_REBUT", proofReceivedAt: new Date() },
  });

  if (oldReceipt && oldReceipt.status !== "JUSTIFICANT_REBUT") {
    await recordStatusChange({
      receiptId,
      fromStatus: oldReceipt.status,
      toStatus: "JUSTIFICANT_REBUT",
      reason: "Justificant pujat manualment",
      actorType: "ADMIN",
    });
  }

  await auditLog("UPLOAD_PROOF", "ReturnedReceipt", receiptId);
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

  // Encuar resposta manual via outbox
  const outboxId = await enqueueMessage({
    receiptId: receipt.id,
    clientId: receipt.client.id,
    phone: receipt.client.whatsapp,
    message: v.data.text.trim(),
  });

  // Guardar al historial de missatges
  const message = await prisma.message.create({
    data: {
      receiptId: receipt.id,
      direction: "OUTBOUND",
      content: v.data.text.trim(),
      status: outboxId ? "queued" : "failed",
    },
  });

  await auditLog("MANUAL_REPLY", "ReturnedReceipt", receipt.id, {
    text: v.data.text.trim(),
    outboxId,
  });

  res.json({ success: true, message, outboxId });
}));

router.delete("/:id", asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  await prisma.message.deleteMany({ where: { receiptId: id } });
  await prisma.paymentProof.deleteMany({ where: { receiptId: id } });
  await prisma.reconciliationMatch.deleteMany({ where: { receiptId: id } });
  await prisma.matchCandidate.deleteMany({ where: { receiptId: id } });
  await prisma.whatsappOutbox.deleteMany({ where: { receiptId: id } });
  await prisma.caseNote.deleteMany({ where: { receiptId: id } });
  await prisma.returnedReceiptStatusHistory.deleteMany({ where: { receiptId: id } });
  await prisma.returnedReceipt.delete({ where: { id } });
  await auditLog("DELETE", "ReturnedReceipt", id);
  res.status(204).send();
}));

export default router;
