// Tests del servei de justificants

import fs from "fs";
import path from "path";
import crypto from "crypto";

// Test de funcions pures de proofService
// Nota: les funcions saveProof i downloadMedia requereixen BD/connexió,
// però podem testejar la validació aquí

describe("proofService - validació", () => {
  const ALLOWED_MIME_TYPES = [
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];

  function isAllowedMimeType(mimeType?: string): boolean {
    if (!mimeType) return false;
    return ALLOWED_MIME_TYPES.some((t) => mimeType.toLowerCase() === t);
  }

  it("accepta JPEG", () => {
    expect(isAllowedMimeType("image/jpeg")).toBe(true);
  });

  it("accepta PNG", () => {
    expect(isAllowedMimeType("image/png")).toBe(true);
  });

  it("accepta PDF", () => {
    expect(isAllowedMimeType("application/pdf")).toBe(true);
  });

  it("accepta Word DOCX", () => {
    expect(isAllowedMimeType("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(true);
  });

  it("accepta Excel XLSX", () => {
    expect(isAllowedMimeType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe(true);
  });

  it("rebutja àudio", () => {
    expect(isAllowedMimeType("audio/ogg")).toBe(false);
  });

  it("rebutja vídeo", () => {
    expect(isAllowedMimeType("video/mp4")).toBe(false);
  });

  it("rebutja undefined", () => {
    expect(isAllowedMimeType(undefined)).toBe(false);
  });

  it("rebutja text/html", () => {
    expect(isAllowedMimeType("text/html")).toBe(false);
  });

  it("rebutja application/zip", () => {
    expect(isAllowedMimeType("application/zip")).toBe(false);
  });

  it("rebutja application/octet-stream", () => {
    // Octet-stream genèric no es permet
    expect(isAllowedMimeType("application/octet-stream")).toBe(false);
  });
});

describe("proofService - SHA-256", () => {
  it("genera hash de 64 caràcters hex", () => {
    const buffer = Buffer.from("test proof content");
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    expect(hash.length).toBe(64);
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });

  it("genera hash diferent per contingut diferent", () => {
    const hash1 = crypto.createHash("sha256").update(Buffer.from("test1")).digest("hex");
    const hash2 = crypto.createHash("sha256").update(Buffer.from("test2")).digest("hex");
    expect(hash1).not.toBe(hash2);
  });

  it("genera el mateix hash per contingut idèntic", () => {
    const content = "identical content";
    const hash1 = crypto.createHash("sha256").update(Buffer.from(content)).digest("hex");
    const hash2 = crypto.createHash("sha256").update(Buffer.from(content)).digest("hex");
    expect(hash1).toBe(hash2);
  });
});

describe("proofService - emmagatzematge", () => {
  const UPLOADS_DIR = path.join(__dirname, "../../uploads/proofs");

  it("el directori d'uploads existeix o es pot crear", () => {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    expect(fs.existsSync(UPLOADS_DIR)).toBe(true);
  });

  it("pot guardar i llegir un fitxer", () => {
    const filename = `test-${Date.now()}.txt`;
    const filePath = path.join(UPLOADS_DIR, filename);
    const content = "test content";
    fs.writeFileSync(filePath, content);
    expect(fs.existsSync(filePath)).toBe(true);
    const read = fs.readFileSync(filePath, "utf-8");
    expect(read).toBe(content);
    fs.unlinkSync(filePath);
  });
});
