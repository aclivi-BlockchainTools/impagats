import { Link } from "react-router-dom";

interface Props {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  color?: string;
  accent?: string;
  to?: string;
}

export default function StatsCard({ label, value, subtitle, icon, color = "bg-white", accent, to }: Props) {
  const card = (
    <div className={`${color} rounded-lg shadow p-4 ${accent ? `border-l-4 ${accent}` : ""} ${to ? "hover:shadow-md transition-shadow cursor-pointer" : ""}`}>
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

  if (to) return <Link to={to}>{card}</Link>;
  return card;
}
