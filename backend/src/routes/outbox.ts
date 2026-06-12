import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { getOutboxStats, processOutbox, processOneMessage } from "../services/outboxService";

const router = Router();

// Estat de la cua
router.get("/stats", asyncHandler(async (_req: Request, res: Response) => {
  const stats = await getOutboxStats();
  res.json(stats);
}));

// Llistar missatges de la cua
router.get("/", asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
  const skip = (page - 1) * limit;
  const status = req.query.status as string | undefined;

  const where: any = {};
  if (status) where.status = status;

  const [items, total] = await Promise.all([
    prisma.whatsappOutbox.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { receipt: { select: { id: true, status: true, receiptReference: true, client: { select: { name: true } } } } },
    }),
    prisma.whatsappOutbox.count({ where }),
  ]);

  res.json({ data: items, total, page, limit });
}));

// Processar la cua manualment
router.post("/process", asyncHandler(async (_req: Request, res: Response) => {
  const result = await processOutbox();
  res.json(result);
}));

// Reenviar un missatge fallit
router.post("/:id/retry", asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const outbox = await prisma.whatsappOutbox.findUnique({ where: { id } });

  if (!outbox) return res.status(404).json({ error: "Missatge no trobat" });
  if (!["FAILED", "CANCELLED"].includes(outbox.status)) {
    return res.status(400).json({ error: "Només es poden reenviar missatges fallits o cancel·lats" });
  }

  // Reset to PENDING
  await prisma.whatsappOutbox.update({
    where: { id },
    data: { status: "PENDING", attempts: 0, lastError: null },
  });

  const result = await processOneMessage(id);
  res.json(result);
}));

// Cancel·lar un missatge pendent
router.post("/:id/cancel", asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const outbox = await prisma.whatsappOutbox.findUnique({ where: { id } });

  if (!outbox) return res.status(404).json({ error: "Missatge no trobat" });
  if (!["PENDING", "SENDING"].includes(outbox.status)) {
    return res.status(400).json({ error: "Només es poden cancel·lar missatges pendents" });
  }

  await prisma.whatsappOutbox.update({
    where: { id },
    data: { status: "CANCELLED", lastError: "Cancel·lat per l'usuari" },
  });

  res.json({ success: true });
}));

export default router;
