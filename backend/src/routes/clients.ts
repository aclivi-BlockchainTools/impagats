import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { auditLog } from "../middleware/auditLog";
import { pick } from "../lib/validation";

const CLIENT_FIELDS = ["name", "nif", "phone", "whatsapp", "email", "externalRef", "active"];

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });
  res.json(clients);
});

router.get("/:id", async (req: Request, res: Response) => {
  const client = await prisma.client.findUnique({ where: { id: parseInt(req.params.id as string) } });
  if (!client) return res.status(404).json({ error: "Client no trobat" });
  res.json(client);
});

router.post("/", async (req: Request, res: Response) => {
  const client = await prisma.client.create({ data: pick(req.body, CLIENT_FIELDS) as any });
  await auditLog("CREATE", "Client", client.id, req.body);
  res.status(201).json(client);
});

router.put("/:id", async (req: Request, res: Response) => {
  const client = await prisma.client.update({
    where: { id: parseInt(req.params.id as string) },
    data: pick(req.body, CLIENT_FIELDS) as any,
  });
  await auditLog("UPDATE", "Client", client.id, req.body);
  res.json(client);
});

router.delete("/:id", async (req: Request, res: Response) => {
  await prisma.client.delete({ where: { id: parseInt(req.params.id as string) } });
  await auditLog("DELETE", "Client", parseInt(req.params.id as string));
  res.status(204).send();
});

export default router;
