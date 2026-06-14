interface Props {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  color?: string;       // bg color class
  accent?: string;       // left border accent color
}

export default function StatsCard({ label, value, subtitle, icon, color = "bg-white", accent }: Props) {
  return (
    <div className={`${color} rounded-lg shadow p-4 ${accent ? `border-l-4 ${accent}` : ""}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</div>
          <div className="text-2xl font-bold mt-0.5">{value}</div>
          {subtitle && <div className="text-xs text-gray-400 mt-0.5">{subtitle}</div>}
        </div>
        {icon && <span className="text-2xl opacity-60 flex-shrink-0">{icon}</span>}
      </div>
    </div>
  );
}
