import { parse } from "csv-parse/sync";
import { TxClient } from "../lib/prisma";
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

const ALL_HEADER_ALIASES = Object.values(COLUMN_ALIASES).flat().map((a) => a.toLowerCase());

function findColumn(row: CsvRow, aliases: string[]): string | undefined {
  const keys = Object.keys(row);
  for (const a of aliases) {
    const match = keys.find((k) => k.toLowerCase().trim() === a.toLowerCase());
    if (match) return match;
  }
  return undefined;
}

function getValue(row: CsvRow, aliases: string[]): string | undefined {
  const col = findColumn(row, aliases);
  return col ? row[col]?.trim() : undefined;
}

function looksLikeHeader(line: string): boolean {
  const fields = line.toLowerCase().split(";");
  return fields.some((f) => ALL_HEADER_ALIASES.includes(f.trim()));
}

function skipMetadataRows(content: string): string {
  const lines = content.split(/\r?\n/);
  let headerIdx = lines.findIndex(looksLikeHeader);
  if (headerIdx === -1) headerIdx = 0;
  return lines.slice(headerIdx).join("\n");
}

function parseDate(val: string | undefined): Date | null {
  if (!val) return null;
  const dmyMatch = val.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1]);
    const month = parseInt(dmyMatch[2]) - 1;
    let year = parseInt(dmyMatch[3]);
    if (year < 100) year += 2000;
    const dt = new Date(year, month, day);
    if (!isNaN(dt.getTime()) && dt.getDate() === day && dt.getMonth() === month) {
      return dt;
    }
  }
  const dt = new Date(val);
  return isNaN(dt.getTime()) ? null : dt;
}

function parseAmount(val: string | undefined): number {
  if (!val) return 0;
  const hasComma = val.includes(",");
  const hasDot = val.includes(".");
  let cleaned = val;
  if (hasComma && hasDot) {
    const lastComma = val.lastIndexOf(",");
    const lastDot = val.lastIndexOf(".");
    if (lastComma > lastDot) {
      cleaned = val.replace(/\./g, "").replace(",", ".");
    } else {
      cleaned = val.replace(/,/g, "");
    }
  } else if (hasComma) {
    const commaPos = val.lastIndexOf(",");
    const afterComma = val.substring(commaPos + 1);
    if (afterComma.length <= 2 && commaPos > 0) {
      cleaned = val.replace(",", ".");
    } else {
      cleaned = val.replace(/,/g, "");
    }
  }
  return parseFloat(cleaned) || 0;
}

// Import from file path (standalone call)
export async function importCsv(filePath: string): Promise<{ imported: number; skipped: number }> {
  const fs = await import("fs");
  let content = fs.readFileSync(filePath, "utf-8");
  return importCsvContent(content);
}

// Import from CSV content with optional transaction
export async function importCsvContent(
  content: string,
  tx: TxClient = prisma,
): Promise<{ imported: number; skipped: number }> {
  content = skipMetadataRows(content);
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

    const date = parseDate(dateStr);
    if (!date) {
      skipped++;
      continue;
    }

    await tx.bankMovement.create({
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
