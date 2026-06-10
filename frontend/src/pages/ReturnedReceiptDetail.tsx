import { useState } from "react";
import { useParams } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import StatusBadge from "../components/StatusBadge";

export default function ReturnedReceiptDetail() {
  const { id } = useParams();
  const { data: receipt, loading, reload } = useApi(() => api.getReturnedReceipt(parseInt(id!)));
  const [sending, setSending] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);

  const handleSendWhatsApp = async () => {
    setSending(true);
    try {
      const result = await api.sendWhatsApp(parseInt(id!));
      if (result.success) reload();
      else alert("Error: " + result.error);
    } catch (err: any) {
      alert(err.message);
    }
    setSending(false);
  };

  const handleUploadProof = async () => {
    if (!proofFile) return;
    try {
      await api.uploadProof(parseInt(id!), proofFile);
      setProofFile(null);
      reload();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    await api.updateReturnedReceipt(parseInt(id!), { status: newStatus });
    reload();
  };

  if (loading) return <div className="text-gray-500">Carregant...</div>;
  if (!receipt) return <div className="text-gray-500">No trobat</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Impagat #{receipt.id}</h1>
        <StatusBadge status={receipt.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6 space-y-3">
          <h2 className="font-semibold text-lg">Informació</h2>
          <div><span className="text-sm text-gray-500">Data devolució:</span> {new Date(receipt.returnDate).toLocaleDateString("ca-ES")}</div>
          <div><span className="text-sm text-gray-500">Import retornat:</span> <strong>{receipt.returnedAmount.toFixed(2)} €</strong></div>
          <div><span className="text-sm text-gray-500">Referència:</span> {receipt.receiptReference || "-"}</div>
          <div><span className="text-sm text-gray-500">Motiu:</span> {receipt.returnReason || "-"}</div>
          <div><span className="text-sm text-gray-500">Client:</span> {receipt.client ? <>{receipt.client.name} ({receipt.client.whatsapp || "sense WhatsApp"})</> : <span className="text-orange-600">No assignat</span>}</div>
          <div><span className="text-sm text-gray-500">Factura:</span> {receipt.invoice ? <>#{receipt.invoice.invoiceNumber} ({receipt.invoice.amount.toFixed(2)} €)</> : <span className="text-orange-600">No assignada</span>}</div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="font-semibold text-lg mb-4">Accions</h2>
            <div className="space-y-3">
              <button onClick={handleSendWhatsApp} disabled={sending || !receipt.client?.whatsapp}
                className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 text-sm">
                {sending ? "Enviant..." : "Enviar WhatsApp"}
              </button>

              <div className="border-t pt-3">
                <label className="text-sm font-medium block mb-1">Pujar justificant</label>
                <input type="file" onChange={(e) => setProofFile(e.target.files?.[0] || null)} className="block mb-2 text-sm" />
                <button onClick={handleUploadProof} disabled={!proofFile}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50">Pujar</button>
              </div>

              <div className="border-t pt-3">
                <label className="text-sm font-medium block mb-1">Canviar estat</label>
                <select className="w-full border rounded px-3 py-2 text-sm" value={receipt.status}
                  onChange={(e) => handleStatusChange(e.target.value)}>
                  <option value="DETECTED">DETECTED</option>
                  <option value="MATCHED">MATCHED</option>
                  <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
                  <option value="NOTIFIED">NOTIFIED</option>
                  <option value="PROOF_RECEIVED">PROOF_RECEIVED</option>
                  <option value="PAYMENT_CONFIRMED">PAYMENT_CONFIRMED</option>
                  <option value="CLOSED">CLOSED</option>
                  <option value="IGNORED">IGNORED</option>
                </select>
              </div>
            </div>
          </div>

          {receipt.proofs?.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="font-semibold text-lg mb-2">Justificants</h2>
              <ul className="text-sm space-y-1">
                {receipt.proofs.map((p: any) => (
                  <li key={p.id} className="flex justify-between">
                    <span>{new Date(p.receivedAt).toLocaleDateString("ca-ES")}</span>
                    <StatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {receipt.messages?.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="font-semibold text-lg mb-2">WhatsApp</h2>
              <ul className="text-sm space-y-2">
                {receipt.messages.map((m: any) => (
                  <li key={m.id} className={`p-2 rounded ${m.direction === "OUTBOUND" ? "bg-green-50" : "bg-blue-50"}`}>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{m.direction === "OUTBOUND" ? "Enviat" : "Rebut"}</span>
                      <span>{new Date(m.sentAt).toLocaleString("ca-ES")}</span>
                    </div>
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
