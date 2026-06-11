const statusColors: Record<string, string> = {
  DETECTAT: "bg-yellow-100 text-yellow-800",
  EMPARELLAT: "bg-blue-100 text-blue-800",
  REVISAR: "bg-orange-100 text-orange-800",
  NOTIFICAT: "bg-purple-100 text-purple-800",
  JUSTIFICANT_REBUT: "bg-green-100 text-green-800",
  PAGAMENT_CONFIRMAT: "bg-emerald-100 text-emerald-800",
  TANCAT: "bg-gray-100 text-gray-800",
  IGNORAT: "bg-gray-100 text-gray-500",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusColors[status] || "bg-gray-100 text-gray-800"}`}>
      {status}
    </span>
  );
}
