import { parse } from "csv-parse/sync";
import prisma from "../lib/prisma";

interface CsvRow {
  [key: string]: string;
}

const COLUMN_ALIASES: Record<string, string[]> = {
  concept: ["concepto", "concepte", "descripcion", "descripcio", "description", "concept"],
  amount: ["importe", "import", "amount", "quantitat"],
  date: ["fecha", "data", "date", "fecha_operacion", "data_operacio"],
  reference: ["referencia", "referencia", "reference", "ref"],
  iban: ["iban", "IBAN", "cuenta", "compte", "account"],
};

function findColumn(row: CsvRow, aliases: string[]): string | undefined {
  const keys = Object.keys(row);
  return aliases.find((a) => keys.some((k) => k.toLowerCase().trim() === a.toLowerCase()));
}

function getValue(row: CsvRow, aliases: string[]): string | undefined {
  const col = findColumn(row, aliases);
  return col ? row[col]?.trim() : undefined;
}

function parseAmount(val: string | undefined): number {
  if (!val) return 0;
  // Detect format: if comma is last non-digit char, it's decimal (ES/CA: 1.234,56)
  // Otherwise dot is decimal (EN: 1,234.56 or plain 200.00)
  const hasComma = val.includes(",");
  const hasDot = val.includes(".");
  let cleaned = val;
  if (hasComma && hasDot) {
    // Both present: last occurrence determines decimal separator
    const lastComma = val.lastIndexOf(",");
    const lastDot = val.lastIndexOf(".");
    if (lastComma > lastDot) {
      // Comma is decimal: 1.234,56
      cleaned = val.replace(/\./g, "").replace(",", ".");
    } else {
      // Dot is decimal: 1,234.56
      cleaned = val.replace(/,/g, "");
    }
  } else if (hasComma) {
    // Only comma: could be decimal or thousands. Check position.
    const commaPos = val.lastIndexOf(",");
    const afterComma = val.substring(commaPos + 1);
    if (afterComma.length <= 2 && commaPos > 0) {
      // Likely decimal: 1234,56
      cleaned = val.replace(",", ".");
    } else {
      // Likely thousands: 1234 (no decimals) or 1,234,567
      cleaned = val.replace(/,/g, "");
    }
  }
  // If only dots, they're already decimal separators (or thousands in ES, but we default to EN)
  return parseFloat(cleaned) || 0;
}

export async function importCsv(filePath: string): Promise<{ imported: number; skipped: number }> {
  const fs = await import("fs");
  const content = fs.readFileSync(filePath, "utf-8");
  const rows: CsvRow[] = parse(content, {
    columns: true,
    delimiter: ";",
    skip_empty_lines: true,
    bom: true,
  });

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const concept = getValue(row, COLUMN_ALIASES.concept) || "";
    const amount = parseAmount(getValue(row, COLUMN_ALIASES.amount));
    const dateStr = getValue(row, COLUMN_ALIASES.date);
    const reference = getValue(row, COLUMN_ALIASES.reference);
    const iban = getValue(row, COLUMN_ALIASES.iban);

    if (!concept || !dateStr || isNaN(amount)) {
      skipped++;
      continue;
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      skipped++;
      continue;
    }

    await prisma.bankMovement.create({
      data: {
        rawData: row as any,
        concept,
        amount,
        date,
        reference,
        iban,
      },
    });
    imported++;
  }

  return { imported, skipped };
}
