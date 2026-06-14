import { useState } from "react";
import { api } from "../lib/api";

export default function BankImport() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleImportCsv = async () => {
    if (!csvFile) return;
    setLoading(true);
    try {
      const res = await api.importCsv(csvFile);
      setResult(res);
    } catch (err: any) {
      alert(err.message);
    }
    setLoading(false);
  };

  const handleImportXml = async () => {
    if (!xmlFile) return;
    setLoading(true);
    try {
      const res = await api.importSepaXml(xmlFile);
      setResult(res);
    } catch (err: any) {
      alert(err.message);
    }
    setLoading(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Importar moviments</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CSV import */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="font-semibold text-lg">CSV bancari</h2>
          <p className="text-sm text-gray-600">
            Fitxer CSV amb columnes de concepte, import, data i referència. Delimitador: punt i coma (;).
          </p>
          <input type="file" accept=".csv,text/csv,application/vnd.ms-excel" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} className="block w-full text-sm" />
          <button onClick={handleImportCsv} disabled={!csvFile || loading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 text-sm">
            {loading ? "Important..." : "Importar CSV"}
          </button>
        </div>

        {/* SEPA XML import */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="font-semibold text-lg">SEPA XML (pain.002)</h2>
          <p className="text-sm text-gray-600">
            Fitxer XML de devolucions SEPA (Customer Payment Status Report). Extreu nom del deutor, IBAN, import, data i núm. factura.
          </p>
          <input type="file" accept=".xml,text/xml,application/xml" onChange={(e) => setXmlFile(e.target.files?.[0] || null)} className="block w-full text-sm" />
          <button onClick={handleImportXml} disabled={!xmlFile || loading}
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50 text-sm">
            {loading ? "Important..." : "Importar XML SEPA"}
          </button>
        </div>
      </div>

      {result && (
        <div className="mt-6 bg-white rounded-lg shadow p-6 max-w-lg text-sm space-y-1">
          {result.imported !== undefined && <p>Moviments importats: <strong>{result.imported}</strong></p>}
          {result.skipped !== undefined && <p>Saltats: <strong>{result.skipped}</strong></p>}
          {result.detected !== undefined && <p>Devolucions detectades: <strong>{result.detected}</strong></p>}
          {result.matched !== undefined && <p>Auto-matching: <strong>{result.matched}</strong></p>}
          {result.reconciled !== undefined && <p>Conciliacions: <strong>{result.reconciled}</strong></p>}
          {result.total !== undefined && <p>Total transaccions XML: <strong>{result.total}</strong></p>}
          {result.message && <p className="text-green-700 font-medium mt-2">{result.message}</p>}
        </div>
      )}
    </div>
  );
}
