import { useState } from "react";
import { api } from "../lib/api";

export default function BankImport() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [xmlFile, setXmlFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [notifyResult, setNotifyResult] = useState<any>(null);

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
      <h1 className="text-2xl font-bold mb-2">Importació bancària</h1>
      <p className="text-sm text-gray-500 mb-6">
        Importa moviments bancaris (CSV) i devolucions SEPA (XML) per detectar rebuts retornats.
      </p>

      {/* Flux recomanat */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-6">
        <h2 className="font-semibold text-blue-800 mb-2">Flux recomanat</h2>
        <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
          <li>Importar CSV de rebuts girats o moviments bancaris</li>
          <li>Importar XML de devolucions pain.002</li>
          <li>Revisar impagats detectats</li>
          <li>Enviar WhatsApp als deutors</li>
          <li>Revisar justificants i abonaments rebuts</li>
        </ol>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CSV import */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-lg">CSV bancari / CSB43</h2>
            <p className="text-sm text-gray-600 mt-1">
              Importa moviments bancaris per detectar devolucions i buscar possibles abonaments.
              Fitxer CSV amb delimitador punt i coma (;). Columnes de concepte, import, data i referència.
            </p>
          </div>
          <input type="file" accept=".csv,text/csv,application/vnd.ms-excel" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} className="block w-full text-sm" />
          <button onClick={handleImportCsv} disabled={!csvFile || loading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 text-sm">
            {loading ? "Important..." : "Importar CSV"}
          </button>
        </div>

        {/* SEPA XML import */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-lg">SEPA XML pain.002</h2>
            <p className="text-sm text-gray-600 mt-1">
              Importa devolucions SEPA i marca rebuts retornats. Extreu nom del deutor, IBAN, import,
              data i número de factura del fitxer XML de Customer Payment Status Report.
            </p>
          </div>
          <input type="file" accept=".xml,text/xml,application/xml" onChange={(e) => setXmlFile(e.target.files?.[0] || null)} className="block w-full text-sm" />
          <button onClick={handleImportXml} disabled={!xmlFile || loading}
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50 text-sm">
            {loading ? "Important..." : "Importar XML SEPA"}
          </button>
        </div>
      </div>

      {/* Resultats */}
      {result && (
        <div className="mt-6">
          <h2 className="font-semibold text-lg mb-3">Resultat de la importació</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {result.imported !== undefined && (
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Moviments importats</div>
                <div className="text-xl font-bold mt-1">{result.imported}</div>
              </div>
            )}
            {result.skipped !== undefined && (
              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Duplicats / no importats</div>
                <div className="text-xl font-bold mt-1">{result.skipped}</div>
              </div>
            )}
            {result.detected !== undefined && (
              <div className="bg-yellow-50 rounded-lg shadow p-4 border-l-4 border-yellow-400">
                <div className="text-xs text-yellow-700 uppercase tracking-wide font-medium">Devolucions detectades</div>
                <div className="text-xl font-bold mt-1 text-yellow-800">{result.detected}</div>
              </div>
            )}
            {result.matched !== undefined && (
              <div className="bg-blue-50 rounded-lg shadow p-4 border-l-4 border-blue-400">
                <div className="text-xs text-blue-700 uppercase tracking-wide font-medium">Coincidències automàtiques</div>
                <div className="text-xl font-bold mt-1 text-blue-800">{result.matched}</div>
              </div>
            )}
            {result.reconciled !== undefined && (
              <div className="bg-green-50 rounded-lg shadow p-4 border-l-4 border-green-400">
                <div className="text-xs text-green-700 uppercase tracking-wide font-medium">Conciliacions</div>
                <div className="text-xl font-bold mt-1 text-green-800">{result.reconciled}</div>
              </div>
            )}
            {result.total !== undefined && (
              <div className="bg-indigo-50 rounded-lg shadow p-4 border-l-4 border-indigo-400">
                <div className="text-xs text-indigo-700 uppercase tracking-wide font-medium">Total transaccions XML</div>
                <div className="text-xl font-bold mt-1 text-indigo-800">{result.total}</div>
              </div>
            )}
          </div>
          {result.message && (
            <p className="mt-4 text-green-700 font-medium text-sm bg-green-50 border border-green-200 rounded-lg p-3">
              {result.message}
            </p>
          )}

          {/* Botó notificar tots */}
          <div className="mt-4 bg-white rounded-lg shadow p-4 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">Notificar tots els emparellats</h3>
                <p className="text-xs text-gray-500">Envia WhatsApp a tots els impagats en estat EMPARELLAT amb WhatsApp.</p>
              </div>
              <button
                onClick={async () => {
                  if (!confirm("Segur que vols notificar tots els impagats emparellats? S'encuaran i s'enviaran de forma esglaonada en segon pla.")) return;
                  setNotifying(true);
                  try {
                    const res = await api.notifyAllReceipts();
                    setNotifyResult(res);
                  } catch (err: any) { alert(err.message); }
                  setNotifying(false);
                }}
                disabled={notifying}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 text-sm whitespace-nowrap"
              >
                {notifying ? "Notificant..." : "Notificar tots els emparellats"}
              </button>
            </div>
            {notifyResult && (
              <div className="mt-3 text-sm space-y-1">
                <p className="text-green-700">{notifyResult.queued} de {notifyResult.total} encuats ({notifyResult.skipped} saltats) · S'enviaran esglaonadament</p>
                {notifyResult.skippedDetails?.length > 0 && (
                  <div className="text-xs text-gray-500">
                    Saltats: {notifyResult.skippedDetails.map((s: any) => `#${s.id} (${s.reason})`).join(", ")}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
