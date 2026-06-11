import { useState, useEffect } from "react";
import { api } from "../lib/api";
import CompanySection from "../components/CompanySection";
import OpenWASection from "../components/OpenWASection";
import AgentSection from "../components/AgentSection";

const DEFAULT_TEMPLATE = `Hola {{client_name}},

T'informem que s'ha retornat el rebut del període {{service_period}} corresponent a la factura {{invoice_number}} per un import de {{amount}} €.

Per regularitzar la situació, fes una transferència al següent compte:

🏦 {{company_iban}}
📋 Factura: {{invoice_number}}

⚠️ IMPORTANT: Si us plau, envia'ns la foto del comprovant de pagament per aquest WhatsApp.

Gràcies.
{{company_name}}`;

const DEFAULT_MULTIPLE_TEMPLATE = `Hola {{client_name}},

T'informem que s'han retornat els rebuts següents:

{{receipts_list}}

🏦 {{company_iban}}
💰 Total a pagar: {{total_amount}} €

⚠️ IMPORTANT: Si us plau, envia'ns la foto dels comprovants de pagament per aquest WhatsApp.

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
      if (!s.whatsapp_template_multiple) s.whatsapp_template_multiple = DEFAULT_MULTIPLE_TEMPLATE;
      setSettings(s);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    await api.updateSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const set = (key: string, value: string) => setSettings({ ...settings, [key]: value });

  const handleTestOpenWA = async () => {
    setTesting(true);
    setOpenwaResult(null);
    await api.updateSettings({
      openwa_base_url: settings.openwa_base_url || "",
      openwa_api_key: settings.openwa_api_key || "",
      openwa_session_id: settings.openwa_session_id || "",
    });
    const res = await fetch("/api/settings/test-openwa", { method: "POST" });
    setOpenwaResult(await res.json());
    setTesting(false);
  };

  const handleRegisterWebhook = async () => {
    setRegistering(true);
    setWebhookResult(null);
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
    setWebhookResult(await res.json());
    setRegistering(false);
  };

  const handleCheckWebhooks = async () => {
    const res = await fetch("/api/settings/webhooks");
    setWebhookResult(await res.json());
  };

  if (loading) return <div className="text-gray-500">Carregant...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Configuració</h1>
      <div className="bg-white rounded-lg shadow p-6 max-w-2xl space-y-6">
        <CompanySection settings={settings} onChange={set} />

        <OpenWASection
          settings={settings} onChange={set}
          onTest={handleTestOpenWA} onRegisterWebhook={handleRegisterWebhook}
          onCheckWebhooks={handleCheckWebhooks}
          testing={testing} registering={registering}
          openwaResult={openwaResult} webhookResult={webhookResult}
        />

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
          <h2 className="font-semibold text-lg mb-3">Plantilla WhatsApp múltiple</h2>
          <textarea className="w-full border rounded px-3 py-2 font-mono text-sm h-48"
            value={settings.whatsapp_template_multiple || ""}
            onChange={(e) => set("whatsapp_template_multiple", e.target.value)}
            placeholder="Hola {{client_name}}, ..." />
          <p className="text-xs text-gray-500 mt-1">Variables: {"{{client_name}}"}, {"{{receipts_list}}"}, {"{{total_amount}}"}, {"{{company_iban}}"}, {"{{company_name}}"}</p>
        </div>

        <AgentSection settings={settings} onChange={set} />

        <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm">
          {saved ? "Desat!" : "Desar configuració"}
        </button>
      </div>
    </div>
  );
}
