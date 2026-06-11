import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import StatusBadge from "../components/StatusBadge";

export default function ReturnedReceiptsList() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const { data: receipts, loading, error, reload } = useApi(() => api.getReturnedReceipts(filters));

  useEffect(() => { reload(); }, [filters]);

  if (loading) return <div className="text-gray-500">Carregant...</div>;
  if (error) return <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">Error: {error}</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Impagats</h1>
        <Link to="/receipts/new" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm">Nou impagat</Link>
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
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Data</th>
              <th className="text-left p-3">Client</th>
              <th className="text-left p-3">Referència</th>
              <th className="text-left p-3">Notes</th>
              <th className="text-left p-3">Data emissió</th>
              <th className="text-right p-3">Import</th>
              <th className="text-left p-3">Estat</th>
              <th className="text-right p-3">Accions</th>
            </tr>
          </thead>
          <tbody>
            {receipts?.data?.map((r: any) => (
              <tr key={r.id} className="border-t">
                <td className="p-3">{new Date(r.returnDate).toLocaleDateString("ca-ES")}</td>
                <td className="p-3">{r.client?.name || "-"}</td>
                <td className="p-3">{r.receiptReference || "-"}</td>
                <td className="p-3 text-sm">{r.notes || "-"}</td>
                <td className="p-3 text-sm">{r.bankMovement?.rawData?.Valor || "-"}</td>
                <td className="p-3 text-right">{r.returnedAmount.toFixed(2)} €</td>
                <td className="p-3"><StatusBadge status={r.status} /></td>
                <td className="p-3 text-right">
                  <Link to={`/receipts/${r.id}`} className="text-blue-600 hover:underline">Detall</Link>
                </td>
              </tr>
            ))}
            {(!receipts?.data || receipts.data.length === 0) && <tr><td colSpan={8} className="p-3 text-center text-gray-500">Cap impagat</td></tr>}
            {receipts && (
              <tr><td colSpan={8} className="p-3 text-right text-sm text-gray-500">
                Mostrant {receipts.data?.length || 0} de {receipts.total} — Pàg {receipts.page}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
