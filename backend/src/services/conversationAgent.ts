import prisma from "../lib/prisma";

// Tipus
export type Intent = "pagament_clar" | "pagament_ambigu" | "comprovant_enviat" | "altres_temes";

export interface ClassificationResult {
  intent: Intent;
  action: string;
  templateKey: string;
  metadata: Record<string, string | null>;
}

interface KeywordConfig {
  pagament_clar: string[];
  pagament_ambigu: string[];
  comprovant_enviat: string[];
}

const DEFAULT_KEYWORDS: Record<string, Record<string, string>> = {
  pagament_clar: {
    cat: "he pagat,ja he fet el pagament,transferència feta,ingrés fet,he fet l'ingrés,he realitzat el pagament,he fet la transferència,transferencia feta,he fet el ingres,ja he pagat,pagament fet",
    es: "he pagado,ya he hecho el pago,transferencia hecha,ingreso hecho,he realizado el pago,ya está pagado,pago hecho,ya he pagado",
  },
  pagament_ambigu: {
    cat: "fet,ja està,ho tens,t'ho he enviat,ok,d'acord,llisto,solucionat",
    es: "hecho,ya está,lo tienes,te lo he enviado,vale,listo,solucionado",
  },
  comprovant_enviat: {
    cat: "comprovant,justificant,adjunt,captura,foto del pagament,et passo el comprovant",
    es: "comprobante,justificante,adjunto,captura,foto del pago,te paso el comprobante",
  },
};

const DEFAULT_TEMPLATES: Record<string, string> = {
  template_pagament_clar:
    "Gràcies {{client_name}}. He registrat la teva confirmació{{#reference}} amb referència {{reference}}{{/reference}}. Si ens pots enviar el comprovant del pagament, ens ajudaria a verificar-lo. Per a qualsevol altra consulta, contacta amb nosaltres per les vies habituals.",
  template_pagament_ambigu:
    "Gràcies per respondre. Em pots confirmar la data o referència del pagament per poder-ho registrar correctament? Recorda que aquest és un sistema automàtic — per a qualsevol altra consulta, contacta amb nosaltres per les vies habituals.",
  template_comprovant_rebut:
    "Gràcies {{client_name}}. He rebut el teu comprovant i el revisarem en breu. Si tot és correcte, confirmarem el pagament. Per a qualsevol altra consulta, contacta amb nosaltres per les vies habituals.",
  template_redireccio:
    "Aquest és un sistema automàtic de confirmació de pagaments. Per a qualsevol altra consulta o aclariment, contacta amb nosaltres per les vies de comunicació habituals. Gràcies.",
};

// Normalitza text: minúscules, sense accents
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function getKeywordConfig(): Promise<KeywordConfig> {
  const settings = await prisma.appSettings.findMany();
  const getSetting = (key: string, fallback: string): string[] => {
    const s = settings.find((x) => x.key === key);
    const raw = s?.value?.trim() || fallback;
    return raw
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);
  };

  return {
    pagament_clar: [
      ...getSetting("agent.keywords_pagament_clar_cat", DEFAULT_KEYWORDS.pagament_clar.cat),
      ...getSetting("agent.keywords_pagament_clar_es", DEFAULT_KEYWORDS.pagament_clar.es),
    ],
    pagament_ambigu: [
      ...getSetting("agent.keywords_ambigu_cat", DEFAULT_KEYWORDS.pagament_ambigu.cat),
      ...getSetting("agent.keywords_ambigu_es", DEFAULT_KEYWORDS.pagament_ambigu.es),
    ],
    comprovant_enviat: [
      ...getSetting("agent.keywords_comprovant_cat", DEFAULT_KEYWORDS.comprovant_enviat.cat),
      ...getSetting("agent.keywords_comprovant_es", DEFAULT_KEYWORDS.comprovant_enviat.es),
    ],
  };
}

async function getTemplate(key: string): Promise<string> {
  const setting = await prisma.appSettings.findUnique({ where: { key: `agent.${key}` } });
  return setting?.value?.trim() || (DEFAULT_TEMPLATES as any)[key] || "";
}

function renderTemplate(template: string, vars: Record<string, string | null>): string {
  let result = template;
  // Conditional blocks: {{#reference}}text amb {{reference}}{{/reference}}
  result = result.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_match, key, content) => {
    return vars[key] ? content.replace(/\{\{(\w+)\}\}/g, (_m: string, k: string) => vars[k] || "") : "";
  });
  // Simple variables
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value || "");
  }
  return result;
}

