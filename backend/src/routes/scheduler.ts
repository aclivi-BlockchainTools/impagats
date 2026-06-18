import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import { schedulerTick } from "../services/scheduler";

const router = Router();

router.post("/run", asyncHandler(async (_req, res) => {
  const summary = await schedulerTick();
  res.json({ ok: true, ...summary });
}));

export default router;
