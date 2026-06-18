import { useState, useMemo, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { api, formatAmount } from "../lib/api";
import StatusBadge from "../components/StatusBadge";

// --- 4 cubells d'acció principals ---
interface ActionBucket {
  key: string;
  label: string;
  statuses: string[];
  color: string;
  borderColor: string;
  action: string;
  customFilter?: (r: any) => boolean;
}

const BUCKETS: ActionBucket[] = [
  {
    key: "to_notify",
    label: "Per notificar",
    statuses: ["EMPARELLAT", "DETECTAT", "ERROR_WHATSAPP"],
    color: "bg-blue-50",
    borderColor: "border-blue-300",
    action: "Enviar WhatsApp",
    customFilter: (r) => r.status === "DETECTAT" ? !!r.client?.whatsapp : true,
  },
  {
    key: "waiting",
    label: "Esperant resposta",
    statuses: ["NOTIFICAT", "ESPERANT_JUSTIFICANT", "PAGAMENT_DECLARAT"],
    color: "bg-purple-50",
    borderColor: "border-purple-300",
    action: "Fer seguiment",
  },
  {
    key: "to_review",
    label: "Per revisar",
    statuses: ["REVISAR", "PENDENT_REVISIO", "JUSTIFICANT_REBUT"],
    color: "bg-amber-50",
    borderColor: "border-amber-300",
    action: "Revisar justificant / cas",
  },
  {
    key: "closed",
    label: "Tancat",
    statuses: ["PAGAMENT_CONFIRMAT", "TANCAT", "IGNORAT"],
    color: "bg-gray-50",
    borderColor: "border-gray-300",
    action: "Consultar",
  },
];

// --- Filtres avançats (toggle) ---
interface TrayFilter {
  key: string;
  label: string;
  statuses: string[];
  customFilter?: (r: any) => boolean;
}

const ADVANCED_FILTERS: TrayFilter[] = [
  { key: "proof_pending", label: "Justificants per revisar", statuses: ["PENDENT_REVISIO", "JUSTIFICANT_REBUT"] },
  { key: "payment_claimed", label: "Pagaments declarats", statuses: ["PAGAMENT_DECLARAT"] },
  { key: "waiting_promise", label: "Promeses de pagament", statuses: ["ESPERANT_JUSTIFICANT"] },
  {
    key: "notified_replied", label: "Han contestat", statuses: ["NOTIFICAT"],
    customFilter: (r) => (r.messages || []).some((m: any) => m.direction === "INBOUND"),
  },
  {
    key: "notified_no_response", label: "Sense resposta", statuses: ["NOTIFICAT"],
    customFilter: (r) => !(r.messages || []).some((m: any) => m.direction === "INBOUND"),
  },
  { key: "whatsapp_error", label: "Errors WhatsApp", statuses: ["ERROR_WHATSAPP"] },
  {
    key: "review_nowhatsapp", label: "Sense WhatsApp", statuses: ["REVISAR"],
    customFilter: (r) => !r.client?.whatsapp,
  },
  {
    key: "review_other", label: "Altres revisions", statuses: ["REVISAR"],
    customFilter: (r) => !!r.client?.whatsapp,
  },
  { key: "confirmed", label: "Pagaments confirmats", statuses: ["PAGAMENT_CONFIRMAT"] },
  { key: "closed_sep", label: "Tancats", statuses: ["TANCAT"] },
  { key: "ignored", label: "Ignorats", statuses: ["IGNORAT"] },
];

function daysSince(date: string | null | undefined): number | null {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function recommendedAction(status: string): string {
  const actions: Record<string, string> = {
    PENDENT_REVISIO: "Revisar justificant",
    PAGAMENT_DECLARAT: "Demanar justificant",
    JUSTIFICANT_REBUT: "Revisar possible abonament",
    ESPERANT_JUSTIFICANT: "Verificar promesa",
    NOTIFICAT: "Fer seguiment",
    ERROR_WHATSAPP: "Reenviar WhatsApp",
    REVISAR: "Revisar cas",
    PAGAMENT_CONFIRMAT: "Tancar cas",
  };
  return actions[status] || "Obrir cas";
}

export default function WorkTray() {
  const [searchParams] = useSearchParams();
  const bucketFromUrl = searchParams.get("bucket") || "";
  const filterFromUrl = searchParams.get("filter") || "";

  const [activeBucket, setActiveBucket] = useState<string>(
    BUCKETS.some(b => b.key === bucketFromUrl) ? bucketFromUrl : "to_notify"
  );
  const [activeFilter, setActiveFilter] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (bucketFromUrl && BUCKETS.some(b => b.key === bucketFromUrl)) {
      setActiveBucket(bucketFromUrl);
    }
  }, [bucketFromUrl]);

  useEffect(() => {
    if (filterFromUrl) {
      setShowAdvanced(true);
      setActiveFilter(filterFromUrl);
    }
  }, [filterFromUrl]);

  const { data: receiptsData } = useApi(() => api.getReturnedReceipts({ limit: "200" }));
  const receipts = receiptsData?.data || [];

  const bucket = BUCKETS.find((b) => b.key === activeBucket) || BUCKETS[0];

  const bucketFiltered = useMemo(
    () => receipts
      .filter((r: any) => bucket.statuses.includes(r.status))
      .filter((r: any) => bucket.customFilter ? bucket.customFilter(r) : true),
    [receipts, bucket]
  );

  // Si hi ha filtre avançat actiu, aplicar-lo
  const advanced = ADVANCED_FILTERS.find((f) => f.key === activeFilter);
  const displayFiltered = advanced
    ? bucketFiltered
      .filter((r: any) => advanced.statuses.includes(r.status))
      .filter((r: any) => advanced.customFilter ? advanced.customFilter(r) : true)
    : bucketFiltered;

  const bucketCounts = BUCKETS.map((b) => ({
    ...b,
    count: receipts
      .filter((r: any) => b.statuses.includes(r.status))
      .filter((r: any) => b.customFilter ? b.customFilter(r) : true).length,
  }));

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold">Safata de treball</h1>
          <p className="text-sm text-gray-500 mt-1">{bucket.label}: {bucket.action}</p>
        </div>
      </div>

      {/* 4 cubells d'acció */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {bucketCounts.map((b) => (
          <button
            key={b.key}
            onClick={() => { setActiveBucket(b.key); setActiveFilter(""); }}
            className={`rounded-lg border ${b.borderColor} ${b.color} p-4 text-left transition-all hover:shadow-md
              ${activeBucket === b.key ? "ring-2 ring-blue-400 shadow-md" : ""}`}
          >
            <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">{b.label}</div>
            <div className="text-2xl font-bold mt-1">{b.count}</div>
            <div className="text-xs text-gray-500 mt-1">{b.action}</div>
          </button>
        ))}
      </div>

      {/* Toggle filtres avançats */}
      <div className="mb-4">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          {showAdvanced ? "Amagar filtres avançats" : "Filtres avançats"}
        </button>
      </div>

      {showAdvanced && (
        <div className="flex flex-wrap gap-2 mb-4">
          {ADVANCED_FILTERS.map((f) => {
            const count = receipts
              .filter((r: any) => f.statuses.includes(r.status))
              .filter((r: any) => f.customFilter ? f.customFilter(r) : true).length;
            return (
              <button
                key={f.key}
                onClick={() => setActiveFilter(activeFilter === f.key ? "" : f.key)}
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
      )}

      {/* Resum */}
      <div className="bg-white rounded-lg shadow p-3 mb-4">
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="text-gray-500">
            {advanced ? advanced.label : bucket.label}:{" "}
            <span className="font-semibold text-gray-800">{displayFiltered.length}</span>
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
      <div className={`rounded-lg border ${bucket.borderColor} bg-white shadow overflow-hidden`}>
        {displayFiltered.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">ID</th>
                <th className="text-left p-3">Client</th>
                <th className="text-left p-3">Període</th>
                <th className="text-right p-3">Import</th>
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
                      <span className="text-xs text-gray-600 bg-gray-100 rounded px-2 py-0.5">{action}</span>
                    </td>
                    <td className="p-3 text-right space-x-1 whitespace-nowrap">
                      <Link to={`/receipts/${r.id}`} className="text-blue-600 hover:underline text-xs">Obrir</Link>
                      {["DETECTAT", "EMPARELLAT", "REVISAR", "ERROR_WHATSAPP"].includes(r.status) && (
                        <Link to={`/receipts/${r.id}`} className="text-green-600 hover:underline text-xs">WhatsApp</Link>
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
