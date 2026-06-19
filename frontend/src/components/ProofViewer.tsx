import { api } from "../lib/api";

interface Proof {
  id: number;
  receiptId: number;
  mimeType: string | null;
  sizeBytes: number | null;
  sha256: string | null;
  storagePath: string;
  status: string;
  receivedAt: string;
  originalName: string | null;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

function isPdf(mimeType: string): boolean {
  return mimeType === "application/pdf";
}

function getIcon(mimeType: string): string {
  if (isImage(mimeType)) return "🖼️";
  if (isPdf(mimeType)) return "📄";
  return "📎";
}

interface Props {
  proofs: Proof[];
}

export default function ProofViewer({ proofs }: Props) {
  if (!proofs || proofs.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="font-semibold text-lg mb-3">
        Justificants ({proofs.length})
      </h2>
      <div className="space-y-3">
        {proofs.map((p) => (
          <div key={p.id} className="border rounded-lg p-3 flex items-center gap-3 hover:bg-gray-50">
            {/* Miniatura o icona */}
            <div className="w-16 h-16 rounded bg-gray-100 flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden">
              {isImage(p.mimeType ?? "") ? (
                <img
                  src={`/api/proofs/${p.id}/file`}
                  alt="Miniatura"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <span>{getIcon(p.mimeType ?? "")}</span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {p.originalName || `Justificant #${p.id}`}
              </div>
              <div className="text-xs text-gray-500">
                {p.mimeType ?? "?"} · {formatSize(p.sizeBytes ?? 0)} · {new Date(p.receivedAt).toLocaleString("ca-ES")}
              </div>
            </div>

            {/* Botons */}
            <div className="flex gap-2 flex-shrink-0">
              <a
                href={`/api/proofs/${p.id}/file`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 text-sm font-medium whitespace-nowrap"
              >
                {isImage(p.mimeType ?? "") ? "Veure" : "Obrir"}
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
