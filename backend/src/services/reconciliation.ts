import { TxClient } from "../lib/prisma";
import prisma from "../lib/prisma";

export async function reconcileNewMovements(tx: TxClient = prisma): Promise<number> {
  const openReceipts = await tx.returnedReceipt.findMany({
    where: { status: { in: ["NOTIFICAT", "JUSTIFICANT_REBUT"] } },
    include: { client: true },
  });

  const unreconciledMovements = await tx.bankMovement.findMany({
    where: {
      amount: { gt: 0 },
      isReturn: false,
      reconciliationMatches: { none: {} },
    },
  });

  let matched = 0;

  for (const mv of unreconciledMovements) {
    for (const receipt of openReceipts) {
      const amountTolerance = 0.05;
      const minAmount = receipt.returnedAmount * (1 - amountTolerance);
      const maxAmount = receipt.returnedAmount * (1 + amountTolerance);

      if (mv.amount >= minAmount && mv.amount <= maxAmount) {
        let confidence = 0.6;

        if (receipt.client && mv.concept) {
          const nameParts = receipt.client.name.toLowerCase().split(" ");
          const conceptLow = mv.concept.toLowerCase();
          const nameMatch = nameParts.some((p) => p.length > 2 && conceptLow.includes(p));
          if (nameMatch) confidence = 0.9;
        }

        const isHighConfidence = confidence >= 0.8;

        await tx.reconciliationMatch.create({
          data: {
            receiptId: receipt.id,
            bankMovementId: mv.id,
            amount: mv.amount,
            confidence,
          },
        });

        await tx.returnedReceipt.update({
          where: { id: receipt.id },
          data: isHighConfidence
            ? { status: "PAGAMENT_CONFIRMAT", paymentConfirmedAt: new Date() }
            : { status: "REVISAR" },
        });

        matched++;
        break;
      }
    }
  }

  return matched;
}
