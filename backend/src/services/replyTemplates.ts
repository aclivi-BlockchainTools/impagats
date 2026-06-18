// Plantilles fixes de resposta WhatsApp
// Totes les respostes al client han de sortir d'aquí, sense redacció lliure.
// Dissenyades per ser comunicatives i útils, mantenint el canal tancat i segur.

export interface TemplateVars {
  client_name?: string;
  company_name?: string;
  invoice_number?: string;
  amount?: string;
  receipt_reference?: string;
  service_period?: string;
  company_iban?: string;
  total_amount?: string;
  receipts_list?: string;
  case_details?: string;
  return_fee_per_receipt?: string;
  return_fee_total?: string;
  total_with_fee?: string;
}

export function render(template: string, vars: TemplateVars): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    if (value !== undefined) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }
  }
  return result;
}

// --- Missatge inicial de notificació ---
export const TEMPLATE_INITIAL_NOTIFICATION = `Hola {{client_name}},

T'informem que s'ha retornat el rebut del període {{service_period}} corresponent a la factura {{invoice_number}} per un import de {{amount}} €.

Per regularitzar la situació, fes una transferència al següent compte:

🏦 {{company_iban}}
📋 Factura: {{invoice_number}}

⚠️ IMPORTANT: Si us plau, envia'ns la foto del comprovant de pagament per aquest WhatsApp.

---

Te informamos que se ha devuelto el recibo del período {{service_period}} correspondiente a la factura {{invoice_number}} por un importe de {{amount}} €.

Para regularizar la situación, haz una transferencia a la siguiente cuenta:

🏦 {{company_iban}}
📋 Factura: {{invoice_number}}

⚠️ IMPORTANTE: Por favor, envíanos la foto del comprobante de pago por este WhatsApp.

Gracias.
{{company_name}}`;

// --- Missatge per enviament múltiple ---
export const TEMPLATE_MULTIPLE_NOTIFICATION = `Hola {{client_name}},

T'informem que s'han retornat els rebuts següents:

{{receipts_list}}

🏦 {{company_iban}}
💰 Total a pagar: {{total_amount}} €

⚠️ IMPORTANT: Si us plau, envia'ns la foto dels comprovants de pagament per aquest WhatsApp.

---

Te informamos que se han devuelto los siguientes recibos:

{{receipts_list}}

🏦 {{company_iban}}
💰 Total a pagar: {{total_amount}} €

⚠️ IMPORTANTE: Por favor, envíanos la foto de los comprobantes de pago por este WhatsApp.

Gracias.
{{company_name}}`;

// --- greeting_or_identity: Salutació o "qui ets" ---
export const TEMPLATE_GREETING_OR_IDENTITY = `Hola. Soc l'assistent automàtic de {{company_name}} per gestionar justificants de pagament relacionats amb incidències de cobrament.

Si ja has fet l'abonament, pots enviar aquí el justificant en foto, PDF o document.

Per qualsevol dubte sobre imports, factures o altres temes, contacta amb nosaltres per les vies habituals.`;

// --- proof_media: Justificant guardat correctament (primer) ---
export const TEMPLATE_PROOF_RECEIVED = `Gràcies. Hem rebut el justificant correctament.

El nostre equip el revisarà i actualitzarà l'estat del rebut si tot és correcte.`;

// --- additional_proof_received: Segon o posterior justificant ---
export const TEMPLATE_ADDITIONAL_PROOF_RECEIVED = `Hem rebut també aquest document i l'afegirem a la revisió del cas.

Gràcies.`;

// --- pending_review_status: PENDENT_REVISIO + pregunta estat ---
export const TEMPLATE_PENDING_REVIEW_STATUS = `Hem rebut el justificant i queda pendent de revisió.

Si tot és correcte, actualitzarem l'estat del rebut. Si necessitem alguna cosa més, contactarem amb tu per les vies habituals.

Gràcies.`;

// --- proof_media: Error guardant el fitxer ---
export const TEMPLATE_PROOF_SAVE_ERROR = `Gràcies, hem rebut una imatge o document, però no l'hem pogut guardar correctament.

Si us plau, torna a enviar el justificant com a foto, PDF o document. Quan el rebem correctament, quedarà pendent de revisió.`;

// --- payment_claim_without_proof: Client diu que ha pagat sense fitxer ---
export const TEMPLATE_PAYMENT_CLAIM_NO_PROOF = `Perfecte, gràcies per avisar.

Per poder revisar el pagament, envia si us plau el justificant bancari en foto, PDF o document per aquest mateix WhatsApp.`;

// --- payment_promise: Client diu que pagarà més tard ---
export const TEMPLATE_PAYMENT_PROMISE = `D'acord, gràcies per avisar.

Quan hagis fet l'abonament, envia si us plau el justificant bancari per aquest mateix WhatsApp.`;

// --- question_about_debt: Preguntes sobre imports, factures o deute ---
export const TEMPLATE_QUESTION_ABOUT_DEBT = `Entenc la consulta.

Aquest canal només pot gestionar l'enviament de justificants. Per revisar imports, factures o qualsevol dubte sobre el rebut, contacta amb nosaltres per les vies habituals.

Gràcies.`;

