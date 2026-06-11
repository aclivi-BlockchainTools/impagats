interface Props {
  settings: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export default function AgentSection({ settings, onChange }: Props) {
  const on = (key: string, val: string) => onChange(key, val);

  return (
    <div>
      <h2 className="font-semibold text-lg mb-3">Agent conversacional</h2>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">Activat</label>
          <input
            type="checkbox"
            checked={settings["agent.enabled"] !== "false"}
            onChange={(e) => on("agent.enabled", e.target.checked ? "true" : "false")}
            className="h-4 w-4"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Timeout (hores)</label>
          <input
            className="w-32 border rounded px-3 py-2 text-sm"
            value={settings["agent.timeout_hores"] || "24"}
            onChange={(e) => on("agent.timeout_hores", e.target.value)}
            type="number" min="1" max="168"
          />
        </div>

        <div className="border-t pt-3">
          <h3 className="text-sm font-semibold mb-2">Paraules clau — Pagament clar (CAT)</h3>
          <input className="w-full border rounded px-3 py-2 text-sm" value={settings["agent.keywords_pagament_clar_cat"] || ""} onChange={(e) => on("agent.keywords_pagament_clar_cat", e.target.value)} placeholder="he pagat,ja he fet el pagament,transferència feta,ingrés fet" />
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2">Paraules clau — Pagament clar (ES)</h3>
          <input className="w-full border rounded px-3 py-2 text-sm" value={settings["agent.keywords_pagament_clar_es"] || ""} onChange={(e) => on("agent.keywords_pagament_clar_es", e.target.value)} placeholder="he pagado,ya he hecho el pago,transferencia hecha" />
        </div>

        <div className="border-t pt-3">
          <h3 className="text-sm font-semibold mb-2">Paraules clau — Pagament ambigu (CAT)</h3>
          <input className="w-full border rounded px-3 py-2 text-sm" value={settings["agent.keywords_ambigu_cat"] || ""} onChange={(e) => on("agent.keywords_ambigu_cat", e.target.value)} placeholder="fet,ja està,ho tens,ok,d'acord,llisto" />
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2">Paraules clau — Pagament ambigu (ES)</h3>
          <input className="w-full border rounded px-3 py-2 text-sm" value={settings["agent.keywords_ambigu_es"] || ""} onChange={(e) => on("agent.keywords_ambigu_es", e.target.value)} placeholder="hecho,ya está,lo tienes,vale,ok,listo" />
        </div>

        <div className="border-t pt-3">
          <h3 className="text-sm font-semibold mb-2">Paraules clau — Comprovant (CAT)</h3>
          <input className="w-full border rounded px-3 py-2 text-sm" value={settings["agent.keywords_comprovant_cat"] || ""} onChange={(e) => on("agent.keywords_comprovant_cat", e.target.value)} placeholder="comprovant,justificant,adjunt,captura" />
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2">Paraules clau — Comprovant (ES)</h3>
          <input className="w-full border rounded px-3 py-2 text-sm" value={settings["agent.keywords_comprovant_es"] || ""} onChange={(e) => on("agent.keywords_comprovant_es", e.target.value)} placeholder="comprobante,justificante,adjunto,captura" />
        </div>

        <div className="border-t pt-3">
          <h3 className="text-sm font-semibold mb-2">Plantilla — Confirmació de pagament</h3>
          <textarea className="w-full border rounded px-3 py-2 font-mono text-xs h-24" value={settings["agent.template_pagament_clar"] || ""} onChange={(e) => on("agent.template_pagament_clar", e.target.value)} placeholder="Gràcies {{client_name}}..." />
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2">Plantilla — Pagament ambigu</h3>
          <textarea className="w-full border rounded px-3 py-2 font-mono text-xs h-24" value={settings["agent.template_pagament_ambigu"] || ""} onChange={(e) => on("agent.template_pagament_ambigu", e.target.value)} placeholder="Gràcies per respondre..." />
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2">Plantilla — Comprovant rebut</h3>
          <textarea className="w-full border rounded px-3 py-2 font-mono text-xs h-24" value={settings["agent.template_comprovant_rebut"] || ""} onChange={(e) => on("agent.template_comprovant_rebut", e.target.value)} placeholder="Gràcies {{client_name}}..." />
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2">Plantilla — Redirecció</h3>
          <textarea className="w-full border rounded px-3 py-2 font-mono text-xs h-24" value={settings["agent.template_redireccio"] || ""} onChange={(e) => on("agent.template_redireccio", e.target.value)} placeholder="Aquest és un sistema automàtic..." />
        </div>
      </div>
    </div>
  );
}
