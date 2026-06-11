import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import prisma from "../lib/prisma";
import { auditLog } from "../middleware/auditLog";
import { importCsv } from "../services/csvImporter";
import { detectReturns } from "../services/returnDetector";
import { matchAllDetected } from "../services/matchingEngine";
import { reconcileNewMovements } from "../services/reconciliation";

const upload = multer({
  dest: path.join(__dirname, "../../uploads"),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const isCsv = file.mimetype === "text/csv"
      || file.mimetype === "application/vnd.ms-excel"
      || file.originalname.endsWith(".csv");
    cb(null, isCsv);
  },
});
const router = Router();

router.get("/", async (req: Request, res: Response) => {
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
});

router.post("/", upload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "Fitxer CSV requerit" });

  const result = await prisma.$transaction(async (tx) => {
    // Import CSV inside transaction
    const { imported, skipped } = await (async () => {
      const fs = await import("fs");
      const { parse } = await import("csv-parse/sync");
      let content = fs.readFileSync(req.file!.path, "utf-8");
      // Re-use skipMetadataRows logic inline (imported inside transaction to avoid coupling)
      const lines = content.split(/\r?\n/);
      const ALL_ALIASES = ["concepto", "concepte", "descripcion", "descripcio", "description", "concept",
        "importe", "import", "amount", "quantitat", "fecha", "data", "date", "fecha_operacion", "data_operacio",
        "referencia", "referencia", "reference", "ref", "iban", "IBAN", "cuenta", "compte", "account"];
      let headerIdx = lines.findIndex((l) => {
        const fields = l.toLowerCase().split(";");
        return fields.some((f) => ALL_ALIASES.includes(f.trim()));
      });
      if (headerIdx === -1) headerIdx = 0;
      content = lines.slice(headerIdx).join("\n");

      const rows: Record<string, string>[] = parse(content, {
        columns: true,
        delimiter: ";",
        skip_empty_lines: true,
        bom: true,
      });

      const COLUMN_ALIASES: Record<string, string[]> = {
        concept: ["concepto", "concepte", "descripcion", "descripcio", "description", "concept"],
        amount: ["importe", "import", "amount", "quantitat"],
        date: ["fecha", "data", "date", "fecha_operacion", "data_operacio"],
        reference: ["referencia", "referencia", "reference", "ref"],
        iban: ["iban", "IBAN", "cuenta", "compte", "account"],
      };

      let imported = 0, skipped = 0;
      for (const row of rows) {
        const getValue = (aliases: string[]) => {
          const col = Object.keys(row).find((k) => aliases.map(a => a.toLowerCase()).includes(k.toLowerCase().trim()));
          return col ? row[col]?.trim() : undefined;
        };
        const concept = getValue(COLUMN_ALIASES.concept) || "";
        const amount = (() => {
          const val = getValue(COLUMN_ALIASES.amount);
          if (!val) return 0;
          let cleaned = val;
          const hasComma = val.includes(","), hasDot = val.includes(".");
          if (hasComma && hasDot) {
            const lastComma = val.lastIndexOf(","), lastDot = val.lastIndexOf(".");
            cleaned = lastComma > lastDot ? val.replace(/\./g, "").replace(",", ".") : val.replace(/,/g, "");
          } else if (hasComma) {
            const commaPos = val.lastIndexOf(",");
            if (val.substring(commaPos + 1).length <= 2 && commaPos > 0) cleaned = val.replace(",", ".");
            else cleaned = val.replace(/,/g, "");
          }
          return parseFloat(cleaned) || 0;
        })();
        const dateStr = getValue(COLUMN_ALIASES.date);
        const reference = getValue(COLUMN_ALIASES.reference);
        const iban = getValue(COLUMN_ALIASES.iban);

        if (!concept || !dateStr || isNaN(amount)) { skipped++; continue; }

        let date: Date | null = null;
        const dmyMatch = dateStr!.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
        if (dmyMatch) {
          const day = parseInt(dmyMatch[1]), month = parseInt(dmyMatch[2]) - 1;
          let year = parseInt(dmyMatch[3]);
          if (year < 100) year += 2000;
          const dt = new Date(year, month, day);
          if (!isNaN(dt.getTime()) && dt.getDate() === day && dt.getMonth() === month) date = dt;
        }
        if (!date) { date = new Date(dateStr!); if (isNaN(date.getTime())) { skipped++; continue; } }

        await tx.bankMovement.create({
          data: { rawData: row as any, concept, amount, date, reference, iban },
        });
        imported++;
      }
      return { imported, skipped };
    })();

    // Detect returns
    const keywordsSetting = await tx.appSettings.findFirst({ where: { key: "return_keywords" } });
    const keywords = keywordsSetting
      ? keywordsSetting.value.split(",").map((k: string) => k.trim().toLowerCase())
      : ["devolucio", "devolución", "recibo devuelto", "impagado", "retorno", "adeudo devuelto", "SEPA", "recibo", "dev.rebut", "dev rebut", "devolució rebut"];
    const movements = await tx.bankMovement.findMany({ where: { isReturn: false } });
    let detected = 0;
    const monthNames = ["Gener", "Febrer", "Març", "Abril", "Maig", "Juny", "Juliol", "Agost", "Setembre", "Octubre", "Novembre", "Desembre"];

    for (const mv of movements) {
      const c = (mv.concept || "").toLowerCase();
      if (keywords.some((kw: string) => c.includes(kw)) && mv.amount < 0) {
        await tx.bankMovement.update({ where: { id: mv.id }, data: { isReturn: true } });
        const existing = await tx.returnedReceipt.findFirst({ where: { bankMovementId: mv.id } });
        if (!existing) {
          const rawData = mv.rawData as any;
          let servicePeriod: string | null = null;
          const rawValor = rawData?.Valor || rawData?.valor || rawData?.VALOR;
          if (rawValor) {
            const dm = String(rawValor).trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
            if (dm) {
              const d = parseInt(dm[1]), m = parseInt(dm[2]);
              let y = parseInt(dm[3]); if (y < 100) y += 2000;
              const sm = m - 1 < 1 ? 12 : m - 1;
              const sy = m - 1 < 1 ? y - 1 : y;
              servicePeriod = `${monthNames[sm - 1]} ${sy}`;
            }
          }
          const ref = mv.reference || c.replace(/\s+/g, " ").trim();
          await tx.returnedReceipt.create({
            data: {
              bankMovementId: mv.id,
              returnedAmount: Math.abs(mv.amount),
              returnDate: mv.date,
              returnReason: mv.concept?.replace(/\s+/g, " ").trim() || "",
              receiptReference: ref,
              notes: servicePeriod ? `Període: ${servicePeriod}` : null,
              servicePeriod: servicePeriod || null,
              status: "DETECTAT",
            },
          });
          detected++;
        }
      }
    }

    // Match detected receipts
    const detectedReceipts = await tx.returnedReceipt.findMany({ where: { status: "DETECTAT" } });
    let matched = 0;
    for (const receipt of detectedReceipts) {
      const concept = receipt.receiptReference || receipt.returnReason || "";
      const hasWhatsApp = (c: any) => !!c?.whatsapp;
      // 1. Invoice number
      const refMatch = concept.match(/[\d]{4,}/);
      if (refMatch) {
        const invoice = await tx.invoice.findFirst({ where: { invoiceNumber: refMatch[0] }, include: { client: true } });
        if (invoice) {
          const status = hasWhatsApp(invoice.client) ? "EMPARELLAT" : "REVISAR";
          await tx.returnedReceipt.update({ where: { id: receipt.id }, data: { invoiceId: invoice.id, clientId: invoice.clientId, status } });
          matched++;
          continue;
        }
      }
      // 2. Client name extraction (simplified)
      const nameMatch = concept.match(/(?:DEV\.?\s*REBUT|DEVOLUCI[OÓ]\s*(?:REBUT)?|DEV\s+REBUT)\s+(.+)/i);
      let found = false;
      if (nameMatch) {
        const extractedName = nameMatch[1].replace(/\s+/g, " ").trim();
        const clients = await tx.client.findMany({ where: { active: true } });
        let bestClient: any = null, bestScore = 0;
        for (const cl of clients) {
          const a = extractedName.toLowerCase(), b = cl.name.toLowerCase();
          if (a === b) { bestScore = 1; bestClient = cl; break; }
          const partsA = a.split(/\s+/), partsB = b.split(/\s+/);
          const allInB = partsB.every((pb: string) => partsA.some((pa: string) => pa.includes(pb) || pb.includes(pa)));
          const allInA = partsA.every((pa: string) => partsB.some((pb: string) => pb.includes(pa) || pa.includes(pb)));
          if (allInB && allInA && 0.9 > bestScore) { bestScore = 0.9; bestClient = cl; }
          else if ((allInB || allInA) && 0.7 > bestScore) { bestScore = 0.7; bestClient = cl; }
        }
        if (bestClient && bestScore >= 0.7) {
          const status = hasWhatsApp(bestClient) ? "EMPARELLAT" : "REVISAR";
          await tx.returnedReceipt.update({ where: { id: receipt.id }, data: { clientId: bestClient.id, status } });
          found = true; matched++;
        } else if (bestClient && bestScore >= 0.4) {
          await tx.returnedReceipt.update({ where: { id: receipt.id }, data: { clientId: bestClient.id, status: "REVISAR" } });
          found = true; matched++;
        } else if (extractedName.length > 2) {
          const newClient = await tx.client.create({ data: { name: extractedName.replace(/\b\w/g, (c: string) => c.toUpperCase()) } });
          await tx.returnedReceipt.update({ where: { id: receipt.id }, data: { clientId: newClient.id, status: "REVISAR" } });
          found = true; matched++;
        }
      }
      if (found) continue;
      // 3. Amount match
      const invoicesByAmount = await tx.invoice.findMany({
        where: { amount: { gte: receipt.returnedAmount * 0.95, lte: receipt.returnedAmount * 1.05 } },
        include: { client: true },
      });
      if (invoicesByAmount.length === 1) {
        const status = hasWhatsApp(invoicesByAmount[0].client) ? "EMPARELLAT" : "REVISAR";
        await tx.returnedReceipt.update({ where: { id: receipt.id }, data: { invoiceId: invoicesByAmount[0].id, clientId: invoicesByAmount[0].clientId, status } });
        matched++;
      } else {
        await tx.returnedReceipt.update({ where: { id: receipt.id }, data: { status: "REVISAR" } });
      }
    }

    // Reconciliation
    const openReceipts = await tx.returnedReceipt.findMany({
      where: { status: { in: ["NOTIFICAT", "JUSTIFICANT_REBUT"] } },
      include: { client: true },
    });
    const unreconciled = await tx.bankMovement.findMany({
      where: { amount: { gt: 0 }, isReturn: false, reconciliationMatches: { none: {} } },
    });
    let reconciled = 0;
    for (const mv of unreconciled) {
      for (const receipt of openReceipts) {
        if (mv.amount >= receipt.returnedAmount * 0.95 && mv.amount <= receipt.returnedAmount * 1.05) {
          let confidence = 0.6;
          if (receipt.client && mv.concept) {
            const parts = receipt.client.name.toLowerCase().split(" ");
            if (parts.some((p: string) => p.length > 2 && mv.concept!.toLowerCase().includes(p))) confidence = 0.9;
          }
          const isHighConfidence = confidence >= 0.8;
          await tx.reconciliationMatch.create({ data: { receiptId: receipt.id, bankMovementId: mv.id, amount: mv.amount, confidence } });
          await tx.returnedReceipt.update({ where: { id: receipt.id }, data: isHighConfidence
            ? { status: "PAGAMENT_CONFIRMAT", paymentConfirmedAt: new Date() }
            : { status: "REVISAR" } });
          reconciled++;
          break;
        }
      }
    }

    return { imported, skipped, detected, matched, reconciled };
  });

  await auditLog("IMPORT_CSV", "BankMovement", undefined, result);

  res.json(result);
});

export default router;
