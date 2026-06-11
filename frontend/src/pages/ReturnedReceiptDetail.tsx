import { useState } from "react";
import { useParams } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import StatusBadge from "../components/StatusBadge";

function AgentIndicator({ message }: { message: any }) {
  if (!message.agentIntent) return null;
  return (
    <div className="mt-1 text-xs flex items-center gap-2">
      <span className="text-purple-600 font-medium">Agent</span>
      <span className="text-gray-400">intent:</span>
      <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-mono">{message.agentIntent}</span>
      <span className="text-gray-400">→</span>
      <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-mono">{message.agentAction}</span>
      {message.needsReview && <span className="bg-red-100 text-red-600 px-1.5 py-0.5 rounded text-xs">Revisar</span>}
    </div>
  );
}

export default function ReturnedReceiptDetail() {
  const { id } = useParams();
  const { data: receipt, loading, error, reload } = useApi(() => api.getReturnedReceipt(parseInt(id!)));
  const [sending, setSending] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);

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

  const handleSendManualReply = async () => {
    if (!replyText.trim()) return;
    setReplying(true);
    try {
      await api.sendManualReply(parseInt(id!), replyText.trim());
      setReplyText("");
      reload();
    } catch (err: any) {
      alert(err.message);
    }
    setReplying(false);
  };

  if (loading) return <div className="text-gray-500">Carregant...</div>;
  if (error) return <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">Error: {error}</div>;
  if (!receipt) return <div className="text-gray-500">No trobat</div>;

  const isAgentActive = receipt.status === "NOTIFICAT" || receipt.status === "ESPERANT_DETALLS";

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
          {receipt.servicePeriod && <div><span className="text-sm text-gray-500">Període:</span> <span className="font-medium">{receipt.servicePeriod}</span></div>}
          {receipt.notes && <div><span className="text-sm text-gray-500">Notes:</span> <span className="text-blue-700 font-medium">{receipt.notes}</span></div>}
          {receipt.bankMovement?.rawData?.Valor && (
            <div><span className="text-sm text-gray-500">Data emissió rebut:</span> {receipt.bankMovement.rawData.Valor}</div>
          )}
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
                  <option value="DETECTAT">DETECTAT</option>
                  <option value="EMPARELLAT">EMPARELLAT</option>
                  <option value="REVISAR">REVISAR</option>
                  <option value="NOTIFICAT">NOTIFICAT</option>
                  <option value="JUSTIFICANT_REBUT">JUSTIFICANT REBUT</option>
                  <option value="PAGAMENT_CONFIRMAT">PAGAMENT CONFIRMAT</option>
                  <option value="TANCAT">TANCAT</option>
                  <option value="IGNORAT">IGNORAT</option>
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

          {/* Agent status banner */}
          {isAgentActive && (
            <div className="bg-green-50 border border-green-300 rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full inline-block" />
                <span className="text-green-700 text-sm font-medium">Agent actiu — Esperant resposta del deutor</span>
              </div>
            </div>
          )}

          {/* Manual reply box */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-semibold mb-2">Resposta manual</h3>
            <textarea
              className="w-full border rounded px-3 py-2 text-sm resize-y"
              rows={3}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Escriu una resposta manual..."
            />
            <button
              onClick={handleSendManualReply}
              disabled={replying || !replyText.trim() || !receipt.client?.whatsapp}
              className="mt-2 bg-indigo-600 text-white px-3 py-1.5 rounded text-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {replying ? "Enviant..." : "Enviar resposta manual"}
            </button>
          </div>

          {/* Conversation thread */}
          {receipt.messages?.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="font-semibold text-lg mb-3">Conversa WhatsApp</h2>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {[...receipt.messages].reverse().map((m: any) => (
                  <div key={m.id} className={`rounded-lg p-3 text-sm ${
                    m.direction === "OUTBOUND"
                      ? m.agentIntent ? "bg-purple-50 border border-purple-200" : "bg-green-50 border border-green-200"
                      : "bg-blue-50 border border-blue-200"
                  }`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium">
                        {m.direction === "OUTBOUND"
                          ? m.agentIntent ? "🤖 Agent (auto)" : "📤 Enviat"
                          : "📥 Rebut"}
                      </span>
                      <span className="text-xs text-gray-500">{new Date(m.sentAt).toLocaleString("ca-ES")}</span>
                    </div>
                    <div className="whitespace-pre-wrap text-sm">{m.content}</div>
                    <AgentIndicator message={m} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
