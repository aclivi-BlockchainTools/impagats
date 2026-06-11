import prisma from "../lib/prisma";
import { openwa } from "../connectors/OpenWAConnector";
import { auditLog } from "../middleware/auditLog";

const DEFAULT_TEMPLATE = `Hola {{client_name}},

T'informem que s'ha retornat el rebut del període {{service_period}} corresponent a la factura {{invoice_number}} per un import de {{amount}} €.

Per regularitzar la situació, fes una transferència al següent compte:

🏦 {{company_iban}}
📋 Factura: {{invoice_number}}

⚠️ IMPORTANT: Si us plau, envia'ns la foto del comprovant de pagament per aquest WhatsApp.

Gràcies.
{{company_name}}`;

const DEFAULT_MULTIPLE_TEMPLATE = `Hola {{client_name}},

T'informem que s'han retornat els rebuts següents:

{{receipts_list}}

🏦 {{company_iban}}
💰 Total a pagar: {{total_amount}} €

⚠️ IMPORTANT: Si us plau, envia'ns la foto dels comprovants de pagament per aquest WhatsApp.

Gràcies.
{{company_name}}`;

function resolveTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value || "");
  }
  return result;
}

export async function sendWhatsApp(receiptId: number): Promise<{ success: boolean; error?: string }> {
  const receipt = await prisma.returnedReceipt.findUnique({
    where: { id: receiptId },
    include: { client: true, invoice: true },
  });

  if (!receipt) return { success: false, error: "Impagat no trobat" };
  if (!receipt.client) return { success: false, error: "Sense client assignat" };
  if (!receipt.client.whatsapp) return { success: false, error: "Client sense WhatsApp" };

  // Get template and company info from AppSettings
  const settings = await prisma.appSettings.findMany();
  const templateSetting = settings.find((s) => s.key === "whatsapp_template");
  const ibanSetting = settings.find((s) => s.key === "company_iban");
  const nameSetting = settings.find((s) => s.key === "company_name");

  const template = templateSetting?.value?.trim() || DEFAULT_TEMPLATE;
  const companyIban = ibanSetting?.value || "ES00 0000 0000 0000 0000 0000";
  const companyName = nameSetting?.value || "Empresa";

  const text = resolveTemplate(template, {
    client_name: receipt.client.name,
    invoice_number: receipt.invoice?.invoiceNumber || receipt.receiptReference || "N/A",
    amount: receipt.returnedAmount.toFixed(2),
    receipt_reference: receipt.receiptReference || "",
    service_period: receipt.servicePeriod || "",
    company_iban: companyIban,
    company_name: companyName,
  });

  const result = await openwa.sendMessage(receipt.client.whatsapp, text);

  // Save message to history
  await prisma.message.create({
    data: {
      receiptId,
      direction: "OUTBOUND",
      content: text,
      status: result.success ? "sent" : "failed",
      externalId: result.externalId,
    },
  });

  if (result.success) {
    await prisma.returnedReceipt.update({
      where: { id: receiptId },
      data: { status: "NOTIFICAT", notifiedAt: new Date() },
    });
    await auditLog("SEND_WHATSAPP", "ReturnedReceipt", receiptId);
  }

  return result;
}

export async function sendBulkWhatsApp(receiptIds: number[]): Promise<{ success: boolean; error?: string }> {
  if (!receiptIds || receiptIds.length < 2) {
    return { success: false, error: "Calen almenys 2 impagats" };
  }

  const receipts = await prisma.returnedReceipt.findMany({
    where: { id: { in: receiptIds } },
    include: { client: true, invoice: true },
  });

  if (receipts.length !== receiptIds.length) {
    return { success: false, error: "Algun impagat no trobat" };
  }

  const clientIds = [...new Set(receipts.map((r) => r.clientId))];
  if (clientIds.length > 1) {
    return { success: false, error: "Tots els impagats han de ser del mateix client" };
  }

  const client = receipts[0].client;
  if (!client) return { success: false, error: "Sense client assignat" };
  if (!client.whatsapp) return { success: false, error: "Client sense WhatsApp" };

  const settings = await prisma.appSettings.findMany();
  const templateSetting = settings.find((s) => s.key === "whatsapp_template_multiple");
  const ibanSetting = settings.find((s) => s.key === "company_iban");
  const nameSetting = settings.find((s) => s.key === "company_name");

  const template = templateSetting?.value?.trim() || DEFAULT_MULTIPLE_TEMPLATE;
  const companyIban = ibanSetting?.value || "ES00 0000 0000 0000 0000 0000";
  const companyName = nameSetting?.value || "Empresa";

  const totalAmount = receipts.reduce((sum, r) => sum + r.returnedAmount, 0);
  const receiptsList = receipts
    .map((r) => {
      const period = r.servicePeriod || "Període desconegut";
      const invoice = r.invoice?.invoiceNumber || r.receiptReference || "N/A";
      return `📅 ${period} — Factura ${invoice} — ${r.returnedAmount.toFixed(2)} €`;
    })
    .join("\n");

  const text = resolveTemplate(template, {
    client_name: client.name,
    receipts_list: receiptsList,
    total_amount: totalAmount.toFixed(2),
    company_iban: companyIban,
    company_name: companyName,
  });

  const result = await openwa.sendMessage(client.whatsapp, text);

  for (const r of receipts) {
    await prisma.message.create({
      data: {
        receiptId: r.id,
        direction: "OUTBOUND",
        content: text,
        status: result.success ? "sent" : "failed",
        externalId: result.externalId,
      },
    });

    if (result.success) {
      await prisma.returnedReceipt.update({
        where: { id: r.id },
        data: { status: "NOTIFICAT", notifiedAt: new Date() },
      });
    }
  }

  if (result.success) {
    await auditLog("SEND_BULK_WHATSAPP", "ReturnedReceipt", undefined, {
      receiptIds, clientId: client.id, clientName: client.name,
      totalAmount: totalAmount.toFixed(2),
    });
  }

  return result;
}
