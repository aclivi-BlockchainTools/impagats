import { useState } from "react";
import { api } from "../lib/api";

export default function BankImport() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const res = await api.importCsv(file);
      setResult(res);
    } catch (err: any) {
      alert(err.message);
    }
    setLoading(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Importar CSV</h1>
      <div className="bg-white rounded-lg shadow p-6 max-w-lg space-y-4">
        <p className="text-sm text-gray-600">
          Puja un fitxer CSV amb columnes de concepte, import, data i referència. El delimitador ha de ser punt i coma (;).
        </p>
        <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block" />
        <button onClick={handleImport} disabled={!file || loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 text-sm">
          {loading ? "Important..." : "Importar"}
        </button>
        {result && (
          <div className="bg-gray-50 rounded p-4 text-sm space-y-1">
            <p>Moviments importats: <strong>{result.imported}</strong></p>
            <p>Saltats: <strong>{result.skipped}</strong></p>
            <p>Devolucions detectades: <strong>{result.detected}</strong></p>
            <p>Auto-matching: <strong>{result.matched || 0}</strong></p>
            <p>Conciliacions: <strong>{result.reconciled || 0}</strong></p>
          </div>
        )}
      </div>
    </div>
  );
}
