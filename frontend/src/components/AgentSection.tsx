interface Props {
  settings: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

const INTENT_TEMPLATES: { key: string; label: string; description: string }[] = [
  { key: "template_greeting_or_identity", label: "Salutació / Identitat", description: "Quan el client diu hola o pregunta qui som" },
  { key: "template_proof_media", label: "Justificant rebut (primer)", description: "Primer comprovant enviat pel client" },
  { key: "template_additional_proof_received", label: "Justificant rebut (addicional)", description: "Segon o posterior comprovant" },
  { key: "template_pending_review_status", label: "Pendent de revisió", description: "Client pregunta per l'estat tenint justificant pendent" },
  { key: "template_payment_claim_without_proof", label: "Pagament declarat", description: "Client diu que ha pagat sense enviar justificant" },
  { key: "template_payment_promise", label: "Promesa de pagament", description: "Client diu que pagarà en el futur" },
  { key: "template_case_info_request", label: "Informació del cas", description: "Client pregunta per imports o detalls del deute" },
  { key: "template_question_about_debt", label: "Dubte sobre deute", description: "Pregunta genèrica sense prou context" },
  { key: "template_complaint_or_problem", label: "Queixa / Problema", description: "Client es queixa o discuteix l'import" },
  { key: "template_wrong_person", label: "Persona equivocada", description: "Número incorrecte, bloqueja WhatsApp" },
  { key: "template_unsubscribe", label: "Baixa del canal", description: "Client demana no rebre més WhatsApps" },
  { key: "template_audio", label: "Àudio", description: "Client envia una nota de veu" },
  { key: "template_unknown", label: "Desconegut", description: "Missatge no classificat" },
];

export default function AgentSection({ settings, onChange }: Props) {
  const on = (key: string, val: string) => onChange(key, val);

  return (
    <div>
      <h2 className="font-semibold text-lg mb-3">Agent WhatsApp</h2>

      <div className="space-y-4">
        {/* Controls generals */}
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Activat</label>
            <input
              type="checkbox"
              checked={settings["agent.enabled"] !== "false"}
              onChange={(e) => on("agent.enabled", e.target.checked ? "true" : "false")}
              className="h-4 w-4"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Mode segur (només guardar, no respondre)</label>
            <input
              type="checkbox"
              checked={settings["agent.safe_mode"] === "true"}
              onChange={(e) => on("agent.safe_mode", e.target.checked ? "true" : "false")}
              className="h-4 w-4"
            />
          </div>

          <div>
            <label className="text-sm font-medium mr-2">Timeout (hores)</label>
            <input
              className="w-20 border rounded px-2 py-1 text-sm"
              value={settings["agent.timeout_hores"] || "24"}
              onChange={(e) => on("agent.timeout_hores", e.target.value)}
              type="number" min="1" max="168"
            />
          </div>

          <div>
            <label className="text-sm font-medium mr-2">Màx. missatges desconeguts</label>
            <input
              className="w-16 border rounded px-2 py-1 text-sm"
              value={settings["agent.max_unknown"] || "3"}
              onChange={(e) => on("agent.max_unknown", e.target.value)}
              type="number" min="1" max="10"
            />
          </div>
        </div>

        {/* Plantilles per intent */}
        <div className="border-t pt-3">
          <h3 className="text-sm font-semibold mb-2">Plantilles de resposta (12 intents)</h3>
          <p className="text-xs text-gray-500 mb-3">
            Customitza les respostes automàtiques. Variables: {"{{company_name}}"}, {"{{case_details}}"} (info del cas).
          </p>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {INTENT_TEMPLATES.map((tpl) => (
              <div key={tpl.key}>
                <div className="flex items-baseline justify-between mb-1">
                  <label className="text-xs font-medium text-gray-700">{tpl.label}</label>
                  <span className="text-[10px] text-gray-400">{tpl.description}</span>
                </div>
                <textarea
                  className="w-full border rounded px-3 py-1.5 font-mono text-xs h-20"
                  value={settings[tpl.key] || ""}
                  onChange={(e) => on(tpl.key, e.target.value)}
                  placeholder={`Plantilla per defecte de "${tpl.label}"...`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
