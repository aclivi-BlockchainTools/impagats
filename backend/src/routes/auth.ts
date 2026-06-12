import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { generateToken, authMiddleware, AuthRequest } from "../middleware/auth";
import { config } from "../lib/config";
import { asyncHandler } from "../middleware/errorHandler";

const router = Router();

// POST /api/auth/login
router.post("/login", asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email i contrasenya requerits" });
  }

  if (!config.adminEmail || !config.adminPasswordHash) {
    return res.status(500).json({ error: "Auth no configurada al servidor" });
  }

  if (email !== config.adminEmail) {
    return res.status(401).json({ error: "Credencials invàlides" });
  }

  const valid = await bcrypt.compare(password, config.adminPasswordHash);
  if (!valid) {
    return res.status(401).json({ error: "Credencials invàlides" });
  }

  const token = generateToken(email);
  res.json({ token, email });
}));

// GET /api/auth/me — verificar token
router.get("/me", authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
  res.json({ email: req.adminId, authenticated: true });
}));

export default router;
