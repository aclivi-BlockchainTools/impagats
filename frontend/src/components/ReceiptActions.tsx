import { useState } from "react";
import { api } from "../lib/api";
import StatusBadge from "./StatusBadge";

interface Props {
  receipt: any;
  onReload: () => void;
}

export default function ReceiptActions({ receipt, onReload }: Props) {
  const [sending, setSending] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const [simulateText, setSimulateText] = useState("");
  const [simulating, setSimulating] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [simulateResult, setSimulateResult] = useState<any>(null);

  const handleSendWhatsApp = async () => {
    setSending(true);
    try {
      const result = await api.sendWhatsApp(receipt.id);
      if (result.success) onReload();
      else alert("Error: " + result.error);
    } catch (err: any) { alert(err.message); }
    setSending(false);
  };

  const handleUploadProof = async () => {
    if (!proofFile) return;
    try { await api.uploadProof(receipt.id, proofFile); setProofFile(null); onReload(); }
    catch (err: any) { alert(err.message); }
  };

  const handleStatusChange = async (newStatus: string) => {
    await api.updateReturnedReceipt(receipt.id, { status: newStatus });
    onReload();
  };

  const handleSendManualReply = async () => {
    if (!replyText.trim()) return;
    setReplying(true);
    try { await api.sendManualReply(receipt.id, replyText.trim()); setReplyText(""); onReload(); }
    catch (err: any) { alert(err.message); }
    setReplying(false);
  };

  const handleSimulate = async () => {
    if (!simulateText.trim()) return;
    setSimulating(true);
    setSimulateResult(null);
    try {
      const result = await api.simulateAgent(receipt.id, simulateText.trim());
      setSimulateResult(result);
    } catch (err: any) { alert(err.message); }
    setSimulating(false);
  };

  const handleExecuteAgent = async () => {
    if (!simulateText.trim()) return;
    setExecuting(true);
    try {
      const result = await api.executeAgent(receipt.id, simulateText.trim());
      const label = intentLabels[result.intent] || result.intent;
      const waMsg = result.whatsappSent
        ? "WhatsApp enviat."
        : `WhatsApp no enviat: ${result.whatsappError || "OpenWA no accessible"}. Però l'agent ha processat la resposta.`;
      alert(`Agent: ${label} → ${result.action}\n${waMsg}`);
      setSimulateText("");
      setSimulateResult(null);
      onReload();
    } catch (err: any) { alert(err.message); }
    setExecuting(false);
  };

  const intentLabels: Record<string, string> = {
    pagament_clar: "Pagament clar",
    pagament_ambigu: "Pagament ambigu",
    comprovant_enviat: "Comprovant enviat",
    altres_temes: "Altres temes",
  };

  const isAgentActive = receipt.status === "NOTIFICAT" || receipt.status === "ESPERANT_DETALLS";

  return (
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

      {isAgentActive && (
        <div className="bg-green-50 border border-green-300 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full inline-block" />
            <span className="text-green-700 text-sm font-medium">Agent actiu — Esperant resposta del deutor</span>
          </div>
        </div>
      )}

      {isAgentActive && (
        <div className="bg-white rounded-lg shadow p-4 border border-purple-200">
          <h3 className="text-sm font-semibold mb-2 text-purple-700">Provar agent</h3>
          <p className="text-xs text-gray-500 mb-2">Escriu com si fossis el deutor per veure què respondria l'agent.</p>
          <textarea
            className="w-full border rounded px-3 py-2 text-sm resize-y" rows={2}
            value={simulateText} onChange={(e) => setSimulateText(e.target.value)}
            placeholder="Ex: Ja he pagat la factura..."
          />
          <button onClick={handleSimulate}
            disabled={simulating || !simulateText.trim()}
            className="mt-2 bg-purple-600 text-white px-3 py-1.5 rounded text-sm hover:bg-purple-700 disabled:opacity-50">
            {simulating ? "Simulant..." : "Simular resposta"}
          </button>

          {simulateResult && (
            <div className="mt-3 border-t pt-3 space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500">Classificació:</span>
                <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-medium">
                  {intentLabels[simulateResult.intent] || simulateResult.intent}
                </span>
                <span className="text-gray-400">→</span>
                <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-mono text-xs">
                  {simulateResult.action}
                </span>
              </div>
              {simulateResult.receiptNewStatus && (
                <div className="text-xs text-gray-500">
                  Canviaria estat a: <span className="font-medium text-green-700">{simulateResult.receiptNewStatus}</span>
                </div>
              )}
              <div>
                <div className="text-xs text-gray-500 mb-1">Resposta de l'agent:</div>
                <div className="bg-purple-50 border border-purple-200 rounded p-2 text-sm whitespace-pre-wrap text-purple-900">
                  {simulateResult.replyText}
                </div>
              </div>
              <button
                onClick={handleExecuteAgent}
                disabled={executing || !receipt.client?.whatsapp}
                className="w-full bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50"
              >
                {executing ? "Enviant..." : "Enviar resposta de l'agent per WhatsApp"}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-sm font-semibold mb-2">Resposta manual</h3>
        <textarea
          className="w-full border rounded px-3 py-2 text-sm resize-y" rows={3}
          value={replyText} onChange={(e) => setReplyText(e.target.value)}
          placeholder="Escriu una resposta manual..."
        />
        <button onClick={handleSendManualReply}
          disabled={replying || !replyText.trim() || !receipt.client?.whatsapp}
          className="mt-2 bg-indigo-600 text-white px-3 py-1.5 rounded text-sm hover:bg-indigo-700 disabled:opacity-50">
          {replying ? "Enviant..." : "Enviar resposta manual"}
        </button>
      </div>
    </div>
  );
}
