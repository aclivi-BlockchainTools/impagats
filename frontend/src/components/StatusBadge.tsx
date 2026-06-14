const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  // Groc/taronja — pendent o revisar
  DETECTAT:    { label: "Detectat",             bg: "bg-yellow-50 border border-yellow-200", text: "text-yellow-700", dot: "bg-yellow-500" },
  REVISAR:     { label: "Revisar",               bg: "bg-orange-50 border border-orange-200", text: "text-orange-700", dot: "bg-orange-500" },
  PENDENT_REVISIO: { label: "Pendent revisió",   bg: "bg-amber-50 border border-amber-200", text: "text-amber-700", dot: "bg-amber-500" },

  // Blau/lila — procés o notificat
  EMPARELLAT:  { label: "Emparellat",            bg: "bg-blue-50 border border-blue-200",   text: "text-blue-700",  dot: "bg-blue-500" },
  NOTIFICAT:   { label: "Notificat",             bg: "bg-purple-50 border border-purple-200", text: "text-purple-700", dot: "bg-purple-500" },
  ESPERANT_JUSTIFICANT: { label: "Esperant justificant", bg: "bg-indigo-50 border border-indigo-200", text: "text-indigo-700", dot: "bg-indigo-500" },
  PAGAMENT_DECLARAT:    { label: "Pagament declarat",    bg: "bg-rose-50 border border-rose-200", text: "text-rose-700", dot: "bg-rose-500" },

  // Verd — justificat, confirmat o tancat
  JUSTIFICANT_REBUT:  { label: "Justificant rebut",  bg: "bg-emerald-50 border border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500" },
  PAGAMENT_CONFIRMAT: { label: "Pagament confirmat", bg: "bg-green-50 border border-green-200", text: "text-green-700", dot: "bg-green-500" },
  TANCAT:             { label: "Tancat",             bg: "bg-gray-100 border border-gray-200", text: "text-gray-600", dot: "bg-gray-400" },

  // Vermell — error
  ERROR_WHATSAPP: { label: "Error WhatsApp", bg: "bg-red-50 border border-red-200", text: "text-red-700", dot: "bg-red-500" },

  // Gris — ignorat
  IGNORAT: { label: "Ignorat", bg: "bg-gray-50 border border-gray-200", text: "text-gray-400", dot: "bg-gray-300" },
};

export default function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] || { label: status, bg: "bg-gray-50 border border-gray-200", text: "text-gray-600", dot: "bg-gray-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}
