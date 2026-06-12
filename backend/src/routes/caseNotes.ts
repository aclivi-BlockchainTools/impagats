import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { getStatusHistory } from "../services/statusHistory";

const router = Router();

// GET /api/case-notes/:receiptId — notes d'un rebut
router.get("/:receiptId/notes", asyncHandler(async (req: Request, res: Response) => {
  const receiptId = parseInt(req.params.receiptId as string);
  const notes = await prisma.caseNote.findMany({
    where: { receiptId },
    orderBy: { createdAt: "desc" },
  });
  res.json(notes);
}));

// POST /api/case-notes/:receiptId/notes — crear nota interna
router.post("/:receiptId/notes", asyncHandler(async (req: AuthRequest, res: Response) => {
  const receiptId = parseInt(req.params.receiptId as string);
  const { body } = req.body;

  if (!body || typeof body !== "string" || body.trim().length === 0) {
    return res.status(400).json({ error: "Cos de la nota requerit" });
  }

  const note = await prisma.caseNote.create({
    data: {
      receiptId,
      author: req.adminId || "admin",
      body: body.trim(),
    },
  });

  res.status(201).json(note);
}));

// GET /api/case-notes/:receiptId/history — historial d'estats d'un rebut
router.get("/:receiptId/history", asyncHandler(async (req: Request, res: Response) => {
  const receiptId = parseInt(req.params.receiptId as string);
  const history = await getStatusHistory(receiptId);
  res.json(history);
}));

export default router;
