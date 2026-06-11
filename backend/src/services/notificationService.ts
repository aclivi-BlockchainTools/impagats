import prisma from "../lib/prisma";
import { openwa } from "../connectors/OpenWAConnector";
import { auditLog } from "../middleware/auditLog";

const DEFAULT_TEMPLATE = `Hola {{client_name}},

T'informem que s'ha retornat un rebut pendent i necessitem que facis la transferència al següent compte:

🏦 {{company_iban}}

📅 Període: {{service_period}}
💰 Import: {{amount}} €
📄 Ref. rebut: {{receipt_reference}}

⚠️ IMPORTANT: Si us plau, envia'ns la foto del comprovant de pagament per aquest WhatsApp.

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
    invoice_number: receipt.invoice?.invoiceNumber || "N/A",
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