// --- complaint_or_problem: Queixa, problema, impossibilitat de pagar ---
export const TEMPLATE_COMPLAINT_OR_PROBLEM = `Entenc.

Aquest canal automàtic no pot gestionar incidències, consultes o acords de pagament.

Per revisar el teu cas, contacta amb nosaltres per les vies habituals.

Gràcies.`;

// --- audio: Client envia àudio ---
export const TEMPLATE_AUDIO = `Aquest canal automàtic no pot gestionar àudios.

Si ja has fet l'abonament, envia si us plau el justificant bancari en foto, PDF o document.

Per qualsevol dubte, contacta amb nosaltres per les vies habituals.`;

// --- unsubscribe: Client demana no rebre més WhatsApps ---
export const TEMPLATE_UNSUBSCRIBE = `D'acord. No t'enviarem més missatges per aquest canal.

Si en el futur vols reactivar les notificacions, contacta amb nosaltres per les vies habituals.

Gràcies.`;

// --- case_info_request: Pregunta sobre deute amb context suficient ---
export const TEMPLATE_CASE_INFO = `T'informem sobre el teu cas:

{{case_details}}

Si ja has fet l'abonament, envia'ns el justificant en foto, PDF o document per aquest WhatsApp.

Per qualsevol altre dubte, contacta amb nosaltres per les vies habituals.`;

// --- wrong_person: Número equivocat ---
export const TEMPLATE_WRONG_PERSON = `Gràcies per avisar.

Aquest canal és automàtic i no pot revisar aquesta incidència. Si cal, contacta amb nosaltres per les vies habituals.`;

// --- unknown: Missatge no classificat ---
export const TEMPLATE_UNKNOWN = `Gràcies pel missatge.

Aquest canal només pot gestionar justificants de pagament. Si ja has fet l'abonament, envia el justificant en foto, PDF o document.

Per qualsevol altre tema, contacta amb nosaltres per les vies habituals.`;

// --- Resposta general d'error ---
export const TEMPLATE_TECHNICAL_ERROR = `Hem tingut un problema tècnic. Si us plau, contacta amb nosaltres per les vies de comunicació habituals. Disculpa les molèsties.`;

// --- Mapa de plantilles per intent ---
export const REPLY_TEMPLATES: Record<string, string> = {
  greeting_or_identity: TEMPLATE_GREETING_OR_IDENTITY,
  proof_media: TEMPLATE_PROOF_RECEIVED,
  additional_proof_received: TEMPLATE_ADDITIONAL_PROOF_RECEIVED,
  pending_review_status: TEMPLATE_PENDING_REVIEW_STATUS,
  payment_claim_without_proof: TEMPLATE_PAYMENT_CLAIM_NO_PROOF,
  payment_promise: TEMPLATE_PAYMENT_PROMISE,
  question_about_debt: TEMPLATE_QUESTION_ABOUT_DEBT,
  case_info_request: TEMPLATE_CASE_INFO,
  complaint_or_problem: TEMPLATE_COMPLAINT_OR_PROBLEM,
  wrong_person: TEMPLATE_WRONG_PERSON,
  unsubscribe: TEMPLATE_UNSUBSCRIBE,
  audio: TEMPLATE_AUDIO,
  unknown: TEMPLATE_UNKNOWN,
};

// --- Línia de recàrrec per devolució (quan client té >1 impagat) ---
// S'afegeix al final de la plantilla de notificació (després del text base)
export const TEMPLATE_FEE_LINE = `

Despesa de devolució ({{return_fee_per_receipt}} € per rebut retornat): {{return_fee_total}} €

Total amb despeses: {{total_with_fee}} €`;

// --- Recordatori de pagament ---
export const TEMPLATE_REMINDER = `Hola {{client_name}},

Recordatori: encara no hem rebut el justificant del rebut de {{service_period}} corresponent a la factura {{invoice_number}} per import de {{amount}} €.

Si ja has fet l'abonament, envia'ns si us plau el justificant bancari per aquest mateix WhatsApp.

Gràcies.

---

Recordatorio: todavía no hemos recibido el justificante del recibo de {{service_period}} correspondiente a la factura {{invoice_number}} por importe de {{amount}} €.

Si ya has hecho el pago, envíanos por favor el justificante bancario por este mismo WhatsApp.

Gracias.
{{company_name}}`;

// --- Funció helper ---
export function getReplyTemplate(intent: string): string {
  return REPLY_TEMPLATES[intent] || TEMPLATE_UNKNOWN;
}

export function renderInitialNotification(vars: TemplateVars): string {
  return render(TEMPLATE_INITIAL_NOTIFICATION, vars);
}

export function renderMultipleNotification(vars: TemplateVars): string {
  return render(TEMPLATE_MULTIPLE_NOTIFICATION, vars);
}

export function renderReply(intent: string, _vars?: TemplateVars): string {
  const template = getReplyTemplate(intent);
  return template;
}
