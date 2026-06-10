import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  const { receiptId } = req.query;
  const where = receiptId ? { receiptId: parseInt(receiptId as string) } : {};
  const messages = await prisma.message.findMany({
    where,
    orderBy: { sentAt: "desc" },
  });
  res.json(messages);
});

export default router;
