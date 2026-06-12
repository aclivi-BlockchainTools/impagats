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

const UPLOADS_DIR = path.join(__dirname, "../../uploads/proofs");

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

function ensureUploadsDir(): void {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function computeSha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function isAllowedMimeType(mimeType?: string): boolean {
  if (!mimeType) return false;
  const lower = mimeType.toLowerCase();
  return ALLOWED_MIME_TYPES.some((t) => lower === t);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function saveProof(data: ProofData): Promise<ProofResult> {
  const { receiptId, messageId, originalName, mimeType, buffer } = data;

  // Validar tipus MIME
  if (!isAllowedMimeType(mimeType)) {
    logger.warn({ receiptId, mimeType }, "Tipus MIME no permès per justificant");
    return { success: false, error: `Tipus de fitxer no permès: ${mimeType || "desconegut"}` };
  }

  try {
    ensureUploadsDir();

    const sha256 = computeSha256(buffer);
    const sizeBytes = buffer.length;

    // Extensió
    const ext = mimeType ? `.${mimeType.split("/")[1]}` : ".bin";
    const safeName = originalName ? sanitizeFilename(originalName) : "proof";
    const filename = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${safeName}${ext}`;
    const fullPath = path.join(UPLOADS_DIR, filename);

    // Guardar fitxer
    fs.writeFileSync(fullPath, buffer);

    // Crear registre PaymentProof
    const proof = await prisma.paymentProof.create({
      data: {
        receiptId,
        messageId: messageId || null,
        originalName: originalName || filename,
        mimeType: mimeType || "application/octet-stream",
        sizeBytes,
        sha256,
        storagePath: filename, // només el nom del fitxer, no path absolut
        status: "RECEIVED",
      },
    });

    logger.info({
      receiptId,
      proofId: proof.id,
      sha256,
      sizeBytes,
      mimeType,
    }, "Justificant guardat correctament");

    return {
      success: true,
      proofId: proof.id,
      sha256,
      storagePath: filename,
      sizeBytes,
    };
  } catch (err: any) {
    logger.error({ err, receiptId }, "Error guardant justificant");
    return { success: false, error: err.message };
  }
}

// Descarregar media des d'URL d'OpenWA
export async function downloadMedia(url: string): Promise<{ success: boolean; buffer?: Buffer; mimeType?: string; error?: string }> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status} descarregant media` };
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const mimeType = response.headers.get("content-type") || undefined;
    return { success: true, buffer, mimeType };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Descarregar i guardar — el flux complet
export async function downloadAndSaveProof(
  mediaUrl: string,
  receiptId: number,
  messageId?: number,
  originalName?: string,
): Promise<ProofResult> {
  const download = await downloadMedia(mediaUrl);
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
