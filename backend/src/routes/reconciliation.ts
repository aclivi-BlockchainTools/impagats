import { Router, Request, Response } from "express";
import { asyncHandler } from "../middleware/errorHandler";
import { reconcileNewMovements, getReconciliationMatches } from "../services/reconciliation";
import { logger } from "../lib/logger";

const router = Router();

// Executar conciliació manual
router.post("/run", asyncHandler(async (_req: Request, res: Response) => {
  logger.info("Conciliació manual iniciada");
  const matched = await reconcileNewMovements();
  logger.info({ matched }, "Conciliació manual completada");
  res.json({ success: true, matched });
}));

// Llistar matches
router.get("/matches", asyncHandler(async (req: Request, res: Response) => {
  const minScore = req.query.minScore ? parseInt(req.query.minScore as string) : undefined;
  const manual = req.query.manual !== undefined ? req.query.manual === "true" : undefined;
  const matches = await getReconciliationMatches({ minScore, manual });
  res.json(matches);
}));

export default router;
