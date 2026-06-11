import { Router, Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { auditLog } from "../middleware/auditLog";
import { asyncHandler } from "../middleware/errorHandler";
import { validate, createClientSchema, updateClientSchema } from "../lib/validation";

const router = Router();

router.get("/", asyncHandler(async (_req: Request, res: Response) => {
  const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });
  res.json(clients);
}));

router.get("/:id", asyncHandler(async (req: Request, res: Response) => {
  const client = await prisma.client.findUnique({ where: { id: parseInt(req.params.id as string) } });
  if (!client) return res.status(404).json({ error: "Client no trobat" });
  res.json(client);
}));

router.post("/", asyncHandler(async (req: Request, res: Response) => {
  const v = validate(createClientSchema, req.body);
  if (!v.success) return res.status(400).json({ error: v.error });
  const client = await prisma.client.create({ data: v.data });
  await auditLog("CREATE", "Client", client.id, req.body);
  res.status(201).json(client);
}));

router.put("/:id", asyncHandler(async (req: Request, res: Response) => {
  const v = validate(updateClientSchema, req.body);
  if (!v.success) return res.status(400).json({ error: v.error });
  const client = await prisma.client.update({
    where: { id: parseInt(req.params.id as string) },
    data: v.data,
  });
  await auditLog("UPDATE", "Client", client.id, req.body);
  res.json(client);
}));

router.delete("/:id", asyncHandler(async (req: Request, res: Response) => {
  await prisma.client.delete({ where: { id: parseInt(req.params.id as string) } });
  await auditLog("DELETE", "Client", parseInt(req.params.id as string));
  res.status(204).send();
}));

export default router;
