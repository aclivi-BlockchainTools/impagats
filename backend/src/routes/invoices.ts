import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { auditLog } from "../middleware/auditLog";
import { pick } from "../lib/validation";

const INVOICE_FIELDS = ["clientId", "invoiceNumber", "date", "dueDate", "amount", "status", "externalRef"];
const DATE_FIELDS = ["date", "dueDate"];

function cleanDates(data: Record<string, unknown>): Record<string, unknown> {
  const result = { ...data };
  for (const f of DATE_FIELDS) {
    if (result[f] === "" || result[f] === null || result[f] === undefined) {
      delete result[f];
    }
  }
  return result;
}

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  const { clientId } = req.query;
  const where = clientId ? { clientId: parseInt(clientId as string) } : {};
  const invoices = await prisma.invoice.findMany({
    where,
    include: { client: true },
    orderBy: { date: "desc" },
  });
  res.json(invoices);
});

router.get("/:id", async (req: Request, res: Response) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: parseInt(req.params.id as string) },
    include: { client: true },
  });
  if (!invoice) return res.status(404).json({ error: "Factura no trobada" });
  res.json(invoice);
});

router.post("/", async (req: Request, res: Response) => {
  const invoice = await prisma.invoice.create({ data: cleanDates(pick(req.body, INVOICE_FIELDS)) as any });
  await auditLog("CREATE", "Invoice", invoice.id, req.body);
  res.status(201).json(invoice);
});

router.put("/:id", async (req: Request, res: Response) => {
  const invoice = await prisma.invoice.update({
    where: { id: parseInt(req.params.id as string) },
    data: cleanDates(pick(req.body, INVOICE_FIELDS)) as any,
  });
  await auditLog("UPDATE", "Invoice", invoice.id, req.body);
  res.json(invoice);
});

router.delete("/:id", async (req: Request, res: Response) => {
  await prisma.invoice.delete({ where: { id: parseInt(req.params.id as string) } });
  await auditLog("DELETE", "Invoice", parseInt(req.params.id as string));
  res.status(204).send();
});

export default router;
