import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

router.get("/", asyncHandler(async (_req: Request, res: Response) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ok" });
}));

export default router;
