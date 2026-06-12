// SEPA XML Importer — pain.002.001.03 (Customer Payment Status Report)
// Usa fast-xml-parser per parsejar XML correctament (suporta namespaces)

import { XMLParser } from "fast-xml-parser";
import crypto from "crypto";
import prisma from "../lib/prisma";

interface SepaTransaction {
  amount: number;
  collectionDate: Date;
  debtorName: string;
  debtorIban: string;
  invoiceNumber: string | null;
  rejectionCode: string;
  endToEndId: string;
  mandateId: string;
  rawData: any;
}

function computeImportHash(date: Date, amount: number, concept: string, reference?: string, iban?: string): string {
  const stable = [
    date.toISOString().split("T")[0],
    amount.toFixed(2),
    concept.trim().toLowerCase(),
    (reference || "").trim().toLowerCase(),
    (iban || "").trim().replace(/\s/g, ""),
  ].join("|");
  return crypto.createHash("sha256").update(stable).digest("hex").substring(0, 32);
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  let m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const year = parseInt(m[1]), month = parseInt(m[2]), day = parseInt(m[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(year, month - 1, day);
    }
  }
  m = dateStr.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const day = parseInt(m[1]), month = parseInt(m[2]);
    let year = parseInt(m[3]);
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(year, month - 1, day);
    }
  }
  return null;
}

function parseInvoiceNumber(ustrd: string): string | null {
  if (!ustrd) return null;
  const m = ustrd.match(/Factura\s*n[.:]*\s*(\d+)/i);
  return m ? m[1] : null;
}

