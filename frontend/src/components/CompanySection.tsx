interface Props {
  settings: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export default function CompanySection({ settings, onChange }: Props) {
  return (
    <div>
      <h2 className="font-semibold text-lg mb-3">Dades d'empresa</h2>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nom empresa</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={settings.company_name || ""}
            onChange={(e) => onChange("company_name", e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">IBAN</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={settings.company_iban || ""}
            onChange={(e) => onChange("company_iban", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
