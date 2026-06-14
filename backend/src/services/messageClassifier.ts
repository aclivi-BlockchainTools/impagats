// Classificador tancat de missatges entrants
// Classifica, no conversa. Sense redacció lliure.
// Cada intent té una plantilla fixa a replyTemplates.ts
//
// Ordre de classificació:
//   1. Media compatible → proof_media (o additional_proof_received si ja hi ha proof)
//   2. Si PENDENT_REVISIO + pregunta estat → pending_review_status
//   3. Àudio → audio
//   4. Salutació o "qui ets" → greeting_or_identity
//   5. Persona equivocada → wrong_person
//   6. Text dient que ja ha pagat → payment_claim_without_proof
//   7. Text prometent pagament futur → payment_promise
//   8. Queixa, problema o impossibilitat de pagar → complaint_or_problem
//   9. Pregunta sobre import/factura/deute → question_about_debt
//  10. Desconegut → unknown

export type ClosedIntent =
  | "proof_media"
  | "additional_proof_received"
  | "pending_review_status"
  | "payment_claim_without_proof"
  | "payment_promise"
  | "greeting_or_identity"
  | "question_about_debt"
  | "complaint_or_problem"
  | "wrong_person"
  | "audio"
  | "unknown";

export interface ClassificationInput {
  body: string;
  hasMedia: boolean;
  mediaType?: string;
  proofSaved?: boolean;
  // Context del rebut (per classificació contextual)
  currentStatus?: string;          // estat actual del ReturnedReceipt
  hasExistingProof?: boolean;      // true si ja existeix almenys un PaymentProof
}

