import { TxClient } from "../lib/prisma";
import prisma from "../lib/prisma";

function extractClientName(concept: string): string | null {
  const c = concept.trim();
  if (/CARREC|SEPA|DEVOL\.REBUTS/i.test(c) && !/DEV\.? ?REBUT [A-Z]/i.test(c)) {
    return null;
  }
  const match = c.match(
    /(?:DEV\.?\s*REBUT|DEVOLUCI[OÓ]\s*(?:REBUT)?|DEV\s+REBUT)\s+(.+)/i
  );
  if (match) {
    const name = match[1].trim();
    if (name.length > 2) return name.replace(/\s+/g, " ").trim();
  }
  return null;
}

function resolveStatus(client: { whatsapp?: string | null }): string {
  return client.whatsapp ? "EMPARELLAT" : "REVISAR";
}

function nameMatchScore(extractedName: string, clientName: string): number {
  const a = extractedName.toLowerCase().trim();
  const b = clientName.toLowerCase().trim();

  if (a === b) return 1.0;

  const partsA = a.split(/\s+/);
  const partsB = b.split(/\s+/);

  const allPartsInB = partsB.every((pb) => partsA.some((pa) => pa.includes(pb) || pb.includes(pa)));
  const allPartsInA = partsA.every((pa) => partsB.some((pb) => pb.includes(pa) || pa.includes(pb)));

  if (allPartsInB && allPartsInA) return 0.9;
  if (allPartsInB || allPartsInA) return 0.7;

  let matched = 0;
  const total = Math.max(partsA.length, partsB.length);
  for (const pa of partsA) {
    if (pa.length < 3) continue;
    if (partsB.some((pb) => pb.includes(pa) || pa.includes(pb))) {
      matched++;
    }
  }
  if (matched > 0) return (matched / total) * 0.8;

  return 0;
}

export async function matchReceipt(receiptId: number, tx: TxClient = prisma): Promise<void> {
  const receipt = await tx.returnedReceipt.findUnique({
    where: { id: receiptId },
  });

  if (!receipt || !["DETECTAT", "REVISAR"].includes(receipt.status)) return;

  const concept = receipt.receiptReference || receipt.returnReason || "";

  // 1. Try matching by invoice number in concept (4+ digit numbers)
  const refMatch = concept.match(/[\d]{4,}/);
  if (refMatch) {
    const invoice = await tx.invoice.findFirst({
      where: { invoiceNumber: refMatch[0] },
      include: { client: true },
    });
    if (invoice) {
      const status = resolveStatus(invoice.client);
      await tx.returnedReceipt.update({
        where: { id: receiptId },
        data: { invoiceId: invoice.id, clientId: invoice.clientId, status },
      });
      return;
    }
  }

  // 2. Try matching by client name extracted from concept
  const extractedName = extractClientName(concept);
  if (extractedName) {
    const clients = await tx.client.findMany({ where: { active: true } });
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
      const invoicesByAmount = await tx.invoice.findMany({
        where: {
          clientId: bestClient.id,
          amount: { gte: receipt.returnedAmount * 0.95, lte: receipt.returnedAmount * 1.05 },
        },
      });

      if (invoicesByAmount.length === 1) {
        await tx.returnedReceipt.update({
          where: { id: receiptId },
          data: {
            clientId: bestClient.id,
            invoiceId: invoicesByAmount[0].id,
            status,
          },
        });
        return;
      }

      await tx.returnedReceipt.update({
        where: { id: receiptId },
        data: { clientId: bestClient.id, status },
      });
      return;
    }

    if (bestClient && bestScore >= 0.4) {
      await tx.returnedReceipt.update({
        where: { id: receiptId },
        data: { clientId: bestClient.id, status: "REVISAR" },
      });
      return;
    }

    if (!bestClient || bestScore < 0.4) {
      const displayName = extractedName.replace(/\b\w/g, (c) => c.toUpperCase());
      const newClient = await tx.client.create({
        data: { name: displayName },
      });
      await tx.returnedReceipt.update({
        where: { id: receiptId },
        data: { clientId: newClient.id, status: "REVISAR" },
      });
      return;
    }
  }

  // 3. Matching per import (±5%)
  const invoicesByAmount = await tx.invoice.findMany({
    where: { amount: { gte: receipt.returnedAmount * 0.95, lte: receipt.returnedAmount * 1.05 } },
    include: { client: true },
  });

  if (invoicesByAmount.length === 1) {
    const status = resolveStatus(invoicesByAmount[0].client);
    await tx.returnedReceipt.update({
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
    await tx.returnedReceipt.update({
      where: { id: receiptId },
      data: { status: "REVISAR" },
    });
    return;
  }

  // No match
  await tx.returnedReceipt.update({
    where: { id: receiptId },
    data: { status: "REVISAR" },
  });
}

export async function matchAllDetected(tx: TxClient = prisma): Promise<number> {
  const detected = await tx.returnedReceipt.findMany({
    where: { status: "DETECTAT" },
  });

  for (const r of detected) {
    await matchReceipt(r.id, tx);
  }

  return detected.length;
}
