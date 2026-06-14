// Servei LLM Observer: 3 nivells d'observació
// N1: Classificació alternativa de missatges individuals
// N2: Revisió de conversa completa
// N3: Auditoria periòdica de l'agent
//
// La LLM MAI envia missatges, MAI modifica regles automàticament.
// Sempre rep dades anonimitzades.

import prisma from "../lib/prisma";
import { anonymizeText, anonymizeConversation } from "../lib/anonymizer";
import { createLLMProvider, LLMProviderType } from "./llmProviders";
import { logger } from "../lib/logger";
import * as crypto from "crypto";

interface ObserverSettings {
  enabled: boolean;
  provider: LLMProviderType;
  model: string;
  confidenceThreshold: number;
  storeAnonymized: boolean;
  strictPrivacy: boolean;
}

// --- Entrada N1 ---
export interface ClassifyMessageInput {
  text: string;
  currentIntent: string;
  currentStatus: string;
  pendingAmount?: string;
  pendingPeriods?: string[];
  hasProof: boolean;
  hasReconciliation: boolean;
  lastMessages: string[];
  probableLanguage: "ca" | "es" | "unknown";
  receiptId: number;
  clientId: number;
  messageId: number;
}

// --- Entrada N2 ---
export interface ReviewConversationInput {
  receiptId: number;
  clientId: number;
  messages: Array<{ direction: string; content: string | null }>;
  pendingAmount?: string;
  pendingPeriods?: string[];
  hasProof: boolean;
  hasReconciliation: boolean;
  status: string;
  messageCount: number;
  durationDays: number;
}

// --- Sortida N1 ---
interface MessageSuggestion {
  intent: string;
  confidence: number;
  needsReview: boolean;
  suggestedReply: string;
  suggestedKeywords: string[];
  suggestedStateChange: string | null;
  risk: "low" | "medium" | "high";
  reason: string;
}

// --- Sortida N2 ---
interface ConversationReview {
  analysisType: string;
  summary: string;
  conversationQuality: string;
  agentEffectiveness: number;
  issues: Array<{ type: string; description: string; messages?: number[]; suggestedIntent?: string }>;
  suggestedImprovements: string[];
  risk: string;
  needsReview: boolean;
}

// --- Sortida N3 ---
interface AgentAudit {
  analysisType: string;
  period: string;
  stats: Record<string, number>;
  topIssues: string[];
  suggestedNewIntents: Array<{ name: string; keywords: string[]; suggestedReply: string }>;
  templatesToImprove: Array<{ intent: string; issue: string; suggestion: string }>;
}

const N1_SYSTEM_PROMPT = `Ets un assistent d'anàlisi de missatges de WhatsApp per a una app de gestió d'impagats bancaris.

El teu objectiu és classificar missatges entrants de clients i suggerir millores, però MAI respondre directament al client.

Rebràs un missatge anonimitzat (sense dades personals) i el context del cas.

Has de retornar EXCLUSIVAMENT un JSON vàlid amb aquesta estructura:
{
  "intent": "PAYMENT_PROMISE | PAYMENT_DECLARED | PROOF_SENT | DEBT_QUESTION | COMPLAINT_OR_DISPUTE | WRONG_PERSON | OPT_OUT_WHATSAPP | GREETING | HUMAN_REVIEW_REQUIRED | UNKNOWN",
  "confidence": 0.0,
  "needsReview": true/false,
  "suggestedReply": "resposta suggerida en català",
  "suggestedKeywords": ["paraula1", "paraula2"],
  "suggestedStateChange": null,
  "risk": "low|medium|high",
  "reason": "explicació breu de la classificació"
}

Guia d'intents:
- PAYMENT_PROMISE: el client diu que pagarà en una data futura concreta
- PAYMENT_DECLARED: el client diu que JA ha pagat
- PROOF_SENT: el client envia un justificant de pagament
- DEBT_QUESTION: el client pregunta sobre imports, factures o el deute
- COMPLAINT_OR_DISPUTE: el client es queixa o disputa el deute
- WRONG_PERSON: el client diu que no és la persona correcta
- OPT_OUT_WHATSAPP: el client demana no rebre més missatges
- GREETING: salutació simple
- HUMAN_REVIEW_REQUIRED: el missatge requereix atenció humana urgent
- UNKNOWN: no es pot classificar amb confiança

Risc:
- low: missatge rutinari, ben classificat
- medium: possible malentès o ambigüitat
- high: possible conflicte, queixa greu, o risc legal

La suggestedReply HA DE SER en català, professional i útil.
NOMÉS JSON, sense text addicional.`;

