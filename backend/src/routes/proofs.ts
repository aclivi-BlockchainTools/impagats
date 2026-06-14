import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { logger } from "../lib/logger";
import { asyncHandler } from "../middleware/errorHandler";
import path from "path";
import fs from "fs";
import { config } from "../lib/config";

const router = Router();

// Serveix un fitxer de proof per ID
router.get("/:id/file", asyncHandler(async (req: Request, res: Response) => {
  const proof = await prisma.paymentProof.findUnique({
    where: { id: parseInt(req.params.id as string) },
    select: {
      id: true,
      receiptId: true,
      mimeType: true,
      storagePath: true,
      originalName: true,
      sizeBytes: true,
    },
  });

  if (!proof) {
    return res.status(404).json({ error: "Justificant no trobat" });
  }

  // storagePath és relatiu: YYYY/MM/filename
  const baseDir = process.env.STORAGE_DIR
    ? path.resolve(process.env.STORAGE_DIR, "proofs")
    : path.resolve(__dirname, "../../storage/proofs");

  const fullPath = path.join(baseDir, proof.storagePath);

  // Verificar que el fitxer existeix
  if (!fs.existsSync(fullPath)) {
    logger.error({ proofId: proof.id, storagePath: proof.storagePath, fullPath }, "Fitxer de proof no trobat a disc");
    return res.status(404).json({ error: "Fitxer no trobat al sistema de fitxers" });
  }

  // Content-Type segons MIME
  const mimeType = proof.mimeType || "application/octet-stream";
  const filename = proof.originalName || `proof-${proof.id}`;

  res.setHeader("Content-Type", mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
  res.setHeader("Content-Length", proof.sizeBytes || 0);
  res.setHeader("Cache-Control", "private, max-age=3600");

  const stream = fs.createReadStream(fullPath);
  stream.on("error", (err) => {
    logger.error({ err, proofId: proof.id, fullPath }, "Error llegint fitxer de proof");
    if (!res.headersSent) {
      res.status(500).json({ error: "Error llegint el fitxer" });
    }
  });
  stream.pipe(res);
}));

export default router;
