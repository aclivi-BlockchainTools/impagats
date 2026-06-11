import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";

export default function ClientForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [form, setForm] = useState({
    name: "", nif: "", phone: "", whatsapp: "", email: "", externalRef: "", active: true,
  });

  useEffect(() => {
    if (isEdit) {
      api.getClient(parseInt(id!)).then(setForm);
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

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{isEdit ? "Editar client" : "Nou client"}</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 max-w-lg space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nom *</label>
          <input required className="w-full border rounded px-3 py-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">NIF/CIF</label>
          <input className="w-full border rounded px-3 py-2" value={form.nif} onChange={(e) => setForm({ ...form, nif: e.target.value })} />
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
  );
}
