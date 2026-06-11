interface Props {
  settings: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onTest: () => void;
  onRegisterWebhook: () => void;
  onCheckWebhooks: () => void;
  testing: boolean;
  registering: boolean;
  openwaResult: { ok: boolean; error?: string } | null;
  webhookResult: { ok: boolean; webhooks?: any[]; error?: string } | null;
}

export default function OpenWASection({
  settings, onChange, onTest, onRegisterWebhook, onCheckWebhooks,
  testing, registering, openwaResult, webhookResult,
}: Props) {
  return (
    <div>
      <h2 className="font-semibold text-lg mb-3">Connexió OpenWA</h2>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">URL del servidor</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={settings.openwa_base_url || ""}
            onChange={(e) => onChange("openwa_base_url", e.target.value)}
            placeholder="http://localhost:8080"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">API Key</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={settings.openwa_api_key || ""}
              onChange={(e) => onChange("openwa_api_key", e.target.value)}
              placeholder="clau-api"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Session ID</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={settings.openwa_session_id || ""}
              onChange={(e) => onChange("openwa_session_id", e.target.value)}
              placeholder="id-de-sessió"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onTest}
            disabled={testing || !settings.openwa_base_url}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 text-sm"
          >
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
            <input
              className="flex-1 border rounded px-3 py-2 text-sm"
              value={settings.app_url || ""}
              onChange={(e) => onChange("app_url", e.target.value)}
              placeholder={window.location.origin}
            />
            <button
              onClick={onRegisterWebhook}
              disabled={registering || !settings.openwa_base_url || !settings.openwa_session_id}
              className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50 text-sm whitespace-nowrap"
            >
              {registering ? "Registrant..." : "Registrar webhook"}
            </button>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <button onClick={onCheckWebhooks} className="text-xs text-blue-600 hover:underline">
              Verificar webhooks existents
            </button>
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
      <p className="text-xs text-gray-500 mt-2">
        Es pot configurar també via variables d'entorn al .env (els valors del formulari tenen prioritat).
      </p>
    </div>
  );
}
