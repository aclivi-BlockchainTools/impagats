import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";

export default function ClientsList() {
  const { data: clients, loading, error, reload } = useApi(() => api.getClients());
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const filtered = useMemo(() => {
    if (!clients) return [];
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter((c: any) =>
      c.name.toLowerCase().includes(q) ||
      (c.nif && c.nif.toLowerCase().includes(q)) ||
      (c.whatsapp && c.whatsapp.includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  }, [clients, search]);

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

  if (loading) return <div className="text-gray-500">Carregant...</div>;
  if (error) return <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">Error: {error}</div>;

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
              <th className="text-left p-3">Nom</th>
              <th className="text-left p-3">NIF</th>
              <th className="text-left p-3">WhatsApp</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Estat</th>
              <th className="text-right p-3">Accions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c: any) => (
              <tr key={c.id} className="border-t">
                <td className="p-3"><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} /></td>
                <td className="p-3">{c.name}</td>
                <td className="p-3">{c.nif || "-"}</td>
                <td className="p-3">{c.whatsapp || "-"}</td>
                <td className="p-3">{c.email || "-"}</td>
                <td className="p-3">{c.active ? "Actiu" : "Inactiu"}</td>
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
