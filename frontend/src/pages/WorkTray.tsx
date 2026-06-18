import { useState, useMemo, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { api, formatAmount } from "../lib/api";
import StatusBadge from "../components/StatusBadge";

interface TrayFilter {
  key: string;
  label: string;
  statuses: string[];
  color: string;
  description: string;
}

const TRAY_FILTERS: TrayFilter[] = [
  {
    key: "proof_pending",
    label: "Justificants per revisar",
    statuses: ["PENDENT_REVISIO", "JUSTIFICANT_REBUT"],
    color: "bg-teal-50 border-teal-300",
    description: "Justificants rebuts (WhatsApp o manual), pendents de revisió",
  },
  {
    key: "payment_claimed",
    label: "Pagaments declarats",
    statuses: ["PAGAMENT_DECLARAT"],
    color: "bg-rose-50 border-rose-300",
    description: "Client diu que ha pagat, sense justificant",
  },
  {
    key: "waiting_promise",
    label: "Promeses de pagament",
    statuses: ["ESPERANT_JUSTIFICANT"],
    color: "bg-amber-50 border-amber-300",
    description: "Client ha promès pagar, esperant justificant",
  },
  {
    key: "notified_no_response",
    label: "Notificats sense resposta",
    statuses: ["NOTIFICAT"],
    color: "bg-purple-50 border-purple-300",
    description: "WhatsApp enviat, sense resposta del client",
  },
  {
    key: "whatsapp_error",
    label: "Errors WhatsApp",
    statuses: ["ERROR_WHATSAPP"],
    color: "bg-red-50 border-red-300",
    description: "Error enviant WhatsApp",
  },
  {
    key: "review_needed",
    label: "Requereixen revisió",
    statuses: ["REVISAR"],
    color: "bg-orange-50 border-orange-300",
    description: "Queixes, dubtes, possibles errors de telèfon",
  },
  {
    key: "confirmed",
    label: "Pagaments confirmats",
    statuses: ["PAGAMENT_CONFIRMAT"],
    color: "bg-emerald-50 border-emerald-300",
    description: "Pagament confirmat per conciliació o manualment",
  },
  {
    key: "closed",
    label: "Tancats",
    statuses: ["TANCAT"],
    color: "bg-gray-50 border-gray-300",
    description: "Casos tancats",
  },
  {
    key: "ignored",
    label: "Ignorats",
    statuses: ["IGNORAT"],
    color: "bg-gray-50 border-gray-300",
    description: "Falsos positius o ignorats",
  },
];

// Calcula els dies des d'una data
function daysSince(date: string | null | undefined): number | null {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

// Recomana la següent acció segons l'estat
function recommendedAction(status: string): string {
  const actions: Record<string, string> = {
    PENDENT_REVISIO: "Revisar justificant",
    PAGAMENT_DECLARAT: "Demanar justificant",
    JUSTIFICANT_REBUT: "Revisar possible abonament",
    ESPERANT_JUSTIFICANT: "Verificar promesa de pagament",
    NOTIFICAT: "Esperar resposta o reclamar",
    ERROR_WHATSAPP: "Reenviar WhatsApp o revisar",
    REVISAR: "Revisar cas",
    PAGAMENT_CONFIRMAT: "Tancar cas",
  };
  return actions[status] || "Obrir cas";
}

export default function WorkTray() {
  const [searchParams] = useSearchParams();
  const filterFromUrl = searchParams.get("filter") || "";
  const [activeFilter, setActiveFilter] = useState<string>(
    TRAY_FILTERS.some(f => f.key === filterFromUrl) ? filterFromUrl : "proof_pending"
  );
  useEffect(() => {
    if (filterFromUrl && TRAY_FILTERS.some(f => f.key === filterFromUrl)) {
      setActiveFilter(filterFromUrl);
    }
  }, [filterFromUrl]);
  const { data: receiptsData } = useApi(() => api.getReturnedReceipts({ limit: "200" }));

  const receipts = receiptsData?.data || [];

  const active = TRAY_FILTERS.find((f) => f.key === activeFilter) || TRAY_FILTERS[0];
  const filtered = useMemo(
    () => receipts.filter((r: any) => active.statuses.includes(r.status)),
    [receipts, active]
  );

  const displayFiltered = filtered;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold">Safata de treball</h1>
          <p className="text-sm text-gray-500 mt-1">{active.description}</p>
        </div>
      </div>

      {/* Píndoles de filtre */}
      <div className="flex flex-wrap gap-2 mb-4">
        {TRAY_FILTERS.map((f) => {
          const count = receipts.filter((r: any) => f.statuses.includes(r.status)).length;
          return (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors
                ${activeFilter === f.key
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-200 hover:border-blue-300"
                }`}
            >
              {f.label}
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs
                ${activeFilter === f.key ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600"}`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Resum */}
      <div className="bg-white rounded-lg shadow p-3 mb-4">
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="text-gray-500">
            {active.label}: <span className="font-semibold text-gray-800">{displayFiltered.length}</span>
          </span>
          <span className="text-gray-500">
            Import total:{" "}
            <span className="font-semibold text-gray-800">
              {displayFiltered.reduce((sum: number, r: any) => sum + (parseFloat(r.returnedAmount) || 0), 0).toFixed(2)} €
            </span>
          </span>
        </div>
      </div>

      {/* Taula */}
      <div className={`rounded-lg border ${active.color} bg-white shadow overflow-hidden`}>
        {displayFiltered.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">ID</th>
                <th className="text-left p-3">Client</th>
                <th className="text-left p-3">Període</th>
                <th className="text-left p-3">Import</th>
                <th className="text-left p-3">Data devolució</th>
                <th className="text-left p-3">Dies notificat</th>
                <th className="text-left p-3">Última resposta</th>
                <th className="text-center p-3">Estat</th>
                <th className="text-left p-3">Acció recomanada</th>
                <th className="text-right p-3">Accions</th>
              </tr>
            </thead>
            <tbody>
              {displayFiltered.map((r: any) => {
                const daysNotified = daysSince(r.notifiedAt);
                const lastInbound = r.messages?.filter((m: any) => m.direction === "INBOUND").slice(-1)[0];
                const action = recommendedAction(r.status);
                return (
                  <tr key={r.id} className="border-t hover:bg-gray-50">
                    <td className="p-3">
                      <Link to={`/receipts/${r.id}`} className="text-blue-600 hover:underline font-medium">
                        #{r.id}
                      </Link>
                    </td>
                    <td className="p-3 max-w-[140px]">
                      <span className="font-medium truncate block" title={r.client?.name}>
                        {r.client?.name || <span className="text-orange-500">No assignat</span>}
                      </span>
                    </td>
                    <td className="p-3">{r.servicePeriod || "-"}</td>
                    <td className="p-3 text-right font-semibold">{formatAmount(r.returnedAmount)} €</td>
                    <td className="p-3 text-xs">{r.returnDate ? new Date(r.returnDate).toLocaleDateString("ca-ES") : "-"}</td>
                    <td className="p-3">
                      {daysNotified !== null ? (
                        <span className={`text-xs font-medium ${daysNotified >= 7 ? "text-red-600" : daysNotified >= 3 ? "text-amber-600" : "text-gray-500"}`}>
                          {daysNotified}d
                        </span>
                      ) : "-"}
                    </td>
                    <td className="p-3 text-xs max-w-[120px] truncate" title={lastInbound?.content}>
                      {lastInbound?.content || "-"}
                    </td>
                    <td className="p-3"><StatusBadge status={r.status} /></td>
                    <td className="p-3">
                      <span className="text-xs text-gray-600 bg-gray-100 rounded px-2 py-0.5">
                        {action}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1 whitespace-nowrap">
                      <Link to={`/receipts/${r.id}`} className="text-blue-600 hover:underline text-xs">
                        Obrir
                      </Link>
                      {["DETECTAT", "EMPARELLAT", "REVISAR", "ERROR_WHATSAPP"].includes(r.status) && (
                        <Link to={`/receipts/${r.id}`} className="text-green-600 hover:underline text-xs">
                          WhatsApp
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-gray-400 text-sm">Cap impagat en aquesta categoria</div>
        )}
      </div>
    </div>
  );
}
