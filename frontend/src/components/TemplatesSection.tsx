import { useState } from "react";

interface TemplateDef {
  intent: string;
  label: string;
  description: string;
  triggers: string;
  storageKey: string;
  defaultValue: string;
}

const TEMPLATES: TemplateDef[] = [
  {
    intent: "greeting_or_identity",
    label: "Salutació / Identitat",
    description: "Quan el client saluda o pregunta qui som",
    triggers: "Hola, Bon dia, Qui ets?, K ets?, Quién eres?, Qué es esto?",
    storageKey: "template_greeting",
    defaultValue: "Hola. Soc l'assistent automàtic de {{company_name}} per gestionar justificants de pagament relacionats amb incidències de cobrament.\n\nSi ja has fet l'abonament, pots enviar aquí el justificant en foto, PDF o document.\n\nPer qualsevol dubte sobre imports, factures o altres temes, contacta amb nosaltres per les vies habituals.",
  },
  {
    intent: "proof_media",
    label: "Justificant rebut (primer)",
    description: "Quan el client envia foto/PDF i es guarda correctament",
    triggers: "Imatge (JPEG, PNG, WebP), PDF, Word, Excel rebut per WhatsApp",
    storageKey: "template_proof_media",
    defaultValue: "Gràcies. Hem rebut el justificant correctament.\n\nEl nostre equip el revisarà i actualitzarà l'estat del rebut si tot és correcte.",
  },
  {
    intent: "additional_proof_received",
    label: "Justificant addicional",
    description: "Quan el client envia un segon o posterior justificant",
    triggers: "Nova imatge/PDF quan ja existeix un PaymentProof previ",
    storageKey: "template_additional_proof",
    defaultValue: "Hem rebut també aquest document i l'afegirem a la revisió del cas.\n\nGràcies.",
  },
  {
    intent: "pending_review_status",
    label: "Pendent revisió (pregunta)",
    description: "Quan el rebut està en PENDENT_REVISIO i el client pregunta per l'estat",
    triggers: "Tot correcte?, Està pagat?, He de fer alguna cosa?, Ya está?, Queda pagado?",
    storageKey: "template_pending_review",
    defaultValue: "Hem rebut el justificant i queda pendent de revisió.\n\nSi tot és correcte, actualitzarem l'estat del rebut. Si necessitem alguna cosa més, contactarem amb tu per les vies habituals.\n\nGràcies.",
  },
  {
    intent: "payment_claim_without_proof",
    label: "Pagament declarat (sense justificant)",
    description: "Quan el client diu que ja ha pagat però no envia fitxer",
    triggers: "Pagat, Pagado, Ja he pagat, Ya lo hice, Transferencia hecha, Ja està fet",
    storageKey: "template_payment_claim",
    defaultValue: "Perfecte, gràcies per avisar.\n\nPer poder revisar el pagament, envia si us plau el justificant bancari en foto, PDF o document per aquest mateix WhatsApp.",
  },
  {
    intent: "payment_promise",
    label: "Promesa de pagament",
    description: "Quan el client diu que pagarà més tard",
    triggers: "Demà ho pago, Ho pagaré divendres, Mañana lo pago, Ara no puc",
    storageKey: "template_payment_promise",
    defaultValue: "D'acord, gràcies per avisar.\n\nQuan hagis fet l'abonament, envia si us plau el justificant bancari per aquest mateix WhatsApp.",
  },
  {
    intent: "question_about_debt",
    label: "Pregunta sobre el deute",
    description: "Quan el client pregunta imports, factures o què deu",
    triggers: "Què es deu?, Cuánto es?, Qué factura es?, Per què m'han cobrat?, No entenc",
    storageKey: "template_question_debt",
    defaultValue: "Entenc la consulta.\n\nAquest canal només pot gestionar l'enviament de justificants. Per revisar imports, factures o qualsevol dubte sobre el rebut, contacta amb nosaltres per les vies habituals.\n\nGràcies.",
  },
  {
    intent: "complaint_or_problem",
    label: "Queixa / Problema",
    description: "Quan el client es queixa o diu que no pot pagar",
    triggers: "No puedo pagar, No puc pagar, No estoy de acuerdo, Això és una estafa",
    storageKey: "template_complaint",
    defaultValue: "Entenc.\n\nAquest canal automàtic no pot gestionar incidències, consultes o acords de pagament.\n\nPer revisar el teu cas, contacta amb nosaltres per les vies habituals.\n\nGràcies.",
  },
  {
    intent: "audio",
    label: "Àudio rebut",
    description: "Quan el client envia un missatge d'àudio",
    triggers: "Àudio (ogg, mpeg, opus) per WhatsApp",
    storageKey: "template_audio",
    defaultValue: "Aquest canal automàtic no pot gestionar àudios.\n\nSi ja has fet l'abonament, envia si us plau el justificant bancari en foto, PDF o document.\n\nPer qualsevol dubte, contacta amb nosaltres per les vies habituals.",
  },
  {
    intent: "unknown",
    label: "Desconegut",
    description: "Quan el missatge no encaixa amb cap altre intent",
    triggers: "Qualsevol missatge no classificat, emojis, text genèric",
    storageKey: "template_unknown",
    defaultValue: "Gràcies pel missatge.\n\nAquest canal només pot gestionar justificants de pagament. Si ja has fet l'abonament, envia el justificant en foto, PDF o document.\n\nPer qualsevol altre tema, contacta amb nosaltres per les vies habituals.",
  },
  {
    intent: "wrong_person",
    label: "Número equivocat",
    description: "Quan el client diu que no és la persona correcta",
    triggers: "No soc jo, Número equivocat, No conec aquesta empresa, Error de persona",
    storageKey: "template_wrong_person",
    defaultValue: "Gràcies per avisar.\n\nAquest canal és automàtic i no pot revisar aquesta incidència. Si cal, contacta amb nosaltres per les vies habituals.",
  },
];

