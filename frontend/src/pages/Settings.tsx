import { useState, useEffect } from "react";
import { api } from "../lib/api";

export default function Settings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getSettings().then((s) => { setSettings(s); setLoading(false); });
  }, []);

  const handleSave = async () => {
    await api.updateSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
          <div className="grid grid-cols-2 gap-4 mb-2">
            <div>
              <label className="block text-sm font-medium mb-1">URL del servidor</label>
              <input className="w-full border rounded px-3 py-2" value={settings.openwa_base_url || ""}
                onChange={(e) => set("openwa_base_url", e.target.value)}
                placeholder="http://localhost:8080" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">API Key</label>
              <input className="w-full border rounded px-3 py-2" value={settings.openwa_api_key || ""}
                onChange={(e) => set("openwa_api_key", e.target.value)}
                placeholder="clau-api" />
            </div>
          </div>
          <p className="text-xs text-gray-500">Es pot configurar també via variables d'entorn OPENWA_BASE_URL i OPENWA_API_KEY al .env (els valors del formulari tenen prioritat).</p>
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
          <p className="text-xs text-gray-500 mt-1">Variables: {"{{client_name}}"}, {"{{invoice_number}}"}, {"{{amount}}"}, {"{{receipt_reference}}"}, {"{{company_iban}}"}, {"{{company_name}}"}</p>
        </div>

        <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm">
          {saved ? "Desat!" : "Desar configuració"}
        </button>
      </div>
    </div>
  );
}
