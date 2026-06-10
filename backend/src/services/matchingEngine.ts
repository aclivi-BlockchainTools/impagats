import prisma from "../lib/prisma";

export async function matchReceipt(receiptId: number): Promise<void> {
  const receipt = await prisma.returnedReceipt.findUnique({
    where: { id: receiptId },
  });

  if (!receipt || receipt.status === "IGNORED" || receipt.status === "CLOSED") return;

  // Matching per referència exacta (número de factura al concepte)
  const ref = receipt.receiptReference || "";
  const invoiceMatch = ref.match(/[\d]{4,}/);
  if (invoiceMatch) {
    const invoice = await prisma.invoice.findFirst({
      where: { invoiceNumber: invoiceMatch[0] },
    });
    if (invoice) {
      await prisma.returnedReceipt.update({
        where: { id: receiptId },
        data: { invoiceId: invoice.id, clientId: invoice.clientId, status: "MATCHED" },
      });
      return;
    }
  }

  // Matching per import
  const invoicesByAmount = await prisma.invoice.findMany({
    where: { amount: { gte: receipt.returnedAmount * 0.95, lte: receipt.returnedAmount * 1.05 } },
  });

  if (invoicesByAmount.length === 1) {
    await prisma.returnedReceipt.update({
      where: { id: receiptId },
      data: {
        invoiceId: invoicesByAmount[0].id,
        clientId: invoicesByAmount[0].clientId,
        status: "MATCHED",
      },
    });
    return;
  }

  if (invoicesByAmount.length > 1) {
    await prisma.returnedReceipt.update({
      where: { id: receiptId },
      data: { status: "NEEDS_REVIEW" },
    });
    return;
  }

  // Cap match
  await prisma.returnedReceipt.update({
    where: { id: receiptId },
    data: { status: "NEEDS_REVIEW" },
  });
}

export async function matchAllDetected(): Promise<number> {
  const detected = await prisma.returnedReceipt.findMany({
    where: { status: "DETECTED" },
  });

  for (const r of detected) {
    await matchReceipt(r.id);
  }

  return detected.length;
}