const N2_SYSTEM_PROMPT = `Ets un assistent d'anàlisi de converses de WhatsApp per a una app de gestió d'impagats bancaris.

Analitza la conversa completa entre un agent automàtic i un client. Detecta problemes, errors de classificació, respostes inadequades, i suggereix millores.

Retorna EXCLUSIVAMENT JSON:
{
  "analysisType": "conversation_review",
  "summary": "resum de la conversa en català (2-3 frases)",
  "conversationQuality": "excellent|good|fair|poor",
  "agentEffectiveness": 0.0,
  "issues": [
    {"type": "repetitive_response|missed_intent|wrong_intent|inadequate_reply|escalation_needed", "description": "...", "messages": [1,2,3], "suggestedIntent": "..."}
  ],
  "suggestedImprovements": ["millora 1", "millora 2"],
  "risk": "low|medium|high",
  "needsReview": true/false
}

NOMÉS JSON.`;

const N3_SYSTEM_PROMPT = `Ets un assistent d'auditoria per a una app de gestió d'impagats bancaris amb agent WhatsApp automàtic.

Analitza les estadístiques d'un període i suggereix millores concretes.

Retorna EXCLUSIVAMENT JSON:
{
  "analysisType": "agent_audit",
  "period": "YYYY-MM-DD..YYYY-MM-DD",
  "stats": {},
  "topIssues": ["problema 1", "problema 2"],
  "suggestedNewIntents": [
    {"name": "NOM_INTENT", "keywords": ["paraula1"], "suggestedReply": "resposta suggerida"}
  ],
  "templatesToImprove": [
    {"intent": "NOM_INTENT", "issue": "problema", "suggestion": "millora"}
  ]
}

NOMÉS JSON.`;

export class LLMObserverService {
  private enabled = false;
  private settings: ObserverSettings = {
    enabled: false,
    provider: "deepseek",
    model: "deepseek-v4-pro",
    confidenceThreshold: 0.7,
    storeAnonymized: true,
    strictPrivacy: false,
  };

