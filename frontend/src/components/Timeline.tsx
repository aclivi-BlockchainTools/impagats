// Timeline unificat del cas: combina totes les fonts d'esdeveniments
// - Canvis d'estat (statusHistory)
// - Missatges WhatsApp (messages)
// - Justificants (proofs)
// - Conciliacions (reconciliationMatches)
// - Notes internes (caseNotes)
// - Promeses de pagament (paymentPromises)

interface TimelineEvent {
  timestamp: Date;
  type: "status_change" | "whatsapp_out" | "whatsapp_in" | "proof" | "reconciliation" | "note" | "promise" | "system";
  icon: string;
  label: string;
  detail?: string;
  color: string;
}

interface Props {
  statusHistory?: any[];
  messages?: any[];
  proofs?: any[];
  reconciliationMatches?: any[];
  caseNotes?: any[];
  paymentPromises?: any[];
}

export default function Timeline({
  statusHistory = [],
  messages = [],
  proofs = [],
  reconciliationMatches = [],
  caseNotes = [],
  paymentPromises = [],
}: Props) {
  const events: TimelineEvent[] = [];

  // Canvis d'estat
  for (const h of statusHistory || []) {
    events.push({
      timestamp: new Date(h.createdAt),
      type: "status_change",
      icon: "🔄",
      label: `${h.fromStatus || "(inici)"} → ${h.toStatus}`,
      detail: h.reason,
      color: "bg-blue-500",
    });
  }

  // Missatges WhatsApp
  for (const m of messages || []) {
    events.push({
      timestamp: new Date(m.sentAt),
      type: m.direction === "OUTBOUND" ? "whatsapp_out" : "whatsapp_in",
      icon: m.direction === "OUTBOUND" ? "📤" : "📥",
      label: m.direction === "OUTBOUND"
        ? `WhatsApp enviat${m.agentIntent ? ` (auto: ${m.agentIntent})` : " (manual)"}`
        : "Resposta rebuda",
      detail: m.content?.substring(0, 100),
      color: m.direction === "OUTBOUND" ? "bg-purple-500" : "bg-indigo-500",
    });
  }

  // Justificants
  for (const p of proofs || []) {
    events.push({
      timestamp: new Date(p.receivedAt),
      type: "proof",
      icon: "📎",
      label: "Justificant rebut",
      detail: p.originalName || `${p.mimeType} (${p.sizeBytes ? Math.round(p.sizeBytes / 1024) + "KB" : "?"})`,
      color: "bg-teal-500",
    });
  }

  // Conciliacions
  for (const rc of reconciliationMatches || []) {
    events.push({
      timestamp: new Date(rc.matchedAt),
      type: "reconciliation",
      icon: "🏦",
      label: `Abonament detectat (${(rc.confidence * 100).toFixed(0)}% confiança)`,
      detail: `Import: ${parseFloat(rc.amount).toFixed(2)} €`,
      color: "bg-emerald-500",
    });
  }

  // Notes internes
  for (const n of caseNotes || []) {
    events.push({
      timestamp: new Date(n.createdAt),
      type: "note",
      icon: "📝",
      label: `Nota interna${n.author ? ` (${n.author})` : ""}`,
      detail: n.body?.substring(0, 100),
      color: "bg-gray-400",
    });
  }

  // Promeses de pagament
  for (const pp of paymentPromises || []) {
    events.push({
      timestamp: new Date(pp.createdAt),
      type: "promise",
      icon: "🤝",
      label: `Promesa de pagament (${pp.status === "ACTIVE" ? "activa" : pp.status === "FULFILLED" ? "complerta" : pp.status === "EXPIRED" ? "vençuda" : pp.status})`,
      detail: pp.body?.substring(0, 100) || (pp.promisedDate ? `Data promesa: ${new Date(pp.promisedDate).toLocaleDateString("ca-ES")}` : undefined),
      color: "bg-amber-500",
    });
  }

  // Ordenar cronològicament
  events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  if (events.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="font-semibold text-lg mb-4">Cronologia del cas</h2>
        <p className="text-sm text-gray-400">Cap esdeveniment registrat</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="font-semibold text-lg mb-4">Cronologia del cas</h2>
      <div className="relative">
        {/* Línia vertical */}
        <div className="absolute left-2.5 top-0 bottom-0 w-px bg-gray-200" />

        <ul className="space-y-3 ml-8">
          {events.map((e, idx) => (
            <li key={idx} className="relative">
              {/* Punt de color */}
              <span className={`absolute -left-[1.35rem] w-2 h-2 rounded-full mt-1.5 ${e.color}`} />

              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{e.icon}</span>
                  <span className="text-sm font-medium">{e.label}</span>
                </div>
                {e.detail && (
                  <div className="text-xs text-gray-500 mt-0.5 truncate max-w-md" title={e.detail}>
                    {e.detail}
                  </div>
                )}
                <div className="text-xs text-gray-300 mt-0.5">
                  {e.timestamp.toLocaleString("ca-ES")}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
