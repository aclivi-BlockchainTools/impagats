interface Props {
  col: string;
  label: string;
  sortKey: string;
  sortDir: "asc" | "desc";
  align?: "left" | "right" | "center";
  onSort: (key: string) => void;
  className?: string;
}

export default function SortHead({ col, label, sortKey, sortDir, align = "left", onSort, className = "" }: Props) {
  const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <th
      className={`p-3 cursor-pointer hover:bg-gray-100 select-none ${alignClass} ${className}`}
      onClick={() => onSort(col)}
    >
      {label} {sortKey === col ? (sortDir === "asc" ? "▲" : "▼") : ""}
    </th>
  );
}