export function classifyMessage(text: string, keywords: KeywordConfig, hasMedia: boolean): ClassificationResult {
  const normalized = normalize(text).trim();

  // If media attached, treat as comprovant_enviat regardless of text
  if (hasMedia) {
    return {
      intent: "comprovant_enviat",
      action: "acusar_recepcio_comprovant",
      templateKey: "template_comprovant_rebut",
      metadata: { reference: extractReference(normalized), amount: extractAmount(normalized), date: extractDate(normalized) },
    };
  }

  // 1. pagament_clar
  if (keywords.pagament_clar.some((k) => normalized.includes(k))) {
    return {
      intent: "pagament_clar",
      action: "confirmar_i_demanar_comprovant",
      templateKey: "template_pagament_clar",
      metadata: { reference: extractReference(normalized), amount: extractAmount(normalized), date: extractDate(normalized) },
    };
  }

  // 2. comprovant_enviat (text mention)
  if (keywords.comprovant_enviat.some((k) => normalized.includes(k))) {
    return {
      intent: "comprovant_enviat",
      action: "acusar_recepcio_comprovant",
      templateKey: "template_comprovant_rebut",
      metadata: { reference: extractReference(normalized), amount: extractAmount(normalized), date: extractDate(normalized) },
    };
  }

  // 3. pagament_ambigu
  if (keywords.pagament_ambigu.some((k) => normalized.includes(k))) {
    return {
      intent: "pagament_ambigu",
      action: "demanar_detalls",
      templateKey: "template_pagament_ambigu",
      metadata: { reference: null, amount: null, date: null },
    };
  }

  // 4. altres_temes
  return {
    intent: "altres_temes",
    action: "redirigir",
    templateKey: "template_redireccio",
    metadata: {},
  };
}

function extractReference(text: string): string | null {
  const m = text.match(/(?:ref[erencia]*|referència|referencia)[\s:]*[#nº]*\s*(\w+)/i);
  return m ? m[1] : null;
}

function extractAmount(text: string): string | null {
  const m = text.match(/(\d+[,.]?\d*)\s*(?:€|euros?)/i);
  return m ? m[1].replace(",", ".") : null;
}

function extractDate(text: string): string | null {
  const m = text.match(/(?:ahir|avui|el dia|el)\s*(\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?)/i);
  return m ? m[1] : null;
}

// Called from webhook when an INBOUND message arrives for a receipt in NOTIFICAT/ESPERANT_DETALLS
export async function handleIncomingMessage(
  messageText: string,
  hasMedia: boolean,
  receiptId: number,
  clientName: string,
): Promise<{ intent: Intent; action: string; replyText: string; receiptNewStatus: string | null; metadata: Record<string, string | null> }> {
  const keywords = await getKeywordConfig();
  const classification = classifyMessage(messageText, keywords, hasMedia);

  const templateStr = await getTemplate(classification.templateKey);
  const replyText = renderTemplate(templateStr, {
    client_name: clientName,
    reference: classification.metadata.reference,
    amount: classification.metadata.amount,
  });

  let receiptNewStatus: string | null = null;
  if (classification.intent === "pagament_clar" || classification.intent === "comprovant_enviat") {
    receiptNewStatus = "JUSTIFICANT_REBUT";
  }

  return {
    intent: classification.intent,
    action: classification.action,
    replyText,
    receiptNewStatus,
    metadata: classification.metadata,
  };
}

// Check and handle timeout for ESPERANT_DETALLS
export async function checkConversationTimeout(receiptId: number): Promise<boolean> {
  const settings = await prisma.appSettings.findMany();
  const timeoutSetting = settings.find((s) => s.key === "agent.timeout_hores");
  const timeoutHours = parseInt(timeoutSetting?.value || "24", 10);

  const lastAgentMessage = await prisma.message.findFirst({
    where: {
      receiptId,
      agentAction: { not: null },
    },
    orderBy: { sentAt: "desc" },
  });

  if (!lastAgentMessage) return false;

  const elapsed = Date.now() - lastAgentMessage.sentAt.getTime();
  return elapsed > timeoutHours * 60 * 60 * 1000;
}
