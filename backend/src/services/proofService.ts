// Servei de gestió de justificants de pagament
// Valida, emmagatzema i registra comprovants rebuts via WhatsApp

import prisma from "../lib/prisma";
import { logger } from "../lib/logger";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

// Directori base per guardar comprovants. Usar STORAGE_DIR de .env si existeix.
function getStorageBaseDir(): string {
  const envDir = process.env.STORAGE_DIR;
  if (envDir) return path.resolve(envDir, "proofs");
  // Fallback: relatiu a l'arrel del projecte backend
  return path.resolve(__dirname, "../../storage/proofs");
}

function getUploadsDir(): string {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return path.join(getStorageBaseDir(), year, month);
}

export interface ProofData {
  receiptId: number;
  messageId?: number;
  originalName?: string;
  mimeType?: string;
  buffer: Buffer;
}

export interface ProofResult {
  success: boolean;
  proofId?: number;
  error?: string;
  sha256?: string;
  storagePath?: string;
  sizeBytes?: number;
}

function ensureUploadsDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.info({ dir }, "Directori de proofs creat");
  }
}

function computeSha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function isAllowedMimeType(mimeType?: string): boolean {
  if (!mimeType) return false;
  // Treure paràmetres (ex: "image/jpeg; charset=utf-8" → "image/jpeg")
  const base = mimeType.split(";")[0].trim().toLowerCase();
  // Acceptar també variants comunes de WhatsApp/OpenWA
  const variants: Record<string, string> = {
    "image/jpg": "image/jpeg",
    "image/svg+xml": "image/svg+xml",
    "application/x-pdf": "application/pdf",
    "text/plain": "text/plain",
  };
  const normalized = variants[base] || base;
  return ALLOWED_MIME_TYPES.some((t) => normalized === t);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 100);
}

function getExtension(mimeType?: string, filename?: string): string {
  // Mapeig de MIME → extensió
  const mimeToExt: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  };
  if (mimeType) {
    const base = mimeType.split(";")[0].trim().toLowerCase();
    if (mimeToExt[base]) return mimeToExt[base];
    const parts = base.split("/");
    if (parts.length === 2 && parts[1].length <= 5 && /^[a-z0-9.+-]+$/.test(parts[1])) {
      return parts[1];
    }
  }
  // Fallback: extensió del filename original
  if (filename) {
    const extMatch = filename.match(/\.([a-zA-Z0-9]{1,7})$/);
    if (extMatch) return extMatch[1].toLowerCase();
  }
  return "bin";
}

