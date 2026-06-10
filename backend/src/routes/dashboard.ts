import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  const total = await prisma.returnedReceipt.count();
  const pending = await prisma.returnedReceipt.count({
    where: { status: { in: ["DETECTED", "MATCHED", "NEEDS_REVIEW"] } },
  });
  const notified = await prisma.returnedReceipt.count({
    where: { status: "NOTIFIED" },
  });
  const proofPending = await prisma.paymentProof.count({
    where: { status: "RECEIVED" },
  });
  const closed = await prisma.returnedReceipt.count({
    where: { status: "CLOSED" },
  });

  const pendingTotal = await prisma.returnedReceipt.aggregate({
    _sum: { returnedAmount: true },
    where: { status: { notIn: ["CLOSED", "IGNORED", "PAYMENT_CONFIRMED"] } },
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
