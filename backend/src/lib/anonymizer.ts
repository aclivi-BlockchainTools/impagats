// Anonimitzador de dades personals per l'LLM Observer
// Substitueix: DNI/NIF/CIF, telèfons, IBAN, emails
// Conserva: imports, mesos, imports monetaris

function anonymizeDocumentID(text: string): string {
  // CIF: lletra + 8 dígits (B12345678)
  let r = text.replace(/\b[A-HJ-NP-SUVW]\d{7}[A-J0-9]?\b/g, "DOCUMENT");
  // DNI/NIE: 7-8 dígits + lletra (12345678Z) o X/Y/Z + 7 dígits + lletra
  r = r.replace(/\b[XYZ]?\d{7,8}[A-Z]\b/g, "DOCUMENT");
  return r;
}

function anonymizePhone(text: string): string {
  // +34 amb espais i agrupacions
  let r = text.replace(/\+34[\s.-]*[0-9][\s.-]*[0-9]{2}[\s.-]*[0-9]{2}[\s.-]*[0-9]{2}[\s.-]*[0-9]{2}/g, "PHONE");
  // +34 seguit de 9 dígits
  r = r.replace(/\+34\d{9}/g, "PHONE");
  // Mòbil espanyol: 6 o 7 seguit de 8 dígits
  r = r.replace(/\b[67]\d{8}\b/g, "PHONE");
  // Fix amb prefix: 9X o 9XX seguit de format variable
  r = r.replace(/\b9\d{1,2}[\s.-]*\d{3}[\s.-]*\d{2}[\s.-]*\d{2}\b/g, "PHONE");
  // Fix compacte
  r = r.replace(/\b9\d{8}\b/g, "PHONE");
  return r;
}

function anonymizeIBAN(text: string): string {
  // IBAN espanyol: ES + 22 dígits, amb o sense espais/guions/punts
  // Format típic: ES91 2100 0418 4502 0005 1332 (2+4+4+4+4+4)
  // També: ES91 2100 0418 45 0005 1332 (2+4+4+2+4+4)
  let r = text.replace(/\bES\d{2}(?:[\s.-]*\d{4}){4,5}[\s.-]*\d{2,4}\b/g, "IBAN");
  // IBAN sense espais
  r = r.replace(/\bES\d{20,22}\b/g, "IBAN");
  return r;
}

function anonymizeEmail(text: string): string {
  // TLD de 2+ caràcters (estàndard) o 1 caràcter (ex: a@b.c)
  return text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{1,}\b/g, "EMAIL");
}

export function anonymizeText(text: string): string {
  if (!text) return "";
  let result = text;
  result = anonymizeEmail(result);
  result = anonymizeIBAN(result);
  result = anonymizePhone(result);
  result = anonymizeDocumentID(result);
  return result;
}

export interface AnonymizedMessage {
  direction: "INBOUND" | "OUTBOUND";
  text: string;
}

export interface ConversationContext {
  pendingAmount?: string;
  pendingPeriods?: string[];
  hasProof: boolean;
  hasReconciliation: boolean;
  status: string;
  messageCount: number;
  durationDays: number;
}

export interface AnonymizedConversation {
  messages: AnonymizedMessage[];
  context: ConversationContext;
}

export function anonymizeConversation(
  messages: Array<{ direction: string; content: string | null }>,
  context: ConversationContext
): AnonymizedConversation {
  return {
    messages: messages.map((m) => ({
      direction: (m.direction === "OUTBOUND" ? "OUTBOUND" : "INBOUND") as "INBOUND" | "OUTBOUND",
      text: m.direction === "INBOUND"
        ? anonymizeText(m.content || "")
        : (m.content || ""), // OUTBOUND no s'anonimitza tant
    })),
    context,
  };
}
