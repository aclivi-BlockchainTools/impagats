import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { api, formatAmount } from "../lib/api";
import StatusBadge from "../components/StatusBadge";

const CAT_MONTHS = ["Gener", "Febrer", "Març", "Abril", "Maig", "Juny",
  "Juliol", "Agost", "Setembre", "Octubre", "Novembre", "Desembre"];

// Matriu mensual: 12 mesos amb colors per estat
function MonthlyMatrix({ receipts }: { receipts: any[] }) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const months = CAT_MONTHS;

  // Agrupar rebuts per mes (YYYY-MM)
  const byMonth: Record<string, { status: string; amount: number }[]> = {};
  for (const r of receipts) {
    if (!r.servicePeriod) continue;
    const parts = r.servicePeriod.trim().split(/\s+/);
    if (parts.length < 2) continue;
    const monthIdx = months.findIndex((m) => m.toLowerCase() === parts[0].toLowerCase());
    const year = parseInt(parts[1]);
    if (monthIdx < 0 || !year) continue;
    const key = `${year}-${String(monthIdx + 1).padStart(2, "0")}`;
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push({ status: r.status, amount: parseFloat(r.returnedAmount) || 0 });
  }

  const getColor = (entries: { status: string; amount: number }[] | undefined) => {
    if (!entries || entries.length === 0) return "bg-gray-100 text-gray-400";
    const statuses = entries.map((e) => e.status);
    if (statuses.some((s) => ["PAGAMENT_CONFIRMAT", "TANCAT"].includes(s))) return "bg-green-100 text-green-700 border-green-300";
    if (statuses.some((s) => ["PENDENT_REVISIO", "JUSTIFICANT_REBUT", "PAGAMENT_DECLARAT"].includes(s))) return "bg-yellow-100 text-yellow-700 border-yellow-300";
    if (statuses.some((s) => ["NOTIFICAT", "ESPERANT_JUSTIFICANT"].includes(s))) return "bg-blue-100 text-blue-700 border-blue-300";
    return "bg-red-100 text-red-700 border-red-300";
  };

  return (
    <div className="grid grid-cols-6 gap-1">
      {months.map((month, idx) => {
        const key1 = `${currentYear}-${String(idx + 1).padStart(2, "0")}`;
        const key2 = `${currentYear - 1}-${String(idx + 1).padStart(2, "0")}`;
        const entries = byMonth[key1] || byMonth[key2];
        const colorClass = getColor(entries);
        const total = entries ? entries.reduce((s, e) => s + e.amount, 0) : 0;
        return (
          <div key={month} className={`rounded border text-center py-1.5 text-xs ${colorClass}`}>
            <div className="font-medium">{month.substring(0, 3)}</div>
            {total > 0 && <div className="text-[10px]">{total.toFixed(0)}€</div>}
          </div>
        );
      })}
    </div>
  );
}

