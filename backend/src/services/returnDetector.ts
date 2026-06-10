import prisma from "../lib/prisma";

const DEFAULT_KEYWORDS = [
  "devolucio", "devolución", "recibo devuelto", "impagado",
  "retorno", "adeudo devuelto", "SEPA", "recibo",
];

export async function detectReturns(): Promise<number> {
  const settings = await prisma.appSettings.findMany();
  const keywordsSetting = settings.find((s) => s.key === "return_keywords");
  const keywords = keywordsSetting
    ? keywordsSetting.value.split(",").map((k) => k.trim().toLowerCase())
    : DEFAULT_KEYWORDS;

  const movements = await prisma.bankMovement.findMany({
    where: { isReturn: false },
  });

  let detected = 0;

  for (const mv of movements) {
    const concept = (mv.concept || "").toLowerCase();
    const isNegative = mv.amount < 0;

    const keywordMatch = keywords.some((kw) => concept.includes(kw));

    if (keywordMatch && isNegative) {
      await prisma.bankMovement.update({
        where: { id: mv.id },
        data: { isReturn: true },
      });

      const existing = await prisma.returnedReceipt.findFirst({
        where: { bankMovementId: mv.id },
      });

      if (!existing) {
        await prisma.returnedReceipt.create({
          data: {
            bankMovementId: mv.id,
            returnedAmount: Math.abs(mv.amount),
            returnDate: mv.date,
            returnReason: concept,
            receiptReference: mv.reference || concept,
            status: "DETECTED",
          },
        });
        detected++;
      }
    }
  }

  return detected;
}
