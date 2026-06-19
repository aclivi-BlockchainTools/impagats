import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import SortHead from "../components/SortHead";

export default function ClientsList() {
  const { data: clients, loading, error, reload } = useApi(() => api.getClients());
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [sortKey, setSortKey] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("asc");

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const filtered = useMemo(() => {
    if (!clients) return [];
    let list = clients;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = clients.filter((c: any) =>
        c.name.toLowerCase().includes(q) ||
        (c.poble && c.poble.toLowerCase().includes(q)) ||
        (c.whatsapp && c.whatsapp.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
      );
    }
    return [...list].sort((a: any, b: any) => {
      let va: any, vb: any;
      switch (sortKey) {
        case "name": va = a.name.toLowerCase(); vb = b.name.toLowerCase(); break;
        case "poble": va = (a.poble || "").toLowerCase(); vb = (b.poble || "").toLowerCase(); break;
        case "whatsapp": va = a.whatsapp || ""; vb = b.whatsapp || ""; break;
        case "email": va = (a.email || "").toLowerCase(); vb = (b.email || "").toLowerCase(); break;
        case "status":
          va = a.baixa ? 0 : a.active ? 1 : 2;
          vb = b.baixa ? 0 : b.active ? 1 : 2;
          break;
        default: return 0;
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [clients, search, sortKey, sortDir]);

  const toggle = (id: number) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((c: any) => c.id)));
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Segur que vols eliminar aquest client?")) return;
    await api.deleteClient(id);
    reload();
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Segur que vols eliminar ${selected.size} clients?`)) return;
    for (const id of selected) await api.deleteClient(id);
    setSelected(new Set());
    reload();
  };

  if (loading && !clients) return <div className="text-gray-500">Carregant...</div>;
  if (error && !clients) return <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">Error: {error}</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Clients</h1>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <button onClick={handleBulkDelete} className="bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 text-sm">
              Eliminar ({selected.size})
            </button>
          )}
          <Link to="/clients/new" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm">Nou client</Link>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow p-3 mb-4">
        <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Cercar clients..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3 w-8"><input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} /></th>
              <SortHead col="name" label="Nom" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortHead col="poble" label="Poble" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortHead col="whatsapp" label="WhatsApp" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortHead col="email" label="Email" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortHead col="status" label="Estat" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <th className="text-right p-3">Accions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c: any) => (
              <tr key={c.id} className="border-t">
                <td className="p-3"><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} /></td>
                <td className="p-3">{c.name}</td>
                <td className="p-3">{c.poble || "-"}</td>
                <td className="p-3">{c.whatsapp || "-"}</td>
                <td className="p-3">{c.email || "-"}</td>
                <td className="p-3">
                  {c.baixa ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500"/>Baixa
                    </span>
                  ) : (
                    c.active ? "Actiu" : "Inactiu"
                  )}
                </td>
                <td className="p-3 text-right space-x-2">
                  <Link to={`/clients/${c.id}`} className="text-blue-600 hover:underline">Editar</Link>
                  <button onClick={() => handleDelete(c.id)} className="text-red-600 hover:underline">Eliminar</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} className="p-3 text-center text-gray-500">{search ? "Cap coincidència" : "Cap client"}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
