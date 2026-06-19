import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { api, formatAmount } from "../lib/api";
import SortHead from "../components/SortHead";

export default function InvoicesList() {
  const { data: invoices, loading, error, reload } = useApi(() => api.getInvoices());
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [sortKey, setSortKey] = useState<string>("date");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const filtered = useMemo(() => {
    if (!invoices) return [];
    let list = invoices;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = invoices.filter((inv: any) =>
        inv.invoiceNumber.toLowerCase().includes(q) ||
        (inv.client?.name && inv.client.name.toLowerCase().includes(q))
      );
    }
    return [...list].sort((a: any, b: any) => {
      let va: any, vb: any;
      switch (sortKey) {
        case "invoiceNumber": va = a.invoiceNumber.toLowerCase(); vb = b.invoiceNumber.toLowerCase(); break;
        case "client": va = (a.client?.name || "").toLowerCase(); vb = (b.client?.name || "").toLowerCase(); break;
        case "date": va = new Date(a.date).getTime(); vb = new Date(b.date).getTime(); break;
        case "amount": va = parseFloat(a.amount || "0"); vb = parseFloat(b.amount || "0"); break;
        case "status": va = a.status; vb = b.status; break;
        default: return 0;
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [invoices, search, sortKey, sortDir]);

  const toggle = (id: number) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((inv: any) => inv.id)));
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Segur que vols eliminar aquesta factura?")) return;
    await api.deleteInvoice(id);
    reload();
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Segur que vols eliminar ${selected.size} factures?`)) return;
    for (const id of selected) await api.deleteInvoice(id);
    setSelected(new Set());
    reload();
  };

  if (loading && !invoices) return <div className="text-gray-500">Carregant...</div>;
  if (error && !invoices) return <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">Error: {error}</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Factures</h1>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <button onClick={handleBulkDelete} className="bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 text-sm">
              Eliminar ({selected.size})
            </button>
          )}
          <Link to="/invoices/new" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm">Nova factura</Link>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow p-3 mb-4">
        <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Cercar factures..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3 w-8"><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} /></th>
              <SortHead col="invoiceNumber" label="Núm. Factura" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortHead col="client" label="Client" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortHead col="date" label="Data" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortHead col="amount" label="Import" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
              <SortHead col="status" label="Estat" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <th className="text-right p-3">Accions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((inv: any) => (
              <tr key={inv.id} className="border-t">
                <td className="p-3"><input type="checkbox" checked={selected.has(inv.id)} onChange={() => toggle(inv.id)} /></td>
                <td className="p-3">{inv.invoiceNumber}</td>
                <td className="p-3">{inv.client?.name || "-"}</td>
                <td className="p-3">{new Date(inv.date).toLocaleDateString("ca-ES")}</td>
                <td className="p-3 text-right">{formatAmount(inv.amount)} €</td>
                <td className="p-3">{inv.status}</td>
                <td className="p-3 text-right space-x-2">
                  <Link to={`/invoices/${inv.id}`} className="text-blue-600 hover:underline">Editar</Link>
                  <button onClick={() => handleDelete(inv.id)} className="text-red-600 hover:underline">Eliminar</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} className="p-3 text-center text-gray-500">{search ? "Cap coincidència" : "Cap factura"}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
