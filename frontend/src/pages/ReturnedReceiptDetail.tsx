import { useParams } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import StatusBadge from "../components/StatusBadge";
import ReceiptInfo from "../components/ReceiptInfo";
import ReceiptActions from "../components/ReceiptActions";
import ConversationView from "../components/ConversationView";

export default function ReturnedReceiptDetail() {
  const { id } = useParams();
  const { data: receipt, loading, error, reload } = useApi(() => api.getReturnedReceipt(parseInt(id!)));
  const { data: clients } = useApi(() => api.getClients());
  const { data: invoices } = useApi(() => api.getInvoices());

  if (loading) return <div className="text-gray-500">Carregant...</div>;
  if (error) return <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">Error: {error}</div>;
  if (!receipt) return <div className="text-gray-500">No trobat</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Impagat #{receipt.id}</h1>
        <StatusBadge status={receipt.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReceiptInfo receipt={receipt} clients={clients || []} invoices={invoices || []} onReload={reload} />
        <div>
          <ReceiptActions receipt={receipt} onReload={reload} />
          <div className="mt-4">
            <ConversationView messages={receipt.messages} />
          </div>
        </div>
      </div>
    </div>
  );
}
