import prisma from "../lib/prisma";

export async function auditLog(action: string, entityType: string, entityId?: number, details?: any) {
  await prisma.auditLog.create({
    data: { action, entityType, entityId, details },
  });
}
