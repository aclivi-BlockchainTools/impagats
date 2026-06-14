import { useState } from "react";
import { Link } from "react-router-dom";
import StatusBadge from "./StatusBadge";
import { formatAmount } from "../lib/api";

const TRAY_FILTERS: { key: string; label: string; statuses: string[]; color: string }[] = [
  { key: "review", label: "Requereix revisió", statuses: ["REVISAR"], color: "bg-orange-50 border-orange-300" },
  { key: "proof", label: "Justificant rebut", statuses: ["JUSTIFICANT_REBUT"], color: "bg-green-50 border-green-300" },
  { key: "pending_review", label: "Pendent revisar", statuses: ["PENDENT_REVISIO"], color: "bg-teal-50 border-teal-300" },
  { key: "whatsapp_error", label: "WhatsApp fallit", statuses: ["ERROR_WHATSAPP"], color: "bg-red-50 border-red-300" },
  { key: "waiting", label: "Esperant justificant", statuses: ["ESPERANT_JUSTIFICANT"], color: "bg-amber-50 border-amber-300" },
  { key: "claimed", label: "Pagament declarat", statuses: ["PAGAMENT_DECLARAT"], color: "bg-rose-50 border-rose-300" },
  { key: "confirmed", label: "Pagament confirmat", statuses: ["PAGAMENT_CONFIRMAT"], color: "bg-emerald-50 border-emerald-300" },
  { key: "closed", label: "Tancats", statuses: ["TANCAT"], color: "bg-gray-50 border-gray-300" },
];

interface Props {
  receipts: any[];
}

export default function WorkTray({ receipts }: Props) {
  const [activeFilter, setActiveFilter] = useState<string>("review");

  const active = TRAY_FILTERS.find((f) => f.key === activeFilter) || TRAY_FILTERS[0];
  const filtered = receipts.filter((r: any) => active.statuses.includes(r.status));

  return (
    <div className="mt-6">
      <h2 className="text-xl font-bold mb-4">Safata de treball</h2>

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

      <div className={`rounded-lg border ${active.color} bg-white shadow overflow-hidden`}>
        {filtered.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">ID</th>
                <th className="text-left p-3">Client</th>
                <th className="text-left p-3">Factura</th>
                <th className="text-left p-3">Període</th>
                <th className="text-left p-3">Import</th>
                <th className="text-left p-3">Data</th>
                <th className="text-left p-3">Motiu</th>
                <th className="text-center p-3">Estat</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r: any) => (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="p-3">
                    <Link to={`/receipts/${r.id}`} className="text-blue-600 hover:underline font-medium">
                      #{r.id}
                    </Link>
                  </td>
                  <td className="p-3">{r.client?.name || "-"}</td>
                  <td className="p-3">{r.invoice?.invoiceNumber || r.receiptReference || "-"}</td>
                  <td className="p-3">{r.servicePeriod || "-"}</td>
                  <td className="p-3 text-right">{formatAmount(r.returnedAmount)} €</td>
                  <td className="p-3 text-xs">{r.returnDate ? new Date(r.returnDate).toLocaleDateString("ca-ES") : "-"}</td>
                  <td className="p-3 text-xs max-w-[200px] truncate" title={r.returnReason}>{r.returnReason || "-"}</td>
                  <td className="p-3"><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-gray-400 text-sm">Cap impagat en aquesta categoria</div>
        )}
      </div>
    </div>
  );
}