function parseInvoiceDate(ustrd: string): string | null {
  if (!ustrd) return null;
  const m = ustrd.match(/de[:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i);
  return m ? m[1] : null;
}

// SEPA rejection code meanings
const REJECTION_MEANINGS: Record<string, string> = {
  "AC01": "IBAN incorrecte",
  "AC04": "Compte tancat",
  "AC06": "Compte bloquejat",
  "AG01": "Transacció no permesa",
  "AM04": "Fons insuficients",
  "MD01": "Mandat no trobat",
  "MD02": "Mandat incorrecte",
  "MD06": "Deutor reclama",
  "MS02": "No autoritzat pel deutor",
  "MS03": "No autoritzat",
  "RC01": "IBAN no correcte",
};

function rejectionLabel(code: string): string {
  const meaning = REJECTION_MEANINGS[code];
  return meaning ? `${code} - ${meaning}` : code;
}

function computeServicePeriod(date: Date): string {
  const monthNames = ["Gener", "Febrer", "Març", "Abril", "Maig", "Juny",
    "Juliol", "Agost", "Setembre", "Octubre", "Novembre", "Desembre"];
  const m = date.getMonth();
  const y = date.getFullYear();
  const sm = m === 0 ? 12 : m;
  const sy = m === 0 ? y - 1 : y;
  return `${monthNames[sm - 1]} ${sy}`;
}

// Navega un objecte XML parsejat per trobar valors amb camí (suporta namespaces)
function getNested(obj: any, ...keys: string[]): string | null {
  let current = obj;
  for (const key of keys) {
    if (!current || typeof current !== "object") return null;
    // Cerca la clau exacta o amb prefix de namespace
    const foundKey = Object.keys(current).find(
      (k) => k === key || k.endsWith(`:${key}`)
    );
    if (!foundKey) return null;
    current = current[foundKey];
  }
  if (typeof current === "string") return current.trim();
  if (typeof current === "number" || typeof current === "boolean") return String(current);
  if (typeof current === "object" && current["#text"]) return String(current["#text"]).trim();
  return null;
}

function parseTransaction(txInfo: any): SepaTransaction | null {
  const txSts = getNested(txInfo, "TxSts");
  if (txSts !== "RJCT") return null;

  const amtStr = getNested(txInfo, "OrgnlTxRef", "Amt", "InstdAmt");
  const amount = amtStr ? parseFloat(amtStr) : 0;
  if (amount <= 0) return null;

  const collectionDateStr = getNested(txInfo, "OrgnlTxRef", "ReqdColltnDt") || "";
  let collectionDate = parseDate(collectionDateStr);

  const ustrd = getNested(txInfo, "OrgnlTxRef", "RmtInf", "Ustrd") || "";
  let dateSource = "ReqdColltnDt";

  if (!collectionDate) {
    const invoiceDateStr = parseInvoiceDate(ustrd);
    if (invoiceDateStr) {
      collectionDate = parseDate(invoiceDateStr);
      dateSource = "Ustrd";
    }
  }
  if (!collectionDate) {
    collectionDate = new Date();
    dateSource = "fallback-today";
  }

  const debtorName = getNested(txInfo, "OrgnlTxRef", "Dbtr", "Nm") || "";
  const debtorIban = getNested(txInfo, "OrgnlTxRef", "DbtrAcct", "IBAN") || "";
  const rejectionCode = getNested(txInfo, "StsRsnInf", "Rsn", "Cd") || "UNKNOWN";
  const endToEndId = getNested(txInfo, "OrgnlEndToEndId") || "";
  const mandateId = getNested(txInfo, "OrgnlTxRef", "MndtRltdInf", "MndtId") || "";
  const invoiceNumber = parseInvoiceNumber(ustrd);
  const invoiceDate = parseInvoiceDate(ustrd);
  const creditorName = getNested(txInfo, "OrgnlTxRef", "Cdtr", "Nm") || "";

  let valorDate = "";
  if (collectionDate) {
    const d = collectionDate.getDate().toString().padStart(2, "0");
    const m = (collectionDate.getMonth() + 1).toString().padStart(2, "0");
    const y = collectionDate.getFullYear().toString().slice(-2);
    valorDate = `${d}/${m}/${y}`;
  }

  return {
    amount,
    collectionDate,
    debtorName: debtorName.trim(),
    debtorIban,
    invoiceNumber,
    rejectionCode,
    endToEndId,
    mandateId,
    rawData: {
      Valor: valorDate,
      invoiceNumber,
      invoiceDate,
      debtorName: debtorName.trim(),
      debtorIban,
      creditorName: creditorName.trim(),
      rejectionCode,
      endToEndId,
      mandateId,
      collectionDate: collectionDateStr,
      dateSource,
    },
  };
}

export async function importSepaXml(xmlContent: string, batchId?: number): Promise<{
  total: number;
  imported: number;
  skipped: number;
  detected: number;
  matched: number;
  errors: string[];
}> {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    textNodeName: "#text",
    removeNSPrefix: false,
    allowBooleanAttributes: true,
    parseAttributeValue: true,
  });

  let parsed: any;
  try {
    parsed = parser.parse(xmlContent);
  } catch (err: any) {
    return { total: 0, imported: 0, skipped: 0, detected: 0, matched: 0, errors: [`Error parsejant XML: ${err.message}`] };
  }

  // Navegar fins a l'arrel del document (suporta namespace)
  const document = parsed.Document || parsed["Document"] || parsed;
  const cstmrPmtStsRpt = document?.CstmrPmtStsRpt || document?.["CstmrPmtStsRpt"];

  if (!cstmrPmtStsRpt) {
    return { total: 0, imported: 0, skipped: 0, detected: 0, matched: 0, errors: ["XML no reconegut: falta CstmrPmtStsRpt"] };
  }

  // Obtenir transaccions
  let txInfos = cstmrPmtStsRpt?.OrgnlPmtInfAndSts || cstmrPmtStsRpt?.["OrgnlPmtInfAndSts"];
  if (!txInfos) {
    return { total: 0, imported: 0, skipped: 0, detected: 0, matched: 0, errors: ["Cap OrgnlPmtInfAndSts trobat"] };
  }

  // Assegurar array
  if (!Array.isArray(txInfos)) {
    txInfos = [txInfos];
  }

  let total = 0;
  let imported = 0;
  let skipped = 0;
  let detected = 0;
  let matched = 0;
  const errors: string[] = [];

  for (const pmtInf of txInfos) {
    let txBlocks = pmtInf?.TxInfAndSts || pmtInf?.["TxInfAndSts"];
    if (!txBlocks) continue;
    if (!Array.isArray(txBlocks)) {
      txBlocks = [txBlocks];
    }

    for (const txInfo of txBlocks) {
      const tx = parseTransaction(txInfo);
      if (!tx) continue;
      total++;

      // Dedup: comprovar per importHash
      const concept = `DEV.REBUT ${tx.debtorName}`;
      const importHash = computeImportHash(tx.collectionDate, tx.amount, concept, tx.endToEndId, tx.debtorIban);

      const existing = await prisma.bankMovement.findFirst({
        where: { importHash },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Crear BankMovement
      const movement = await prisma.bankMovement.create({
        data: {
          importBatchId: batchId || null,
          importHash,
          rawData: tx.rawData,
          concept,
          amount: -tx.amount,
          date: tx.collectionDate,
          reference: tx.endToEndId,
          iban: tx.debtorIban,
          isReturn: true,
        },
      });
      imported++;

      const servicePeriod = computeServicePeriod(tx.collectionDate);
      let notes = servicePeriod ? `Període: ${servicePeriod}` : "";
      if ((tx.rawData as any).dateSource && (tx.rawData as any).dateSource !== "ReqdColltnDt") {
        notes = notes ? `${notes} ⚠️ Data estimada (${(tx.rawData as any).dateSource})` : `⚠️ Data estimada (${(tx.rawData as any).dateSource})`;
      }

      await prisma.returnedReceipt.create({
        data: {
          bankMovementId: movement.id,
          returnedAmount: tx.amount,
          returnDate: tx.collectionDate,
          returnReason: rejectionLabel(tx.rejectionCode),
          receiptReference: tx.invoiceNumber || tx.endToEndId,
          notes: notes || null,
          servicePeriod: servicePeriod || null,
          status: "DETECTAT",
        },
      });
      detected++;

      // Match per número de factura
      if (tx.invoiceNumber) {
        const invoice = await prisma.invoice.findFirst({
          where: { invoiceNumber: tx.invoiceNumber },
          include: { client: true },
        });
        if (invoice) {
          const hasWhatsApp = !!invoice.client?.whatsapp;
          const newStatus = hasWhatsApp ? "EMPARELLAT" : "REVISAR";
          await prisma.returnedReceipt.updateMany({
            where: { bankMovementId: movement.id },
            data: {
              invoiceId: invoice.id,
              clientId: invoice.clientId,
              status: newStatus,
            },
          });
          matched++;
          continue;
        }
      }

      // Match per nom del client
      if (tx.debtorName) {
        const clients = await prisma.client.findMany({ where: { active: true } });
        const extractedName = tx.debtorName.toLowerCase();
        let bestClient: any = null;
        let bestScore = 0;

        for (const cl of clients) {
          const a = extractedName, b = cl.name.toLowerCase();
          if (a === b) { bestScore = 1; bestClient = cl; break; }
          const partsA = a.split(/\s+/), partsB = b.split(/\s+/);
          const allInB = partsB.every((pb: string) => partsA.some((pa: string) => pa.includes(pb) || pb.includes(pa)));
          const allInA = partsA.every((pa: string) => partsB.some((pb: string) => pb.includes(pa) || pa.includes(pb)));
          if (allInB && allInA && 0.9 > bestScore) { bestScore = 0.9; bestClient = cl; }
          else if ((allInB || allInA) && 0.7 > bestScore) { bestScore = 0.7; bestClient = cl; }
          let wordMatched = 0;
          const total = Math.max(partsA.length, partsB.length);
          for (const pa of partsA) {
            if (pa.length < 3) continue;
            if (partsB.some((pb: string) => pb.includes(pa) || pa.includes(pb))) wordMatched++;
          }
          const wordScore = wordMatched > 0 ? (wordMatched / total) * 0.8 : 0;
          if (wordScore > bestScore) { bestScore = wordScore; bestClient = cl; }
        }

        if (bestClient && bestScore >= 0.9) {
          const hasWhatsApp = !!bestClient.whatsapp;
          const newStatus = hasWhatsApp ? "EMPARELLAT" : "REVISAR";
          await prisma.returnedReceipt.updateMany({
            where: { bankMovementId: movement.id },
            data: {
              clientId: bestClient.id,
              status: newStatus,
            },
          });
          matched++;
        } else if (bestClient && bestScore >= 0.4) {
          // Crear MatchCandidate per revisió manual
          await prisma.matchCandidate.create({
            data: {
              receiptId: movement.id,
              bankMovementId: movement.id,
              clientId: bestClient.id,
              score: bestScore,
              reason: `Fuzzy match: "${extractedName}" ≈ "${bestClient.name}" (${bestScore.toFixed(2)})`,
            },
          });
          await prisma.returnedReceipt.updateMany({
            where: { bankMovementId: movement.id },
            data: { clientId: bestClient.id, status: "REVISAR" },
          });
          matched++;
        } else if (extractedName.length > 2) {
          const displayName = tx.debtorName.replace(/\b\w/g, (c: string) => c.toUpperCase());
          const newClient = await prisma.client.create({ data: { name: displayName } });
          await prisma.returnedReceipt.updateMany({
            where: { bankMovementId: movement.id },
            data: { clientId: newClient.id, status: "REVISAR" },
          });
          matched++;
        }
      }
    }
  }

  return { total, imported, skipped, detected, matched, errors };
}
