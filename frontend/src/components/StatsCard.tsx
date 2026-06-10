export default function StatsCard({ label, value, color = "bg-white" }: { label: string; value: string | number; color?: string }) {
  return (
    <div className={`${color} rounded-lg shadow p-4`}>
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
