import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import prisma from "../lib/prisma";
import { auditLog } from "../middleware/auditLog";
import { asyncHandler } from "../middleware/errorHandler";
import { importCsvContent } from "../services/csvImporter";
import { detectReturns } from "../services/returnDetector";
import { matchAllDetected } from "../services/matchingEngine";
import { reconcileNewMovements } from "../services/reconciliation";
import { importSepaXml } from "../services/sepaXmlImporter";

const upload = multer({
  dest: path.join(__dirname, "../../uploads"),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = file.mimetype === "text/csv"
      || file.mimetype === "application/vnd.ms-excel"
      || file.originalname.endsWith(".csv")
      || file.mimetype === "text/xml"
      || file.mimetype === "application/xml"
      || file.originalname.endsWith(".xml");
    cb(null, allowed);
  },
});

const router = Router();

router.get("/", asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
  const skip = (page - 1) * limit;

  const [movements, total] = await Promise.all([
    prisma.bankMovement.findMany({
      skip,
      take: limit,
      orderBy: { date: "desc" },
    }),
    prisma.bankMovement.count(),
  ]);

  res.json({ data: movements, total, page, limit });
}));

router.post("/", upload.single("file"), asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "Fitxer CSV requerit" });

  const filename = req.file.originalname || "unknown.csv";

  // Crear ImportBatch
  const batch = await prisma.importBatch.create({
    data: {
      type: "CSV",
      filename,
      totalRows: 0,
      importedRows: 0,
      skippedRows: 0,
      errorRows: 0,
    },
  });

  const result = await prisma.$transaction(async (tx) => {
    // 1. Import CSV
    const content = fs.readFileSync(req.file!.path, "utf-8");
    const { imported, skipped, errors } = await importCsvContent(content, tx, batch.id);

    // Actualitzar batch
    await tx.importBatch.update({
      where: { id: batch.id },
      data: {
        totalRows: imported + skipped,
        importedRows: imported,
        skippedRows: skipped,
        errorRows: errors.length,
        errors: errors.length > 0 ? errors : undefined,
      },
    });

    // 2. Detect returns
    const detected = await detectReturns(tx);

    // 3. Match detected receipts
    const matched = await matchAllDetected(tx);

    // 4. Reconcile
    const reconciled = await reconcileNewMovements(tx);

    return { imported, skipped, detected, matched, reconciled, errors };
  });

  await auditLog("IMPORT_CSV", "BankMovement", undefined, {
    batchId: batch.id,
    ...result,
  });

  res.json({ batchId: batch.id, ...result });
}));

router.post("/xml", upload.single("file"), asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "Fitxer XML requerit" });

  const filename = req.file.originalname || "unknown.xml";
  const content = fs.readFileSync(req.file.path, "utf-8");

  // Crear ImportBatch
  const batch = await prisma.importBatch.create({
    data: {
      type: "SEPA_XML",
      filename,
      totalRows: 0,
      importedRows: 0,
      skippedRows: 0,
      errorRows: 0,
    },
  });

  const result = await importSepaXml(content, batch.id);

  // Actualitzar batch amb resultats
  await prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      totalRows: result.total,
      importedRows: result.imported,
      skippedRows: result.skipped,
      errorRows: result.errors.length,
      errors: result.errors.length > 0 ? result.errors : undefined,
    },
  });

  await auditLog("IMPORT_SEPA_XML", "BankMovement", undefined, {
    batchId: batch.id,
    ...result,
  });

  res.json({
    batchId: batch.id,
    ...result,
    message: `${result.total} devolucions trobades, ${result.imported} importades, ${result.skipped} duplicades, ${result.detected} detectades, ${result.matched} emparellades`,
  });
}));

export default router;
