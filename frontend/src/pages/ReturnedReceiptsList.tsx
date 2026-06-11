import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import StatusBadge from "../components/StatusBadge";

export default function ReturnedReceiptsList() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [sending, setSending] = useState(false);
  const [sortKey, setSortKey] = useState<string>("returnDate");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");
  const { data: receipts, loading, error, reload } = useApi(() => api.getReturnedReceipts(filters));

  useEffect(() => { reload(); }, [filters]);

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
    // Sort
    return [...list].sort((a: any, b: any) => {
      let va: any, vb: any;
      switch (sortKey) {
        case "returnDate": va = new Date(a.returnDate).getTime(); vb = new Date(b.returnDate).getTime(); break;
        case "client": va = (a.client?.name || "").toLowerCase(); vb = (b.client?.name || "").toLowerCase(); break;
        case "reference": va = a.receiptReference || ""; vb = b.receiptReference || ""; break;
        case "returnReason": va = a.returnReason || ""; vb = b.returnReason || ""; break;
        case "servicePeriod": va = a.servicePeriod || ""; vb = b.servicePeriod || ""; break;
        case "amount": va = a.returnedAmount; vb = b.returnedAmount; break;
        case "status": va = a.status; vb = b.status; break;
        default: return 0;
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [receipts, search, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortHead = ({ col, label }: { col: string; label: string }) => (
    <th className="text-left p-3 cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort(col)}>
      {label} {sortKey === col ? (sortDir === "asc" ? "▲" : "▼") : ""}
    </th>
  );

  const toggle = (id: number) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
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

  // Check if all selected are from the same client
  const selectedReceipts = filtered.filter((r: any) => selected.has(r.id));
  const sameClient = selected.size >= 2 && new Set(selectedReceipts.map((r: any) => r.clientId)).size === 1;
  const canSend = sameClient && selectedReceipts.every((r: any) =>
    ["DETECTAT", "EMPARELLAT", "REVISAR", "NOTIFICAT"].includes(r.status)
  );

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
                  title={!sameClient ? "Tots els impagats han de ser del mateix client" : !canSend ? "Els impagats han d'estar en estat DETECTAT, EMPARELLAT, REVISAR o NOTIFICAT" : ""}
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
      <div className="bg-white rounded-lg shadow p-4 mb-4 flex gap-4 flex-wrap">
        <select className="border rounded px-3 py-2 text-sm" value={filters.status || ""}
          onChange={(e) => setFilters(e.target.value ? { ...filters, status: e.target.value } : {})}>
          <option value="">Tots els estats</option>
          <option value="DETECTAT">DETECTAT</option>
          <option value="EMPARELLAT">EMPARELLAT</option>
          <option value="REVISAR">REVISAR</option>
          <option value="NOTIFICAT">NOTIFICAT</option>
          <option value="JUSTIFICANT_REBUT">JUSTIFICANT REBUT</option>
          <option value="PAGAMENT_CONFIRMAT">PAGAMENT CONFIRMAT</option>
          <option value="TANCAT">TANCAT</option>
          <option value="IGNORAT">IGNORAT</option>
        </select>
        <input className="border rounded px-3 py-2 text-sm flex-1" placeholder="Cercar impagats..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3 w-8"><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} /></th>
              <SortHead col="returnDate" label="Data dev." />
              <SortHead col="client" label="Client" />
              <th className="text-left p-3">Núm. Factura</th>
              <SortHead col="returnReason" label="Motiu" />
              <SortHead col="servicePeriod" label="Període" />
              <th className="text-left p-3">Data emissió</th>
              <SortHead col="amount" label="Import" />
              <SortHead col="status" label="Estat" />
              <th className="text-left p-3">Agent</th>
              <th className="text-right p-3">Accions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r: any) => (
              <tr key={r.id} className="border-t">
                <td className="p-3"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} /></td>
                <td className="p-3">{new Date(r.returnDate).toLocaleDateString("ca-ES")}</td>
                <td className="p-3">{r.client?.name || "-"}</td>
                <td className="p-3">{r.receiptReference || "-"}</td>
                <td className="p-3 text-xs">{r.returnReason || "-"}</td>
                <td className="p-3 text-sm">{r.servicePeriod || "-"}</td>
                <td className="p-3 text-sm">{r.bankMovement?.rawData?.Valor || "-"}</td>
                <td className="p-3 text-right">{r.returnedAmount.toFixed(2)} €</td>
                <td className="p-3"><StatusBadge status={r.status} /></td>
                <td className="p-3">
                  {r.status === "NOTIFICAT" && (
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />
                      <span className="text-green-700 text-xs">actiu</span>
                    </span>
                  )}
                  {r.status === "ESPERANT_DETALLS" && (
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full inline-block" />
                      <span className="text-yellow-700 text-xs">pendent</span>
                    </span>
                  )}
                  {r.status === "JUSTIFICANT_REBUT" && r.notes?.includes("[Agent:") && (
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />
                      <span className="text-green-700 text-xs">respost</span>
                    </span>
                  )}
                  {r.notes?.includes("altres_temes → redirigir") && (
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full inline-block" />
                      <span className="text-red-700 text-xs">tancat</span>
                    </span>
                  )}
                  {!["NOTIFICAT", "ESPERANT_DETALLS", "JUSTIFICANT_REBUT"].includes(r.status) && !r.notes?.includes("[Agent:") && (
                    <span className="text-gray-400 text-xs">-</span>
                  )}
                </td>
                <td className="p-3 text-right space-x-2">
                  <Link to={`/receipts/${r.id}`} className="text-blue-600 hover:underline">Detall</Link>
                  <button onClick={() => handleDelete(r.id)} className="text-red-600 hover:underline">Eliminar</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={11} className="p-3 text-center text-gray-500">{search ? "Cap coincidència" : "Cap impagat"}</td></tr>}
            {receipts && filtered.length > 0 && (
              <tr><td colSpan={11} className="p-3 text-right text-sm text-gray-500">
                Mostrant {filtered.length} de {receipts.total} — Pàg {receipts.page}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
