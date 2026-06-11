import { z, ZodSchema } from "zod";

// --- Client ---
export const createClientSchema = z.object({
  name: z.string().min(1, "Nom requerit"),
  nif: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  email: z.string().email("Email invàlid").nullable().optional(),
  externalRef: z.string().nullable().optional(),
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

// --- ReturnedReceipt update ---
export const updateReceiptSchema = z.object({
  status: z.enum([
    "DETECTAT", "EMPARELLAT", "REVISAR", "NOTIFICAT",
    "JUSTIFICANT_REBUT", "PAGAMENT_CONFIRMAT", "TANCAT", "IGNORAT", "ESPERANT_DETALLS",
  ]).optional(),
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
