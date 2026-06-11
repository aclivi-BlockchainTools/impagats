import { useState, useEffect } from "react";
import { api } from "../lib/api";

const DEFAULT_TEMPLATE = `Hola {{client_name}},

T'informem que s'ha retornat un rebut pendent i necessitem que facis la transferència al següent compte:

🏦 {{company_iban}}

📅 Període: {{service_period}}
💰 Import: {{amount}} €
📄 Ref. rebut: {{receipt_reference}}

⚠️ IMPORTANT: Si us plau, envia'ns la foto del comprovant de pagament per aquest WhatsApp.

Gràcies.
{{company_name}}`;

export default function Settings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [openwaResult, setOpenwaResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [webhookResult, setWebhookResult] = useState<{ ok: boolean; webhooks?: any[]; error?: string } | null>(null);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    api.getSettings().then((s) => {
      if (!s.whatsapp_template) s.whatsapp_template = DEFAULT_TEMPLATE;
      setSettings(s);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    await api.updateSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTestOpenWA = async () => {
    setTesting(true);
    setOpenwaResult(null);
    await api.updateSettings({
      openwa_base_url: settings.openwa_base_url || "",
      openwa_api_key: settings.openwa_api_key || "",
      openwa_session_id: settings.openwa_session_id || "",
    });
    const res = await fetch("/api/settings/test-openwa", { method: "POST" });
    const data = await res.json();
    setOpenwaResult(data);
    setTesting(false);
  };

  const handleRegisterWebhook = async () => {
    setRegistering(true);
    setWebhookResult(null);
    // Save OpenWA settings first
    await api.updateSettings({
      openwa_base_url: settings.openwa_base_url || "",
      openwa_api_key: settings.openwa_api_key || "",
      openwa_session_id: settings.openwa_session_id || "",
      app_url: settings.app_url || "",
    });
    const res = await fetch("/api/settings/register-webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appUrl: settings.app_url || window.location.origin }),
    });
    const data = await res.json();
    setWebhookResult(data);
    setRegistering(false);
  };

  const handleCheckWebhooks = async () => {
    const res = await fetch("/api/settings/webhooks");
    const data = await res.json();
    setWebhookResult(data);
  };

  const set = (key: string, value: string) => setSettings({ ...settings, [key]: value });

  if (loading) return <div className="text-gray-500">Carregant...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Configuració</h1>
      <div className="bg-white rounded-lg shadow p-6 max-w-2xl space-y-6">
        <div>
          <h2 className="font-semibold text-lg mb-3">Dades d'empresa</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nom empresa</label>
              <input className="w-full border rounded px-3 py-2" value={settings.company_name || ""}
                onChange={(e) => set("company_name", e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">IBAN</label>
              <input className="w-full border rounded px-3 py-2" value={settings.company_iban || ""}
                onChange={(e) => set("company_iban", e.target.value)} />
            </div>
          </div>
        </div>

        <div>
          <h2 className="font-semibold text-lg mb-3">Connexió OpenWA</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">URL del servidor</label>
              <input className="w-full border rounded px-3 py-2" value={settings.openwa_base_url || ""}
                onChange={(e) => set("openwa_base_url", e.target.value)}
                placeholder="http://localhost:8080" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">API Key</label>
                <input className="w-full border rounded px-3 py-2" value={settings.openwa_api_key || ""}
                  onChange={(e) => set("openwa_api_key", e.target.value)}
                  placeholder="clau-api" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Session ID</label>
                <input className="w-full border rounded px-3 py-2" value={settings.openwa_session_id || ""}
                  onChange={(e) => set("openwa_session_id", e.target.value)}
                  placeholder="id-de-sessió" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleTestOpenWA} disabled={testing || !settings.openwa_base_url}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 text-sm">
                {testing ? "Provant..." : "Provar connexió"}
              </button>
              {openwaResult && (
                openwaResult.ok
                  ? <span className="text-green-600 text-sm font-medium">Connectat correctament</span>
                  : <span className="text-red-600 text-sm">Error: {openwaResult.error}</span>
              )}
            </div>

            <div className="border-t pt-3 mt-3">
              <label className="block text-sm font-medium mb-1">URL pública del backend (per rebre webhooks)</label>
              <div className="flex gap-2">
                <input className="flex-1 border rounded px-3 py-2 text-sm" value={settings.app_url || ""}
                  onChange={(e) => set("app_url", e.target.value)}
                  placeholder={window.location.origin} />
                <button onClick={handleRegisterWebhook} disabled={registering || !settings.openwa_base_url || !settings.openwa_session_id}
                  className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50 text-sm whitespace-nowrap">
                  {registering ? "Registrant..." : "Registrar webhook"}
                </button>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <button onClick={handleCheckWebhooks} className="text-xs text-blue-600 hover:underline">Verificar webhooks existents</button>
                {webhookResult && (
                  webhookResult.ok
                    ? <span className="text-green-600 text-xs">
                        {webhookResult.webhooks && webhookResult.webhooks.length > 0
                          ? `${webhookResult.webhooks.length} webhook(s) trobat(s)`
                          : "Cap webhook (cal registrar-ne un)"}
                      </span>
                    : <span className="text-red-600 text-xs">Error: {webhookResult.error}</span>
                )}
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Es pot configurar també via variables d'entorn al .env (els valors del formulari tenen prioritat).</p>
        </div>

        <div>
          <h2 className="font-semibold text-lg mb-3">Paraules clau per detectar devolucions</h2>
          <input className="w-full border rounded px-3 py-2" value={settings.return_keywords || ""}
            onChange={(e) => set("return_keywords", e.target.value)}
            placeholder="devolucio, devolución, recibo devuelto, impagado, ..." />
          <p className="text-xs text-gray-500 mt-1">Separades per comes</p>
        </div>

        <div>
          <h2 className="font-semibold text-lg mb-3">Plantilla WhatsApp</h2>
          <textarea className="w-full border rounded px-3 py-2 font-mono text-sm h-48"
            value={settings.whatsapp_template || ""}
            onChange={(e) => set("whatsapp_template", e.target.value)}
            placeholder="Hola {{client_name}}, ..." />
          <p className="text-xs text-gray-500 mt-1">Variables: {"{{client_name}}"}, {"{{invoice_number}}"}, {"{{amount}}"}, {"{{receipt_reference}}"}, {"{{service_period}}"}, {"{{company_iban}}"}, {"{{company_name}}"}</p>
        </div>

        <div>
          <h2 className="font-semibold text-lg mb-3">Agent conversacional</h2>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium">Activat</label>
              <input
                type="checkbox"
                checked={settings["agent.enabled"] !== "false"}
                onChange={(e) => set("agent.enabled", e.target.checked ? "true" : "false")}
                className="h-4 w-4"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Timeout (hores)</label>
              <input
                className="w-32 border rounded px-3 py-2 text-sm"
                value={settings["agent.timeout_hores"] || "24"}
                onChange={(e) => set("agent.timeout_hores", e.target.value)}
                type="number"
                min="1"
                max="168"
              />
            </div>

            <div className="border-t pt-3">
              <h3 className="text-sm font-semibold mb-2">Paraules clau — Pagament clar (CAT)</h3>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={settings["agent.keywords_pagament_clar_cat"] || ""}
                onChange={(e) => set("agent.keywords_pagament_clar_cat", e.target.value)}
                placeholder="he pagat,ja he fet el pagament,transferència feta,ingrés fet"
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Paraules clau — Pagament clar (ES)</h3>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={settings["agent.keywords_pagament_clar_es"] || ""}
                onChange={(e) => set("agent.keywords_pagament_clar_es", e.target.value)}
                placeholder="he pagado,ya he hecho el pago,transferencia hecha"
              />
            </div>

            <div className="border-t pt-3">
              <h3 className="text-sm font-semibold mb-2">Paraules clau — Pagament ambigu (CAT)</h3>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={settings["agent.keywords_ambigu_cat"] || ""}
                onChange={(e) => set("agent.keywords_ambigu_cat", e.target.value)}
                placeholder="fet,ja està,ho tens,ok,d'acord,llisto"
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Paraules clau — Pagament ambigu (ES)</h3>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={settings["agent.keywords_ambigu_es"] || ""}
                onChange={(e) => set("agent.keywords_ambigu_es", e.target.value)}
                placeholder="hecho,ya está,lo tienes,vale,ok,listo"
              />
            </div>

            <div className="border-t pt-3">
              <h3 className="text-sm font-semibold mb-2">Paraules clau — Comprovant (CAT)</h3>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={settings["agent.keywords_comprovant_cat"] || ""}
                onChange={(e) => set("agent.keywords_comprovant_cat", e.target.value)}
                placeholder="comprovant,justificant,adjunt,captura"
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Paraules clau — Comprovant (ES)</h3>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={settings["agent.keywords_comprovant_es"] || ""}
                onChange={(e) => set("agent.keywords_comprovant_es", e.target.value)}
                placeholder="comprobante,justificante,adjunto,captura"
              />
            </div>

            <div className="border-t pt-3">
              <h3 className="text-sm font-semibold mb-2">Plantilla — Confirmació de pagament</h3>
              <textarea
                className="w-full border rounded px-3 py-2 font-mono text-xs h-24"
                value={settings["agent.template_pagament_clar"] || ""}
                onChange={(e) => set("agent.template_pagament_clar", e.target.value)}
                placeholder="Gràcies {{client_name}}..."
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Plantilla — Pagament ambigu</h3>
              <textarea
                className="w-full border rounded px-3 py-2 font-mono text-xs h-24"
                value={settings["agent.template_pagament_ambigu"] || ""}
                onChange={(e) => set("agent.template_pagament_ambigu", e.target.value)}
                placeholder="Gràcies per respondre..."
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Plantilla — Comprovant rebut</h3>
              <textarea
                className="w-full border rounded px-3 py-2 font-mono text-xs h-24"
                value={settings["agent.template_comprovant_rebut"] || ""}
                onChange={(e) => set("agent.template_comprovant_rebut", e.target.value)}
                placeholder="Gràcies {{client_name}}..."
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Plantilla — Redirecció</h3>
              <textarea
                className="w-full border rounded px-3 py-2 font-mono text-xs h-24"
                value={settings["agent.template_redireccio"] || ""}
                onChange={(e) => set("agent.template_redireccio", e.target.value)}
                placeholder="Aquest és un sistema automàtic..."
              />
            </div>
          </div>
        </div>

        <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm">
          {saved ? "Desat!" : "Desar configuració"}
        </button>
      </div>
    </div>
  );
}
