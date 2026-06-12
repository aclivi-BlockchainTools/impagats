import { useState } from "react";
import StatusBadge from "./StatusBadge";
import { api, formatAmount } from "../lib/api";

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
          <label className="block text-xs text-gray-500">Motiu</label>
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
      <div><span className="text-sm text-gray-500">Data devolució:</span> {new Date(receipt.returnDate).toLocaleDateString("ca-ES")}</div>
      <div><span className="text-sm text-gray-500">Import retornat:</span> <strong>{formatAmount(receipt.returnedAmount)} €</strong></div>
      <div><span className="text-sm text-gray-500">Núm. Factura:</span> {receipt.receiptReference || "-"}</div>
      <div><span className="text-sm text-gray-500">Motiu:</span> {receipt.returnReason || "-"}</div>
      <div><span className="text-sm text-gray-500">Client:</span> {receipt.client ? <>{receipt.client.name} ({receipt.client.whatsapp || "sense WhatsApp"})</> : <span className="text-orange-600">No assignat</span>}</div>
      <div><span className="text-sm text-gray-500">Factura:</span> {receipt.invoice ? <>#{receipt.invoice.invoiceNumber} ({formatAmount(receipt.invoice.amount)} €)</> : <span className="text-orange-600">No assignada</span>}</div>
      {receipt.servicePeriod && <div><span className="text-sm text-gray-500">Període:</span> <span className="font-medium">{receipt.servicePeriod}</span></div>}
      {receipt.notes && <div><span className="text-sm text-gray-500">Notes:</span> <span className="text-blue-700 font-medium">{receipt.notes}</span></div>}
      {receipt.bankMovement?.rawData?.Valor && (
        <div><span className="text-sm text-gray-500">Data emissió rebut:</span> {receipt.bankMovement.rawData.Valor}</div>
      )}
    </div>
  );
}
