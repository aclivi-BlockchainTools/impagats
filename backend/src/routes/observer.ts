import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { llmObserver } from "../services/llmObserverService";
import { logger } from "../lib/logger";

const router = Router();

// GET /api/observer/suggestions — llistat paginat
router.get("/suggestions", asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const status = req.query.status as string | undefined;
  const risk = req.query.risk as string | undefined;
  const type = req.query.type as string | undefined;

  const where: any = {};
  if (status) where.status = status;
  if (risk) where.risk = risk;
  if (type) where.analysisType = type;

  const [data, total] = await Promise.all([
    prisma.agentLearningSuggestion.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.agentLearningSuggestion.count({ where }),
  ]);

  res.json({ data, total, page, limit });
}));

// GET /api/observer/suggestions/:id — detall
router.get("/suggestions/:id", asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const suggestion = await prisma.agentLearningSuggestion.findUnique({ where: { id } });
  if (!suggestion) return res.status(404).json({ error: "Suggeriment no trobat" });
  res.json(suggestion);
}));

// PUT /api/observer/suggestions/:id — aprovar/rebutjar
router.put("/suggestions/:id", asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const { action } = req.body;

  if (!["APPROVED", "REJECTED"].includes(action)) {
    return res.status(400).json({ error: "Acció invàlida. Usa: APPROVED o REJECTED" });
  }

  const suggestion = await prisma.agentLearningSuggestion.findUnique({ where: { id } });
  if (!suggestion) return res.status(404).json({ error: "Suggeriment no trobat" });

  const updated = await prisma.agentLearningSuggestion.update({
    where: { id },
    data: {
      status: action,
      reviewedAt: new Date(),
    },
  });

  logger.info({ id, action }, "Suggeriment actualitzat");
  res.json(updated);
}));

// POST /api/observer/suggestions/:id/apply — aplicar suggeriment
router.post("/suggestions/:id/apply", asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const suggestion = await prisma.agentLearningSuggestion.findUnique({ where: { id } });
  if (!suggestion) return res.status(404).json({ error: "Suggeriment no trobat" });

  const results: string[] = [];

  // 1. Crear AgentKeywordRule si hi ha paraules clau suggerides
  if (suggestion.suggestedKeywords && Array.isArray(suggestion.suggestedKeywords)) {
    for (const kw of suggestion.suggestedKeywords as string[]) {
      if (kw && kw.trim()) {
        await prisma.agentKeywordRule.create({
          data: {
            intent: suggestion.suggestedIntent || undefined,
            pattern: kw.trim(),
            type: "KEYWORD",
            source: "LLM",
            active: true,
          },
        });
        results.push(`KeywordRule creada: "${kw.trim()}"`);
      }
    }
  }

  // 2. Si hi ha suggestedReply i suggestedIntent, crear/actualitzar plantilla
  if (suggestion.suggestedReply && suggestion.suggestedIntent) {
    const templateKey = `template_${suggestion.suggestedIntent.toLowerCase()}`;
    await prisma.appSettings.upsert({
      where: { key: templateKey },
      update: { value: suggestion.suggestedReply },
      create: { key: templateKey, value: suggestion.suggestedReply },
    });
    results.push(`Plantilla ${templateKey} actualitzada`);
  }

  // 3. Marcar com APPLIED
  await prisma.agentLearningSuggestion.update({
    where: { id },
    data: { status: "APPLIED", reviewedAt: new Date() },
  });

  logger.info({ id, results }, "Suggeriment aplicat");
  res.json({ ok: true, results });
}));

