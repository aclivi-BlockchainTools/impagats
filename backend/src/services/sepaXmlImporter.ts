// SEPA XML Importer — pain.002.001.03 (Customer Payment Status Report)
// Parsea fitxers XML de devolucions SEPA i crea BankMovement + ReturnedReceipt

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

// Extract all <TxInfAndSts> blocks from the XML
function extractTransactions(xml: string): string[] {
  const blocks: string[] = [];
  const regex = /<TxInfAndSts>([\s\S]*?)<\/TxInfAndSts>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    blocks.push(match[1]);
  }
  return blocks;
}

// Extract text content of a single XML tag (supports attributes)
function getTag(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, "i"));
  return m ? m[1].trim() : null;
}

// Extract text from nested path: <Parent><Child>value</Child></Parent>
function getNestedTag(block: string, parent: string, child: string): string | null {
  const parentRegex = new RegExp(`<${parent}>([\\s\\S]*?)<\\/${parent}>`, "i");
  const pm = block.match(parentRegex);
  if (!pm) return null;
  return getTag(pm[1], child);
}

function parseAmount(block: string): number {
  const amt = getNestedTag(block, "Amt", "InstdAmt");
  if (!amt) return 0;
  return parseFloat(amt) || 0;
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  // Try SEPA format: YYYY-MM-DD
  let m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const year = parseInt(m[1]), month = parseInt(m[2]), day = parseInt(m[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(year, month - 1, day);
    }
  }
  // Try DD/MM/YY or DD/MM/YYYY (Ustrd invoice dates)
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
  // "TECNOLOGIA LLIURE S.C.P. Ntra. Factura n: 000757 de: 27/03/2026"
  // "TECNOLOGIA LLIURE S.C.P. Ntra. Factura n.: 000670 de: 26/02/2026"
  const m = ustrd.match(/Factura\s*n[.:]*\s*(\d+)/i);
  return m ? m[1] : null;
}

function parseInvoiceDate(ustrd: string): string | null {
  if (!ustrd) return null;
  // Extract date after "de:" or "de "
  const m = ustrd.match(/de[:\s]*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i);
  return m ? m[1] : null;
}

function parseBlock(block: string): SepaTransaction | null {
  const txSts = getTag(block, "TxSts");
  if (txSts !== "RJCT") return null; // Only rejected transactions

  const amount = parseAmount(block);
  if (amount <= 0) return null;

  const collectionDateStr = getTag(block, "ReqdColltnDt") || "";
  let collectionDate = parseDate(collectionDateStr);

  // If SEPA date is invalid, try invoice date from Ustrd as fallback
  const ustrd = getNestedTag(block, "RmtInf", "Ustrd") || "";
  let dateSource = "ReqdColltnDt";
  if (!collectionDate) {
    const invoiceDateStr = parseInvoiceDate(ustrd);
    if (invoiceDateStr) {
      collectionDate = parseDate(invoiceDateStr);
      dateSource = "Ustrd";
    }
  }
  // Last resort: use today
  if (!collectionDate) {
    collectionDate = new Date();
    dateSource = "fallback-today";
  }

  const debtorName = getNestedTag(block, "Dbtr", "Nm") || "";
  const debtorIban = getNestedTag(block, "DbtrAcct", "IBAN") || "";
  const rejectionCode = getNestedTag(block, "Rsn", "Cd") || "UNKNOWN";
  const endToEndId = getTag(block, "OrgnlEndToEndId") || "";
  const mandateId = getNestedTag(block, "MndtRltdInf", "MndtId") || "";
  const invoiceNumber = parseInvoiceNumber(ustrd);
  const invoiceDate = parseInvoiceDate(ustrd);
  const creditorName = getNestedTag(block, "Cdtr", "Nm") || "";

  // Format collection date as DD/MM/YY for display (Valor = receipt emission date)
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

// Compute service period from collection date (month before)
function computeServicePeriod(date: Date): string {
  const monthNames = ["Gener", "Febrer", "Març", "Abril", "Maig", "Juny",
    "Juliol", "Agost", "Setembre", "Octubre", "Novembre", "Desembre"];
  const m = date.getMonth(); // 0-indexed
  const y = date.getFullYear();
  const sm = m === 0 ? 12 : m;
  const sy = m === 0 ? y - 1 : y;
  return `${monthNames[sm - 1]} ${sy}`;
}

export async function importSepaXml(xmlContent: string): Promise<{
  total: number;
  imported: number;
  detected: number;
  matched: number;
}> {
  const blocks = extractTransactions(xmlContent);
  let total = 0;
  let imported = 0;
  let detected = 0;
  let matched = 0;

  for (const block of blocks) {
    const tx = parseBlock(block);
    if (!tx) continue;
    total++;

    // Skip if already imported (by endToEndId or mandateId + collectionDate)
    const existing = await prisma.bankMovement.findFirst({
      where: {
        reference: tx.endToEndId,
        date: tx.collectionDate,
      },
    });
    if (existing) continue;

    // Create bank movement
    const movement = await prisma.bankMovement.create({
      data: {
        rawData: tx.rawData,
        concept: `DEV.REBUT ${tx.debtorName}`,
        amount: -tx.amount, // Negative = return
        date: tx.collectionDate,
        reference: tx.endToEndId,
        iban: tx.debtorIban,
        isReturn: true,
      },
    });
    imported++;

    // Calculate service period
    const servicePeriod = computeServicePeriod(tx.collectionDate);

    // Build notes: service period + warning if date was a fallback
    let notes = servicePeriod ? `Període: ${servicePeriod}` : "";
    if ((tx.rawData as any).dateSource && (tx.rawData as any).dateSource !== "ReqdColltnDt") {
      notes = notes ? `${notes} ⚠️ Data estimada (${(tx.rawData as any).dateSource})` : `⚠️ Data estimada (${(tx.rawData as any).dateSource})`;
    }

    // Create returned receipt
    await prisma.returnedReceipt.create({
      data: {
        bankMovementId: movement.id,
        returnedAmount: tx.amount,
        returnDate: tx.collectionDate,
        returnReason: tx.rejectionCode,
        receiptReference: tx.invoiceNumber ? `Factura n: ${tx.invoiceNumber}` : tx.endToEndId,
        notes: notes || null,
        servicePeriod: servicePeriod || null,
        status: "DETECTAT",
      },
    });
    detected++;

    // Match by invoice number
    if (tx.invoiceNumber) {
      const invoice = await prisma.invoice.findFirst({
        where: { invoiceNumber: tx.invoiceNumber },
        include: { client: true },
      });
      if (invoice) {
        const hasWhatsApp = !!invoice.client?.whatsapp;
        await prisma.returnedReceipt.updateMany({
          where: { bankMovementId: movement.id },
          data: {
            invoiceId: invoice.id,
            clientId: invoice.clientId,
            status: hasWhatsApp ? "EMPARELLAT" : "REVISAR",
          },
        });
        matched++;
        continue;
      }
    }

    // Match by client name (auto-create if not found)
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

      if (bestClient && bestScore >= 0.4) {
        const hasWhatsApp = !!bestClient.whatsapp;
        await prisma.returnedReceipt.updateMany({
          where: { bankMovementId: movement.id },
          data: {
            clientId: bestClient.id,
            status: hasWhatsApp ? "EMPARELLAT" : "REVISAR",
          },
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

  return { total, imported, detected, matched };
}
