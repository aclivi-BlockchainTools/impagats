const statusColors: Record<string, string> = {
  DETECTAT: "bg-yellow-100 text-yellow-800",
  EMPARELLAT: "bg-blue-100 text-blue-800",
  REVISAR: "bg-orange-100 text-orange-800",
  NOTIFICAT: "bg-purple-100 text-purple-800",
  ESPERANT_JUSTIFICANT: "bg-amber-100 text-amber-800",
  PAGAMENT_DECLARAT: "bg-rose-100 text-rose-800",
  JUSTIFICANT_REBUT: "bg-green-100 text-green-800",
  PENDENT_REVISIO: "bg-teal-100 text-teal-800",
  PAGAMENT_CONFIRMAT: "bg-emerald-100 text-emerald-800",
  TANCAT: "bg-gray-100 text-gray-800",
  ERROR_WHATSAPP: "bg-red-100 text-red-800",
  IGNORAT: "bg-gray-100 text-gray-500",
};

const statusLabels: Record<string, string> = {
  DETECTAT: "Detectat",
  EMPARELLAT: "Emparellat",
  REVISAR: "Revisar",
  NOTIFICAT: "Notificat",
  ESPERANT_JUSTIFICANT: "Esperant justificant",
  PAGAMENT_DECLARAT: "Pagament declarat",
  JUSTIFICANT_REBUT: "Justificant rebut",
  PENDENT_REVISIO: "Pendent revisió",
  PAGAMENT_CONFIRMAT: "Pagament confirmat",
  TANCAT: "Tancat",
  ERROR_WHATSAPP: "Error WhatsApp",
  IGNORAT: "Ignorat",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusColors[status] || "bg-gray-100 text-gray-800"}`}>
      {statusLabels[status] || status}
    </span>
  );
}