  async loadConfig(): Promise<void> {
    const rows = await prisma.appSettings.findMany({
      where: { key: { startsWith: "observer." } },
    });
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;

    this.settings = {
      enabled: map["observer.enabled"] === "true",
      provider: (map["observer.provider"] as LLMProviderType) || "deepseek",
      model: map["observer.model"] || "deepseek-v4-pro",
      confidenceThreshold: parseFloat(map["observer.confidence_threshold"] || "0.7"),
      storeAnonymized: map["observer.store_anonymized"] !== "false",
      strictPrivacy: map["observer.strict_privacy"] === "true",
    };
    this.enabled = this.settings.enabled;
    logger.info({ enabled: this.enabled, provider: this.settings.provider }, "LLM Observer config carregada");
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private getApiKey(): string {
    switch (this.settings.provider) {
      case "openai": return process.env.OPENAI_API_KEY || "";
      case "anthropic": return process.env.ANTHROPIC_API_KEY || "";
      case "deepseek": return process.env.DEEPSEEK_API_KEY || "";
      default: return "";
    }
  }

  private async saveSuggestion(data: {
    messageId?: number;
    clientId?: number;
    receiptId?: number;
    originalTextHash?: string;
    anonymizedText?: string;
    analysisType: string;
    currentIntent?: string;
    suggestedIntent?: string;
    confidence?: number;
    suggestedReply?: string;
    suggestedKeywords?: string[];
    suggestedStateChange?: string | null;
    conversationQuality?: string;
    agentEffectiveness?: number;
    issues?: any[];
    suggestedImprovements?: string[];
    risk?: string;
    reason?: string;
    provider: string;
    model: string;
  }): Promise<void> {
    await prisma.agentLearningSuggestion.create({
      data: {
        messageId: data.messageId,
        clientId: data.clientId,
        receiptId: data.receiptId,
        originalTextHash: data.originalTextHash,
        anonymizedText: this.settings.storeAnonymized ? data.anonymizedText : null,
        analysisType: data.analysisType,
        currentIntent: data.currentIntent,
        suggestedIntent: data.suggestedIntent,
        confidence: data.confidence,
        suggestedReply: data.suggestedReply,
        suggestedKeywords: data.suggestedKeywords,
        suggestedStateChange: data.suggestedStateChange,
        conversationQuality: data.conversationQuality,
        agentEffectiveness: data.agentEffectiveness,
        issues: data.issues,
        suggestedImprovements: data.suggestedImprovements,
        risk: data.risk,
        reason: data.reason,
        status: "PENDING",
        provider: data.provider,
        model: data.model,
      },
    });
  }

  // --- Nivell 1: Classificació de missatge individual ---
  async classifyMessage(input: ClassifyMessageInput): Promise<void> {
    if (!this.enabled) return;

    const apiKey = this.getApiKey();
    if (!apiKey && this.settings.provider !== "deepseek") {
      logger.warn("LLM Observer: API key no configurada per " + this.settings.provider);
      return;
    }

    try {
      const llm = createLLMProvider({
        provider: this.settings.provider,
        model: this.settings.model,
        apiKey,
      });

      const anonymizedBody = anonymizeText(input.text);
      const anonLastMessages = input.lastMessages.map((m) => anonymizeText(m));

      const userPrompt = JSON.stringify({
        message: anonymizedBody,
        context: {
          currentIntent: input.currentIntent,
          currentStatus: input.currentStatus,
          pendingAmount: input.pendingAmount,
          pendingPeriods: input.pendingPeriods,
          hasProof: input.hasProof,
          hasReconciliation: input.hasReconciliation,
          probableLanguage: input.probableLanguage,
          lastMessages: anonLastMessages,
        },
      });

      const response = await llm.chat([
        { role: "system", content: N1_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ]);

      const parsed = JSON.parse(response) as MessageSuggestion;

      const originalHash = this.settings.strictPrivacy
        ? undefined
        : crypto.createHash("sha256").update(input.text).digest("hex").substring(0, 16);

      await this.saveSuggestion({
        messageId: input.messageId,
        clientId: input.clientId,
        receiptId: input.receiptId,
        originalTextHash: originalHash,
        anonymizedText: userPrompt,
        analysisType: "message_classification",
        currentIntent: input.currentIntent,
        suggestedIntent: parsed.intent,
        confidence: parsed.confidence,
        suggestedReply: parsed.suggestedReply,
        suggestedKeywords: parsed.suggestedKeywords,
        suggestedStateChange: parsed.suggestedStateChange,
        risk: parsed.risk,
        reason: parsed.reason,
        provider: this.settings.provider,
        model: this.settings.model,
      });

      // Si needsReview, afegir nota al cas
      if (parsed.needsReview) {
        const receipt = await prisma.returnedReceipt.findUnique({
          where: { id: input.receiptId },
          select: { notes: true },
        });
        const note = "[Revisió LLM suggerida: veure Aprenentatge agent]";
        const currentNotes = receipt?.notes || "";
        if (!currentNotes.includes(note)) {
          await prisma.returnedReceipt.update({
            where: { id: input.receiptId },
            data: { notes: currentNotes ? `${currentNotes} ${note}` : note },
          });
        }
      }

      logger.info({
        receiptId: input.receiptId,
        suggestedIntent: parsed.intent,
        confidence: parsed.confidence,
        risk: parsed.risk,
      }, "LLM Observer N1: missatge classificat");
    } catch (err: any) {
      logger.error({ err: err.message, receiptId: input.receiptId }, "LLM Observer N1 error");
    }
  }

  // --- Nivell 2: Revisió de conversa completa ---
  async reviewConversation(input: ReviewConversationInput): Promise<void> {
    if (!this.enabled) return;

    const apiKey = this.getApiKey();
    if (!apiKey && this.settings.provider !== "deepseek") return;

    try {
      const llm = createLLMProvider({
        provider: this.settings.provider,
        model: this.settings.model,
        apiKey,
      });

      const conversation = anonymizeConversation(input.messages, {
        pendingAmount: input.pendingAmount,
        pendingPeriods: input.pendingPeriods,
        hasProof: input.hasProof,
        hasReconciliation: input.hasReconciliation,
        status: input.status,
        messageCount: input.messageCount,
        durationDays: input.durationDays,
      });

      const response = await llm.chat([
        { role: "system", content: N2_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(conversation) },
      ]);

      const parsed = JSON.parse(response) as ConversationReview;

      await this.saveSuggestion({
        receiptId: input.receiptId,
        clientId: input.clientId,
        anonymizedText: this.settings.storeAnonymized ? JSON.stringify(conversation) : undefined,
        analysisType: "conversation_review",
        conversationQuality: parsed.conversationQuality,
        agentEffectiveness: parsed.agentEffectiveness,
        issues: parsed.issues,
        suggestedImprovements: parsed.suggestedImprovements,
        risk: parsed.risk,
        reason: parsed.summary,
        provider: this.settings.provider,
        model: this.settings.model,
      });

      if (parsed.needsReview) {
        const receipt = await prisma.returnedReceipt.findUnique({
          where: { id: input.receiptId },
          select: { notes: true },
        });
        const note = "[Revisió conversa LLM: veure Aprenentatge agent]";
        const currentNotes = receipt?.notes || "";
        if (!currentNotes.includes(note)) {
          await prisma.returnedReceipt.update({
            where: { id: input.receiptId },
            data: { notes: currentNotes ? `${currentNotes} ${note}` : note },
          });
        }
      }

      logger.info({ receiptId: input.receiptId, quality: parsed.conversationQuality }, "LLM Observer N2: conversa revisada");
    } catch (err: any) {
      logger.error({ err: err.message, receiptId: input.receiptId }, "LLM Observer N2 error");
    }
  }

  // --- Nivell 3: Auditoria periòdica ---
  async auditAgent(input: {
    from: string;
    to: string;
  }): Promise<any | null> {
    if (!this.enabled) return null;

    const apiKey = this.getApiKey();
    if (!apiKey && this.settings.provider !== "deepseek") return null;

    try {
      const llm = createLLMProvider({
        provider: this.settings.provider,
        model: this.settings.model,
        apiKey,
      });

      // Recollir estadístiques reals de la BD
      const fromDate = new Date(input.from);
      const toDate = new Date(input.to + "T23:59:59.999Z");

      const [totalMessages, unknownCount] = await Promise.all([
        prisma.message.count({
          where: { sentAt: { gte: fromDate, lte: toDate }, direction: "INBOUND" },
        }),
        prisma.message.count({
          where: {
            sentAt: { gte: fromDate, lte: toDate },
            direction: "INBOUND",
            agentIntent: "unknown",
          },
        }),
      ]);

      // Top missatges unknown (mostra dels últims)
      const topUnknown = await prisma.message.findMany({
        where: {
          sentAt: { gte: fromDate, lte: toDate },
          direction: "INBOUND",
          agentIntent: "unknown",
        },
        select: { content: true },
        take: 10,
        orderBy: { sentAt: "desc" },
      });

      // Top intents amb suggeriments aprovats/rebutjats
      const topCorrectedIntents = await prisma.agentLearningSuggestion.groupBy({
        by: ["currentIntent"],
        where: {
          createdAt: { gte: fromDate, lte: toDate },
          analysisType: "message_classification",
          status: { in: ["APPROVED", "APPLIED"] },
        },
        _count: { currentIntent: true },
        orderBy: { _count: { currentIntent: "desc" } },
        take: 5,
      });

      const stats = {
        totalMessages,
        unknownRate: totalMessages > 0 ? unknownCount / totalMessages : 0,
        humanReviewRate: 0,
        avgResolutionDays: 0,
        blockRate: 0,
      };

      const userPrompt = JSON.stringify({
        period: `${input.from}..${input.to}`,
        stats,
        topUnknown: topUnknown.map((m) => anonymizeText(m.content || "")),
        topCorrectedIntents: topCorrectedIntents.map((c) => c.currentIntent),
      });

      const response = await llm.chat([
        { role: "system", content: N3_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ]);

      const parsed = JSON.parse(response) as AgentAudit;

      await this.saveSuggestion({
        anonymizedText: this.settings.storeAnonymized ? userPrompt : undefined,
        analysisType: "agent_audit",
        issues: parsed.topIssues?.map((i: string) => ({ type: "audit_finding", description: i })),
        suggestedImprovements: [
          ...(parsed.suggestedNewIntents || []).map((ni: any) => `Nou intent: ${ni.name}`),
          ...(parsed.templatesToImprove || []).map((ti: any) => `Millorar plantilla ${ti.intent}: ${ti.suggestion}`),
        ],
        risk: "medium",
        reason: parsed.topIssues?.join("; "),
        provider: this.settings.provider,
        model: this.settings.model,
      });

      logger.info("LLM Observer N3: auditoria generada");
      return parsed;
    } catch (err: any) {
      logger.error({ err: err.message }, "LLM Observer N3 error");
      return null;
    }
  }
}

// Singleton
export const llmObserver = new LLMObserverService();
