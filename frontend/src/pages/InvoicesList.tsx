import { Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";

export default function InvoicesList() {
  const { data: invoices, loading, error, reload } = useApi(() => api.getInvoices());

  const handleDelete = async (id: number) => {
    if (!confirm("Segur que vols eliminar aquesta factura?")) return;
    await api.deleteInvoice(id);
    reload();
  };

  if (loading) return <div className="text-gray-500">Carregant...</div>;
  if (error) return <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">Error: {error}</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Factures</h1>
        <Link to="/invoices/new" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm">Nova factura</Link>
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Núm. Factura</th>
              <th className="text-left p-3">Client</th>
              <th className="text-left p-3">Data</th>
              <th className="text-right p-3">Import</th>
              <th className="text-left p-3">Estat</th>
              <th className="text-right p-3">Accions</th>
            </tr>
          </thead>
          <tbody>
            {invoices?.map((inv: any) => (
              <tr key={inv.id} className="border-t">
                <td className="p-3">{inv.invoiceNumber}</td>
                <td className="p-3">{inv.client?.name || "-"}</td>
                <td className="p-3">{new Date(inv.date).toLocaleDateString("ca-ES")}</td>
                <td className="p-3 text-right">{inv.amount.toFixed(2)} €</td>
                <td className="p-3">{inv.status}</td>
                <td className="p-3 text-right space-x-2">
                  <Link to={`/invoices/${inv.id}`} className="text-blue-600 hover:underline">Editar</Link>
                  <button onClick={() => handleDelete(inv.id)} className="text-red-600 hover:underline">Eliminar</button>
                </td>
              </tr>
            ))}
            {invoices?.length === 0 && <tr><td colSpan={6} className="p-3 text-center text-gray-500">Cap factura</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
