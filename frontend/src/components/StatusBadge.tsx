const statusColors: Record<string, string> = {
  DETECTED: "bg-yellow-100 text-yellow-800",
  MATCHED: "bg-blue-100 text-blue-800",
  NEEDS_REVIEW: "bg-orange-100 text-orange-800",
  NOTIFIED: "bg-purple-100 text-purple-800",
  PROOF_RECEIVED: "bg-green-100 text-green-800",
  PAYMENT_CONFIRMED: "bg-emerald-100 text-emerald-800",
  CLOSED: "bg-gray-100 text-gray-800",
  IGNORED: "bg-gray-100 text-gray-500",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusColors[status] || "bg-gray-100 text-gray-800"}`}>
      {status}
    </span>
  );
}
