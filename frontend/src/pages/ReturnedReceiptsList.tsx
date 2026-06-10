import { useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import StatusBadge from "../components/StatusBadge";

export default function ReturnedReceiptsList() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const { data: receipts, loading } = useApi(() => api.getReturnedReceipts(filters));

  if (loading) return <div className="text-gray-500">Carregant...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Impagats</h1>
      <div className="bg-white rounded-lg shadow p-4 mb-4 flex gap-4 flex-wrap">
        <select className="border rounded px-3 py-2 text-sm" value={filters.status || ""}
          onChange={(e) => setFilters(e.target.value ? { ...filters, status: e.target.value } : {})}>
          <option value="">Tots els estats</option>
          <option value="DETECTED">DETECTED</option>
          <option value="MATCHED">MATCHED</option>
          <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
          <option value="NOTIFIED">NOTIFIED</option>
          <option value="PROOF_RECEIVED">PROOF_RECEIVED</option>
          <option value="PAYMENT_CONFIRMED">PAYMENT_CONFIRMED</option>
          <option value="CLOSED">CLOSED</option>
          <option value="IGNORED">IGNORED</option>
        </select>
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Data</th>
              <th className="text-left p-3">Client</th>
              <th className="text-left p-3">Referència</th>
              <th className="text-right p-3">Import</th>
              <th className="text-left p-3">Estat</th>
              <th className="text-right p-3">Accions</th>
            </tr>
          </thead>
          <tbody>
            {receipts?.map((r: any) => (
              <tr key={r.id} className="border-t">
                <td className="p-3">{new Date(r.returnDate).toLocaleDateString("ca-ES")}</td>
                <td className="p-3">{r.client?.name || "-"}</td>
                <td className="p-3">{r.receiptReference || "-"}</td>
                <td className="p-3 text-right">{r.returnedAmount.toFixed(2)} €</td>
                <td className="p-3"><StatusBadge status={r.status} /></td>
                <td className="p-3 text-right">
                  <Link to={`/receipts/${r.id}`} className="text-blue-600 hover:underline">Detall</Link>
                </td>
              </tr>
            ))}
            {receipts?.length === 0 && <tr><td colSpan={6} className="p-3 text-center text-gray-500">Cap impagat</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
