import { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  logger.error({ err }, "Unhandled error");
  const isDev = process.env.NODE_ENV !== "production";
  res.status(500).json({
    error: isDev ? err.message || "Error intern" : "Error intern del servidor",
  });
}
