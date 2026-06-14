import { TxClient } from "../lib/prisma";
import prisma from "../lib/prisma";
import { recordStatusChange } from "./statusHistory";
import { logger } from "../lib/logger";

interface MatchScore {
  receiptId: number;
  bankMovementId: number;
  score: number;
  reasons: string[];
  amount: number | any;
}

// Calcula l'score de coincidència entre un rebut i un moviment bancari
function calculateMatchScore(
  receipt: any,
  movement: any,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let totalScore = 0;
  const maxScore = 100;

  const receiptAmount = Math.abs(Number(receipt.returnedAmount));
  const mvAmount = Number(movement.amount);

  // 1. Import exacte: +50
  if (Math.abs(mvAmount - receiptAmount) < 0.001) {
    totalScore += 50;
    reasons.push("Import exacte");
  } else if (mvAmount >= receiptAmount * 0.98 && mvAmount <= receiptAmount * 1.02) {
    // Import ±2%: +30
    totalScore += 30;
    reasons.push(`Import proper (±2%): ${mvAmount.toFixed(2)} vs ${receiptAmount.toFixed(2)}`);
  } else if (mvAmount >= receiptAmount * 0.90 && mvAmount <= receiptAmount * 1.10) {
    // Import ±10%: +10
    totalScore += 10;
    reasons.push(`Import aproximat (±10%): ${mvAmount.toFixed(2)} vs ${receiptAmount.toFixed(2)}`);
  }

  // 2. Nom del client al concepte: +30
  if (receipt.client && movement.concept) {
    const nameParts = receipt.client.name.toLowerCase().split(/\s+/);
    const conceptLow = movement.concept.toLowerCase();
    const matchedParts = nameParts.filter((p: string) => p.length > 2 && conceptLow.includes(p));
    if (matchedParts.length >= 2) {
      totalScore += 30;
      reasons.push("Nom del client al concepte");
    } else if (matchedParts.length === 1) {
      totalScore += 15;
      reasons.push("Part del nom al concepte");
    }
  }

  // 3. Factura al concepte: +40
  if (receipt.invoice?.invoiceNumber && movement.concept) {
    const invNum = receipt.invoice.invoiceNumber.toLowerCase();
    if (movement.concept.toLowerCase().includes(invNum)) {
      totalScore += 40;
      reasons.push(`Factura ${receipt.invoice.invoiceNumber} al concepte`);
    }
  }

  // 4. Referència al concepte: +20
  if (receipt.receiptReference && movement.concept) {
    const ref = receipt.receiptReference.toLowerCase();
    if (movement.concept.toLowerCase().includes(ref)) {
      totalScore += 20;
      reasons.push("Referència al concepte");
    }
  }

  // 5. Període al concepte: +10
  if (receipt.servicePeriod && movement.concept) {
    const periodLower = receipt.servicePeriod.toLowerCase();
    const conceptLower = movement.concept.toLowerCase();
    const periodParts = periodLower.split(/\s+/);
    if (periodParts.some((p: string) => p.length > 2 && conceptLower.includes(p))) {
      totalScore += 10;
      reasons.push("Període al concepte");
    }
  }

  // 6. Transferència posterior al retorn: +5
  if (movement.date && receipt.returnDate) {
    const mvDate = new Date(movement.date);
    const retDate = new Date(receipt.returnDate);
    if (mvDate > retDate) {
      totalScore += 5;
      reasons.push("Data posterior al retorn");
    }
  }

  // Normalitzar a 0-100
  const normalizedScore = Math.min(100, Math.round((totalScore / maxScore) * 100));

  return { score: normalizedScore, reasons };
}

