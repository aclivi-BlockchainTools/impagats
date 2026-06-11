import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  const total = await prisma.returnedReceipt.count();
  const pending = await prisma.returnedReceipt.count({
    where: { status: { in: ["DETECTAT", "EMPARELLAT", "REVISAR"] } },
  });
  const notified = await prisma.returnedReceipt.count({
    where: { status: "NOTIFICAT" },
  });
  const proofPending = await prisma.paymentProof.count({
    where: { status: "RECEIVED" },
  });
  const closed = await prisma.returnedReceipt.count({
    where: { status: "TANCAT" },
  });

  const pendingTotal = await prisma.returnedReceipt.aggregate({
    _sum: { returnedAmount: true },
    where: { status: { notIn: ["TANCAT", "IGNORAT", "PAGAMENT_CONFIRMAT"] } },
  });

  res.json({
    total,
    pending,
    notified,
    proofPending,
    closed,
    pendingAmount: pendingTotal._sum.returnedAmount || 0,
  });
});

export default router;
