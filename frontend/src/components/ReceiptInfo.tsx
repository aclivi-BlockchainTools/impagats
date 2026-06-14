import { useState } from "react";
import StatusBadge from "./StatusBadge";
import { api, formatAmount } from "../lib/api";

// Traducció de motius bancaris
function translateReturnReason(reason: string | null | undefined): string {
  if (!reason) return "-";
  const upper = reason.toUpperCase().trim();
  const translations: Record<string, string> = {
    "FALTA DE FONDOS": "Falta de fons",
    "FALTA DE FONS": "Falta de fons",
    "COMPTE BLOQUEJAT": "Compte bloquejat",
    "COMPTE CANCELAT": "Compte cancel·lat",
    "OPER NO AUTO/MAND": "Operació no autoritzada / mandat",
    "CUENTA CANCELADA": "Compte cancel·lat",
    "CUENTA BLOQUEADA": "Compte bloquejat",
  };
  if (translations[upper]) return translations[upper];
  for (const [key, val] of Object.entries(translations)) {
    if (upper.includes(key)) return val;
  }
  return reason;
}

interface Props {
  receipt: any;
  clients?: any[];
  invoices?: any[];
  onReload: () => void;
}

export default function ReceiptInfo({ receipt, clients, invoices, onReload }: Props) {
  const [edit, setEdit] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setEditData({
      receiptReference: receipt.receiptReference || "",
      notes: receipt.notes || "",
      servicePeriod: receipt.servicePeriod || "",
      returnReason: receipt.returnReason || "",
      clientId: receipt.clientId || "",
      invoiceId: receipt.invoiceId || "",
    });
    setEdit(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateReturnedReceipt(receipt.id, editData);
      setEdit(false);
      onReload();
    } catch (err: any) { alert(err.message); }
    setSaving(false);
  };

  const set = (key: string, value: any) => setEditData({ ...editData, [key]: value });

  const reasonDisplay = translateReturnReason(receipt.returnReason);
  const reasonIsTranslated = reasonDisplay !== (receipt.returnReason || "-");

  if (edit) {
    return (
      <div className="bg-white rounded-lg shadow p-6 space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-lg">Informació</h2>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Desant..." : "Desar"}
            </button>
            <button onClick={() => setEdit(false)} className="border px-3 py-1 rounded text-sm hover:bg-gray-50">Cancel·lar</button>
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500">Client</label>
          <select className="w-full border rounded px-2 py-1 text-sm" value={editData.clientId || ""} onChange={(e) => set("clientId", e.target.value ? parseInt(e.target.value) : null)}>
            <option value="">Cap</option>
            {(clients || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500">Factura</label>
          <select className="w-full border rounded px-2 py-1 text-sm" value={editData.invoiceId || ""} onChange={(e) => set("invoiceId", e.target.value ? parseInt(e.target.value) : null)}>
            <option value="">Cap</option>
            {(invoices || []).map((inv: any) => <option key={inv.id} value={inv.id}>#{inv.invoiceNumber} ({formatAmount(inv.amount)}€)</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500">Núm. Factura / Referència</label>
          <input className="w-full border rounded px-2 py-1 text-sm" value={editData.receiptReference} onChange={(e) => set("receiptReference", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500">Període servei</label>
          <input className="w-full border rounded px-2 py-1 text-sm" value={editData.servicePeriod} onChange={(e) => set("servicePeriod", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500">Motiu devolució</label>
          <input className="w-full border rounded px-2 py-1 text-sm" value={editData.returnReason} onChange={(e) => set("returnReason", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500">Notes</label>
          <textarea className="w-full border rounded px-2 py-1 text-sm" rows={2} value={editData.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-3">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-lg">Informació</h2>
        <button onClick={startEdit} className="text-blue-600 hover:underline text-sm">Editar</button>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <div>
          <span className="text-xs text-gray-500">Data devolució</span>
          <div className="text-sm font-medium">{new Date(receipt.returnDate).toLocaleDateString("ca-ES")}</div>
        </div>
        <div>
          <span className="text-xs text-gray-500">Import retornat</span>
          <div className="text-sm font-bold">{formatAmount(receipt.returnedAmount)} €</div>
        </div>
        <div>
          <span className="text-xs text-gray-500">Client</span>
          <div className="text-sm">
            {receipt.client ? receipt.client.name : <span className="text-orange-600">No assignat</span>}
          </div>
        </div>
        <div>
          <span className="text-xs text-gray-500">WhatsApp client</span>
          <div className="text-sm">{receipt.client?.whatsapp || <span className="text-gray-400">—</span>}</div>
        </div>
        <div>
          <span className="text-xs text-gray-500">Factura</span>
          <div className="text-sm">
            {receipt.invoice ? <>#{receipt.invoice.invoiceNumber} ({formatAmount(receipt.invoice.amount)} €)</> : <span className="text-orange-600">No assignada</span>}
          </div>
        </div>
        <div>
          <span className="text-xs text-gray-500">Referència</span>
          <div className="text-sm font-mono">{receipt.receiptReference || "-"}</div>
        </div>
        {receipt.servicePeriod && (
          <div>
            <span className="text-xs text-gray-500">Període</span>
            <div className="text-sm font-medium">{receipt.servicePeriod}</div>
          </div>
        )}
        {receipt.bankMovement?.rawData?.Valor && (
          <div>
            <span className="text-xs text-gray-500">Data emissió rebut</span>
            <div className="text-sm">{receipt.bankMovement.rawData.Valor}</div>
          </div>
        )}
      </div>

      {/* Motiu devolució */}
      <div className="border-t pt-3">
        <span className="text-xs text-gray-500">Motiu devolució</span>
        <div className="text-sm font-medium mt-0.5">{reasonDisplay}</div>
        {reasonIsTranslated && (
          <div className="text-xs text-gray-400 mt-0.5" title="Text original">Original: {receipt.returnReason}</div>
        )}
      </div>

      {receipt.notes && (
        <div className="border-t pt-3">
          <span className="text-xs text-gray-500">Notes</span>
          <div className="text-sm text-blue-700 font-medium mt-0.5">{receipt.notes}</div>
        </div>
      )}

      {/* Dades crues bancàries */}
      {receipt.bankMovement?.rawData && (
        <details className="border-t pt-3">
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">Dades bancàries originals</summary>
          <div className="mt-2 text-xs text-gray-500 space-y-1 max-h-40 overflow-y-auto">
            {Object.entries(receipt.bankMovement.rawData).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <span className="font-medium text-gray-600">{k}:</span>
                <span className="truncate">{String(v)}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