interface Props {
  settings: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export default function TemplatesSection({ settings, onChange }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [previewIntent, setPreviewIntent] = useState<string | null>(null);

  const toggle = (intent: string) => {
    const next = new Set(expanded);
    if (next.has(intent)) next.delete(intent); else next.add(intent);
    setExpanded(next);
  };

  return (
    <div>
      <h2 className="font-semibold text-lg mb-4">Plantilles de resposta automàtica</h2>
      <p className="text-sm text-gray-500 mb-4">
        Aquestes plantilles s'usen quan l'agent respon automàticament als missatges de WhatsApp.
        Cada intent té paraules clau de detecció i una resposta fixa.
      </p>

      <div className="space-y-3">
        {TEMPLATES.map((tpl) => {
          const currentValue = settings[tpl.storageKey] || tpl.defaultValue;
          const isExpanded = expanded.has(tpl.intent);
          const isPreview = previewIntent === tpl.intent;

          return (
            <div key={tpl.intent} className="border rounded-lg overflow-hidden">
              {/* Capçalera */}
              <button
                onClick={() => toggle(tpl.intent)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      ["greeting_or_identity", "proof_media", "additional_proof_received", "pending_review_status", "payment_claim_without_proof", "payment_promise"].includes(tpl.intent)
                        ? "bg-green-500" : "bg-gray-400"
                    }`} />
                    <span className="font-medium text-sm">{tpl.label}</span>
                    <span className="text-xs text-gray-400 font-mono">{tpl.intent}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 ml-4">{tpl.description}</div>
                </div>
                <span className="text-gray-400 text-sm flex-shrink-0 ml-2">{isExpanded ? "▴" : "▾"}</span>
              </button>

              {/* Contingut expandit */}
              {isExpanded && (
                <div className="border-t p-4 bg-gray-50 space-y-4">
                  {/* Dispara */}
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Què ho dispara</div>
                    <div className="text-sm text-gray-700 bg-white rounded border p-2">{tpl.triggers}</div>
                  </div>

                  {/* Plantilla */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-semibold text-gray-500 uppercase">Plantilla</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setPreviewIntent(isPreview ? null : tpl.intent)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {isPreview ? "Tancar previsualització" : "Previsualitzar"}
                        </button>
                        <button
                          onClick={() => onChange(tpl.storageKey, tpl.defaultValue)}
                          className="text-xs text-gray-400 hover:underline"
                        >
                          Restaurar
                        </button>
                      </div>
                    </div>
                    <textarea
                      className="w-full border rounded px-3 py-2 font-mono text-xs h-32"
                      value={currentValue}
                      onChange={(e) => onChange(tpl.storageKey, e.target.value)}
                      placeholder={tpl.defaultValue}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      {tpl.intent === "greeting_or_identity" ? "Variables: {{company_name}}" : ""}
                      Modificat: {currentValue !== tpl.defaultValue ? "Sí" : "No (usant valor per defecte)"}
                    </p>
                  </div>

                  {/* Previsualització */}
                  {isPreview && (
                    <div className="bg-white border border-blue-200 rounded-lg p-3">
                      <div className="text-xs font-semibold text-blue-600 uppercase mb-2">Previsualització</div>
                      <div className="text-sm whitespace-pre-wrap text-blue-900">{currentValue.replace("{{company_name}}", settings.company_name || "Empresa")}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

