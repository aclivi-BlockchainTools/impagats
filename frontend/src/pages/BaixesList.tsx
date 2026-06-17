import { useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";

export default function BaixesList() {
  const { data: baixes, loading, error, reload } = useApi(() => api.getBaixes());
  const [selClient, setSelClient] = useState<number>(0);
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [adding, setAdding] = useState(false);
  const { data: clients } = useApi(() => api.getClients());

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selClient) return;
    setAdding(true);
    try {
      await api.createBaixa(selClient, date);
      setSelClient(0);
      reload();
    } catch (err: any) { alert(err.message); }
    setAdding(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Segur que vols eliminar aquesta baixa?")) return;
    await api.deleteBaixa(id);
    reload();
  };

  // Clients que no estan ja de baixa
  const activeClients = (clients || []).filter((c: any) =>
    !(baixes || []).some((b: any) => b.clientId === c.id)
  );

  if (loading) return <div className="text-gray-500">Carregant...</div>;
  if (error) return <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">Error: {error}</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Baixes</h1>

      {/* Formulari afegir */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="font-semibold text-lg mb-3">Donar de baixa</h2>
        <form onSubmit={handleAdd} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Client</label>
            <select
              className="w-full border rounded px-3 py-2 text-sm"
              value={selClient || ""}
              onChange={(e) => setSelClient(parseInt(e.target.value) || 0)}
              required
            >
              <option value="">Selecciona un client...</option>
              {activeClients.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Data baixa</label>
            <input
              type="date"
              className="border rounded px-3 py-2 text-sm"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={adding || !selClient}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 text-sm disabled:opacity-50"
          >
            {adding ? "Afegint..." : "Afegir baixa"}
          </button>
        </form>
      </div>

      {/* Llista */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Client</th>
              <th className="text-left p-3">WhatsApp</th>
              <th className="text-left p-3">Poble</th>
              <th className="text-left p-3">Data baixa</th>
              <th className="text-right p-3">Accions</th>
            </tr>
          </thead>
          <tbody>
            {(baixes || []).map((b: any) => (
              <tr key={b.id} className="border-t hover:bg-gray-50">
                <td className="p-3 font-medium">
                  <Link to={`/clients/${b.client?.id}`} className="text-blue-600 hover:underline">{b.client?.name}</Link>
                </td>
                <td className="p-3">{b.client?.whatsapp || "-"}</td>
                <td className="p-3">{b.client?.poble || "-"}</td>
                <td className="p-3">{new Date(b.date).toLocaleDateString("ca-ES")}</td>
                <td className="p-3 text-right">
                  <button onClick={() => handleDelete(b.id)} className="text-red-600 hover:underline text-sm">Eliminar</button>
                </td>
              </tr>
            ))}
            {(baixes || []).length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-gray-500">Cap baixa registrada</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