export interface ClassificationResult {
  intent: ClosedIntent;
  shouldMarkPendentRevisio: boolean;
  shouldMarkJustificantRebut: boolean;
  shouldMarkPagamentDeclarat: boolean;
  shouldMarkEsperantJustificant: boolean;
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

function isPendingReviewQuestion(text: string, currentStatus?: string): boolean {
  // Només s'activa si el rebut està en PENDENT_REVISIO
  if (currentStatus !== "PENDENT_REVISIO") return false;
  // Preguntes sobre si està tot bé, si està pagat, si falta algo
  const patterns = [
    /\b(?:tot|todo)\s+(?:correcte|correcto|bé|be|bien)\??$/,
    /\b(?:tot|todo)\s+(?:en\s+)?(?:ordre|orden)\??$/,
    /\b(?:esta|está|esta|està)\s+(?:tot|todo|pagat|pagado|solucionat|solucionado|be|bé|bien)\??$/,
    /\b(?:esta|está)\s+(?:tot|todo)\s+(?:be|bé|bien|correcte|correcto)\??$/,
    /\b(?:queda|quedo)\s+(?:pagat|pagado|solucionat|solucionado|llest|listo)\??$/,
    /\b(?:queda|queda)\s+(?:alguna\s+cosa|algo|res|algo\s+mas|alguna\s+cosa\s+mes)\b/,
    /\b(?:ja|ya)\s+(?:esta|está)\??$/,
    /\b(?:he|tinc|tengo|haig)\s+(?:de|que)\s+(?:fer|hacer)\s+(?:alguna\s+cosa|algo|res|alguna\s+cosa\s+mes|algo\s+mas)\??$/,
    /\b(?:falta|fa\s+falta|hace\s+falta)\s+(?:alguna\s+cosa|algo|res)\??$/,
    /\b(?:cal|calen|fa\s+falta)\s+(?:fer|enviar|aportar)\s+(?:alguna\s+cosa|algo|res|mes|más)\??$/,
    /\b(?:tot|todo)\s+(?:correcte|correcto|bé|be|bien)\s*(?:,|\.|\?|$)/,
  ];
  return patterns.some((p) => p.test(text));
}

function isGreetingOrIdentity(text: string): boolean {
  const patterns = [
    /^(?:hola|holi|hey|ei|buenos\s+dias|buenas\s+tardes|buenas\s+noches|bon\s+dia|bona\s+tarda|bona\s+nit|salut)$/,
    /^(?:hola|holi|hey|ei|buenos\s+dias|buenas\s+tardes|buenas\s+noches|bon\s+dia|bona\s+tarda|bona\s+nit|salut)[\s,!.]+/,
    /\b(?:qui|quien)\s+(?:ets|eres|sou|sois|parla|parles|habla|hablas)\b/,
    /\bk\s+(?:ets|eres|sou)\b/,
    /\b(?:que|qué|què)\s+(?:ets|eres|es\s+aixo|es\s+esto)\b/,
    /\b(?:com|como)\s+(?:et\s+dius|te\s+llamas|t'has\s+de\s+dir)\b/,
    /\b(?:que|qué|què)\s+(?:es|sou)\s+(?:aixo|aquest|este|aquest\s+numero|este\s+numero)\b/,
    /\b(?:qui|quien)\s+(?:m'ha|me\s+ha)\s+(?:escrit|enviado|enviat)\b/,
  ];
  return patterns.some((p) => p.test(text));
}

function isPaymentClaim(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length <= 30 && /\?$/.test(trimmed)) return false;
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
    /\bya\s+(?:esta|está)\s+(?:pagat|pagado)\b/,
    /\bja\s+(?:esta|està)\s+(?:fet|pagat)\b/,
    /\bya\s+lo\s+(?:hice|hize)\b/,
  ];
  return patterns.some((p) => p.test(text));
}

function isPaymentPromise(text: string): boolean {
  const patterns = [
    /(?:ho\s+)?(?:pagare|pagarem)\s+(?:dema|dilluns|dimarts|dimecres|dijous|divendres|dissabte|diumenge|la\s+setmana|el\s+mes|aviat|despres)/,
    /(?:lo\s+)?(?:pagare)\s+(?:manana|lunes|martes|miercoles|jueves|viernes|sabado|domingo|la\s+semana|el\s+mes|pronto|despues)/,
    /(?:dema)\s+(?:ho\s+)?(?:pago|pagarem|faig|farem)/,
    /(?:manana)\s+(?:lo|te\s+lo)\s+(?:pago|hago)/,
    /(?:ho|el)\s+(?:pagare|fare)\s+(?:el\s+)?(?:divendres|dilluns|dimarts|dimecres|dijous|dissabte|diumenge|proper|que\s+ve)/,
    /(?:lo\s+)?(?:pagare)\s+(?:el\s+)?(?:manana|lunes|martes|miercoles|jueves|viernes|sabado|domingo)/,
    /(?:ara|ahora)\s+(?:no\s+)?(?:puc|puedo|podo)\s*(?:,|\.|\s|$)/,
    /(?:despres|despues|mes\s+tard|mas\s+tarde|luego)\s+(?:ho\s+)?(?:pago|faig|parlo|miro|reviso)/,
    /(?:ho\s+)?(?:fare|hago|faig)\s+(?:despres|despues|mes\s+tard|luego|dema|manana)/,
    /(?:quan|cuando)\s+(?:pugui|pueda|cobri)\s+(?:ho\s+)?(?:pago|pagare|faig)/,
    /(?:estic|estoy)\s+(?:esperant|esperando)\s+(?:cobrar|el\s+cobro|que\s+em\s+paguin)/,
    /(?:no\s+)?(?:tinc|tengo)\s+(?:diners|dinero|fons|fondos)\s+(?:ara|ahora|en\s+aquest\s+moment)/,
  ];
  return patterns.some((p) => p.test(text));
}

function isQuestionAboutDebt(text: string): boolean {
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
    /\b(?:k|que|què)\s+(?:es|vol|significa)\b/,
    /\bcu[aá]nto\s+(?:es|debo)\b/,
    /\b(?:vuelve|torna)\s+(?:a|a\s+enviar)\b/,
    /\b(?:reenv[ií]a)\b/,
  ];
  return patterns.some((p) => p.test(text));
}

