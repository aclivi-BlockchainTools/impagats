import { useState, useEffect } from "react";
import { api } from "../lib/api";

interface Suggestion {
  id: number;
  analysisType: string;
  anonymizedText?: string;
  currentIntent?: string;
  suggestedIntent?: string;
  confidence?: number;
  suggestedReply?: string;
  suggestedKeywords?: string[];
  suggestedStateChange?: string | null;
  conversationQuality?: string;
  agentEffectiveness?: number;
  issues?: any[];
  suggestedImprovements?: string[];
  risk?: string;
  reason?: string;
  status: string;
  provider?: string;
  model?: string;
  createdAt: string;
  reviewedAt?: string;
}

const RISK_COLORS: Record<string, string> = {
  low: "text-green-700 bg-green-50",
  medium: "text-yellow-700 bg-yellow-50",
  high: "text-red-700 bg-red-50",
};

const QUALITY_COLORS: Record<string, string> = {
  excellent: "text-green-700 bg-green-50",
  good: "text-blue-700 bg-blue-50",
  fair: "text-yellow-700 bg-yellow-50",
  poor: "text-red-700 bg-red-50",
};

export default function AgentObserverSection() {
  const [tab, setTab] = useState<"suggestions" | "conversations" | "audits" | "keywords" | "config">("suggestions");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterType, setFilterType] = useState<string>("message_classification");
  const [filterStatus, setFilterStatus] = useState<string>("PENDING");
  const [summary, setSummary] = useState<any>(null);
  const [keywords, setKeywords] = useState<any[]>([]);
  const [observerSettings, setObserverSettings] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [newKeyword, setNewKeyword] = useState({ pattern: "", intent: "", type: "KEYWORD" });
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [auditing, setAuditing] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const s = await api.getSettings();
    const obs: Record<string, string> = {};
    for (const [k, v] of Object.entries(s)) {
      if (k.startsWith("observer.")) obs[k] = v;
    }
    setObserverSettings(obs);
  };

  const setObs = (key: string, value: string) => {
    setObserverSettings({ ...observerSettings, [key]: value });
  };

  const saveSettings = async () => {
    await api.updateSettings(observerSettings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const loadSuggestions = async () => {
    setLoading(true);
    const params: Record<string, string> = { page: String(page), limit: "20" };
    if (filterType) params.type = filterType;
    if (filterStatus) params.status = filterStatus;
    const res = await api.getObserverSuggestions(params);
    setSuggestions(res.data);
    setTotal(res.total);
    setLoading(false);
  };

  const loadSummary = async () => {
    const res = await api.getObserverSummary();
    setSummary(res);
  };

  const loadKeywords = async () => {
    const res = await api.getObserverKeywords();
    setKeywords(res);
  };

  useEffect(() => {
    if (tab === "suggestions") loadSuggestions();
    else if (tab === "conversations") { setFilterType("conversation_review"); loadSuggestions(); }
    else if (tab === "audits") { setFilterType("agent_audit"); loadSuggestions(); }
    else if (tab === "keywords") loadKeywords();
  }, [tab, page]);

  useEffect(() => {
    if (tab === "suggestions" || tab === "conversations" || tab === "audits") loadSuggestions();
  }, [filterType, filterStatus]);

  const handleApprove = async (id: number) => {
    await api.updateObserverSuggestion(id, "APPROVED");
    loadSuggestions();
  };

  const handleReject = async (id: number) => {
    await api.updateObserverSuggestion(id, "REJECTED");
    loadSuggestions();
  };

  const handleApply = async (id: number) => {
    await api.applyObserverSuggestion(id);
    loadSuggestions();
    loadKeywords();
  };

  const handleCreateKeyword = async () => {
    if (!newKeyword.pattern.trim()) return;
    await api.createObserverKeyword({
      pattern: newKeyword.pattern.trim(),
      intent: newKeyword.intent || undefined,
      type: newKeyword.type,
    });
    setNewKeyword({ pattern: "", intent: "", type: "KEYWORD" });
    loadKeywords();
  };

  const handleToggleKeyword = async (id: number, active: boolean) => {
    await api.updateObserverKeyword(id, { active: !active });
    loadKeywords();
  };

  const handleDeleteKeyword = async (id: number) => {
    await api.deleteObserverKeyword(id);
    loadKeywords();
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    await saveSettings();
    const res = await api.testObserver();
    setTestResult(res);
    setTesting(false);
  };

  const handleAudit = async () => {
    setAuditing(true);
    const res = await api.runObserverAudit();
    setTestResult(res);
    setAuditing(false);
    loadSuggestions();
  };

  const tabs = [
    { key: "suggestions", label: "Suggeriments" },
    { key: "conversations", label: "Revisions conversa" },
    { key: "audits", label: "Auditories" },
    { key: "keywords", label: "Paraules clau" },
    { key: "config", label: "Configuració" },
  ] as const;

  return (
    <div>
      <h2 className="font-semibold text-lg mb-3">Aprenentatge agent</h2>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm rounded-t ${tab === t.key ? "bg-white border border-b-white -mb-px font-medium text-blue-700" : "text-gray-500 hover:text-gray-700"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Subpestanya 1: Suggeriments (N1) */}
      {tab === "suggestions" && (
        <div>
          <div className="flex gap-2 mb-3 flex-wrap">
            <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
              className="border rounded px-2 py-1 text-sm">
              <option value="PENDING">Pendents</option>
              <option value="APPROVED">Aprovats</option>
              <option value="REJECTED">Rebutjats</option>
              <option value="APPLIED">Aplicats</option>
              <option value="">Tots</option>
            </select>
            <button onClick={loadSuggestions} className="text-sm text-blue-600 hover:underline">Actualitzar</button>
          </div>

          {loading ? <p className="text-gray-500 text-sm">Carregant...</p> : suggestions.length === 0 ? (
            <p className="text-gray-500 text-sm">Cap suggeriment. Els suggeriments apareixeran quan arribin missatges nous.</p>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {suggestions.map((s) => (
                <div key={s.id} className="bg-gray-50 rounded p-3 text-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-mono text-xs bg-gray-200 rounded px-1 py-0.5">{s.currentIntent || "-"}</span>
                      <span className="mx-1 text-gray-400">→</span>
                      <span className="font-mono text-xs bg-blue-100 rounded px-1 py-0.5">{s.suggestedIntent || "-"}</span>
                      {s.confidence != null && (
                        <span className="ml-2 text-xs">
                          Confiança:{" "}
                          <span className={`font-semibold ${s.confidence >= 0.8 ? "text-green-700" : s.confidence >= 0.5 ? "text-yellow-700" : "text-red-700"}`}>
                            {(s.confidence * 100).toFixed(0)}%
                          </span>
                        </span>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${RISK_COLORS[s.risk || "low"] || ""}`}>
                      {s.risk || "low"}
                    </span>
                  </div>

                  {s.anonymizedText && (
                    <details className="mb-2">
                      <summary className="text-gray-500 cursor-pointer text-xs">Text anonimitzat</summary>
                      <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto max-h-24">{s.anonymizedText}</pre>
                    </details>
                  )}

                  {s.suggestedReply && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mb-2">
                      <p className="text-xs text-yellow-700 font-medium mb-1">RESPOSTA SUGGERIDA — NO enviada automàticament</p>
                      <p className="text-xs">{s.suggestedReply}</p>
                    </div>
                  )}

                  {s.suggestedKeywords && s.suggestedKeywords.length > 0 && (
                    <div className="flex gap-1 flex-wrap mb-2">
                      {s.suggestedKeywords.filter((k: string) => k).map((kw: string) => (
                        <span key={kw} className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{kw}</span>
                      ))}
                    </div>
                  )}

                  {s.reason && <p className="text-xs text-gray-500 mb-2">{s.reason}</p>}

                  <div className="flex gap-2">
                    {s.status === "PENDING" && (
                      <>
                        {s.suggestedIntent && (
                          <button onClick={() => handleApply(s.id)} className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">
                            Aprovar intent
                          </button>
                        )}
                        {s.suggestedKeywords && s.suggestedKeywords.length > 0 && (
                          <button onClick={() => handleApply(s.id)} className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700">
                            Aprovar paraules
                          </button>
                        )}
                        {s.suggestedReply && (
                          <button onClick={() => handleApply(s.id)} className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">
                            Aprovar plantilla
                          </button>
                        )}
                        <button onClick={() => handleReject(s.id)} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200">
                          Rebutjar
                        </button>
                      </>
                    )}
                    {s.status !== "PENDING" && (
                      <span className={`text-xs px-2 py-0.5 rounded ${s.status === "APPLIED" ? "bg-green-100 text-green-700" : s.status === "APPROVED" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}>
                        {s.status === "APPLIED" ? "Aplicat" : s.status === "APPROVED" ? "Aprovat" : "Rebutjat"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {total > 20 && (
            <div className="flex gap-2 mt-3 justify-center">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                className="text-sm px-3 py-1 border rounded disabled:opacity-50">Anterior</button>
              <button onClick={() => setPage(page + 1)} disabled={page * 20 >= total}
                className="text-sm px-3 py-1 border rounded disabled:opacity-50">Següent</button>
            </div>
          )}
        </div>
      )}

      {/* Subpestanya 2: Revisions conversa (N2) */}
      {tab === "conversations" && (
        <div>
          <div className="flex gap-2 mb-3">
            <button onClick={() => { setFilterType("conversation_review"); loadSuggestions(); }}
              className="text-sm text-blue-600 hover:underline">Actualitzar</button>
          </div>

          {loading ? <p className="text-gray-500 text-sm">Carregant...</p> : suggestions.length === 0 ? (
            <p className="text-gray-500 text-sm">Cap revisió de conversa. Apareixeran quan les converses tinguin 3+ missatges.</p>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {suggestions.map((s) => (
                <div key={s.id} className="bg-gray-50 rounded p-3 text-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex gap-2 items-center">
                      <span className={`text-xs px-2 py-0.5 rounded ${QUALITY_COLORS[s.conversationQuality || "fair"] || ""}`}>
                        {s.conversationQuality || "-"}
                      </span>
                      {s.agentEffectiveness != null && (
                        <span className="text-xs text-gray-500">
                          Efectivitat: {(s.agentEffectiveness * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">{new Date(s.createdAt).toLocaleDateString("ca-ES")}</span>
                  </div>

                  {s.reason && <p className="text-xs mb-2">{s.reason}</p>}

                  {s.issues && Array.isArray(s.issues) && s.issues.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs font-medium text-gray-600 mb-1">Problemes detectats:</p>
                      {s.issues.map((issue: any, i: number) => (
                        <div key={i} className="text-xs text-gray-600 ml-2">
                          • {issue.description}
                          {issue.suggestedIntent && <span className="text-purple-600"> — Suggerit: {issue.suggestedIntent}</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {s.suggestedImprovements && Array.isArray(s.suggestedImprovements) && s.suggestedImprovements.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs font-medium text-gray-600 mb-1">Millores suggerides:</p>
                      {s.suggestedImprovements.map((imp: string, i: number) => (
                        <div key={i} className="text-xs text-green-700 ml-2">✓ {imp}</div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    {s.status === "PENDING" && (
                      <>
                        <button onClick={() => handleApply(s.id)} className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">
                          Aprovar millores
                        </button>
                        <button onClick={() => handleReject(s.id)} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200">
                          Rebutjar
                        </button>
                      </>
                    )}
                    {s.status !== "PENDING" && (
                      <span className={`text-xs px-2 py-0.5 rounded ${s.status === "APPLIED" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {s.status === "APPLIED" ? "Aplicat" : "Rebutjat"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Subpestanya 3: Auditories (N3) */}
      {tab === "audits" && (
        <div>
          <div className="flex gap-2 mb-3">
            <button onClick={handleAudit} disabled={auditing}
              className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50">
              {auditing ? "Generant..." : "Generar auditoria"}
            </button>
            <button onClick={loadSummary}
              className="text-sm text-blue-600 hover:underline">Resum</button>
          </div>

          {testResult?.ok && (
            <div className="mb-3 p-2 bg-green-50 text-green-700 text-sm rounded">
              Auditoria generada correctament
            </div>
          )}

          {summary && (
            <div className="bg-gray-50 rounded p-3 text-sm mb-3">
              <p className="font-medium mb-2">Període: {summary.period?.from} → {summary.period?.to}</p>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-white p-2 rounded">
                  <p className="text-xs text-gray-500">Total suggeriments</p>
                  <p className="font-semibold">{summary.suggestions?.total}</p>
                </div>
                <div className="bg-white p-2 rounded">
                  <p className="text-xs text-gray-500">Pendents</p>
                  <p className="font-semibold text-yellow-700">{summary.suggestions?.pending}</p>
                </div>
                <div className="bg-white p-2 rounded">
                  <p className="text-xs text-gray-500">Aprovats</p>
                  <p className="font-semibold text-blue-700">{summary.suggestions?.approved}</p>
                </div>
                <div className="bg-white p-2 rounded">
                  <p className="text-xs text-gray-500">Aplicats</p>
                  <p className="font-semibold text-green-700">{summary.suggestions?.applied}</p>
                </div>
                <div className="bg-white p-2 rounded">
                  <p className="text-xs text-gray-500">Risc alt</p>
                  <p className="font-semibold text-red-700">{summary.highRiskCount}</p>
                </div>
                <div className="bg-white p-2 rounded">
                  <p className="text-xs text-gray-500">Keywords LLM</p>
                  <p className="font-semibold text-purple-700">{summary.llmKeywordsCount}</p>
                </div>
              </div>

              {summary.topCorrectedIntents?.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs font-medium mb-1">Intents més corregits:</p>
                  {summary.topCorrectedIntents.map((c: any, i: number) => (
                    <div key={i} className="text-xs text-gray-600">{c.intent}: {c.count} correccions</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {suggestions.map((s) => (
                <div key={s.id} className="bg-gray-50 rounded p-2 text-xs">
                  <span className="text-gray-400">{new Date(s.createdAt).toLocaleDateString("ca-ES")}</span>
                  <p className="mt-1">{s.reason}</p>
                  {s.suggestedImprovements && Array.isArray(s.suggestedImprovements) && (
                    <div className="mt-1">
                      {s.suggestedImprovements.map((imp: string, i: number) => (
                        <div key={i} className="text-green-700">✓ {imp}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Subpestanya 4: Paraules clau */}
      {tab === "keywords" && (
        <div>
          <div className="bg-gray-50 rounded p-3 mb-3">
            <p className="text-xs font-medium mb-2">Nova paraula clau</p>
            <div className="flex gap-2">
              <input value={newKeyword.pattern} onChange={(e) => setNewKeyword({ ...newKeyword, pattern: e.target.value })}
                className="border rounded px-2 py-1 text-sm flex-1" placeholder="Paraula o regex" />
              <input value={newKeyword.intent} onChange={(e) => setNewKeyword({ ...newKeyword, intent: e.target.value })}
                className="border rounded px-2 py-1 text-sm w-40" placeholder="Intent (opcional)" />
              <button onClick={handleCreateKeyword}
                className="text-sm bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">Afegir</button>
            </div>
          </div>

          {keywords.length === 0 ? (
            <p className="text-gray-500 text-sm">Cap paraula clau configurada.</p>
          ) : (
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {keywords.map((kw) => (
                <div key={kw.id} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2 text-sm">
                  <div className="flex gap-2 items-center">
                    <code className="text-xs bg-gray-200 px-1 py-0.5 rounded">{kw.pattern}</code>
                    {kw.intent && <span className="text-xs text-blue-600">{kw.intent}</span>}
                    <span className="text-xs text-gray-400">{kw.type}</span>
                    <span className={`text-xs px-1 py-0.5 rounded ${kw.source === "LLM" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}>
                      {kw.source}
                    </span>
                    <span className={`w-2 h-2 rounded-full ${kw.active ? "bg-green-500" : "bg-gray-300"}`} />
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => handleToggleKeyword(kw.id, kw.active)}
                      className="text-xs text-blue-600 hover:underline">{kw.active ? "Desactivar" : "Activar"}</button>
                    <button onClick={() => handleDeleteKeyword(kw.id)}
                      className="text-xs text-red-600 hover:underline">Esborrar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Subpestanya 5: Configuració */}
      {tab === "config" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Activar LLM Observer</p>
              <p className="text-xs text-gray-500">Activa l'observador per monitorar converses i generar suggeriments</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={observerSettings["observer.enabled"] === "true"}
                onChange={(e) => setObs("observer.enabled", e.target.checked ? "true" : "false")}
                className="sr-only peer" />
              <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
            </label>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Provider</label>
            <select value={observerSettings["observer.provider"] || "deepseek"}
              onChange={(e) => setObs("observer.provider", e.target.value)}
              className="border rounded px-2 py-1 text-sm w-full">
              <option value="deepseek">DeepSeek</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="disabled">Desactivat</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Model</label>
            <input value={observerSettings["observer.model"] || "deepseek-v4-pro"}
              onChange={(e) => setObs("observer.model", e.target.value)}
              className="border rounded px-2 py-1 text-sm w-full"
              placeholder="gpt-4o, claude-opus-4-6, deepseek-v4-pro" />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Llindar confiança: {observerSettings["observer.confidence_threshold"] || "0.7"}</label>
            <input type="range" min="0" max="1" step="0.05"
              value={observerSettings["observer.confidence_threshold"] || "0.7"}
              onChange={(e) => setObs("observer.confidence_threshold", e.target.value)}
              className="w-full" />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Guardar text anonimitzat</p>
              <p className="text-xs text-gray-500">Si està desactivat, no es guarda el text ni l'hash</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={observerSettings["observer.store_anonymized"] !== "false"}
                onChange={(e) => setObs("observer.store_anonymized", e.target.checked ? "true" : "false")}
                className="sr-only peer" />
              <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Mode estricte privacitat</p>
              <p className="text-xs text-gray-500">Si actiu, ni tan sols es guarda el hash del text original</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={observerSettings["observer.strict_privacy"] === "true"}
                onChange={(e) => setObs("observer.strict_privacy", e.target.checked ? "true" : "false")}
                className="sr-only peer" />
              <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
            </label>
          </div>

          <div className="flex gap-2">
            <button onClick={saveSettings}
              className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
              {saved ? "Desat!" : "Desar configuració"}
            </button>
            <button onClick={handleTest} disabled={testing}
              className="text-sm border px-3 py-1 rounded hover:bg-gray-100 disabled:opacity-50">
              {testing ? "Provant..." : "Test connexió"}
            </button>
          </div>

          {testResult && (
            <div className={`p-2 rounded text-sm ${testResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {testResult.ok ? testResult.message : `Error: ${testResult.error}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
