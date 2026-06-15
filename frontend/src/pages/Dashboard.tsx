import { Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import StatsCard from "../components/StatsCard";
import WorkTray from "../components/WorkTray";

const ACCENT = {
  red:    "border-l-red-400",
  orange: "border-l-orange-400",
  amber:  "border-l-amber-400",
  blue:   "border-l-blue-400",
  purple: "border-l-purple-400",
  indigo: "border-l-indigo-400",
  rose:   "border-l-rose-400",
  emerald:"border-l-emerald-400",
  green:  "border-l-green-400",
  gray:   "border-l-gray-300",
};

export default function Dashboard() {
  const { data, loading, error } = useApi(() => api.getDashboard());
  const { data: debtors } = useApi(() => api.getDashboardDebtors());
  const { data: receiptsData } = useApi(() => api.getReturnedReceipts({ limit: "100" }));

  if (loading) return <div className="text-gray-500">Carregant...</div>;
  if (error) return <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">Error: {error}</div>;
  if (!data) return <div className="text-gray-500">Sense dades</div>;

  const totalOwed = debtors?.reduce((sum: number, d: any) => sum + d.totalAmount, 0) || 0;
  const debtorCount = debtors?.length || 0;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Targetes de mètriques */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">

        {/* Bloc: Pendents d'acció (taronja/groc) */}
        <StatsCard label="Pendents revisió" value={data.pending}
          subtitle="Requereixen atenció manual"
          icon="🔍" color="bg-orange-50" accent={ACCENT.orange} />
        <StatsCard label="Pagament declarat" value={data.paymentClaimed || 0}
          subtitle="Deutor diu que ha pagat"
          icon="💬" color="bg-rose-50" accent={ACCENT.rose} />

        {/* Bloc: En procés (blau/lila) */}
        <StatsCard label="Notificats" value={data.notified}
          subtitle="WhatsApp enviat"
          icon="📤" color="bg-purple-50" accent={ACCENT.purple} />
        <StatsCard label="Esperant justificant" value={data.waitingProof || 0}
          subtitle="Agent espera resposta"
          icon="⏳" color="bg-indigo-50" accent={ACCENT.indigo} />

        {/* Bloc: Justificants (verd) */}
        <StatsCard label="Justificant rebut" value={data.proofPending}
          subtitle="Pendent de validar"
          icon="📎" color="bg-emerald-50" accent={ACCENT.emerald} />
        <StatsCard label="Tancats / Confirmats" value={data.closed}
          subtitle="Resolts"
          icon="✅" color="bg-green-50" accent={ACCENT.green} />

        {/* Bloc: Problemes (vermell) */}
        <StatsCard label="Error WhatsApp" value={data.whatsappError || 0}
          subtitle="Requereix intervenció"
          icon="⚠️" color="bg-red-50" accent={ACCENT.red} />

        {/* Bloc: Resum financer */}
        <StatsCard label="Import pendent" value={`${totalOwed.toFixed(2)} €`}
          subtitle={`${debtorCount} ${debtorCount === 1 ? "deutor" : "deutors"}`}
          icon="💰" color="bg-blue-50" accent={ACCENT.blue} />
      </div>

      {/* Deutors pendents */}
      <h2 className="text-xl font-bold mb-4">Deutors pendents</h2>
      <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
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
            {debtors?.map((d: any) => {
              const isRepeat = d.periodCount > 1;
              return (
              <tr key={d.clientId || d.clientName} className={`border-t hover:bg-gray-50 ${isRepeat ? "bg-amber-50" : ""}`}>
                <td className={`p-3 font-medium ${isRepeat ? "text-amber-900" : ""}`}>
                  {isRepeat && <span className="mr-1.5 text-amber-500" title="Múltiples períodes">🔁</span>}
                  <Link to={`/receipts?clientId=${d.clientId}`} className="text-blue-700 hover:underline">{d.clientName}</Link>
                </td>
                <td className="p-3 text-center">{d.receiptCount}</td>
                <td className={`p-3 text-center font-semibold ${isRepeat ? "text-amber-700" : ""}`}>{d.periodCount}</td>
                <td className="p-3 text-xs">{d.periods?.join(", ")}</td>
                <td className="p-3">{d.oldestDate ? new Date(d.oldestDate).toLocaleDateString("ca-ES") : "-"}</td>
                <td className="p-3 text-right font-semibold">{d.totalAmount.toFixed(2)} €</td>
              </tr>
              );
            })}
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

      <WorkTray receipts={receiptsData?.data || []} />
    </div>
  );
}
