import { useEffect, useRef } from "react";

function AgentIndicator({ message }: { message: any }) {
  if (!message.agentIntent) return null;
  return (
    <div className="mt-1 text-xs flex items-center gap-2 flex-wrap">
      <span className="text-purple-600 font-medium">Agent</span>
      <span className="text-gray-400">intent:</span>
      <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-mono text-xs">{message.agentIntent}</span>
      <span className="text-gray-400">→</span>
      <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-mono text-xs">{message.agentAction}</span>
      {message.needsReview && <span className="bg-red-100 text-red-600 px-1.5 py-0.5 rounded text-xs">Revisar</span>}
    </div>
  );
}

interface Props {
  messages: any[];
}

export default function ConversationView({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll al darrer missatge (final) cada cop que canvien els missatges
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, messages[messages.length - 1]?.id]);

  if (!messages || messages.length === 0) return null;

  // Mostrar en ordre cronològic (el més antic primer) amb scroll al final
  const sorted = [...messages].sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());

  return (
    <div className="bg-white rounded-lg shadow p-6 flex flex-col">
      <h2 className="font-semibold text-lg mb-3 flex-shrink-0">Conversa WhatsApp</h2>
      <div className="space-y-2 overflow-y-auto flex-1" style={{ maxHeight: "500px" }}>
        {sorted.map((m: any) => (
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
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
