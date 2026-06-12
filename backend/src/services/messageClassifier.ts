// Classificador tancat de missatges entrants
// Classifica, no conversa. Sense redacció lliure.
// Cada intent té una plantilla fixa a replyTemplates.ts

export type ClosedIntent =
  | "proof_media"
  | "payment_claim_without_proof"
  | "question"
  | "complaint"
  | "wrong_person"
  | "audio"
  | "unknown";

export interface ClassificationInput {
  body: string;
  hasMedia: boolean;
  mediaType?: string;       // MIME type del media (e.g. "image/jpeg", "audio/ogg")
  proofSaved?: boolean;     // true si el fitxer s'ha guardat correctament
}

export interface ClassificationResult {
  intent: ClosedIntent;
  shouldMarkJustificantRebut: boolean;
  shouldMarkPagamentDeclarat: boolean;
  shouldMarkRevisar: boolean;
  shouldReply: boolean;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// --- Detectors individuals ---

function isAudio(mediaType?: string): boolean {
  if (!mediaType) return false;
  return mediaType.startsWith("audio/") || mediaType === "audio/ogg; codecs=opus";
}

function isProofMedia(hasMedia: boolean, mediaType?: string, proofSaved?: boolean): boolean {
  if (!hasMedia || !mediaType) return false;
  if (isAudio(mediaType)) return false;
  // Accepta imatges, PDFs i documents
  const accepted = [
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];
  return accepted.some((t) => mediaType.startsWith(t)) && proofSaved === true;
}

function isPaymentClaim(text: string): boolean {
  const patterns = [
    /ja\s+(?:he|vaig)\s+(?:pagat|fet\s+(?:el\s+)?pagament|fet\s+(?:la\s+)?transferencia|fet\s+l'ingres)/,
    /\b(?:he|vaig)\s+pagat\b/,
    /(?:ja|ho)\s+(?:esta|he)\s+(?:fet|pagat)/,
    /transferencia\s+(?:feta|realitzada|enviada)/,
    /(?:ingres|ingrés)\s+(?:fet|realitzat)/,
    /pagament\s+(?:fet|realitzat|efectuat)/,
    /ja\s+(?:esta|estic)\s+(?:pagat|al\s+dia)/,
    /(?:he|vaig)\s+(?:realitzat|efectuat)\s+(?:el|la)\s+(?:pagament|transferencia)/,
    /\b(?:ja|tot)\s+(?:esta|fet)\b.*(?:pag|transfer)/,
    /(?:pagat|pagado)\s+(?:la\s+)?(?:factura|el\s+)?(?:rebut|recibo)/,
    /\bhecho\s+(?:el|la)\s+(?:pago|transferencia)\b/,
    /\bya\s+(?:he|lo)\s+(?:pagado|pague)\b/,
    /(?:pago|transferencia)\s+(?:hecho|realizado|enviado)/,
    /\besta\s+pagado\b/,
  ];
  return patterns.some((p) => p.test(text));
}

function isQuestion(text: string): boolean {
  // Preguntes sobre factura, import, motiu, servei, o qualsevol dubte
  if (/\?$/.test(text.trim())) return true;
  const patterns = [
    /(?:per\s+)?que\s+(?:es|m'han|m'heu)\s+(?:aixo|aquest|cobrat|carregat|retornat|tornat)/,
    /(?:quina|quin)\s+(?:factura|import|rebut|deute)/,
    /(?:no\s+)?(?:entenc|comprendo|se)\s+(?:que|per\s+que|res)/,
    /(?:podeu|poden|pots|pueden?)\s+(?:explicar|aclarir|dir-me|trucar)/,
    /(?:vull|voldria|quisiera|necessito)\s+(?:saber|parlar|aclarir|entendre)/,
    /(?:que|quina)\s+(?:es|seria)\s+(?:la\s+)?(?:factura|referencia|import)/,
    /(?:de\s+)?que\s+(?:va|tracta|es|import)/,
    /(?:m'ho\s+)?(?:pots|podeu)\s+(?:explicar|detallar)/,
    /(?:no\s+)?(?:se|sé)\s+(?:que|d'on|per\s+que)/,
    /(?:podria|podries)\s+(?:dir|explicar)/,
    /(?:a\s+)?(?:que|quin)\s+(?:correspon|es\s+deu)/,
    /(?:per\s+)?(?:quina|quin)\s+(?:rao|motiu)/,
    /(?:no\s+)?(?:ho\s+)?(?:entenc|comprendo)/,
  ];
  return patterns.some((p) => p.test(text));
}

function isComplaint(text: string): boolean {
  const patterns = [
    /(?:no|mai)\s+(?:estic|estoy)\s+(?:d'acord|de\s+acuerdo)/,
    /(?:aixo|aquest|aquesta)\s+(?:es|no\s+es)\s+(?:una\s+)?(?:error|equivocacio|mentida|estafa)/,
    /(?:es|sou|son)\s+(?:uns?\s+)?(?:estafadors?|lladres|impresentables)/,
    /(?:denunciar|denunciare|advocat|jutjat|consum)/,
    /(?:no\s+)?(?:pens(o|ar)\s+)?(?:pagar|pagare)/,
    /(?:deixeu|deixi|dejen)\s+(?:de|d')(?:enviar|molestar|trucar)/,
    /(?:no\s+)?(?:vull|vull\s+parlar)\s+(?:amb|mes)\s+(?:un\s+)?(?:humà|persona|supervisor)/,
    /(?:aixo|esto)\s+(?:es|no\s+es)\s+(?:correcte|just|legal)/,
    /(?:estic|estoy)\s+(?:molt\s+)?(?:enfadat|enfadada|indignat|indignada|cansat|cansada)/,
    /(?:ja\s+)?(?:n'estic\s+)?(?:fart|tip)/,
    /(?:no\s+)?m(?:o|e)\s+(?:esteu|esteu|estan)\s+(?:molestant|acosant)/,
    /(?:queixa|reclamacio|reclamació|quej(a|ara|ará))/,
  ];
  return patterns.some((p) => p.test(text));
}

function isWrongPerson(text: string): boolean {
  const patterns = [
    /(?:no|no\s+soy|no\s+soc)\s+(?:el|la|yo|jo)\b/,
    /(?:no|no\s+es)\s+(?:el\s+meu|la\s+meva|meu|meva)\s+(?:numero|telefon|whatsapp)/,
    /(?:numero|numero|tel[èe]fon)\s+(?:equivocat|incorrecte|erroni)/,
    /(?:s'han|s'ha|us\s+heu|t'has)\s+equivocat/,
    /(?:no\s+)?(?:conec|conec\s+a)\s+(?:aquesta|aquest)\s+(?:persona|empresa)/,
    /(?:no\s+)?(?:s[ée]\s+)?(?:qui|de\s+qui)\s+(?:es|soc|parleu)/,
    /(?:error|equivocacio|equivocaci[oó])\s+(?:de|del)\s+(?:numero|persona|contacte)/,
    /(?:no\s+)?(?:soc|soy)\s+(?:el|la)\s+(?:titular|propietari)/,
    /(?:aquesta|aquest)\s+(?:persona|numero)\s+(?:no\s+)?(?:es|coneix|existeix)/,
    /\bequivocat\b.*\b(numero|persona|whatsapp)\b/,
  ];
  return patterns.some((p) => p.test(text));
}

function isPaymentMention(text: string): boolean {
  // Detecta si el text esmenta haver pagat/transferit (més relaxat que isPaymentClaim)
  const patterns = [
    /(?:he|vaig|estic|estem)\s+(?:pagat|fet|realitzat|efectuat)/,
    /\b(?:pagat|pagado|pago|pagament|pagamiento)\b/,
    /\b(?:transferencia|transferència|ingres|ingrés)\b/,
    /\b(?:fet|hecho)\b.*\b(?:pag|transfer|ingres)\b/,
  ];
  return patterns.some((p) => p.test(text));
}

// --- Classificador principal ---

export function classify(input: ClassificationInput): ClassificationResult {
  const { body, hasMedia, mediaType, proofSaved } = input;
  const normalized = normalize(body);

  // 1. Audio → audio (té prioritat sobre altres)
  if (hasMedia && isAudio(mediaType)) {
    return {
      intent: "audio",
      shouldMarkJustificantRebut: false,
      shouldMarkPagamentDeclarat: false,
      shouldMarkRevisar: false,
      shouldReply: true,
    };
  }

  // 2. Media vàlid amb fitxer guardat → proof_media
  if (isProofMedia(hasMedia, mediaType, proofSaved)) {
    return {
      intent: "proof_media",
      shouldMarkJustificantRebut: true,
      shouldMarkPagamentDeclarat: false,
      shouldMarkRevisar: false,
      shouldReply: true,
    };
  }

  // 3. Media rebut però fitxer no guardat → unknown (error tècnic)
  if (hasMedia && mediaType && !isAudio(mediaType) && !proofSaved) {
    return {
      intent: "unknown",
      shouldMarkJustificantRebut: false,
      shouldMarkPagamentDeclarat: false,
      shouldMarkRevisar: true,
      shouldReply: true,
    };
  }

  // 4. Wrong person
  if (isWrongPerson(normalized)) {
    return {
      intent: "wrong_person",
      shouldMarkJustificantRebut: false,
      shouldMarkPagamentDeclarat: false,
      shouldMarkRevisar: true,
      shouldReply: true,
    };
  }

  // 5. Payment claim sense fitxer
  if (isPaymentClaim(normalized)) {
    return {
      intent: "payment_claim_without_proof",
      shouldMarkJustificantRebut: false,
      shouldMarkPagamentDeclarat: true,
      shouldMarkRevisar: false,
      shouldReply: true,
    };
  }

  // 6. Complaint
  if (isComplaint(normalized)) {
    return {
      intent: "complaint",
      shouldMarkJustificantRebut: false,
      shouldMarkPagamentDeclarat: false,
      shouldMarkRevisar: true,
      shouldReply: true,
    };
  }

  // 7. Question
  if (isQuestion(normalized)) {
    return {
      intent: "question",
      shouldMarkJustificantRebut: false,
      shouldMarkPagamentDeclarat: false,
      shouldMarkRevisar: false,
      shouldReply: true,
    };
  }

  // 8. Unknown — intentem detectar si sona a pagament encara que no sigui clar
  if (isPaymentMention(normalized)) {
    return {
      intent: "payment_claim_without_proof",
      shouldMarkJustificantRebut: false,
      shouldMarkPagamentDeclarat: true,
      shouldMarkRevisar: false,
      shouldReply: true,
    };
  }

  // 9. Fallback: unknown
  return {
    intent: "unknown",
    shouldMarkJustificantRebut: false,
    shouldMarkPagamentDeclarat: false,
    shouldMarkRevisar: false,
    shouldReply: true,
  };
}
