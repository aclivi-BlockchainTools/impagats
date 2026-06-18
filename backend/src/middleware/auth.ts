// Middleware d'autenticació JWT
// Protegeix tots els endpoints excepte health i webhook

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../lib/config";
import { logger } from "../lib/logger";

export interface AuthRequest extends Request {
  adminId?: string;
}

export function generateToken(adminEmail: string): string {
  return jwt.sign(
    { email: adminEmail, role: "admin" },
    config.jwtSecret,
    { expiresIn: "24h" }
  );
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  // Permetre sense auth si no hi ha JWT_SECRET configurat
  if (!config.jwtSecret) {
    if (process.env.NODE_ENV === "production") {
      logger.warn("⛔ PRODUCCIÓ sense JWT_SECRET definit — l'auth està DESACTIVADA! Defineix JWT_SECRET al .env.");
    }
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Autenticació requerida" });
    return;
  }

  const token = authHeader.substring(7);
  try {
    const payload = jwt.verify(token, config.jwtSecret) as any;
    req.adminId = payload.email;
    next();
  } catch {
    res.status(401).json({ error: "Token invàlid o expirat" });
  }
}
