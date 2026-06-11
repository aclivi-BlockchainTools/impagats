import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import StatsCard from "../components/StatsCard";

export default function Dashboard() {
  const { data, loading, error } = useApi(() => api.getDashboard());

  if (loading) return <div className="text-gray-500">Carregant...</div>;
  if (error) return <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">Error: {error}</div>;
  if (!data) return <div className="text-gray-500">Sense dades</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard label="Impagats pendents" value={data.pending} color="bg-yellow-50" />
        <StatsCard label="Import pendent" value={`${data.pendingAmount.toFixed(2)} €`} color="bg-red-50" />
        <StatsCard label="Avisats sense resposta" value={data.notified} color="bg-purple-50" />
        <StatsCard label="Justificants pendents" value={data.proofPending} color="bg-blue-50" />
        <StatsCard label="Tancats" value={data.closed} color="bg-green-50" />
      </div>
    </div>
  );
}
