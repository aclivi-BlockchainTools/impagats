import prisma from "../lib/prisma";

const DEFAULT_KEYWORDS = [
  "devolucio", "devolución", "recibo devuelto", "impagado",
  "retorno", "adeudo devuelto", "SEPA", "recibo",
  "dev.rebut", "dev rebut", "devolució rebut",
];

const MONTHS_CA = [
  "Gener", "Febrer", "Març", "Abril", "Maig", "Juny",
  "Juliol", "Agost", "Setembre", "Octubre", "Novembre", "Desembre",
];

// Extract valor date from rawData and compute service period (month before)
function extractServiceInfo(rawData: any): { valorDate: Date | null; servicePeriod: string | null } {
  if (!rawData || typeof rawData !== "object") return { valorDate: null, servicePeriod: null };
  // Look for Valor/valor column in rawData
  const rawValor = rawData.Valor || rawData.valor || rawData.VALOR;
  if (!rawValor) return { valorDate: null, servicePeriod: null };

  // Parse DD/MM/YY or DD/MM/YYYY
  const dmyMatch = String(rawValor).trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!dmyMatch) return { valorDate: null, servicePeriod: null };

  const day = parseInt(dmyMatch[1]);
  const month = parseInt(dmyMatch[2]);
  let year = parseInt(dmyMatch[3]);
  if (year < 100) year += 2000;

  const valorDate = new Date(year, month - 1, day);
  if (isNaN(valorDate.getTime())) return { valorDate: null, servicePeriod: null };

  // Service is the month before valor date
  const serviceMonth = month - 1; // 1-indexed
  const serviceYear = serviceMonth < 1 ? year - 1 : year;
  const serviceMonthFixed = serviceMonth < 1 ? 12 : serviceMonth;

  return {
    valorDate,
    servicePeriod: `${MONTHS_CA[serviceMonthFixed - 1]} ${serviceYear}`,
  };
}

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
        const { servicePeriod } = extractServiceInfo(mv.rawData);
        const ref = mv.reference || concept.replace(/\s+/g, " ").trim();

        await prisma.returnedReceipt.create({
          data: {
            bankMovementId: mv.id,
            returnedAmount: Math.abs(mv.amount),
            returnDate: mv.date,
            returnReason: concept.replace(/\s+/g, " ").trim(),
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

  return detected;
}
