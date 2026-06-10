import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import prisma from "../lib/prisma";
import { auditLog } from "../middleware/auditLog";
import { importCsv } from "../services/csvImporter";
import { detectReturns } from "../services/returnDetector";

const upload = multer({ dest: path.join(__dirname, "../../uploads") });
const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  const movements = await prisma.bankMovement.findMany({
    orderBy: { date: "desc" },
  });
  res.json(movements);
});

router.post("/", upload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "Fitxer CSV requerit" });

  const { imported, skipped } = await importCsv(req.file.path);
  const detected = await detectReturns();

  await auditLog("IMPORT_CSV", "BankMovement", undefined, { imported, skipped, detected });

  res.json({ imported, skipped, detected });
});

export default router;
