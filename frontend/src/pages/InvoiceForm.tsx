import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";

export default function InvoiceForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const { data: clients } = useApi(() => api.getClients());

  const [form, setForm] = useState({
    clientId: 0, invoiceNumber: "", date: "", dueDate: "",
    amount: 0, status: "pending", externalRef: "",
  });

  useEffect(() => {
    if (isEdit) {
      api.getInvoice(parseInt(id!)).then((inv) => setForm({
        ...inv,
        date: inv.date.slice(0, 10),
        dueDate: inv.dueDate ? inv.dueDate.slice(0, 10) : "",
      }));
    }
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data: any = { ...form, clientId: Number(form.clientId), amount: Number(form.amount) };
    if (!data.dueDate) delete data.dueDate;
    if (isEdit) {
      await api.updateInvoice(parseInt(id!), data);
    } else {
      await api.createInvoice(data);
    }
    navigate("/invoices");
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{isEdit ? "Editar factura" : "Nova factura"}</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 max-w-lg space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Client *</label>
          <select required className="w-full border rounded px-3 py-2" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: parseInt(e.target.value) })}>
            <option value={0}>Selecciona client...</option>
            {clients?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Número de factura *</label>
          <input required className="w-full border rounded px-3 py-2" value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Data *</label>
            <input required type="date" className="w-full border rounded px-3 py-2" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Venciment</label>
            <input type="date" className="w-full border rounded px-3 py-2" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Import *</label>
          <input required type="number" step="0.01" className="w-full border rounded px-3 py-2" value={form.amount} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Referència externa</label>
          <input className="w-full border rounded px-3 py-2" value={form.externalRef} onChange={(e) => setForm({ ...form, externalRef: e.target.value })} />
        </div>
        <div className="flex gap-2 pt-2">
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm">{isEdit ? "Desar" : "Crear"}</button>
          <button type="button" onClick={() => navigate("/invoices")} className="border px-4 py-2 rounded hover:bg-gray-50 text-sm">Cancel·lar</button>
        </div>
      </form>
    </div>
  );
}
