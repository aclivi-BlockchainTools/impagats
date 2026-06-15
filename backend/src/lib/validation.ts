import { z, ZodSchema } from "zod";

// Preprocess: empty string → null per camps opcionals
const emptyToNull = (v: unknown) => (v === "" ? null : v);

// --- Client ---
export const createClientSchema = z.object({
  name: z.string().min(1, "Nom requerit"),
  nif: z.preprocess(emptyToNull, z.string().nullable().optional()),
  phone: z.preprocess(emptyToNull, z.string().nullable().optional()),
  whatsapp: z.preprocess(emptyToNull, z.string().nullable().optional()),
  email: z.preprocess(emptyToNull, z.string().email("Email invàlid").nullable().optional()),
  externalRef: z.preprocess(emptyToNull, z.string().nullable().optional()),
  active: z.boolean().optional(),
});

export const updateClientSchema = createClientSchema.partial();

// --- Invoice ---
export const createInvoiceSchema = z.object({
  clientId: z.number().int().positive("clientId requerit"),
  invoiceNumber: z.string().min(1, "Número de factura requerit"),
  date: z.string().datetime({ message: "Data invàlida" }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Format de data invàlid")),
  dueDate: z.string().datetime().nullable().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/).nullable().optional()),
  amount: z.number().positive("Import ha de ser positiu"),
  status: z.string().optional(),
  externalRef: z.string().nullable().optional(),
});

export const updateInvoiceSchema = createInvoiceSchema.partial();

// --- ReturnedReceipt create (manual) ---
export const createReceiptSchema = z.object({
  clientId: z.number().int().positive("clientId requerit"),
  invoiceId: z.number().int().positive().nullable().optional(),
  returnedAmount: z.number().positive("Import requerit"),
  returnDate: z.string().min(1, "Data devolució requerida"),
  receiptDate: z.string().nullable().optional(),
  receiptReference: z.string().nullable().optional(),
  returnReason: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const RETURN_RECEIPT_STATUSES = [
  "DETECTAT", "EMPARELLAT", "REVISAR", "NOTIFICAT",
  "ESPERANT_JUSTIFICANT", "PAGAMENT_DECLARAT", "JUSTIFICANT_REBUT",
  "PENDENT_REVISIO", "PAGAMENT_CONFIRMAT", "TANCAT",
  "ERROR_WHATSAPP", "IGNORAT",
] as const;

export type ReturnReceiptStatus = (typeof RETURN_RECEIPT_STATUSES)[number];

// --- ReturnedReceipt update ---
export const updateReceiptSchema = z.object({
  status: z.enum(RETURN_RECEIPT_STATUSES).optional(),
  notes: z.string().nullable().optional(),
  clientId: z.number().int().positive().nullable().optional(),
  invoiceId: z.number().int().positive().nullable().optional(),
  receiptReference: z.string().nullable().optional(),
  servicePeriod: z.string().nullable().optional(),
  returnReason: z.string().nullable().optional(),
  returnedAmount: z.number().positive().optional(),
  returnDate: z.string().optional(),
});

// --- Manual match ---
export const matchReceiptSchema = z.object({
  clientId: z.number().int().positive().nullable().optional(),
  invoiceId: z.number().int().positive().nullable().optional(),
});

// --- Manual reply ---
export const manualReplySchema = z.object({
  text: z.string().min(1, "text requerit"),
});

// --- Settings ---
export const settingsSchema = z.record(z.string(), z.string());

// --- Helper ---
export function validate<T>(schema: ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) return result as { success: true; data: T };
  const messages = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  return { success: false, error: messages };
}
