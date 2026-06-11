import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import { Link } from "react-router-dom";
import StatsCard from "../components/StatsCard";

export default function Dashboard() {
  const { data, loading, error } = useApi(() => api.getDashboard());
  const { data: debtors } = useApi(() => api.getDashboardDebtors());

  if (loading) return <div className="text-gray-500">Carregant...</div>;
  if (error) return <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">Error: {error}</div>;
  if (!data) return <div className="text-gray-500">Sense dades</div>;

  const totalOwed = debtors?.reduce((sum: number, d: any) => sum + d.totalAmount, 0) || 0;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatsCard label="Impagats pendents" value={data.pending} color="bg-yellow-50" />
        <StatsCard label="Import pendent" value={`${totalOwed.toFixed(2)} €`} color="bg-red-50" />
        <StatsCard label="Avisats sense resposta" value={data.notified} color="bg-purple-50" />
        <StatsCard label="Justificants pendents" value={data.proofPending} color="bg-blue-50" />
        <StatsCard label="Tancats" value={data.closed} color="bg-green-50" />
      </div>

      <h2 className="text-xl font-bold mb-4">Deutors pendents</h2>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Client</th>
              <th className="text-center p-3">Rebuts</th>
              <th className="text-center p-3">Períodes</th>
              <th className="text-left p-3">Períodes deute</th>
              <th className="text-left p-3">Més antic</th>
              <th className="text-right p-3">Total deute</th>
            </tr>
          </thead>
          <tbody>
            {debtors?.map((d: any) => (
              <tr key={d.clientId || d.clientName} className="border-t hover:bg-gray-50">
                <td className="p-3 font-medium">{d.clientName}</td>
                <td className="p-3 text-center">{d.receiptCount}</td>
                <td className="p-3 text-center">{d.periodCount}</td>
                <td className="p-3 text-xs">{d.periods?.join(", ")}</td>
                <td className="p-3">{d.oldestDate ? new Date(d.oldestDate).toLocaleDateString("ca-ES") : "-"}</td>
                <td className="p-3 text-right font-semibold">{d.totalAmount.toFixed(2)} €</td>
              </tr>
            ))}
            {(!debtors || debtors.length === 0) && (
              <tr><td colSpan={6} className="p-3 text-center text-gray-500">Cap deutor pendent</td></tr>
            )}
            {debtors && debtors.length > 0 && (
              <tr className="bg-gray-50 font-semibold">
                <td className="p-3" colSpan={5}>Total</td>
                <td className="p-3 text-right">{totalOwed.toFixed(2)} €</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
