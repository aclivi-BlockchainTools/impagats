import { Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";

export default function ClientsList() {
  const { data: clients, loading, error, reload } = useApi(() => api.getClients());

  const handleDelete = async (id: number) => {
    if (!confirm("Segur que vols eliminar aquest client?")) return;
    await api.deleteClient(id);
    reload();
  };

  if (loading) return <div className="text-gray-500">Carregant...</div>;
  if (error) return <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">Error: {error}</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Clients</h1>
        <Link to="/clients/new" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm">Nou client</Link>
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Nom</th>
              <th className="text-left p-3">NIF</th>
              <th className="text-left p-3">WhatsApp</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Estat</th>
              <th className="text-right p-3">Accions</th>
            </tr>
          </thead>
          <tbody>
            {clients?.map((c: any) => (
              <tr key={c.id} className="border-t">
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
            {clients?.length === 0 && <tr><td colSpan={6} className="p-3 text-center text-gray-500">Cap client</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