// GET /api/observer/summary — resum periòdic
router.get("/summary", asyncHandler(async (req: Request, res: Response) => {
  const from = req.query.from as string || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
  const to = req.query.to as string || new Date().toISOString().substring(0, 10);

  const fromDate = new Date(from);
  const toDate = new Date(to + "T23:59:59.999Z");

  const [totalSuggestions, pendingCount, approvedCount, rejectedCount, appliedCount] = await Promise.all([
    prisma.agentLearningSuggestion.count({ where: { createdAt: { gte: fromDate, lte: toDate } } }),
    prisma.agentLearningSuggestion.count({ where: { createdAt: { gte: fromDate, lte: toDate }, status: "PENDING" } }),
    prisma.agentLearningSuggestion.count({ where: { createdAt: { gte: fromDate, lte: toDate }, status: "APPROVED" } }),
    prisma.agentLearningSuggestion.count({ where: { createdAt: { gte: fromDate, lte: toDate }, status: "REJECTED" } }),
    prisma.agentLearningSuggestion.count({ where: { createdAt: { gte: fromDate, lte: toDate }, status: "APPLIED" } }),
  ]);

  const topUnknown = await prisma.agentLearningSuggestion.findMany({
    where: { createdAt: { gte: fromDate, lte: toDate }, analysisType: "message_classification", currentIntent: "unknown" },
    select: { anonymizedText: true, suggestedIntent: true, confidence: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const topCorrectedIntents = await prisma.agentLearningSuggestion.groupBy({
    by: ["currentIntent"],
    where: { createdAt: { gte: fromDate, lte: toDate }, status: { in: ["APPROVED", "APPLIED"] } },
    _count: { currentIntent: true },
    orderBy: { _count: { currentIntent: "desc" } },
    take: 5,
  });

  const highRiskCount = await prisma.agentLearningSuggestion.count({
    where: { createdAt: { gte: fromDate, lte: toDate }, risk: "high" },
  });

  const keywords = await prisma.agentKeywordRule.count({ where: { source: "LLM", active: true } });

  res.json({
    period: { from, to },
    suggestions: {
      total: totalSuggestions,
      pending: pendingCount,
      approved: approvedCount,
      rejected: rejectedCount,
      applied: appliedCount,
    },
    topUnknown,
    topCorrectedIntents: topCorrectedIntents.map((c) => ({ intent: c.currentIntent, count: c._count.currentIntent })),
    highRiskCount,
    llmKeywordsCount: keywords,
  });
}));

// POST /api/observer/audit — generar auditoria N3
router.post("/audit", asyncHandler(async (req: Request, res: Response) => {
  const from = req.body.from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
  const to = req.body.to || new Date().toISOString().substring(0, 10);

  const result = await llmObserver.auditAgent({ from, to });
  res.json({ ok: true, result });
}));

// GET /api/observer/keywords — llistar regles
router.get("/keywords", asyncHandler(async (_req: Request, res: Response) => {
  const rules = await prisma.agentKeywordRule.findMany({
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
  res.json(rules);
}));

// POST /api/observer/keywords — crear regla
router.post("/keywords", asyncHandler(async (req: Request, res: Response) => {
  const { intent, pattern, type, language, priority } = req.body;
  if (!pattern) return res.status(400).json({ error: "pattern és requerit" });

  const rule = await prisma.agentKeywordRule.create({
    data: {
      intent: intent || undefined,
      pattern,
      type: type || "KEYWORD",
      language: language || undefined,
      priority: priority || 0,
      source: "MANUAL",
    },
  });
  res.status(201).json(rule);
}));

// PUT /api/observer/keywords/:id — editar
router.put("/keywords/:id", asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const { intent, pattern, active, priority, type, language } = req.body;

  const existing = await prisma.agentKeywordRule.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Regla no trobada" });

  const data: any = {};
  if (intent !== undefined) data.intent = intent;
  if (pattern !== undefined) data.pattern = pattern;
  if (active !== undefined) data.active = active;
  if (priority !== undefined) data.priority = priority;
  if (type !== undefined) data.type = type;
  if (language !== undefined) data.language = language;

  const updated = await prisma.agentKeywordRule.update({ where: { id }, data });
  res.json(updated);
}));

// DELETE /api/observer/keywords/:id — esborrar
router.delete("/keywords/:id", asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  await prisma.agentKeywordRule.delete({ where: { id } });
  res.status(204).send();
}));

// POST /api/observer/test — test de connexió
router.post("/test", asyncHandler(async (req: Request, res: Response) => {
  if (!llmObserver.isEnabled()) {
    return res.json({ ok: false, error: "LLM Observer desactivat" });
  }
  try {
    await llmObserver.classifyMessage({
      text: "Hola, he pagat la factura",
      currentIntent: "unknown",
      currentStatus: "NOTIFICAT",
      hasProof: false,
      hasReconciliation: false,
      lastMessages: [],
      probableLanguage: "ca",
      receiptId: 0,
      clientId: 0,
      messageId: 0,
    });
    res.json({ ok: true, message: "Connexió OK — suggeriment creat" });
  } catch (err: any) {
    res.json({ ok: false, error: err.message });
  }
}));

export default router;
