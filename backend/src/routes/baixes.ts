import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { auditLog } from "../middleware/auditLog";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

// GET /api/baixes — llista de baixes amb dades del client
router.get("/", asyncHandler(async (_req: Request, res: Response) => {
  const baixes = await prisma.baixa.findMany({
    include: { client: true },
    orderBy: { date: "desc" },
  });
  res.json(baixes);
}));

// POST /api/baixes — donar un client de baixa
router.post("/", asyncHandler(async (req: Request, res: Response) => {
  const { clientId } = req.body;
  if (!clientId || typeof clientId !== "number") {
    return res.status(400).json({ error: "clientId (número) requerit" });
  }

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return res.status(404).json({ error: "Client no trobat" });

  const baixa = await prisma.baixa.create({
    data: {
      clientId,
      date: req.body.date ? new Date(req.body.date) : new Date(),
    },
    include: { client: true },
  });

  await auditLog("CREATE", "Baixa", baixa.id, { clientId, date: baixa.date });
  res.status(201).json(baixa);
}));

// DELETE /api/baixes/:id — eliminar una baixa
router.delete("/:id", asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  await prisma.baixa.delete({ where: { id } });
  await auditLog("DELETE", "Baixa", id);
  res.status(204).send();
}));

export default router;
