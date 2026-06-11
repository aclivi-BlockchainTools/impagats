// Restaura dades de prova
// Executar: cd backend && npx ts-node ../seed.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seed() {
  console.log("Esborrant dades existents...");
  await prisma.message.deleteMany();
  await prisma.paymentProof.deleteMany();
  await prisma.reconciliationMatch.deleteMany();
  await prisma.returnedReceipt.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.bankMovement.deleteMany();
  await prisma.client.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.appSettings.deleteMany();

  console.log("Creant clients...");
  const c1 = await prisma.client.create({ data: { name: "Marc Garcia", nif: "12345678A", phone: "600111222", whatsapp: "34600111222", email: "marc@example.com", active: true } });
  const c2 = await prisma.client.create({ data: { name: "Anna Pujol", nif: "23456789B", phone: "600222333", whatsapp: "34600222333", email: "anna@example.com", active: true } });
  const c3 = await prisma.client.create({ data: { name: "Joan Ferrer", nif: "34567890C", phone: "600333444", whatsapp: "34600333444", email: "joan@example.com", active: true } });
  const c4 = await prisma.client.create({ data: { name: "Marta Soler", nif: "45678901D", phone: "600444555", whatsapp: null, email: "marta@example.com", active: true } });
  const c5 = await prisma.client.create({ data: { name: "Pere Vidal", nif: "56789012E", phone: "600555666", whatsapp: "34600555666", email: "pere@example.com", active: true } });
  const c6 = await prisma.client.create({ data: { name: "Laura Casas", nif: "67890123F", phone: "600666777", whatsapp: "34600666777", email: "laura@example.com", active: true } });

  console.log("Creant factures...");
  const i1 = await prisma.invoice.create({ data: { clientId: c1.id, invoiceNumber: "F2026-001", date: new Date("2026-05-01"), dueDate: new Date("2026-05-15"), amount: 45.50, status: "pending" } });
  const i2 = await prisma.invoice.create({ data: { clientId: c2.id, invoiceNumber: "F2026-002", date: new Date("2026-05-01"), dueDate: new Date("2026-05-15"), amount: 120.00, status: "pending" } });
  const i3 = await prisma.invoice.create({ data: { clientId: c3.id, invoiceNumber: "F2026-003", date: new Date("2026-05-01"), dueDate: new Date("2026-05-15"), amount: 89.30, status: "pending" } });
  const i4 = await prisma.invoice.create({ data: { clientId: c5.id, invoiceNumber: "F2026-004", date: new Date("2026-05-01"), dueDate: new Date("2026-05-15"), amount: 67.80, status: "pending" } });
  const i5 = await prisma.invoice.create({ data: { clientId: c6.id, invoiceNumber: "F2026-005", date: new Date("2026-06-01"), dueDate: new Date("2026-06-15"), amount: 210.00, status: "pending" } });
  const i6 = await prisma.invoice.create({ data: { clientId: c1.id, invoiceNumber: "F2026-006", date: new Date("2026-06-01"), dueDate: new Date("2026-06-15"), amount: 45.50, status: "pending" } });

  console.log("Creant moviments bancaris...");
  const m1b = await prisma.bankMovement.create({ data: { rawData: { Data: "10/05/26", Concepte: "DEV.REBUT Marc Garcia", Import: "-45,50", Referencia: "REF001" }, concept: "DEV.REBUT Marc Garcia", amount: -45.50, date: new Date("2026-05-10"), reference: "REF001", isReturn: true } });
  const m2b = await prisma.bankMovement.create({ data: { rawData: { Data: "10/05/26", Concepte: "DEVOLUCIO REBUT Anna Pujol", Import: "-120,00", Referencia: "REF002" }, concept: "DEVOLUCIO REBUT Anna Pujol", amount: -120.00, date: new Date("2026-05-10"), reference: "REF002", isReturn: true } });
  const m3b = await prisma.bankMovement.create({ data: { rawData: { Data: "10/05/26", Concepte: "DEV.REBUT Joan Ferrer F2026-003", Import: "-89,30", Referencia: "REF003" }, concept: "DEV.REBUT Joan Ferrer F2026-003", amount: -89.30, date: new Date("2026-05-10"), reference: "REF003", isReturn: true } });
  const m4b = await prisma.bankMovement.create({ data: { rawData: { Data: "10/06/26", Concepte: "DEV.REBUT Laura Casas", Import: "-210,00", Referencia: "REF005" }, concept: "DEV.REBUT Laura Casas", amount: -210.00, date: new Date("2026-06-10"), reference: "REF005", isReturn: true } });
  const m5b = await prisma.bankMovement.create({ data: { rawData: { Data: "15/05/26", Concepte: "Transferencia Marc Garcia", Import: "45,50", Referencia: "T001" }, concept: "Transferencia Marc Garcia", amount: 45.50, date: new Date("2026-05-15"), reference: "T001", isReturn: false } });

  console.log("Creant moviments bancaris per impagats manuals...");
  const m4bm = await prisma.bankMovement.create({ data: { rawData: { manual: true }, concept: "Manual", amount: -67.80, date: new Date("2026-06-01"), reference: "REF004", isReturn: true } });
  const m6bm = await prisma.bankMovement.create({ data: { rawData: { manual: true }, concept: "Manual", amount: -55.00, date: new Date("2026-06-01"), reference: "REF006", isReturn: true } });

  console.log("Creant impagats...");
  const r1 = await prisma.returnedReceipt.create({ data: { clientId: c1.id, invoiceId: i1.id, bankMovementId: m1b.id, returnedAmount: 45.50, returnDate: new Date("2026-05-10"), receiptReference: "REF001", servicePeriod: "Abril 2026", status: "NOTIFICAT", notifiedAt: new Date("2026-06-10T14:32:00") } });
  const r2 = await prisma.returnedReceipt.create({ data: { clientId: c2.id, invoiceId: i2.id, bankMovementId: m2b.id, returnedAmount: 120.00, returnDate: new Date("2026-05-10"), receiptReference: "REF002", servicePeriod: "Abril 2026", status: "NOTIFICAT", notifiedAt: new Date("2026-06-10T14:35:00") } });
  const r3 = await prisma.returnedReceipt.create({ data: { clientId: c3.id, invoiceId: i3.id, bankMovementId: m3b.id, returnedAmount: 89.30, returnDate: new Date("2026-05-10"), receiptReference: "REF003", servicePeriod: "Abril 2026", status: "DETECTAT" } });
  const r4 = await prisma.returnedReceipt.create({ data: { clientId: c5.id, invoiceId: i4.id, bankMovementId: m4bm.id, returnedAmount: 67.80, returnDate: new Date("2026-06-01"), receiptReference: "REF004", servicePeriod: "Maig 2026", status: "EMPARELLAT" } });
  const r5 = await prisma.returnedReceipt.create({ data: { clientId: c6.id, invoiceId: i5.id, bankMovementId: m4b.id, returnedAmount: 210.00, returnDate: new Date("2026-06-10"), receiptReference: "REF005", servicePeriod: "Maig 2026", status: "NOTIFICAT", notifiedAt: new Date("2026-06-10T15:00:00") } });
  const r6 = await prisma.returnedReceipt.create({ data: { clientId: c4.id, invoiceId: null, bankMovementId: m6bm.id, returnedAmount: 55.00, returnDate: new Date("2026-06-01"), receiptReference: "REF006", status: "DETECTAT" } });

  console.log("Creant missatges de prova...");
  await prisma.message.create({ data: { receiptId: r1.id, direction: "OUTBOUND", content: "Benvolgut Marc, t'informem que s'ha retornat un rebut de 45,50€ corresponent al període Abril 2026. Pots fer el pagament al compte ES12 0000 0000 00 0000000000 indicant la referència REF001. Gràcies.", sentAt: new Date("2026-06-10T14:32:00") } });
  await prisma.message.create({ data: { receiptId: r2.id, direction: "OUTBOUND", content: "Benvolguda Anna, t'informem que s'ha retornat un rebut de 120,00€ corresponent al període Abril 2026. Pots fer el pagament al compte ES12 0000 0000 00 0000000000 indicant la referència REF002. Gràcies.", sentAt: new Date("2026-06-10T14:35:00") } });
  await prisma.message.create({ data: { receiptId: r5.id, direction: "OUTBOUND", content: "Benvolguda Laura, t'informem que s'ha retornat un rebut de 210,00€ corresponent al període Maig 2026. Pots fer el pagament al compte ES12 0000 0000 00 0000000000 indicant la referència REF005. Gràcies.", sentAt: new Date("2026-06-10T15:00:00") } });

  console.log("Configurant OpenWA i empresa...");
  await prisma.appSettings.create({ data: { key: "company_name", value: "Gestoria Impagats SL" } });
  await prisma.appSettings.create({ data: { key: "company_iban", value: "ES12 0000 0000 00 0000000000" } });
  await prisma.appSettings.create({ data: { key: "openwa_base_url", value: "http://192.168.0.194:2886" } });
  await prisma.appSettings.create({ data: { key: "openwa_session_id", value: "390fd350" } });
  await prisma.appSettings.create({ data: { key: "agent.enabled", value: "true" } });
  await prisma.appSettings.create({ data: { key: "agent.timeout_hores", value: "24" } });

  console.log("Fet!");
  console.log(`  ${await prisma.client.count()} clients`);
  console.log(`  ${await prisma.invoice.count()} factures`);
  console.log(`  ${await prisma.returnedReceipt.count()} impagats`);
  console.log(`  ${await prisma.appSettings.count()} configuracions`);
}

seed()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
