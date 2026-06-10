import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { auditLog } from "../middleware/auditLog";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });
  res.json(clients);
});

router.get("/:id", async (req: Request, res: Response) => {
  const client = await prisma.client.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!client) return res.status(404).json({ error: "Client no trobat" });
  res.json(client);
});

router.post("/", async (req: Request, res: Response) => {
  const client = await prisma.client.create({ data: req.body });
  await auditLog("CREATE", "Client", client.id, req.body);
  res.status(201).json(client);
});

router.put("/:id", async (req: Request, res: Response) => {
  const client = await prisma.client.update({
    where: { id: parseInt(req.params.id) },
    data: req.body,
  });
  await auditLog("UPDATE", "Client", client.id, req.body);
  res.json(client);
});

router.delete("/:id", async (req: Request, res: Response) => {
  await prisma.client.delete({ where: { id: parseInt(req.params.id) } });
  await auditLog("DELETE", "Client", parseInt(req.params.id));
  res.status(204).send();
});

export default router;
