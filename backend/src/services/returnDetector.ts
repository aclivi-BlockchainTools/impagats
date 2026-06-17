import { TxClient } from "../lib/prisma";
import prisma from "../lib/prisma";
import { logger } from "../lib/logger";

const DEFAULT_KEYWORDS = [
  "devolucio", "devolución", "recibo devuelto", "impagado",
  "retorno", "adeudo devuelto", "SEPA", "recibo",
  "dev.rebut", "dev rebut", "devolució rebut",
];

const MONTHS_CA = [
  "Gener", "Febrer", "Març", "Abril", "Maig", "Juny",
  "Juliol", "Agost", "Setembre", "Octubre", "Novembre", "Desembre",
];

export function computeServicePeriod(date: Date): string {
  const day = date.getDate();
  const month = date.getMonth(); // 0-based: 0=Gener, 11=Desembre
  const year = date.getFullYear();

  let serviceMonth: number;
  let serviceYear: number;

  if (day <= 10) {
    // Primers 10 dies del mes → període = mes anterior
    serviceMonth = month - 1;
    if (serviceMonth < 0) { serviceMonth = 11; serviceYear = year - 1; }
    else serviceYear = year;
  } else if (day >= 21) {
    // Últims ~10 dies del mes → període = aquest mes
    serviceMonth = month;
    serviceYear = year;
  } else {
    // Dies 11-20 → mes anterior (comportament per defecte)
    serviceMonth = month - 1;
    if (serviceMonth < 0) { serviceMonth = 11; serviceYear = year - 1; }
    else serviceYear = year;
  }

  return `${MONTHS_CA[serviceMonth]} ${serviceYear}`;
}

function extractServiceInfo(rawData: any): { valorDate: Date | null; servicePeriod: string | null } {
  if (!rawData || typeof rawData !== "object") return { valorDate: null, servicePeriod: null };
  const rawValor = rawData.Valor || rawData.valor || rawData.VALOR;
  if (!rawValor) return { valorDate: null, servicePeriod: null };

  const dmyMatch = String(rawValor).trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!dmyMatch) return { valorDate: null, servicePeriod: null };

  const day = parseInt(dmyMatch[1]);
  const month = parseInt(dmyMatch[2]);
  let year = parseInt(dmyMatch[3]);
  if (year < 100) year += 2000;

  const valorDate = new Date(year, month - 1, day);
  if (isNaN(valorDate.getTime())) return { valorDate: null, servicePeriod: null };

  return {
    valorDate,
    servicePeriod: computeServicePeriod(valorDate),
  };
}

export async function detectReturns(tx: TxClient = prisma): Promise<number> {
  const settings = await tx.appSettings.findMany();
  const keywordsSetting = settings.find((s) => s.key === "return_keywords");
  const keywords = keywordsSetting
    ? keywordsSetting.value.split(",").map((k) => k.trim().toLowerCase())
    : DEFAULT_KEYWORDS;

  const movements = await tx.bankMovement.findMany({
    where: { isReturn: false },
  });

  let detected = 0;

  for (const mv of movements) {
    const concept = (mv.concept || "").toLowerCase();
    const isNegative = Number(mv.amount) < 0;

    const keywordMatch = keywords.some((kw) => concept.includes(kw));

    if (keywordMatch && isNegative) {
      await tx.bankMovement.update({
        where: { id: mv.id },
        data: { isReturn: true },
      });

      const existing = await tx.returnedReceipt.findFirst({
        where: { bankMovementId: mv.id },
      });

      if (!existing) {
        const { servicePeriod } = extractServiceInfo(mv.rawData);
        const ref = mv.reference || concept.replace(/\s+/g, " ").trim();

        await tx.returnedReceipt.create({
          data: {
            bankMovementId: mv.id,
            returnedAmount: Math.abs(Number(mv.amount)),
            returnDate: mv.date,
            returnReason: concept.replace(/\s+/g, " ").trim(),
            receiptReference: ref,
            notes: servicePeriod ? `Període: ${servicePeriod}` : null,
            servicePeriod: servicePeriod || null,
            status: "DETECTAT",
          },
        });
        detected++;
        logger.info({ movementId: mv.id, amount: Math.abs(Number(mv.amount)), concept: mv.concept }, "Devolució detectada");
      }
    }
  }

  logger.info({ detected, total: movements.length }, "Detecció de devolucions completada");
  return detected;
}
