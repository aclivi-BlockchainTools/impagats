import prisma from "../lib/prisma";

export async function reconcileNewMovements(): Promise<number> {
  const openReceipts = await prisma.returnedReceipt.findMany({
    where: { status: { in: ["NOTIFIED", "PROOF_RECEIVED"] } },
    include: { client: true },
  });

  const unreconciledMovements = await prisma.bankMovement.findMany({
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
        // Match by amount
        let confidence = 0.6;

        // If client exists, try name matching in concept
        if (receipt.client && mv.concept) {
          const nameParts = receipt.client.name.toLowerCase().split(" ");
          const conceptLow = mv.concept.toLowerCase();
          const nameMatch = nameParts.some((p) => p.length > 2 && conceptLow.includes(p));
          if (nameMatch) confidence = 0.9;
        }

        if (confidence >= 0.8) {
          await prisma.reconciliationMatch.create({
            data: {
              receiptId: receipt.id,
              bankMovementId: mv.id,
              amount: mv.amount,
              confidence,
            },
          });

          await prisma.returnedReceipt.update({
            where: { id: receipt.id },
            data: { status: "PAYMENT_CONFIRMED", paymentConfirmedAt: new Date() },
          });

          matched++;
          break; // One movement matches one receipt
        }
      }
    }
  }

  return matched;
}
