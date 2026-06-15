import { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import StatusBadge from "../components/StatusBadge";
import { formatAmount } from "../lib/api";

function formatDataEmissio(valor: string | undefined): string {
  if (!valor) return "-";
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(valor)) return valor;
  const isoMatch = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1].slice(2)}`;
  return valor;
}

const CAT_MONTHS: Record<string, number> = {
  "gener": 1, "febrer": 2, "març": 3, "abril": 4,
  "maig": 5, "juny": 6, "juliol": 7, "agost": 8,
  "setembre": 9, "octubre": 10, "novembre": 11, "desembre": 12,
};

function periodToSort(period: string | null | undefined): number {
  if (!period) return 0;
  const parts = period.trim().split(/\s+/);
  if (parts.length < 2) return 0;
  const month = CAT_MONTHS[parts[0].toLowerCase()] || 0;
  const year = parseInt(parts[1]) || 0;
  return year * 100 + month;
}

// Traducció de codis de motiu bancari
function translateReturnReason(reason: string | null | undefined): string {
  if (!reason) return "-";
  const upper = reason.toUpperCase().trim();
  const translations: Record<string, string> = {
    "FALTA DE FONDOS": "Falta de fons",
    "FALTA DE FONS": "Falta de fons",
    "COMPTE BLOQUEJAT": "Compte bloquejat",
    "COMPTE CANCELAT": "Compte cancel·lat",
    "OPER NO AUTO/MAND": "Operació no autoritzada / mandat",
    "CUENTA CANCELADA": "Compte cancel·lat",
    "CUENTA BLOQUEADA": "Compte bloquejat",
  };
  // Cerca exacta primer, després cerca per substring
  if (translations[upper]) return translations[upper];
  for (const [key, val] of Object.entries(translations)) {
    if (upper.includes(key)) return val;
  }
  return reason;
}

// Quick filter pills
const QUICK_FILTERS: { key: string; label: string; statuses: string[]; color: string; activeColor: string }[] = [
  { key: "pending",  label: "Pendents",     statuses: ["DETECTAT", "EMPARELLAT", "REVISAR"],      color: "bg-white border-gray-200 text-gray-700", activeColor: "bg-orange-600 text-white border-orange-600" },
  { key: "notified", label: "Notificats",   statuses: ["NOTIFICAT"],                               color: "bg-white border-gray-200 text-gray-700", activeColor: "bg-purple-600 text-white border-purple-600" },
  { key: "waiting",  label: "Esperant justificant", statuses: ["ESPERANT_JUSTIFICANT"],            color: "bg-white border-gray-200 text-gray-700", activeColor: "bg-indigo-600 text-white border-indigo-600" },
  { key: "proof",    label: "Justificant rebut",    statuses: ["JUSTIFICANT_REBUT", "PENDENT_REVISIO"], color: "bg-white border-gray-200 text-gray-700", activeColor: "bg-emerald-600 text-white border-emerald-600" },
  { key: "error",    label: "Error WhatsApp",       statuses: ["ERROR_WHATSAPP"],                  color: "bg-white border-gray-200 text-gray-700", activeColor: "bg-red-600 text-white border-red-600" },
];

// Seguiment — estat de l'agent/whatsapp
function SeguimentBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; dot: string }> = {
    NOTIFICAT:            { label: "WhatsApp enviat",    color: "text-green-700", dot: "bg-green-500" },
    ESPERANT_JUSTIFICANT: { label: "Esperant justificant", color: "text-yellow-700", dot: "bg-yellow-500" },
    PAGAMENT_DECLARAT:    { label: "Pagament declarat",  color: "text-rose-700",   dot: "bg-rose-500" },
    JUSTIFICANT_REBUT:    { label: "Justificant rebut",  color: "text-teal-700",   dot: "bg-teal-500" },
    ERROR_WHATSAPP:       { label: "Error WhatsApp",     color: "text-red-700",    dot: "bg-red-500" },
    PENDENT_REVISIO:      { label: "Pendent revisió",    color: "text-amber-700",  dot: "bg-amber-500" },
    PAGAMENT_CONFIRMAT:   { label: "Pagament confirmat", color: "text-emerald-700",dot: "bg-emerald-500" },
    TANCAT:               { label: "Tancat",             color: "text-gray-500",   dot: "bg-gray-400" },
  };
  const info = map[status];
  if (!info) return <span className="text-gray-400 text-xs">—</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span className={`w-1.5 h-1.5 rounded-full ${info.dot}`} />
      <span className={info.color}>{info.label}</span>
    </span>
  );
}

export default function ReturnedReceiptsList() {
  const [searchParams] = useSearchParams();
  const clientIdFromUrl = searchParams.get("clientId") || "";
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [sending, setSending] = useState(false);
  const [sortKey, setSortKey] = useState<string>("returnDate");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");
  const [quickFilter, setQuickFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const apiParams: Record<string, string> = { ...filters, page: String(page), limit: "50" };
  if (clientIdFromUrl) apiParams.clientId = clientIdFromUrl;

  const { data: receipts, loading, error, reload } = useApi(() => api.getReturnedReceipts(apiParams));

  useEffect(() => { setPage(1); }, [filters, clientIdFromUrl]);
  useEffect(() => { reload(); }, [page, filters, clientIdFromUrl]);

  const filtered = useMemo(() => {
    if (!receipts?.data) return [];
    let list = receipts.data;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r: any) =>
        (r.client?.name && r.client.name.toLowerCase().includes(q)) ||
        (r.receiptReference && r.receiptReference.toLowerCase().includes(q)) ||
        (r.notes && r.notes.toLowerCase().includes(q)) ||
        (r.returnReason && r.returnReason.toLowerCase().includes(q))
      );
    }
    // Quick filter
    if (quickFilter) {
      const qf = QUICK_FILTERS.find(f => f.key === quickFilter);
      if (qf) list = list.filter((r: any) => qf.statuses.includes(r.status));
    }
    // Sort
    return [...list].sort((a: any, b: any) => {
      let va: any, vb: any;
      switch (sortKey) {
        case "returnDate": va = new Date(a.returnDate).getTime(); vb = new Date(b.returnDate).getTime(); break;
        case "client": va = (a.client?.name || "").toLowerCase(); vb = (b.client?.name || "").toLowerCase(); break;
        case "reference": va = a.receiptReference || ""; vb = b.receiptReference || ""; break;
        case "returnReason": va = a.returnReason || ""; vb = b.returnReason || ""; break;
        case "servicePeriod": va = periodToSort(a.servicePeriod); vb = periodToSort(b.servicePeriod); break;
        case "amount": va = a.returnedAmount; vb = b.returnedAmount; break;
        case "status": va = a.status; vb = b.status; break;
        default: return 0;
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [receipts, search, sortKey, sortDir, quickFilter]);

  // Resum de dades visibles
  const totalVisible = filtered.length;
  const selectedReceipts = filtered.filter((r: any) => selected.has(r.id));
  const selectedImport = selectedReceipts.reduce((sum: number, r: any) => sum + (parseFloat(r.returnedAmount) || 0), 0);
  const totalClients = receipts?.uniqueClients ?? 0;

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortHead = ({ col, label }: { col: string; label: string }) => (
    <th className="text-left p-3 cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort(col)}>
      {label} {sortKey === col ? (sortDir === "asc" ? "▲" : "▼") : ""}
    </th>
  );

  const SortHeadRight = ({ col, label }: { col: string; label: string }) => (
    <th className="text-right p-3 cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort(col)}>
      {label} {sortKey === col ? (sortDir === "asc" ? "▲" : "▼") : ""}
    </th>
  );

  const toggle = (id: number) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === totalVisible) setSelected(new Set());
    else setSelected(new Set(filtered.map((r: any) => r.id)));
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Segur que vols eliminar aquest impagat?")) return;
    try {
      await api.deleteReturnedReceipt(id);
      reload();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Segur que vols eliminar ${selected.size} impagats?`)) return;
    for (const id of selected) await api.deleteReturnedReceipt(id);
    setSelected(new Set());
    reload();
  };

  // WhatsApp massiu: només si tots els seleccionats són del mateix client
  const sameClient = selected.size >= 2 && new Set(selectedReceipts.map((r: any) => r.clientId)).size === 1;
  const canSend = sameClient && selectedReceipts.every((r: any) =>
    ["DETECTAT", "EMPARELLAT", "REVISAR", "ERROR_WHATSAPP"].includes(r.status)
  );

  const sendTooltip = !sameClient
    ? "Tots els impagats han de ser del mateix client"
    : !canSend
    ? "Els impagats han d'estar en estat DETECTAT, EMPARELLAT, REVISAR o ERROR_WHATSAPP"
    : "";

  const handleBulkWhatsApp = async () => {
    if (!sameClient) return;
    setSending(true);
    try {
      const result = await api.sendBulkWhatsApp([...selected]);
      if (result.success) {
        alert(`WhatsApp enviat a ${selectedReceipts[0].client?.name}. ${selected.size} rebuts notificats.`);
        setSelected(new Set());
        reload();
      } else {
        alert("Error: " + result.error);
      }
    } catch (err: any) {
      alert(err.message);
    }
    setSending(false);
  };

  if (loading) return <div className="text-gray-500">Carregant...</div>;
  if (error) return <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">Error: {error}</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Impagats</h1>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <>
              <button onClick={handleBulkDelete} className="bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 text-sm">
                Eliminar ({selected.size})
              </button>
              {selected.size >= 2 && (
                <button
                  onClick={handleBulkWhatsApp}
                  disabled={!canSend || sending}
                  title={sendTooltip}
                  className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 disabled:opacity-50 text-sm"
                >
                  {sending ? "Enviant..." : `WhatsApp (${selected.size})`}
                </button>
              )}
            </>
          )}
          <Link to="/receipts/new" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm">Nou impagat</Link>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow p-4 mb-4 space-y-3">
        {/* Filtres ràpids */}
        <div className="flex flex-wrap gap-2">
          {QUICK_FILTERS.map((qf) => (
            <button
              key={qf.key}
              onClick={() => setQuickFilter(quickFilter === qf.key ? "" : qf.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors
                ${quickFilter === qf.key ? qf.activeColor : qf.color + " hover:border-gray-300"}`}
            >
              {qf.label}
            </button>
          ))}
        </div>

        {/* Filtre d'estat + cerca */}
        <div className="flex gap-4 flex-wrap">
          <select className="border rounded px-3 py-2 text-sm" value={filters.status || ""}
            onChange={(e) => setFilters(e.target.value ? { ...filters, status: e.target.value } : {})}>
            <option value="">Tots els estats</option>
            <option value="DETECTAT">Detectat</option>
            <option value="EMPARELLAT">Emparellat</option>
            <option value="REVISAR">Revisar</option>
            <option value="NOTIFICAT">Notificat</option>
            <option value="ESPERANT_JUSTIFICANT">Esperant justificant</option>
            <option value="PAGAMENT_DECLARAT">Pagament declarat</option>
            <option value="JUSTIFICANT_REBUT">Justificant rebut</option>
            <option value="PENDENT_REVISIO">Pendent revisió</option>
            <option value="PAGAMENT_CONFIRMAT">Pagament confirmat</option>
            <option value="TANCAT">Tancat</option>
            <option value="ERROR_WHATSAPP">Error WhatsApp</option>
            <option value="IGNORAT">Ignorat</option>
          </select>
          <input className="border rounded px-3 py-2 text-sm flex-1" placeholder="Cercar impagats..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {/* Banner de filtre per client */}
        {clientIdFromUrl && (
          <div className="bg-blue-50 border border-blue-200 rounded px-4 py-2 flex items-center justify-between">
            <span className="text-sm text-blue-800">
              Filtrant per client: <span className="font-semibold">{receipts?.data?.[0]?.client?.name || `#${clientIdFromUrl}`}</span>
              {" "}({receipts?.total || 0} rebuts)
            </span>
            <Link to="/receipts" className="text-sm text-blue-600 hover:underline">Treure filtre</Link>
          </div>
        )}
      </div>

      {/* Resum */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-gray-500">Total impagats:</span>{" "}
            <span className="font-semibold text-lg">{receipts?.total || 0}</span>
          </div>
          <div>
            <span className="text-gray-500">Clients diferents:</span>{" "}
            <span className="font-semibold text-lg">{totalClients}</span>
          </div>
          {selected.size > 0 && (
            <>
              <div className="border-l border-gray-200 pl-6">
                <span className="text-gray-500">Seleccionats:</span>{" "}
                <span className="font-semibold text-blue-700">{selected.size}</span>
              </div>
              <div>
                <span className="text-gray-500">Import seleccionat:</span>{" "}
                <span className="font-semibold text-blue-700">{selectedImport.toFixed(2)} €</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Taula */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3 w-8"><input type="checkbox" checked={selected.size === totalVisible && totalVisible > 0} onChange={toggleAll} /></th>
              <SortHead col="returnDate" label="Data devolució" />
              <SortHead col="client" label="Client" />
              <th className="text-left p-3">Factura</th>
              <SortHead col="returnReason" label="Motiu devolució" />
              <SortHead col="servicePeriod" label="Període" />
              <th className="text-left p-3">Data emissió</th>
              <SortHeadRight col="amount" label="Import" />
              <SortHead col="status" label="Estat" />
              <th className="text-left p-3">Seguiment</th>
              <th className="text-right p-3">Accions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r: any) => (
              <tr key={r.id} className="border-t hover:bg-blue-50/50 transition-colors">
                <td className="p-3"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} /></td>
                <td className="p-3 whitespace-nowrap">{new Date(r.returnDate).toLocaleDateString("ca-ES")}</td>
                <td className="p-3 max-w-[160px]">
                  <span className="font-medium truncate block" title={r.client?.name}>
                    {r.client?.name || <span className="text-orange-500">No assignat</span>}
                  </span>
                </td>
                <td className="p-3 font-mono text-xs">{r.receiptReference || "-"}</td>
                <td className="p-3 text-xs max-w-[160px]">
                  <span title={r.returnReason}>
                    {translateReturnReason(r.returnReason)}
                  </span>
                </td>
                <td className="p-3 text-sm">{r.servicePeriod || "-"}</td>
                <td className="p-3 text-sm">{formatDataEmissio(r.bankMovement?.rawData?.Valor)}</td>
                <td className="p-3 text-right font-semibold whitespace-nowrap">{formatAmount(r.returnedAmount)} €</td>
                <td className="p-3"><StatusBadge status={r.status} /></td>
                <td className="p-3"><SeguimentBadge status={r.status} /></td>
                <td className="p-3 text-right space-x-2 whitespace-nowrap">
                  <Link to={`/receipts/${r.id}`} className="text-blue-600 hover:underline">Detall</Link>
                  <button onClick={() => handleDelete(r.id)} className="text-red-600 hover:underline">Eliminar</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={11} className="p-3 text-center text-gray-500">{search || quickFilter ? "Cap coincidència" : "Cap impagat"}</td></tr>}
            {receipts && filtered.length > 0 && (
              <tr><td colSpan={11} className="p-3 text-right text-sm text-gray-500">
                Mostrant {filtered.length} de {receipts.total} — Pàg {receipts.page}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginació */}
      {receipts && receipts.total > receipts.limit && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-gray-500">
            Pàgina {receipts.page} de {Math.ceil(receipts.total / receipts.limit)}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p: number) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Anterior
            </button>
            <button
              onClick={() => setPage((p: number) => p + 1)}
              disabled={page >= Math.ceil(receipts.total / receipts.limit)}
              className="px-3 py-1.5 border rounded text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Següent →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
