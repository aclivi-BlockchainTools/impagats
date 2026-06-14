import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

router.get("/", asyncHandler(async (_req: Request, res: Response) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ok" });
}));

// Debug endpoint temporal: veure estat del pipeline de media
router.get("/media-debug", asyncHandler(async (_req: Request, res: Response) => {
  const [lastProofs, lastMediaInbound, lastMediaOutbound, proofStats] = await Promise.all([
    prisma.paymentProof.findMany({
      orderBy: { receivedAt: "desc" },
      take: 5,
      select: {
        id: true,
        receiptId: true,
        mimeType: true,
        sizeBytes: true,
        sha256: true,
        storagePath: true,
        status: true,
        receivedAt: true,
      },
    }),
    prisma.message.findMany({
      where: { direction: "INBOUND", content: "(missatge sense text)" },
      orderBy: { sentAt: "desc" },
      take: 5,
      select: {
        id: true,
        receiptId: true,
        direction: true,
        agentIntent: true,
        sentAt: true,
      },
    }),
    prisma.message.findMany({
      where: {
        direction: "OUTBOUND",
        content: {
          contains: "Gràcies, hem rebut",
        },
      },
      orderBy: { sentAt: "desc" },
      take: 5,
      select: {
        id: true,
        receiptId: true,
        content: true,
        agentIntent: true,
        status: true,
        sentAt: true,
      },
    }),
    prisma.paymentProof.groupBy({
      by: ["status"],
      _count: true,
    }),
  ]);

  res.json({
    proofStats: proofStats.map((s: any) => ({ status: s.status, count: s._count })),
    lastProofs,
    lastMediaInbound,
    lastMediaOutbound: lastMediaOutbound.map((m: any) => ({
      ...m,
      content: m.content?.substring(0, 80),
    })),
    storageHint: "revisa backend/storage/proofs/YYYY/MM/",
  });
}));

export default router;
