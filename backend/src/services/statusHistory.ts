// Servei d'historial d'estats de ReturnedReceipt
// Cada canvi d'estat queda registrat a ReturnedReceiptStatusHistory

import prisma from "../lib/prisma";
import { logger } from "../lib/logger";

export interface StatusChangeParams {
  receiptId: number;
  fromStatus?: string | null;
  toStatus: string;
  reason?: string;
  actorType?: "SYSTEM" | "ADMIN" | "OPENWA" | "IMPORTER";
  actorId?: string;
}

export async function recordStatusChange(params: StatusChangeParams): Promise<void> {
  try {
    await prisma.returnedReceiptStatusHistory.create({
      data: {
        receiptId: params.receiptId,
        fromStatus: params.fromStatus || null,
        toStatus: params.toStatus,
        reason: params.reason || null,
        actorType: params.actorType || "SYSTEM",
        actorId: params.actorId || null,
      },
    });

    logger.info({
      receiptId: params.receiptId,
      from: params.fromStatus,
      to: params.toStatus,
      actorType: params.actorType,
    }, "Status change recorded");
  } catch (err: any) {
    logger.error({ err, receiptId: params.receiptId }, "Error recording status change");
  }
}

export async function getStatusHistory(receiptId: number) {
  return prisma.returnedReceiptStatusHistory.findMany({
    where: { receiptId },
    orderBy: { createdAt: "desc" },
  });
}
