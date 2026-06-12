import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

router.get("/", asyncHandler(async (_req: Request, res: Response) => {
  // Single grouped query instead of 5 separate counts
  const grouped = await prisma.returnedReceipt.groupBy({
    by: ["status"],
    _count: { id: true },
    _sum: { returnedAmount: true },
  });

  const counts: Record<string, number> = {};
  const sums: Record<string, number> = {};
  for (const g of grouped) {
    counts[g.status] = g._count.id;
    sums[g.status] = g._sum.returnedAmount ? Number(g._sum.returnedAmount) : 0;
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const pending = (counts["DETECTAT"] || 0) + (counts["EMPARELLAT"] || 0) + (counts["REVISAR"] || 0);
  const notified = counts["NOTIFICAT"] || 0;
  const closed = (counts["TANCAT"] || 0) + (counts["PAGAMENT_CONFIRMAT"] || 0);
  const waitingProof = (counts["ESPERANT_JUSTIFICANT"] || 0);
  const paymentClaimed = (counts["PAGAMENT_DECLARAT"] || 0) + (counts["PENDENT_REVISIO"] || 0);
  const whatsappError = counts["ERROR_WHATSAPP"] || 0;

  const proofPending = await prisma.paymentProof.count({ where: { status: "RECEIVED" } });

  // Pending amount: sum of non-closed/ignored/confirmed
  const pendingAmount = Object.entries(sums)
    .filter(([status]) => !["TANCAT", "IGNORAT", "PAGAMENT_CONFIRMAT"].includes(status))
    .reduce((sum, [, amount]) => sum + amount, 0);

  res.json({
    total,
    pending,
    notified,
    proofPending,
    closed,
    pendingAmount,
    waitingProof,
    paymentClaimed,
    whatsappError,
  });

}));

router.get("/debtors", asyncHandler(async (_req: Request, res: Response) => {
  // Use groupBy instead of loading all receipts into memory
  const receipts = await prisma.returnedReceipt.findMany({
    where: { status: { notIn: ["TANCAT", "IGNORAT", "PAGAMENT_CONFIRMAT"] } },
    include: { client: true },
    orderBy: { returnDate: "desc" },
  });

  // Group by client (still O(n) in memory but groupBy can't do the complex grouping needed)
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
    grouped[cid].totalAmount += Number(r.returnedAmount);
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
}));

export default router;
