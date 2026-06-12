// Plantilles fixes de resposta WhatsApp
// Totes les respostes al client han de sortir d'aquí, sense redacció lliure.

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

Som {{company_name}}. T'informem que hi ha una incidència amb el cobrament del rebut corresponent a la factura {{invoice_number}}, per import de {{amount}} €.

Si ja has fet l'abonament, envia'ns si us plau el justificant bancari per aquest mateix WhatsApp.

Aquest canal és automàtic i només serveix per rebre justificants. Per qualsevol dubte sobre factures, imports o serveis, contacta amb nosaltres per les vies habituals.

Gràcies.`;

// --- Missatge per enviament múltiple ---
export const TEMPLATE_MULTIPLE_NOTIFICATION = `Hola {{client_name}},

Som {{company_name}}. T'informem que hi ha incidències amb el cobrament dels rebuts següents:

{{receipts_list}}

Import total: {{total_amount}} €

Si ja has fet els abonaments, envia'ns si us plau els justificants bancaris per aquest mateix WhatsApp.

Aquest canal és automàtic i només serveix per rebre justificants. Per qualsevol dubte sobre factures, imports o serveis, contacta amb nosaltres per les vies habituals.

Gràcies.`;

// --- Resposta quan rep justificant (proof_media) ---
export const TEMPLATE_PROOF_RECEIVED = `Gràcies. Hem rebut el justificant.

El nostre equip el revisarà i actualitzarà l'estat del rebut si tot és correcte.`;

// --- Resposta quan diu que ha pagat però no envia justificant (payment_claim_without_proof) ---
export const TEMPLATE_PAYMENT_CLAIM_NO_PROOF = `Gràcies per avisar.

Per poder revisar-ho, envia si us plau el justificant bancari en imatge, PDF o document per aquest mateix WhatsApp.`;

// --- Resposta per preguntes, dubtes o queixes (question / complaint / unknown) ---
export const TEMPLATE_REDIRECT = `Aquest canal és automàtic i només pot gestionar l'enviament de justificants de pagament.

Per qualsevol dubte sobre factures, imports o serveis, contacta amb nosaltres per les vies habituals.

Gràcies.`;

// --- Resposta per àudio ---
export const TEMPLATE_AUDIO = `Aquest canal automàtic no pot gestionar àudios.

Si ja has fet l'abonament, envia si us plau el justificant bancari en imatge, PDF o document.

Per qualsevol dubte, contacta amb nosaltres per les vies habituals.`;

// --- Resposta per número equivocat (wrong_person) ---
export const TEMPLATE_WRONG_PERSON = `Gràcies per avisar.

Aquest canal és automàtic i no pot revisar aquesta incidència. Si cal, contacta amb nosaltres per les vies habituals.`;

// --- Resposta general d'error ---
export const TEMPLATE_TECHNICAL_ERROR = `Hem tingut un problema tècnic. Si us plau, contacta amb nosaltres per les vies de comunicació habituals. Disculpa les molèsties.`;

// --- Mapa de plantilles per intent ---
export const REPLY_TEMPLATES: Record<string, string> = {
  proof_media: TEMPLATE_PROOF_RECEIVED,
  payment_claim_without_proof: TEMPLATE_PAYMENT_CLAIM_NO_PROOF,
  question: TEMPLATE_REDIRECT,
  complaint: TEMPLATE_REDIRECT,
  wrong_person: TEMPLATE_WRONG_PERSON,
  audio: TEMPLATE_AUDIO,
  unknown: TEMPLATE_REDIRECT,
};

// --- Funció helper ---
export function getReplyTemplate(intent: string): string {
  return REPLY_TEMPLATES[intent] || TEMPLATE_REDIRECT;
}

export function renderInitialNotification(vars: TemplateVars): string {
  return render(TEMPLATE_INITIAL_NOTIFICATION, vars);
}

export function renderMultipleNotification(vars: TemplateVars): string {
  return render(TEMPLATE_MULTIPLE_NOTIFICATION, vars);
}

export function renderReply(intent: string, _vars?: TemplateVars): string {
  const template = getReplyTemplate(intent);
  // Les plantilles de resposta no tenen variables (són fixes)
  return template;
}