function isComplaintOrProblem(text: string): boolean {
  const patterns = [
    /(?:no|mai)\s+(?:estic|estoy)\s+(?:d'acord|de\s+acuerdo)/,
    /(?:aixo|aquest|aquesta)\s+(?:es|no\s+es)\s+(?:una\s+)?(?:error|equivocacio|mentida|estafa)/,
    /(?:es|sou|son)\s+(?:uns?\s+)?(?:estafadors?|lladres|impresentables)/,
    /(?:denunciar|denunciare|advocat|jutjat|consum)/,
    /(?:no\s+)?(?:penso|pensar\s+)?(?:pagar|pagare)/,
    /(?:deixeu|deixi|dejen)\s+(?:de|d')(?:enviar|molestar|trucar)/,
    /(?:no\s+)?(?:vull|vull\s+parlar)\s+(?:amb|mes)\s+(?:un\s+)?(?:humà|persona|supervisor)/,
    /(?:aixo|esto)\s+(?:es|no\s+es)\s+(?:correcte|just|legal)/,
    /(?:estic|estoy)\s+(?:molt\s+)?(?:enfadat|enfadada|indignat|indignada|cansat|cansada)/,
    /(?:ja\s+)?(?:n'estic\s+)?(?:fart|tip)/,
    /(?:no\s+)?m(?:o|e)\s+(?:esteu|esteu|estan)\s+(?:molestant|acosant)/,
    /(?:queixa|reclamacio|reclamació|quej(a|ara|ará))/,
    /\bno\s+(?:puedo|puc|podem)\s+(?:pagar|pagar-ho)\b/,
    /\bimposible\s+(?:pagar|pagarlo)\b/,
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
  const patterns = [
    /(?:he|vaig|estic|estem)\s+(?:pagat|fet|realitzat|efectuat)/,
    /\b(?:pagat|pagado|pago|pagament|pagamiento)\b/,
    /\b(?:transferencia|transferència|ingres|ingrés)\b/,
    /\b(?:fet|hecho)\b.*\b(?:pag|transfer|ingres)\b/,
  ];
  return patterns.some((p) => p.test(text));
}

// --- Classificador principal ---

function emptyResult(intent: ClosedIntent): ClassificationResult {
  return {
    intent,
    shouldMarkPendentRevisio: false,
    shouldMarkJustificantRebut: false,
    shouldMarkPagamentDeclarat: false,
    shouldMarkEsperantJustificant: false,
    shouldMarkRevisar: false,
    shouldReply: true,
  };
}

export function classify(input: ClassificationInput): ClassificationResult {
  const { body, hasMedia, mediaType, proofSaved, currentStatus, hasExistingProof } = input;
  const normalized = normalize(body);

  // 1. Media vàlid amb fitxer guardat
  if (isProofMedia(hasMedia, mediaType, proofSaved)) {
    // Si ja té proofs anteriors → additional_proof_received
    if (hasExistingProof) {
      return {
        ...emptyResult("additional_proof_received"),
        shouldMarkPendentRevisio: true, // manté PENDENT_REVISIO
        shouldReply: true,
      };
    }
    return {
      ...emptyResult("proof_media"),
      shouldMarkPendentRevisio: true,
      shouldReply: true,
    };
  }

  // 2. PENDENT_REVISIO + pregunta sobre estat → pending_review_status
  if (isPendingReviewQuestion(normalized, currentStatus)) {
    return {
      ...emptyResult("pending_review_status"),
      shouldReply: true,
    };
  }

  // 3. Media rebut però fitxer no guardat → error tècnic
  if (hasMedia && mediaType && !isAudio(mediaType) && !proofSaved) {
    return { ...emptyResult("unknown"), shouldReply: true };
  }

  // 4. Audio → audio
  if (hasMedia && isAudio(mediaType)) {
    return { ...emptyResult("audio"), shouldReply: true };
  }

  // 5. Greeting or identity
  if (isGreetingOrIdentity(normalized)) {
    return { ...emptyResult("greeting_or_identity"), shouldReply: true };
  }

  // 6. Wrong person
  if (isWrongPerson(normalized)) {
    return { ...emptyResult("wrong_person"), shouldMarkRevisar: true, shouldReply: true };
  }

  // 7. Payment claim sense fitxer → PAGAMENT_DECLARAT
  if (isPaymentClaim(normalized)) {
    return { ...emptyResult("payment_claim_without_proof"), shouldMarkPagamentDeclarat: true, shouldReply: true };
  }

  // 8. Payment promise → ESPERANT_JUSTIFICANT
  if (isPaymentPromise(normalized)) {
    return { ...emptyResult("payment_promise"), shouldMarkEsperantJustificant: true, shouldReply: true };
  }

  // 9. Complaint or problem → REVISAR
  if (isComplaintOrProblem(normalized)) {
    return { ...emptyResult("complaint_or_problem"), shouldMarkRevisar: true, shouldReply: true };
  }

  // 10. Question about debt → REVISAR
  if (isQuestionAboutDebt(normalized)) {
    return { ...emptyResult("question_about_debt"), shouldMarkRevisar: true, shouldReply: true };
  }

  // 11. Unknown — intentem detectar si sona a pagament
  if (isPaymentMention(normalized)) {
    return { ...emptyResult("payment_claim_without_proof"), shouldMarkPagamentDeclarat: true, shouldReply: true };
  }

  // 12. Fallback: unknown
  return { ...emptyResult("unknown"), shouldReply: true };
}