// Calcula si un moviment bancari és la suma de N rebuts del mateix client
async function checkSumMatch(
  receipt: any,
  allOpenReceipts: any[],
  movement: any,
): Promise<{ score: number; reasons: string[] } | null> {
  const clientReceipts = allOpenReceipts.filter(
    (r) => r.clientId === receipt.clientId && r.id !== receipt.id,
  );

  if (clientReceipts.length === 0) return null;

  const receiptAmount = Math.abs(Number(receipt.returnedAmount));
  const mvAmount = Number(movement.amount);

  // Buscar combinacions de 2-3 rebuts que sumin l'import del moviment
  const candidates = [receipt, ...clientReceipts];
  const amounts = candidates.map((r) => ({
    receipt: r,
    amount: Math.abs(Number(r.returnedAmount)),
  }));

  // Provar combinacions de 2 rebuts
  for (let i = 0; i < amounts.length; i++) {
    for (let j = i + 1; j < amounts.length; j++) {
      const sum = amounts[i].amount + amounts[j].amount;
      if (Math.abs(mvAmount - sum) < 0.02) {
        return {
          score: 70,
          reasons: [`Suma de 2 rebuts: ${amounts[i].amount.toFixed(2)} + ${amounts[j].amount.toFixed(2)} = ${sum.toFixed(2)}`],
        };
      }
    }
  }

  // Provar combinacions de 3 rebuts
  for (let i = 0; i < amounts.length; i++) {
    for (let j = i + 1; j < amounts.length; j++) {
      for (let k = j + 1; k < amounts.length; k++) {
        const sum = amounts[i].amount + amounts[j].amount + amounts[k].amount;
        if (Math.abs(mvAmount - sum) < 0.02) {
          return {
            score: 65,
            reasons: [`Suma de 3 rebuts: ${sum.toFixed(2)}`],
          };
        }
      }
    }
  }

  return null;
}

export async function reconcileNewMovements(tx: TxClient = prisma): Promise<number> {
  const openReceipts = await tx.returnedReceipt.findMany({
    where: { status: { in: ["NOTIFICAT", "JUSTIFICANT_REBUT", "PAGAMENT_DECLARAT", "ESPERANT_JUSTIFICANT", "PENDENT_REVISIO"] } },
    include: { client: true, invoice: true },
  });

  const unreconciledMovements = await tx.bankMovement.findMany({
    where: {
      amount: { gt: 0 },
      isReturn: false,
      reconciliationMatches: { none: {} },
    },
  });

  let matched = 0;

  for (const movement of unreconciledMovements) {
    const matches: MatchScore[] = [];

    for (const receipt of openReceipts) {
      // Score bàsic import
      const base = calculateMatchScore(receipt, movement);

      if (base.score >= 30) {
        matches.push({
          receiptId: receipt.id,
          bankMovementId: movement.id,
          score: base.score,
          reasons: base.reasons,
          amount: movement.amount,
        });
      }

      // Comprovar suma de rebuts si l'import no és exacte
      if (base.score < 80) {
        const sumResult = await checkSumMatch(receipt, openReceipts, movement);
        if (sumResult) {
          matches.push({
            receiptId: receipt.id,
            bankMovementId: movement.id,
            score: sumResult.score,
            reasons: sumResult.reasons,
            amount: movement.amount,
          });
        }
      }
    }

    // Ordenar per score descendent
    matches.sort((a, b) => b.score - a.score);

    // Agafar el millor match per aquest moviment
    const best = matches[0];
    if (best && best.score >= 40) {
      const confidence = best.score / 100;
      const oldStatus = openReceipts.find((r) => r.id === best.receiptId)?.status || null;
      const isHighConfidence = best.score >= 80;
      const newStatus = isHighConfidence ? "PAGAMENT_CONFIRMAT" : "REVISAR";

      await tx.reconciliationMatch.create({
        data: {
          receiptId: best.receiptId,
          bankMovementId: best.bankMovementId,
          amount: Number(best.amount),
          confidence,
          manual: false,
        },
      });

      await tx.returnedReceipt.update({
        where: { id: best.receiptId },
        data: isHighConfidence
          ? { status: "PAGAMENT_CONFIRMAT", paymentConfirmedAt: new Date() }
          : { status: "REVISAR" },
      });

      await recordStatusChange({
        receiptId: best.receiptId,
        fromStatus: oldStatus,
        toStatus: newStatus,
        reason: `Conciliació automàtica (score: ${best.score}, motius: ${best.reasons.join(", ")})`,
        actorType: "SYSTEM",
      });

      logger.info({
        receiptId: best.receiptId,
        movementId: best.bankMovementId,
        score: best.score,
        reasons: best.reasons,
        status: newStatus,
      }, "Conciliació: match trobat");

      matched++;
    }
  }

  return matched;
}

// Llistar tots els matches de conciliació amb detalls
export async function getReconciliationMatches(params?: {
  minScore?: number;
  manual?: boolean;
}) {
  const where: any = {};
  if (params?.minScore) where.confidence = { gte: params.minScore / 100 };
  if (params?.manual !== undefined) where.manual = params.manual;

  return prisma.reconciliationMatch.findMany({
    where,
    include: {
      receipt: { include: { client: true, invoice: true } },
      bankMovement: true,
    },
    orderBy: { matchedAt: "desc" },
    take: 100,
  });
}
