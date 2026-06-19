// Servei de notificacions WhatsApp
// Encua missatges a l'outbox en lloc d'enviar directament

import prisma from "../lib/prisma";
import { auditLog } from "../middleware/auditLog";
import { render, renderInitialNotification, renderMultipleNotification, filterByLanguage, TEMPLATE_FEE_LINE, TemplateVars } from "./replyTemplates";
import { enqueueMessage } from "./outboxService";

export async function sendWhatsApp(receiptId: number): Promise<{ success: boolean; error?: string; outboxId?: number }> {
  const receipt = await prisma.returnedReceipt.findUnique({
    where: { id: receiptId },
    include: { client: true, invoice: true },
  });

  if (!receipt) return { success: false, error: "Impagat no trobat" };
  if (!receipt.client) return { success: false, error: "Sense client assignat" };
  if (!receipt.client.whatsapp) return { success: false, error: "Client sense WhatsApp" };
  if (receipt.client.whatsappBlocked) return { success: false, error: "WhatsApp bloquejat per a aquest client" };

  if (["TANCAT", "PAGAMENT_CONFIRMAT"].includes(receipt.status)) {
    return { success: false, error: "El rebut ja està tancat o confirmat" };
  }

  // Get template and company info from AppSettings
  const settings = await prisma.appSettings.findMany();
  const templateSetting = settings.find((s) => s.key === "whatsapp_template");
  const feeLineSetting = settings.find((s) => s.key === "whatsapp_template_fee_line");
  const ibanSetting = settings.find((s) => s.key === "company_iban");
  const nameSetting = settings.find((s) => s.key === "company_name");

  const template = templateSetting?.value?.trim() || "";
  const companyIban = ibanSetting?.value || "ES00 0000 0000 0000 0000 0000";
  const companyName = nameSetting?.value || "Empresa";

  // Comptar total d'impagats del client (qualsevol estat) per determinar si aplica recàrrec
  let returnFeeTotal = 0;
  if (receipt.clientId) {
    const totalClientReceipts = await prisma.returnedReceipt.count({
      where: { clientId: receipt.clientId },
    });
    if (totalClientReceipts > 1) {
      returnFeeTotal = 2.0;
    }
  }

  const vars: TemplateVars = {
    client_name: receipt.client.name,
    invoice_number: receipt.invoice?.invoiceNumber || receipt.receiptReference || "N/A",
    amount: receipt.returnedAmount.toString(),
    receipt_reference: receipt.receiptReference || "",
    service_period: receipt.servicePeriod || "",
    company_iban: companyIban,
    company_name: companyName,
    ...(returnFeeTotal > 0 && {
      return_fee_per_receipt: "2,00",
      return_fee_total: returnFeeTotal.toFixed(2).replace(".", ","),
      total_with_fee: (Number(receipt.returnedAmount) + returnFeeTotal).toFixed(2).replace(".", ","),
    }),
  };

  let text = template ? render(template, vars) : renderInitialNotification(vars);

  // Afegir línia de recàrrec si aplica
  if (returnFeeTotal > 0) {
    const feeTemplate = feeLineSetting?.value?.trim() || TEMPLATE_FEE_LINE;
    text += "\n" + render(feeTemplate, vars);
  }

  // Filtrar per idioma del client (si no en té, s'envia bilingüe)
  text = filterByLanguage(text, receipt.client.language);

  // Encuar a l'outbox en lloc d'enviar directament
  const outboxId = await enqueueMessage({
    receiptId,
    clientId: receipt.client.id,
    phone: receipt.client.whatsapp,
    message: text,
  });

  if (outboxId === 0) {
    return { success: false, error: "Missatge no encuat (rebut tancat o duplicat)" };
  }

  await auditLog("ENQUEUE_WHATSAPP", "ReturnedReceipt", receiptId);

  return { success: true, outboxId };
}

export async function sendBulkWhatsApp(receiptIds: number[]): Promise<{ success: boolean; error?: string; outboxIds?: number[] }> {
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

  const template = templateSetting?.value?.trim() || "";
  const companyIban = ibanSetting?.value || "ES00 0000 0000 0000 0000 0000";
  const companyName = nameSetting?.value || "Empresa";

  // Comptar total d'impagats del client (qualsevol estat) per determinar si aplica recàrrec
  const totalClientReceipts = await prisma.returnedReceipt.count({
    where: { clientId: client.id },
  });
  const applyFee = totalClientReceipts > 1;
  const feePerReceipt = applyFee ? 2.0 : 0;
  const totalFees = feePerReceipt * receipts.length;

  const baseAmount = receipts.reduce((sum, r) => sum + Number(r.returnedAmount), 0);
  const totalAmount = baseAmount + totalFees;
  const receiptsList = receipts
    .map((r) => {
      const period = r.servicePeriod ? `📅 ${r.servicePeriod} — ` : "";
      const invoice = r.invoice?.invoiceNumber || r.receiptReference || "N/A";
      const amount = r.returnedAmount.toString();
      if (applyFee) {
        return `${period}Factura ${invoice} — ${amount} € + 2,00 € (despesa devolució)`;
      }
      return `${period}Factura ${invoice} — ${amount} €`;
    })
    .join("\n");

  const vars: TemplateVars = {
    client_name: client.name,
    receipts_list: receiptsList,
    total_amount: totalAmount.toFixed(2),
    company_iban: companyIban,
    company_name: companyName,
    ...(applyFee && {
      return_fee_total: totalFees.toFixed(2).replace(".", ","),
      return_fee_per_receipt: "2,00",
      total_with_fee: totalAmount.toFixed(2).replace(".", ","),
    }),
  };

  const rawText = template ? render(template, vars) : renderMultipleNotification(vars);
  const text = filterByLanguage(rawText, client.language);

  // Encuar un sol missatge per tots els rebuts del mateix client
  const firstReceiptId = receipts[0].id;
  const outboxId = await enqueueMessage({
    receiptId: firstReceiptId,
    clientId: client.id,
    phone: client.whatsapp,
    message: text,
  });

  if (outboxId === 0) {
    return { success: false, error: "Missatge no encuat" };
  }

  // Actualitzar TOTS els rebuts a NOTIFICAT i crear missatges per tots
  for (const r of receipts) {
    // Crear registre de missatge per cada rebut
    await prisma.message.create({
      data: {
        receiptId: r.id,
        direction: "OUTBOUND",
        content: text,
        status: "sent",
      },
    });

    // Actualitzar estat a NOTIFICAT si cal
    if (["DETECTAT", "EMPARELLAT", "REVISAR"].includes(r.status)) {
      await prisma.returnedReceipt.update({
        where: { id: r.id },
        data: { status: "NOTIFICAT", notifiedAt: new Date() },
      });
    }
  }

  await auditLog("ENQUEUE_BULK_WHATSAPP", "ReturnedReceipt", undefined, {
    receiptIds,
    clientId: client.id,
    clientName: client.name,
    totalAmount: totalAmount.toFixed(2),
    outboxId,
  });

  return { success: true, outboxIds: [outboxId] };
}