export async function saveProof(data: ProofData): Promise<ProofResult> {
  const { receiptId, messageId, originalName, mimeType, buffer } = data;

  // 1. Validar tipus MIME
  if (!isAllowedMimeType(mimeType)) {
    logger.warn({ receiptId, mimeType, originalName }, "[saveProof] Fallada 1/4: Tipus MIME no permès — comprova variants MIME i extensió del fitxer");
    return { success: false, error: `Tipus de fitxer no permès: ${mimeType || "desconegut"}` };
  }

  try {
    // 2. Assegurar directori d'uploads (storage/proofs/YYYY/MM/)
    const uploadsDir = getUploadsDir();
    try {
      ensureUploadsDir(uploadsDir);
    } catch (err: any) {
      logger.error({ err, receiptId, uploadsDir }, "[saveProof] Fallada 2/4: No s'ha pogut crear el directori d'uploads — comprova permisos de carpeta");
      return { success: false, error: `Error creant directori: ${err.message}` };
    }

    const sha256 = computeSha256(buffer);
    const sizeBytes = buffer.length;

    // Extensió segons MIME
    const ext = getExtension(mimeType, originalName);
    const shortHash = sha256.substring(0, 8);
    const safeName = originalName
      ? sanitizeFilename(originalName.replace(/\.[^.]+$/, ""))
      : "proof";
    const filename = `proof_${receiptId}_${Date.now()}_${shortHash}.${ext}`;
    const fullPath = path.join(uploadsDir, filename);
    // storagePath relatiu al directori base de storage
    const now = new Date();
    const storageRelPath = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${filename}`;

    // 3. Guardar fitxer a disc
    try {
      fs.writeFileSync(fullPath, buffer);
    } catch (err: any) {
      logger.error({ err, receiptId, fullPath }, "[saveProof] Fallada 3/4: No s'ha pogut escriure el fitxer a disc — comprova espai, permisos i ruta");
      return { success: false, error: `Error escrivint fitxer: ${err.message}` };
    }

    // 4. Crear registre PaymentProof a BD
    try {
      const proof = await prisma.paymentProof.create({
        data: {
          receiptId,
          messageId: messageId || null,
          originalName: originalName || filename,
          mimeType: mimeType || "application/octet-stream",
          sizeBytes,
          sha256,
          storagePath: storageRelPath,
          status: "RECEIVED",
        },
      });

      logger.info({
        receiptId,
        proofId: proof.id,
        sha256,
        sizeBytes,
        mimeType,
      }, "[saveProof] OK 4/4: Justificant guardat correctament");

      return {
        success: true,
        proofId: proof.id,
        sha256,
        storagePath: storageRelPath,
        sizeBytes,
      };
    } catch (err: any) {
      // Intentar netejar el fitxer si la BD falla
      try { fs.unlinkSync(fullPath); } catch (_) { /* ignorar */ }
      logger.error({ err, receiptId }, "[saveProof] Fallada 4/4: No s'ha pogut crear el registre PaymentProof a la BD — comprova connexió, FK i constraints");
      return { success: false, error: `Error creant registre BD: ${err.message}` };
    }
  } catch (err: any) {
    logger.error({ err, receiptId }, "[saveProof] Error inesperat guardant justificant");
    return { success: false, error: err.message };
  }
}

// Descarregar media des d'URL d'OpenWA
// OpenWA requereix autenticació amb X-Api-Key per servir fitxers
export async function downloadMedia(
  url: string,
  apiKey?: string,
): Promise<{ success: boolean; buffer?: Buffer; mimeType?: string; error?: string }> {
  try {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers["X-Api-Key"] = apiKey;
    }
    const response = await fetch(url, { headers });
    if (!response.ok) {
      logger.warn({ url: url.substring(0, 120), status: response.status, hasApiKey: !!apiKey }, "[downloadMedia] Fallada HTTP — comprova URL, API key i que la sessió OpenWA estigui activa");
      return { success: false, error: `HTTP ${response.status} descarregant media` };
    }
    const arrayBuffer = await response.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      logger.warn({ url: url.substring(0, 120), contentType: response.headers.get("content-type") }, "[downloadMedia] Fallada: buffer buit tot i HTTP 200 — el recurs podria no existir o estar corrupte");
      return { success: false, error: "Buffer buit descarregant media" };
    }
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = response.headers.get("content-type") || undefined;
    logger.info({ url: url.substring(0, 120), bufferSize: buffer.length, mimeType }, "[downloadMedia] OK: Media descarregat");
    return { success: true, buffer, mimeType };
  } catch (err: any) {
    logger.error({ err: err.message, url: url.substring(0, 120) }, "[downloadMedia] Fallada de xarxa/DNS — comprova connectivitat amb el servidor OpenWA");
    return { success: false, error: err.message };
  }
}

// Descarregar i guardar — el flux complet
export async function downloadAndSaveProof(
  mediaUrl: string,
  receiptId: number,
  messageId?: number,
  originalName?: string,
  apiKey?: string,
): Promise<ProofResult> {
  const download = await downloadMedia(mediaUrl, apiKey);
  if (!download.success || !download.buffer) {
    return { success: false, error: download.error || "Error descarregant media" };
  }

  return saveProof({
    receiptId,
    messageId,
    originalName,
    mimeType: download.mimeType,
    buffer: download.buffer,
  });
}
