import { useState } from "react";
import { useParams } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { api, formatAmount } from "../lib/api";
import StatusBadge from "../components/StatusBadge";
import ReceiptInfo from "../components/ReceiptInfo";
import ReceiptActions from "../components/ReceiptActions";
import ConversationView from "../components/ConversationView";
import ProofViewer from "../components/ProofViewer";
import Timeline from "../components/Timeline";

export default function ReturnedReceiptDetail() {
  const { id } = useParams();
  const receiptId = parseInt(id!);
  const { data: receipt, loading, error, reload } = useApi(() => api.getReturnedReceipt(receiptId));
  const { data: clients } = useApi(() => api.getClients());
  const { data: invoices } = useApi(() => api.getInvoices());
  const { data: notes, reload: reloadNotes } = useApi(() => api.getCaseNotes(receiptId));
  const { data: history, reload: reloadHistory } = useApi(() => api.getStatusHistory(receiptId));

  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setAddingNote(true);
    try {
      await api.addCaseNote(receiptId, noteText.trim());
      setNoteText("");
      reloadNotes();
    } catch (err: any) { alert(err.message); }
    setAddingNote(false);
  };

  if (loading) return <div className="text-gray-500">Carregant...</div>;
  if (error) return <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">Error: {error}</div>;
  if (!receipt) return <div className="text-gray-500">No trobat</div>;

  // Determinar última acció
  const lastAction = (() => {
    const msgs = receipt.messages;
    if (msgs && msgs.length > 0) {
      const lastMsg = msgs[msgs.length - 1];
      if (lastMsg.direction === "OUTBOUND") return "WhatsApp enviat";
      if (lastMsg.direction === "INBOUND") return "Resposta rebuda";
    }
    if ((receipt.proofs?.length ?? 0) > 0) return "Justificant rebut";
    return null;
  })();

  return (
    <div>
      {/* Capçalera de fitxa de cas */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide">Impagat</div>
            <div className="text-2xl font-bold">#{receipt.id}</div>
          </div>

          <div className="h-10 w-px bg-gray-200" />

          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide">Estat</div>
            <StatusBadge status={receipt.status} />
          </div>

          <div className="h-10 w-px bg-gray-200" />

          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide">Client</div>
            <div className="font-semibold">{receipt.client?.name || <span className="text-orange-500">No assignat</span>}</div>
            {receipt.client?.whatsapp && <div className="text-xs text-gray-400">+{receipt.client.whatsapp}</div>}
          </div>

          <div className="h-10 w-px bg-gray-200" />

          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide">Import</div>
            <div className="text-xl font-bold">{formatAmount(receipt.returnedAmount)} €</div>
          </div>

          <div className="h-10 w-px bg-gray-200" />

          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide">Període</div>
            <div className="font-medium">{receipt.servicePeriod || "-"}</div>
          </div>

          {lastAction && (
            <>
              <div className="h-10 w-px bg-gray-200" />
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Última acció</div>
                <div className="text-sm text-gray-700">{lastAction}</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Layout 2 columnes: esquerra (info + conversa + justificants) | dreta (accions + notes + historial) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna esquerra: informació, conversa i justificants */}
        <div className="lg:col-span-2 space-y-6">
          <ReceiptInfo receipt={receipt} clients={clients || []} invoices={invoices || []} onReload={reload} />
          <ConversationView messages={receipt.messages || []} />
          <ProofViewer proofs={receipt.proofs || []} />
        </div>

        {/* Columna dreta: accions, notes i historial */}
        <div className="space-y-6">
          <ReceiptActions receipt={receipt} onReload={reload} />

          <div className="bg-white rounded-lg shadow p-6 flex flex-col">
            <h2 className="font-semibold text-lg mb-4 flex-shrink-0">Notes internes</h2>
            <div className="flex gap-2 mb-4 flex-shrink-0">
              <input
                className="flex-1 border rounded px-3 py-2 text-sm"
                placeholder="Afegir nota interna..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
              />
              <button
                onClick={handleAddNote}
                disabled={addingNote || !noteText.trim()}
                className="bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {addingNote ? "..." : "Afegir"}
              </button>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: "250px" }}>
              {notes && notes.length > 0 ? (
                <ul className="space-y-2">
                  {notes.map((n: any) => (
                    <li key={n.id} className="border-l-2 border-blue-300 pl-3 py-1">
                      <div className="text-sm whitespace-pre-wrap">{n.body}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        {n.author} — {new Date(n.createdAt).toLocaleString("ca-ES")}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">Cap nota interna</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 flex flex-col">
            <h2 className="font-semibold text-lg mb-4 flex-shrink-0">Historial d'estats</h2>
            <div className="overflow-y-auto" style={{ maxHeight: "250px" }}>
              {history && history.length > 0 ? (
                <ul className="space-y-2 pr-1">
                  {history.map((h: any, idx: number) => (
                    <li key={h.id} className="flex items-start gap-3 text-sm">
                      <div className="flex flex-col items-center flex-shrink-0">
                        <span className="w-2 h-2 bg-gray-400 rounded-full mt-1.5" />
                        {idx < history.length - 1 && <span className="w-px flex-1 bg-gray-200 min-h-[20px]" />}
                      </div>
                      <div className="min-w-0">
                        <div>
                          {h.fromStatus ? (
                            <span className="text-gray-500">{h.fromStatus} → </span>
                          ) : (
                            <span className="text-gray-400">(inici) → </span>
                          )}
                          <span className="font-medium">{h.toStatus}</span>
                          <span className="text-xs text-gray-400 ml-2">{h.actorType}</span>
                        </div>
                        {h.reason && <div className="text-xs text-gray-400 truncate">{h.reason}</div>}
                        <div className="text-xs text-gray-300">{new Date(h.createdAt).toLocaleString("ca-ES")}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">Cap canvi d'estat registrat</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Timeline — a baix de tot, amplada completa */}
      <div className="mt-6">
        <Timeline
          statusHistory={history || []}
          messages={receipt.messages || []}
          proofs={receipt.proofs || []}
          reconciliationMatches={receipt.reconciliation || []}
          caseNotes={notes || []}
          paymentPromises={receipt.paymentPromises || []}
        />
      </div>
    </div>
  );
}
