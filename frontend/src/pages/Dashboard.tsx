import { Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import StatsCard from "../components/StatsCard";

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

type TrayAction = {
  key: string;
  label: string;
  count: number;
  icon: string;
  color: string;
  border: string;
};

export default function Dashboard() {
  const { data, loading, error } = useApi(() => api.getDashboard());
  const { data: debtors } = useApi(() => api.getDashboardDebtors());

  if (loading) return <div className="text-gray-500">Carregant...</div>;
  if (error) return <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">Error: {error}</div>;
  if (!data) return <div className="text-gray-500">Sense dades</div>;

  const totalOwed = debtors?.reduce((sum: number, d: any) => sum + d.totalAmount, 0) || 0;
  const debtorCount = debtors?.length || 0;

  const toNotify = (data.countEmparellat || 0) + (data.countWhatsappError || 0);
  const waiting = (data.notified || 0) + (data.waitingProof || 0) + (data.countPagamentDeclarat || 0);
  const toReview = data.countRevisar || 0;
  const proofReview = (data.countPendentRevisio || 0) + (data.countJustificantRebut || 0);

  const trayActions: TrayAction[] = [
    { key: "to_notify", label: "Per notificar", count: toNotify, icon: "📤", color: "text-blue-700", border: "border-blue-400" },
    { key: "waiting", label: "Esperant resposta", count: waiting, icon: "⏳", color: "text-purple-700", border: "border-purple-400" },
    { key: "to_review", label: "Per revisar", count: toReview, icon: "⚠️", color: "text-amber-700", border: "border-amber-400" },
    { key: "proof_review", label: "Pendent de revisió", count: proofReview, icon: "🔎", color: "text-rose-700", border: "border-rose-400" },
  ].filter(a => a.count > 0);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Targetes de mètriques */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard label="Per processar" value={(data.countDETECTAT || 0) + (data.countEmparellat || 0)}
          subtitle="Detectats pendents de notificar"
          icon="📋" color="bg-blue-50" accent={ACCENT.blue} to="/work-tray?bucket=to_notify" />
        <StatsCard label="Revisar" value={data.countRevisar || 0}
          subtitle="Requereixen atenció manual"
          icon="⚠️" color="bg-orange-50" accent={ACCENT.orange} to="/work-tray?bucket=to_review" />
        <StatsCard label="Pendent de revisió" value={data.countPendentRevisio || 0}
          subtitle="Justificants per validar"
          icon="🔎" color="bg-rose-50" accent={ACCENT.rose} to="/work-tray?bucket=proof_review" />
        <StatsCard label="Pagament declarat" value={data.paymentClaimed || 0}
          subtitle="Deutor diu que ha pagat"
          icon="💬" color="bg-rose-50" accent={ACCENT.rose} to="/work-tray?bucket=waiting&filter=payment_claimed" />
        <StatsCard label="Notificats" value={data.notified}
          subtitle="WhatsApp enviat"
          icon="📤" color="bg-purple-50" accent={ACCENT.purple} to="/work-tray?bucket=waiting" />
        <StatsCard label="Esperant justificant" value={data.waitingProof || 0}
          subtitle="Agent espera resposta"
          icon="⏳" color="bg-indigo-50" accent={ACCENT.indigo} to="/work-tray?bucket=waiting&filter=waiting_promise" />
        <StatsCard label="Justificant rebut" value={data.proofPending}
          subtitle="Pendent de validar"
          icon="📎" color="bg-emerald-50" accent={ACCENT.emerald} to="/work-tray?bucket=proof_review" />
        <StatsCard label="Tancats / Confirmats" value={data.closed}
          subtitle="Resolts"
          icon="✅" color="bg-green-50" accent={ACCENT.green} to="/work-tray?bucket=closed" />
        <StatsCard label="Error WhatsApp" value={data.whatsappError || 0}
          subtitle="Requereix intervenció"
          icon="⚠️" color="bg-red-50" accent={ACCENT.red} to="/work-tray?bucket=to_notify&filter=whatsapp_error" />
        <StatsCard label="Import pendent" value={`${totalOwed.toFixed(2)} €`}
          subtitle={`${debtorCount} ${debtorCount === 1 ? "deutor" : "deutors"}`}
          icon="💰" color="bg-blue-50" accent={ACCENT.blue} />
      </div>

      {/* Què cal fer ara? — accions prioritàries */}
      {trayActions.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Què cal fer ara?</h2>
            <Link to="/work-tray" className="text-sm text-blue-600 hover:underline font-medium">
              Obrir safata completa →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {trayActions.map((action) => (
              <Link
                key={action.key}
                to={`/work-tray?bucket=${action.key}`}
                className={`bg-white rounded-lg shadow-sm border-l-4 ${action.border} p-4 hover:shadow-md transition-shadow`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{action.icon}</span>
                  <div>
                    <div className={`text-2xl font-bold ${action.color}`}>{action.count}</div>
                    <div className="text-sm text-gray-600">{action.label}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Deutors pendents */}
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
    </div>
  );
}