export default function ClientForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [form, setForm] = useState({
    name: "", poble: "", phone: "", whatsapp: "", email: "", externalRef: "", active: true,
  });

  // Carregar dades del client + rebuts + factures quan s'edita
  const { data: receiptsData } = useApi(() =>
    isEdit ? api.getReturnedReceipts({ clientId: id!, limit: "200" }) : Promise.resolve(null)
  );
  const { data: invoicesData } = useApi(() =>
    isEdit ? api.getInvoices(parseInt(id!)) : Promise.resolve(null)
  );

  useEffect(() => {
    if (isEdit) {
      api.getClient(parseInt(id!)).then((c) => setForm({
        name: c.name || "", poble: c.poble || "", phone: c.phone || "",
        whatsapp: c.whatsapp || "", email: c.email || "",
        externalRef: c.externalRef || "", active: c.active ?? true,
      }));
    }
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEdit) {
      await api.updateClient(parseInt(id!), form);
    } else {
      await api.createClient(form);
    }
    navigate("/clients");
  };

  const receipts = receiptsData?.data || [];
  const invoices = invoicesData || [];
  const totalDebt = receipts
    .filter((r: any) => !["TANCAT", "PAGAMENT_CONFIRMAT", "IGNORAT"].includes(r.status))
    .reduce((sum: number, r: any) => sum + (parseFloat(r.returnedAmount) || 0), 0);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{isEdit ? `Client: ${form.name}` : "Nou client"}</h1>

      {/* Formulari */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6 lg:col-span-1 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nom *</label>
              <input required className="w-full border rounded px-3 py-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Poble</label>
              <input className="w-full border rounded px-3 py-2" value={form.poble} onChange={(e) => setForm({ ...form, poble: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">WhatsApp</label>
              <input className="w-full border rounded px-3 py-2" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="34600111222" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input type="email" className="w-full border rounded px-3 py-2" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Referència externa</label>
              <input className="w-full border rounded px-3 py-2" value={form.externalRef} onChange={(e) => setForm({ ...form, externalRef: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="active" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              <label htmlFor="active" className="text-sm">Actiu</label>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm">{isEdit ? "Desar" : "Crear"}</button>
              <button type="button" onClick={() => navigate("/clients")} className="border px-4 py-2 rounded hover:bg-gray-50 text-sm">Cancel·lar</button>
            </div>
          </form>
        </div>

        {/* Resum del client (només en edició) */}
        {isEdit && (
          <div className="lg:col-span-2 space-y-6">
            {/* Targetes resum */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-400">
                <div className="text-xs text-gray-500 uppercase">Deute pendent</div>
                <div className="text-xl font-bold">{totalDebt.toFixed(2)} €</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-400">
                <div className="text-xs text-gray-500 uppercase">Rebutts pendents</div>
                <div className="text-xl font-bold">{receipts.filter((r: any) => !["TANCAT", "PAGAMENT_CONFIRMAT", "IGNORAT"].includes(r.status)).length}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-400">
                <div className="text-xs text-gray-500 uppercase">Factures</div>
                <div className="text-xl font-bold">{invoices.length}</div>
              </div>
              <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-400">
                <div className="text-xs text-gray-500 uppercase">WhatsApp</div>
                <div className="text-xl font-bold">{form.whatsapp ? "Sí" : "No"}</div>
              </div>
            </div>

            {/* Matriu mensual */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="font-semibold text-lg mb-3">Matriu mensual</h2>
              <MonthlyMatrix receipts={receipts} />
              <div className="flex gap-4 mt-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-100 border border-red-300 rounded" /> Pendents</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-100 border border-blue-300 rounded" /> Notificats</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded" /> En revisió</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-100 border border-green-300 rounded" /> Confirmat</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 bg-gray-100 border border-gray-200 rounded" /> Sense dades</span>
              </div>
            </div>

            {/* Llista de rebuts */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b">
                <h2 className="font-semibold text-lg">Rebutts del client</h2>
              </div>
              {receipts.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3">ID</th>
                      <th className="text-left p-3">Període</th>
                      <th className="text-left p-3">Import</th>
                      <th className="text-left p-3">Data devolució</th>
                      <th className="text-left p-3">Factura</th>
                      <th className="text-center p-3">Estat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipts.map((r: any) => (
                      <tr key={r.id} className="border-t hover:bg-gray-50">
                        <td className="p-3">
                          <Link to={`/receipts/${r.id}`} className="text-blue-600 hover:underline font-medium">#{r.id}</Link>
                        </td>
                        <td className="p-3">{r.servicePeriod || "-"}</td>
                        <td className="p-3 font-semibold">{formatAmount(r.returnedAmount)} €</td>
                        <td className="p-3 text-xs">{r.returnDate ? new Date(r.returnDate).toLocaleDateString("ca-ES") : "-"}</td>
                        <td className="p-3 text-xs font-mono">{r.invoice?.invoiceNumber || r.receiptReference || "-"}</td>
                        <td className="p-3"><StatusBadge status={r.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-gray-400 text-sm">Cap rebut per aquest client</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
