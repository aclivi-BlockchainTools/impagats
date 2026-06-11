import prisma from "../lib/prisma";

// Extract potential client name from return concept
// Patterns: "DEV.REBUT NOM CLIENT", "DEV REBUT NOM CLIENT", "DEVOL.REBUTS SEPA ..."
function extractClientName(concept: string): string | null {
  const c = concept.trim();
  // Skip batch charges
  if (/CARREC|SEPA|DEVOL\.REBUTS/i.test(c) && !/DEV\.? ?REBUT [A-Z]/i.test(c)) {
    return null;
  }
  // Try to extract name after DEV.REBUT / DEV REBUT / DEVOLUCIO REBUT etc.
  const match = c.match(
    /(?:DEV\.?\s*REBUT|DEVOLUCI[OÓ]\s*(?:REBUT)?|DEV\s+REBUT)\s+(.+)/i
  );
  if (match) {
    const name = match[1].trim();
    // Remove trailing whitespace and single letters at end (like "M CARME LLOBERA  " with padding)
    if (name.length > 2) return name.replace(/\s+/g, " ").trim();
  }
  return null;
}

// Resolve status: EMPARELLAT only if client has WhatsApp, otherwise REVISAR
function resolveStatus(client: { whatsapp?: string | null }): string {
  return client.whatsapp ? "EMPARELLAT" : "REVISAR";
}

// Simple fuzzy match score based on shared word parts
function nameMatchScore(extractedName: string, clientName: string): number {
  const a = extractedName.toLowerCase().trim();
  const b = clientName.toLowerCase().trim();

  // Exact match
  if (a === b) return 1.0;

  const partsA = a.split(/\s+/);
  const partsB = b.split(/\s+/);

  // Check if all parts of client name appear in extracted name (or vice versa)
  const allPartsInB = partsB.every((pb) => partsA.some((pa) => pa.includes(pb) || pb.includes(pa)));
  const allPartsInA = partsA.every((pa) => partsB.some((pb) => pb.includes(pa) || pa.includes(pb)));

  if (allPartsInB && allPartsInA) return 0.9;
  if (allPartsInB || allPartsInA) return 0.7;

  // Check individual word matches
  let matched = 0;
  const total = Math.max(partsA.length, partsB.length);
  for (const pa of partsA) {
    if (pa.length < 3) continue; // skip short words
    if (partsB.some((pb) => pb.includes(pa) || pa.includes(pb))) {
      matched++;
    }
  }
  if (matched > 0) return (matched / total) * 0.8;

  return 0;
}

export async function matchReceipt(receiptId: number): Promise<void> {
  const receipt = await prisma.returnedReceipt.findUnique({
    where: { id: receiptId },
  });

  if (!receipt || !["DETECTAT", "REVISAR"].includes(receipt.status)) return;

  const concept = receipt.receiptReference || receipt.returnReason || "";

  // 1. Try matching by invoice number in concept (4+ digit numbers)
  const refMatch = concept.match(/[\d]{4,}/);
  if (refMatch) {
    const invoice = await prisma.invoice.findFirst({
      where: { invoiceNumber: refMatch[0] },
      include: { client: true },
    });
    if (invoice) {
      const status = resolveStatus(invoice.client);
      await prisma.returnedReceipt.update({
        where: { id: receiptId },
        data: { invoiceId: invoice.id, clientId: invoice.clientId, status },
      });
      return;
    }
  }

  // 2. Try matching by client name extracted from concept
  const extractedName = extractClientName(concept);
  if (extractedName) {
    const clients = await prisma.client.findMany({ where: { active: true } });
    let bestScore = 0;
    let bestClient: (typeof clients)[0] | null = null;

    for (const client of clients) {
      const score = nameMatchScore(extractedName, client.name);
      if (score > bestScore) {
        bestScore = score;
        bestClient = client;
      }
    }

    if (bestClient && bestScore >= 0.7) {
      const status = resolveStatus(bestClient);
      // Check if there's an invoice for this client with matching amount
      const invoicesByAmount = await prisma.invoice.findMany({
        where: {
          clientId: bestClient.id,
          amount: { gte: receipt.returnedAmount * 0.95, lte: receipt.returnedAmount * 1.05 },
        },
      });

      if (invoicesByAmount.length === 1) {
        await prisma.returnedReceipt.update({
          where: { id: receiptId },
          data: {
            clientId: bestClient.id,
            invoiceId: invoicesByAmount[0].id,
            status,
          },
        });
        return;
      }

      // Client matched but no unique invoice → match to client only
      await prisma.returnedReceipt.update({
        where: { id: receiptId },
        data: { clientId: bestClient.id, status },
      });
      return;
    }

    if (bestClient && bestScore >= 0.4) {
      // Low confidence match → needs review but assign client anyway
      await prisma.returnedReceipt.update({
        where: { id: receiptId },
        data: { clientId: bestClient.id, status: "REVISAR" },
      });
      return;
    }

    // No matching client found: auto-create one from extracted name
    if (!bestClient || bestScore < 0.4) {
      const displayName = extractedName.replace(/\b\w/g, (c) => c.toUpperCase());
      const newClient = await prisma.client.create({
        data: { name: displayName },
      });
      await prisma.returnedReceipt.update({
        where: { id: receiptId },
        data: { clientId: newClient.id, status: "REVISAR" },
      });
      return;
    }
  }

  // 3. Matching per import (±5%)
  const invoicesByAmount = await prisma.invoice.findMany({
    where: { amount: { gte: receipt.returnedAmount * 0.95, lte: receipt.returnedAmount * 1.05 } },
    include: { client: true },
  });

  if (invoicesByAmount.length === 1) {
    const status = resolveStatus(invoicesByAmount[0].client);
    await prisma.returnedReceipt.update({
      where: { id: receiptId },
      data: {
        invoiceId: invoicesByAmount[0].id,
        clientId: invoicesByAmount[0].clientId,
        status,
      },
    });
    return;
  }

  if (invoicesByAmount.length > 1) {
    await prisma.returnedReceipt.update({
      where: { id: receiptId },
      data: { status: "REVISAR" },
    });
    return;
  }

  // Cap match
  await prisma.returnedReceipt.update({
    where: { id: receiptId },
    data: { status: "REVISAR" },
  });
}

export async function matchAllDetected(): Promise<number> {
  const detected = await prisma.returnedReceipt.findMany({
    where: { status: "DETECTAT" },
  });

  for (const r of detected) {
    await matchReceipt(r.id);
  }

  return detected.length;
}
