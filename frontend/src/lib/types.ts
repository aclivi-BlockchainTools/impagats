// Tipus compartits per al frontend — en sincronia amb el model Prisma

export interface Client {
  id: number;
  name: string;
  poble: string | null;
  phone: string | null;
  whatsapp: string | null;
  whatsappBlocked: boolean;
  email: string | null;
  externalRef: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  baixa?: Baixa | null;
}

export interface Baixa {
  id: number;
  clientId: number;
  date: string;
  createdAt: string;
}

export interface Invoice {
  id: number;
  clientId: number;
  invoiceNumber: string;
  date: string;
  dueDate: string | null;
  amount: string; // Decimal → string
  status: string;
  externalRef: string | null;
  createdAt: string;
  updatedAt: string;
  client?: Client;
}

export interface BankMovement {
  id: number;
  importBatchId: number | null;
  importHash: string | null;
  rawData: any;
  concept: string | null;
  amount: string;
  date: string;
  reference: string | null;
  iban: string | null;
  isReturn: boolean;
  createdAt: string;
}

export interface ReturnedReceipt {
  id: number;
  clientId: number | null;
  invoiceId: number | null;
  bankMovementId: number;
  receiptReference: string | null;
  returnedAmount: string;
  returnDate: string;
  returnReason: string | null;
  status: string;
  notes: string | null;
  servicePeriod: string | null;
  detectedAt: string;
  notifiedAt: string | null;
  proofReceivedAt: string | null;
  paymentConfirmedAt: string | null;
  closedAt: string | null;
  reminderCount: number;
  lastReminderAt: string | null;
  createdAt: string;
  updatedAt: string;
  client?: Client | null;
  invoice?: Invoice | null;
  bankMovement?: BankMovement;
  messages?: Message[];
  proofs?: PaymentProof[];
  reconciliation?: ReconciliationMatch[];
  paymentPromises?: PaymentPromise[];
  statusHistory?: StatusHistory[];
  caseNotes?: CaseNote[];
}

export interface Message {
  id: number;
  receiptId: number;
  direction: "INBOUND" | "OUTBOUND";
  content: string | null;
  sentAt: string;
  status: string;
  externalId: string | null;
  agentIntent: string | null;
  agentAction: string | null;
  agentMetadata: any;
  needsReview: boolean;
}

export interface PaymentProof {
  id: number;
  receiptId: number;
  messageId: number | null;
  originalName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  sha256: string | null;
  storagePath: string;
  status: string;
  receivedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  notes: string | null;
}

export interface PaymentPromise {
  id: number;
  receiptId: number;
  clientId: number | null;
  body: string | null;
  promisedDate: string | null;
  status: string;
  fulfilledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReconciliationMatch {
  id: number;
  receiptId: number;
  bankMovementId: number;
  amount: string;
  matchedAt: string;
  confidence: number;
  manual: boolean;
  bankMovement?: BankMovement;
}

export interface StatusHistory {
  id: number;
  receiptId: number;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  actorType: string;
  actorId: string | null;
  createdAt: string;
}

export interface CaseNote {
  id: number;
  receiptId: number;
  author: string | null;
  body: string;
  createdAt: string;
}

export interface DashboardData {
  total: number;
  pending: number;
  notified: number;
  proofPending: number;
  closed: number;
  pendingAmount: number;
  waitingProof: number;
  paymentClaimed: number;
  whatsappError: number;
  countEmparellat: number;
  countDETECTAT: number;
  countRevisar: number;
  countPendentRevisio: number;
  countJustificantRebut: number;
  countPagamentDeclarat: number;
  countWhatsappError: number;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
