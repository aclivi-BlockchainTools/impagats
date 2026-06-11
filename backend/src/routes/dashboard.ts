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

router.get("/debtors", async (_req: Request, res: Response) => {
  const receipts = await prisma.returnedReceipt.findMany({
    where: { status: { notIn: ["TANCAT", "IGNORAT", "PAGAMENT_CONFIRMAT"] } },
    include: { client: true },
    orderBy: { returnDate: "desc" },
  });

  // Group by client
  const grouped: Record<number, { client: any; receipts: any[]; totalAmount: number; periods: string[]; oldestDate: string; newestDate: string }> = {};
  for (const r of receipts) {
    const cid = r.clientId || 0;
    if (!grouped[cid]) {
      grouped[cid] = {
        client: r.client || { id: 0, name: "Sense client" },
        receipts: [],
        totalAmount: 0,
        periods: [],
        oldestDate: "",
        newestDate: "",
      };
    }
    grouped[cid].receipts.push(r);
    grouped[cid].totalAmount += r.returnedAmount;
    if (r.servicePeriod && !grouped[cid].periods.includes(r.servicePeriod)) {
      grouped[cid].periods.push(r.servicePeriod);
    }
    if (!grouped[cid].newestDate || r.returnDate > new Date(grouped[cid].newestDate)) {
      grouped[cid].newestDate = r.returnDate.toISOString().split("T")[0];
    }
    if (!grouped[cid].oldestDate || r.returnDate < new Date(grouped[cid].oldestDate)) {
      grouped[cid].oldestDate = r.returnDate.toISOString().split("T")[0];
    }
  }

  // Sort by total amount descending
  const result = Object.values(grouped).sort((a, b) => b.totalAmount - a.totalAmount);

  res.json(result.map(d => ({
    clientId: d.client.id || null,
    clientName: d.client.name,
    receiptCount: d.receipts.length,
    totalAmount: Math.round(d.totalAmount * 100) / 100,
    periods: d.periods.sort(),
    periodCount: d.periods.length,
    oldestDate: d.oldestDate,
    newestDate: d.newestDate,
  })));
});

export default router;
