import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";

export default function ReturnedReceiptForm() {
  const navigate = useNavigate();
  const { data: clients } = useApi(() => api.getClients());

  const [form, setForm] = useState({
    clientId: 0,
    invoiceId: 0,
    returnedAmount: "",
    returnDate: new Date().toISOString().slice(0, 10),
    receiptDate: "",
    receiptReference: "",
    returnReason: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data: any = {
      clientId: form.clientId || null,
      invoiceId: form.invoiceId || null,
      returnedAmount: parseFloat(form.returnedAmount) || 0,
      returnDate: form.returnDate,
      receiptDate: form.receiptDate || null,
      receiptReference: form.receiptReference || null,
      returnReason: form.returnReason || null,
      notes: form.notes || null,
    };
    if (!data.clientId) { alert("Selecciona un client"); return; }
    if (!data.returnedAmount) { alert("Introdueix l'import"); return; }

    await api.createReturnedReceipt(data);
    navigate("/receipts");
  };

  const set = (key: string, value: any) => setForm({ ...form, [key]: value });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Nou impagat manual</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 max-w-lg space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Client *</label>
          <select required className="w-full border rounded px-3 py-2" value={form.clientId}
            onChange={(e) => set("clientId", parseInt(e.target.value))}>
            <option value={0}>Selecciona client...</option>
            {clients?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Import retornat *</label>
          <input required type="number" step="0.01" className="w-full border rounded px-3 py-2"
            value={form.returnedAmount} onChange={(e) => set("returnedAmount", e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Data devolució *</label>
          <input required type="date" className="w-full border rounded px-3 py-2"
            value={form.returnDate} onChange={(e) => set("returnDate", e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Data emissió rebut</label>
          <input type="date" className="w-full border rounded px-3 py-2"
            value={form.receiptDate} onChange={(e) => set("receiptDate", e.target.value)} />
          <p className="text-xs text-gray-400 mt-1">Data d'emissió del rebut original (columna Valor del CSV)</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Referència</label>
          <input className="w-full border rounded px-3 py-2" value={form.receiptReference}
            onChange={(e) => set("receiptReference", e.target.value)} placeholder="Núm. rebut, factura..." />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Motiu</label>
          <input className="w-full border rounded px-3 py-2" value={form.returnReason}
            onChange={(e) => set("returnReason", e.target.value)} placeholder="Motiu de la devolució" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Notes</label>
          <textarea className="w-full border rounded px-3 py-2" rows={2} value={form.notes}
            onChange={(e) => set("notes", e.target.value)} />
        </div>
        <div className="flex gap-2 pt-2">
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm">Crear</button>
          <button type="button" onClick={() => navigate("/receipts")}
            className="border px-4 py-2 rounded hover:bg-gray-50 text-sm">Cancel·lar</button>
        </div>
      </form>
    </div>
  );
}
