import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { auditLog } from "../middleware/auditLog";
import { openwa } from "../connectors/OpenWAConnector";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  const settings = await prisma.appSettings.findMany();
  const result: Record<string, string> = {};
  for (const s of settings) result[s.key] = s.value;
  res.json(result);
});

router.put("/", async (req: Request, res: Response) => {
  const updates = req.body as Record<string, string>;
  for (const [key, value] of Object.entries(updates)) {
    await prisma.appSettings.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
  await auditLog("UPDATE_SETTINGS", "AppSettings", undefined, updates);
  res.json({ ok: true });
});

router.post("/test-openwa", async (_req: Request, res: Response) => {
  const result = await openwa.testConnection();
  res.json(result);
});

router.post("/register-webhook", async (req: Request, res: Response) => {
  const { appUrl } = req.body;
  if (!appUrl) {
    return res.status(400).json({ ok: false, error: "appUrl és requerida" });
  }
  const result = await openwa.registerWebhook(appUrl);
  if (result.ok) {
    await auditLog("REGISTER_WEBHOOK", "AppSettings", undefined, { appUrl });
  }
  res.json(result);
});

router.get("/webhooks", async (_req: Request, res: Response) => {
  const result = await openwa.getWebhooks();
  res.json(result);
});

export default router;
