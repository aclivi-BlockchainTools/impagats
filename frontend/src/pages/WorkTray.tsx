import { useState, useMemo, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { api, formatAmount, formatReminder } from "../lib/api";
import StatusBadge from "../components/StatusBadge";
import SortHead from "../components/SortHead";

// --- 5 cubells d'acció principals ---
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
    statuses: ["REVISAR"],
    color: "bg-amber-50",
    borderColor: "border-amber-300",
    action: "Completar dades del client",
  },
  {
    key: "proof_review",
    label: "Pendent de revisió",
    statuses: ["PENDENT_REVISIO", "JUSTIFICANT_REBUT"],
    color: "bg-rose-50",
    borderColor: "border-rose-300",
    action: "Validar justificant",
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
  { key: "review_replied", label: "Han contestat", statuses: ["PENDENT_REVISIO", "JUSTIFICANT_REBUT"], customFilter: hasClientReplied },
  { key: "review_no_response", label: "Sense resposta", statuses: ["PENDENT_REVISIO", "JUSTIFICANT_REBUT"], customFilter: (r) => !hasClientReplied(r) },
  { key: "whatsapp_error", label: "Errors WhatsApp", statuses: ["ERROR_WHATSAPP"] },
  {
    key: "review_nowhatsapp", label: "Falta WhatsApp", statuses: ["REVISAR"],
    customFilter: (r) => !r.client?.whatsapp,
  },
  {
    key: "review_noclient", label: "Sense client", statuses: ["REVISAR"],
    customFilter: (r) => !r.client?.name,
  },
  {
    key: "review_other", label: "Altres motius", statuses: ["REVISAR"],
    customFilter: (r) => !!r.client?.whatsapp && !!r.client?.name,
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

function hasClientReplied(r: any): boolean {
  return (r.messages || []).some((m: any) => m.direction === "INBOUND");
}

function reviewReason(r: any): string {
  if (!r.client?.whatsapp) return "Falta WhatsApp";
  if (!r.client?.name) return "Sense client";
  if (r.notes?.includes("Timeout agent")) return "Timeout agent";
  if (r.notes?.includes("Agent error")) return "Error agent";
  return "Revisió pendent";
}

function recommendedAction(status: string, r?: any): string {
  const actions: Record<string, string> = {
    PENDENT_REVISIO: "Revisar justificant",
    PAGAMENT_DECLARAT: "Demanar justificant",
    JUSTIFICANT_REBUT: "Revisar possible abonament",
    ESPERANT_JUSTIFICANT: "Verificar promesa",
    NOTIFICAT: "Fer seguiment",
    ERROR_WHATSAPP: "Reenviar WhatsApp",
    PAGAMENT_CONFIRMAT: "Tancar cas",
  };
  if (status === "REVISAR" && r) return reviewReason(r);
  return actions[status] || "Obrir cas";
}

export default function WorkTray() {
  const [searchParams] = useSearchParams();
  const bucketFromUrl = searchParams.get("bucket") || "";
  const filterFromUrl = searchParams.get("filter") || "";

  const [activeBucket, setActiveBucket] = useState<string>(
    BUCKETS.some(b => b.key === bucketFromUrl) ? bucketFromUrl : "to_notify"
  );
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sortKey, setSortKey] = useState<string>("returnDate");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc");

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  useEffect(() => {
    if (bucketFromUrl && BUCKETS.some(b => b.key === bucketFromUrl)) {
      setActiveBucket(bucketFromUrl);
    }
  }, [bucketFromUrl]);

  useEffect(() => {
    if (filterFromUrl) {
      setShowAdvanced(true);
      setActiveFilters(new Set([filterFromUrl]));
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

  // Si hi ha filtres avançats actius, buscar a TOTS els rebuts (ignorar cubell)
  const selectedFilters = ADVANCED_FILTERS.filter((f) => activeFilters.has(f.key));
  const displayFiltered = selectedFilters.length > 0
    ? receipts.filter((r: any) =>
        selectedFilters.some((f) =>
          f.statuses.includes(r.status) && (f.customFilter ? f.customFilter(r) : true)
        )
      )
    : bucketFiltered;

  // Ordenar resultat filtrat
  const sorted = useMemo(() => {
    return [...displayFiltered].sort((a: any, b: any) => {
      let va: any, vb: any;
      switch (sortKey) {
        case "id": va = a.id; vb = b.id; break;
        case "client": va = (a.client?.name || "").toLowerCase(); vb = (b.client?.name || "").toLowerCase(); break;
        case "servicePeriod": va = a.servicePeriod || ""; vb = b.servicePeriod || ""; break;
        case "amount": va = parseFloat(a.returnedAmount || "0"); vb = parseFloat(b.returnedAmount || "0"); break;
        case "returnDate": va = new Date(a.returnDate).getTime(); vb = new Date(b.returnDate).getTime(); break;
        case "daysNotified": va = daysSince(a.notifiedAt) ?? -1; vb = daysSince(b.notifiedAt) ?? -1; break;
        case "lastResponse": va = a.messages?.filter((m: any) => m.direction === "INBOUND").slice(-1)[0]?.content || ""; vb = b.messages?.filter((m: any) => m.direction === "INBOUND").slice(-1)[0]?.content || ""; break;
        case "status": va = a.status; vb = b.status; break;
        case "action": va = recommendedAction(a.status, a).toLowerCase(); vb = recommendedAction(b.status, b).toLowerCase(); break;
        default: return 0;
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [displayFiltered, sortKey, sortDir]);

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

      {/* 5 cubells d'acció */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {bucketCounts.map((b) => (
          <button
            key={b.key}
            onClick={() => { setActiveBucket(b.key); setActiveFilters(new Set()); }}
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
                onClick={() => {
                  const next = new Set(activeFilters);
                  next.has(f.key) ? next.delete(f.key) : next.add(f.key);
                  setActiveFilters(next);
                }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors
                  ${activeFilters.has(f.key)
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-200 hover:border-blue-300"
                  }`}
              >
                {f.label}
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs
                  ${activeFilters.has(f.key) ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600"}`}
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
            {selectedFilters.length > 0 ? selectedFilters.map(f => f.label).join(" + ") : bucket.label}:{" "}
            <span className="font-semibold text-gray-800">{sorted.length}</span>
          </span>
          <span className="text-gray-500">
            Import total:{" "}
            <span className="font-semibold text-gray-800">
              {sorted.reduce((sum: number, r: any) => sum + (parseFloat(r.returnedAmount) || 0), 0).toFixed(2)} €
            </span>
          </span>
        </div>
      </div>

      {/* Taula */}
      <div className={`rounded-lg border ${bucket.borderColor} bg-white shadow overflow-hidden`}>
        {sorted.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <SortHead col="id" label="ID" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHead col="client" label="Client" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHead col="servicePeriod" label="Període" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHead col="amount" label="Import" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
                <SortHead col="returnDate" label="Data devolució" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHead col="daysNotified" label="Dies notificat" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHead col="lastResponse" label="Última resposta" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHead col="status" label="Estat" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="center" />
                <SortHead col="action" label="Acció recomanada" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <th className="text-right p-3">Accions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r: any) => {
                const daysNotified = daysSince(r.notifiedAt);
                const lastInbound = r.messages?.filter((m: any) => m.direction === "INBOUND").slice(-1)[0];
                const replied = hasClientReplied(r);
                const action = recommendedAction(r.status, r);
                return (
                  <tr key={r.id} className={`border-t hover:bg-gray-50 ${replied ? "border-l-4 border-l-green-400 bg-green-50/60" : ""}`}>
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
                      {formatReminder(r.reminderCount, r.lastReminderAt) && (
                        <div className="text-[10px] text-amber-600 mt-0.5">{formatReminder(r.reminderCount, r.lastReminderAt)}</div>
                      )}
                    </td>
                    <td className="p-3 text-xs max-w-[120px] truncate" title={lastInbound?.content}>
                      {lastInbound?.content ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="text-green-600 font-bold" title="El client ha contestat">↩</span>
                          <span className="truncate">{lastInbound.content}</span>
                        </span>
                      ) : "-"}
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
