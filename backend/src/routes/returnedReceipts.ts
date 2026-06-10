import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { auditLog } from "../middleware/auditLog";
import { sendWhatsApp } from "../services/notificationService";
import { pick } from "../lib/validation";
import multer from "multer";
import path from "path";

const RECEIPT_UPDATE_FIELDS = ["status", "notes", "clientId", "invoiceId"];
const RECEIPT_CREATE_FIELDS = ["clientId", "invoiceId", "returnedAmount", "returnDate", "receiptDate", "receiptReference", "returnReason", "notes"];

const proofUpload = multer({
  dest: path.join(__dirname, "../../uploads/proofs"),
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    cb(null, allowed.includes(file.mimetype));
  },
});

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  const { status, clientId, minAmount, maxAmount, from, to } = req.query;
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

  const receipts = await prisma.returnedReceipt.findMany({
    where,
    include: { client: true, invoice: true, bankMovement: true },
    orderBy: { returnDate: "desc" },
  });
  res.json(receipts);
});

router.post("/", async (req: Request, res: Response) => {
  const { clientId, invoiceId, returnedAmount, returnDate, receiptDate, receiptReference, returnReason, notes } =
    pick(req.body, RECEIPT_CREATE_FIELDS) as any;

  if (!clientId) return res.status(400).json({ error: "clientId requerit" });
  if (!returnedAmount) return res.status(400).json({ error: "returnedAmount requerit" });
  if (!returnDate) return res.status(400).json({ error: "returnDate requerit" });

  // Build rawData for the placeholder bank movement
  const rawData: any = { manual: true };
  if (receiptDate) rawData.Valor = receiptDate;

  // Create a placeholder bank movement for manual receipts
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
      status: clientId ? "MATCHED" : "DETECTED",
    },
  });

  await auditLog("CREATE_MANUAL", "ReturnedReceipt", receipt.id, req.body);
  res.status(201).json(receipt);
});

router.get("/:id", async (req: Request, res: Response) => {
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
});

router.put("/:id", async (req: Request, res: Response) => {
  const body = pick(req.body, RECEIPT_UPDATE_FIELDS);
  const { status, notes, clientId, invoiceId } = body as any;
  const updateData: any = { status, notes, clientId, invoiceId };

  if (status === "NOTIFIED") updateData.notifiedAt = new Date();
  if (status === "PROOF_RECEIVED") updateData.proofReceivedAt = new Date();
  if (status === "PAYMENT_CONFIRMED") updateData.paymentConfirmedAt = new Date();
  if (status === "CLOSED") updateData.closedAt = new Date();

  const receipt = await prisma.returnedReceipt.update({
    where: { id: parseInt(req.params.id as string) },
    data: updateData,
  });

  await auditLog("UPDATE_STATUS", "ReturnedReceipt", receipt.id, { from: req.body, to: updateData });
  res.json(receipt);
});

router.post("/:id/match", async (req: Request, res: Response) => {
  const { clientId, invoiceId } = pick(req.body, ["clientId", "invoiceId"]) as any;
  const receipt = await prisma.returnedReceipt.update({
    where: { id: parseInt(req.params.id as string) },
    data: { clientId, invoiceId, status: "MATCHED" },
  });
  await auditLog("MANUAL_MATCH", "ReturnedReceipt", receipt.id, { clientId, invoiceId });
  res.json(receipt);
});

router.post("/:id/send-whatsapp", async (req: Request, res: Response) => {
  const result = await sendWhatsApp(parseInt(req.params.id as string));
  if (!result.success) return res.status(400).json({ error: result.error });
  res.json(result);
});

router.post("/:id/proof", proofUpload.single("file"), async (req: Request, res: Response) => {
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
    data: { status: "PROOF_RECEIVED", proofReceivedAt: new Date() },
  });

  await auditLog("UPLOAD_PROOF", "ReturnedReceipt", parseInt(req.params.id as string));
  res.status(201).json(proof);
});

export default router;
