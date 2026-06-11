import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Type for transactional Prisma client (as received by $transaction callback)
export type TxClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export default prisma;
