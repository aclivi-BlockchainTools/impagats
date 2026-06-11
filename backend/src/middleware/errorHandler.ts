import { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

// Wrapper for async route handlers — catches rejected promises and forwards to next()
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  logger.error({ err }, "Unhandled error");
  const isDev = process.env.NODE_ENV !== "production";

  // Prisma known request errors
  if (err?.code === "P2025") {
    return res.status(404).json({ error: "Registre no trobat" });
  }
  if (err?.code === "P2002") {
    return res.status(409).json({ error: "Ja existeix un registre amb aquest valor" });
  }
  if (err?.code?.startsWith("P")) {
    return res.status(400).json({ error: isDev ? `DB error: ${err.message}` : "Error de base de dades" });
  }

  // Zod validation errors (if thrown)
  if (err?.name === "ZodError") {
    const messages = err.issues.map((i: any) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return res.status(400).json({ error: `Validació fallida: ${messages}` });
  }

  // Generic
  res.status(err?.status || 500).json({
    error: isDev ? err.message || "Error intern" : "Error intern del servidor",
  });
}
