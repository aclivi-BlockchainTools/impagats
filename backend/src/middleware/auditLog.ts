import prisma from "../lib/prisma";
import { logger } from "../lib/logger";

export async function auditLog(action: string, entityType: string, entityId?: number, details?: any) {
  try {
    await prisma.auditLog.create({
      data: { action, entityType, entityId, details },
    });
  } catch (err) {
    logger.error({ err }, "Audit log error");
  }
}
