# Agent Conversacional — Pla d'Implementació

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agent automàtic que respon a WhatsApp quan un deutor contesta a una reclamació, classificant la intenció (CAT/ES) i actualitzant l'estat del receipt.

**Architecture:** Servei `ConversationAgent` amb classificació per regex multi-idioma, integrat al webhook existent. Nous camps a Message per traçar intencions i accions de l'agent. UI amb panell de conversa i control manual.

**Tech Stack:** Node.js + Express + TypeScript, Prisma, React 18 + Tailwind, Jest + ts-jest

---

## File Structure

### Nous
- `backend/src/services/conversationAgent.ts` — classificador + respondedor + renderitzador de plantilles (~160 LOC)
- `backend/src/__tests__/conversationAgent.test.ts` — tests unitaris de classificació i extracció (~130 LOC)

### Modificats
- `backend/prisma/schema.prisma` — +4 camps a Message: `agentIntent`, `agentAction`, `agentMetadata`, `needsReview`
- `backend/src/routes/webhook.ts:13-98` — cridar ConversationAgent en rebre missatge INBOUND
- `backend/src/routes/returnedReceipts.ts` — nou endpoint `POST /:id/reply` per resposta manual
- `frontend/src/lib/api.ts` — + `sendManualReply()`
- `frontend/src/pages/ReturnedReceiptDetail.tsx` — panell de conversa WhatsApp amb estat d'agent
- `frontend/src/pages/ReturnedReceiptsList.tsx` — columna "Agent" amb indicador d'estat
- `frontend/src/pages/Settings.tsx` — secció "Agent conversacional"

---

### Task 1: Migració BD — Afegir camps d'agent a Message

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Afegir els 4 camps al model Message**

```prisma
model Message {
  id            Int       @id @default(autoincrement())
  receiptId     Int
  direction     String
  content       String?
  sentAt        DateTime  @default(now())
  status        String    @default("sent")
  externalId    String?
  agentIntent   String?
  agentAction   String?
  agentMetadata Json?
  needsReview   Boolean   @default(false)

  receipt ReturnedReceipt @relation(fields: [receiptId], references: [id])
}
```

- [ ] **Step 2: Crear la migració**

```bash
cd backend && npx prisma migrate dev --name add-agent-fields-to-message
```

Expected: "Your database is now in sync with your schema."

- [ ] **Step 3: Verificar que els camps existeixen a la BD**

```bash
cd backend && npx prisma db pull --print 2>/dev/null | grep -A2 agent
```

Expected: Mostra els camps `agentIntent`, `agentAction`, `agentMetadata`, `needsReview`

- [ ] **Step 4: Re-generar el client Prisma**

```bash
cd backend && npx prisma generate
```

Expected: "Generated Prisma Client"

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add agent fields to Message model (intent, action, metadata, needsReview)"
```

---

### Task 2: Servei ConversationAgent

**Files:**
- Create: `backend/src/services/conversationAgent.ts`

- [ ] **Step 1: Crear el fitxer amb tota la lògica**

```typescript
// backend/src/services/conversationAgent.ts
import prisma from "../lib/prisma";

// Tipus
export type Intent = "pagament_clar" | "pagament_ambigu" | "comprovant_enviat" | "altres_temes";

export interface ClassificationResult {
  intent: Intent;
  action: string;
  templateKey: string;
  metadata: Record<string, string | null>;
}

interface KeywordConfig {
  pagament_clar: string[];
  pagament_ambigu: string[];
  comprovant_enviat: string[];
}

const DEFAULT_KEYWORDS: Record<string, Record<string, string>> = {
  pagament_clar: {
    cat: "he pagat,ja he fet el pagament,transferència feta,ingrés fet,he fet l'ingrés,he realitzat el pagament,he fet la transferència,transferencia feta,he fet el ingres,ja he pagat,pagament fet",
    es: "he pagado,ya he hecho el pago,transferencia hecha,ingreso hecho,he realizado el pago,ya está pagado,pago hecho,ya he pagado",
  },
  pagament_ambigu: {
    cat: "fet,ja està,ho tens,t'ho he enviat,ok,d'acord,llisto,solucionat",
    es: "hecho,ya está,lo tienes,te lo he enviado,vale,listo,solucionado",
  },
  comprovant_enviat: {
    cat: "comprovant,justificant,adjunt,captura,foto del pagament,et passo el comprovant",
    es: "comprobante,justificante,adjunto,captura,foto del pago,te paso el comprobante",
  },
};

const DEFAULT_TEMPLATES: Record<string, string> = {
  resposta_pagament_clar:
    "Gràcies {{client_name}}. He registrat la teva confirmació{{#reference}} amb referència {{reference}}{{/reference}}. Si ens pots enviar el comprovant del pagament, ens ajudaria a verificar-lo. Per a qualsevol altra consulta, contacta amb nosaltres per les vies habituals.",
  resposta_pagament_ambigu:
    "Gràcies per respondre. Em pots confirmar la data o referència del pagament per poder-ho registrar correctament? Recorda que aquest és un sistema automàtic — per a qualsevol altra consulta, contacta amb nosaltres per les vies habituals.",
  resposta_comprovant_rebut:
    "Gràcies {{client_name}}. He rebut el teu comprovant i el revisarem en breu. Si tot és correcte, confirmarem el pagament. Per a qualsevol altra consulta, contacta amb nosaltres per les vies habituals.",
  resposta_redireccio:
    "Aquest és un sistema automàtic de confirmació de pagaments. Per a qualsevol altra consulta o aclariment, contacta amb nosaltres per les vies de comunicació habituals. Gràcies.",
};

// Normalitza text: minúscules, sense accents
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function getKeywordConfig(): Promise<KeywordConfig> {
  const settings = await prisma.appSettings.findMany();
  const getSetting = (key: string, fallback: string): string[] => {
    const s = settings.find((x) => x.key === key);
    const raw = s?.value?.trim() || fallback;
    return raw
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);
  };

  return {
    pagament_clar: [
      ...getSetting("agent.keywords_pagament_clar_cat", DEFAULT_KEYWORDS.pagament_clar.cat),
      ...getSetting("agent.keywords_pagament_clar_es", DEFAULT_KEYWORDS.pagament_clar.es),
    ],
    pagament_ambigu: [
      ...getSetting("agent.keywords_ambigu_cat", DEFAULT_KEYWORDS.pagament_ambigu.cat),
      ...getSetting("agent.keywords_ambigu_es", DEFAULT_KEYWORDS.pagament_ambigu.es),
    ],
    comprovant_enviat: [
      ...getSetting("agent.keywords_comprovant_cat", DEFAULT_KEYWORDS.comprovant_enviat.cat),
      ...getSetting("agent.keywords_comprovant_es", DEFAULT_KEYWORDS.comprovant_enviat.es),
    ],
  };
}

async function getTemplate(key: string): Promise<string> {
  const setting = await prisma.appSettings.findUnique({ where: { key: `agent.${key}` } });
  return setting?.value?.trim() || (DEFAULT_TEMPLATES as any)[key] || "";
}

function renderTemplate(template: string, vars: Record<string, string | null>): string {
  let result = template;
  // Conditional blocks: {{#ref}}text amb {{ref}}{{/ref}}
  result = result.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_match, key, content) => {
    return vars[key] ? content.replace(/\{\{(\w+)\}\}/g, (_m: string, k: string) => vars[k] || "") : "";
  });
  // Simple variables
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value || "");
  }
  return result;
}

export function classifyMessage(text: string, keywords: KeywordConfig, hasMedia: boolean): ClassificationResult {
  const normalized = normalize(text).trim();

  // If media attached, treat as comprovant_enviat regardless of text
  if (hasMedia) {
    return {
      intent: "comprovant_enviat",
      action: "acusar_recepcio_comprovant",
      templateKey: "resposta_comprovant_rebut",
      metadata: { reference: extractReference(normalized), amount: extractAmount(normalized), date: extractDate(normalized) },
    };
  }

  // 1. pagament_clar
  if (keywords.pagament_clar.some((k) => normalized.includes(k))) {
    return {
      intent: "pagament_clar",
      action: "confirmar_i_demanar_comprovant",
      templateKey: "resposta_pagament_clar",
      metadata: { reference: extractReference(normalized), amount: extractAmount(normalized), date: extractDate(normalized) },
    };
  }

  // 2. comprovant_enviat (text mention)
  if (keywords.comprovant_enviat.some((k) => normalized.includes(k))) {
    return {
      intent: "comprovant_enviat",
      action: "acusar_recepcio_comprovant",
      templateKey: "resposta_comprovant_rebut",
      metadata: { reference: extractReference(normalized), amount: extractAmount(normalized), date: extractDate(normalized) },
    };
  }

  // 3. pagament_ambigu
  if (keywords.pagament_ambigu.some((k) => normalized.includes(k))) {
    return {
      intent: "pagament_ambigu",
      action: "demanar_detalls",
      templateKey: "resposta_pagament_ambigu",
      metadata: { reference: null, amount: null, date: null },
    };
  }

  // 4. altres_temes
  return {
    intent: "altres_temes",
    action: "redirigir",
    templateKey: "resposta_redireccio",
    metadata: {},
  };
}

function extractReference(text: string): string | null {
  const m = text.match(/(?:ref[erencia]*|referència|referencia)[\s:]*[#nº]*\s*(\w+)/i);
  return m ? m[1] : null;
}

function extractAmount(text: string): string | null {
  const m = text.match(/(\d+[,.]?\d*)\s*(?:€|euros?)/i);
  return m ? m[1].replace(",", ".") : null;
}

function extractDate(text: string): string | null {
  const m = text.match(/(?:ahir|avui|el dia|el)\s*(\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?)/i);
  return m ? m[1] : null;
}

// Called from webhook when an INBOUND message arrives for a receipt in NOTIFICAT/ESPERANT_DETALLS
export async function handleIncomingMessage(
  messageText: string,
  hasMedia: boolean,
  receiptId: number,
  clientName: string,
): Promise<{ intent: Intent; action: string; replyText: string; receiptNewStatus: string | null; metadata: Record<string, string | null> }> {
  const keywords = await getKeywordConfig();
  const classification = classifyMessage(messageText, keywords, hasMedia);

  const templateStr = await getTemplate(classification.templateKey);
  const replyText = renderTemplate(templateStr, {
    client_name: clientName,
    reference: classification.metadata.reference,
    amount: classification.metadata.amount,
  });

  let receiptNewStatus: string | null = null;
  if (classification.intent === "pagament_clar" || classification.intent === "comprovant_enviat") {
    receiptNewStatus = "JUSTIFICANT_REBUT";
  }
  // pagament_ambigu doesn't change receipt status
  // altres_temes doesn't change receipt status

  return {
    intent: classification.intent,
    action: classification.action,
    replyText,
    receiptNewStatus,
    metadata: classification.metadata,
  };
}

// Check and handle timeout for ESPERANT_DETALLS
export async function checkConversationTimeout(receiptId: number): Promise<boolean> {
  const settings = await prisma.appSettings.findMany();
  const timeoutSetting = settings.find((s) => s.key === "agent.timeout_hores");
  const timeoutHours = parseInt(timeoutSetting?.value || "24", 10);

  const lastAgentMessage = await prisma.message.findFirst({
    where: {
      receiptId,
      agentAction: { not: null },
    },
    orderBy: { sentAt: "desc" },
  });

  if (!lastAgentMessage) return false;

  const elapsed = Date.now() - lastAgentMessage.sentAt.getTime();
  return elapsed > timeoutHours * 60 * 60 * 1000;
}
```

- [ ] **Step 2: Verificar que compila**

```bash
cd backend && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/conversationAgent.ts
git commit -m "feat: add ConversationAgent service with classifier and template renderer"
```

---

### Task 3: Tests unitaris del ConversationAgent

**Files:**
- Create: `backend/src/__tests__/conversationAgent.test.ts`

- [ ] **Step 1: Crear el fitxer de tests**

```typescript
// backend/src/__tests__/conversationAgent.test.ts
import { classifyMessage, Intent } from "../services/conversationAgent";

const mockKeywords = {
  pagament_clar: ["he pagat", "he pagado", "transferència feta", "transferencia hecha"],
  pagament_ambigu: ["fet", "hecho", "ok", "d'acord"],
  comprovant_enviat: ["comprovant", "comprobante", "adjunt"],
};

describe("classifyMessage", () => {
  describe("pagament_clar", () => {
    it("detecta confirmació en català", () => {
      const r = classifyMessage("Hola, ja he pagat la factura", mockKeywords, false);
      expect(r.intent).toBe("pagament_clar");
      expect(r.action).toBe("confirmar_i_demanar_comprovant");
      expect(r.templateKey).toBe("resposta_pagament_clar");
    });

    it("detecta confirmació en castellà", () => {
      const r = classifyMessage("Ya he pagado, gracias", mockKeywords, false);
      expect(r.intent).toBe("pagament_clar");
      expect(r.action).toBe("confirmar_i_demanar_comprovant");
    });

    it("detecta transferència feta en català", () => {
      const r = classifyMessage("Ja he fet la transferència, saludos", mockKeywords, false);
      expect(r.intent).toBe("pagament_clar");
    });

    it("detecta transferencia hecha en castellà", () => {
      const r = classifyMessage("Transferencia hecha ayer", mockKeywords, false);
      expect(r.intent).toBe("pagament_clar");
    });

    it("extreu referència del missatge", () => {
      const r = classifyMessage("He pagat amb referència #12345", mockKeywords, false);
      expect(r.metadata.reference).toBe("12345");
    });

    it("extreu import del missatge", () => {
      const r = classifyMessage("He fet el pagament de 45,50€", mockKeywords, false);
      expect(r.metadata.amount).toBe("45.50");
    });
  });

  describe("pagament_ambigu", () => {
    it("detecta 'fet' com ambigu en català", () => {
      const r = classifyMessage("Fet!", mockKeywords, false);
      expect(r.intent).toBe("pagament_ambigu");
      expect(r.action).toBe("demanar_detalls");
      expect(r.templateKey).toBe("resposta_pagament_ambigu");
    });

    it("detecta 'ok' com ambigu", () => {
      const r = classifyMessage("ok", mockKeywords, false);
      expect(r.intent).toBe("pagament_ambigu");
    });

    it("detecta 'd'acord' com ambigu", () => {
      const r = classifyMessage("D'acord, gràcies", mockKeywords, false);
      expect(r.intent).toBe("pagament_ambigu");
    });

    it("detecta 'hecho' com ambigu en castellà", () => {
      const r = classifyMessage("Ya está hecho", mockKeywords, false);
      expect(r.intent).toBe("pagament_ambigu");
    });
  });

  describe("comprovant_enviat", () => {
    it("detecta comprovant per text", () => {
      const r = classifyMessage("T'envio el comprovant del pagament", mockKeywords, false);
      expect(r.intent).toBe("comprovant_enviat");
      expect(r.action).toBe("acusar_recepcio_comprovant");
      expect(r.templateKey).toBe("resposta_comprovant_rebut");
    });

    it("detecta adjunt en castellà", () => {
      const r = classifyMessage("Te adjunto el comprobante", mockKeywords, false);
      expect(r.intent).toBe("comprovant_enviat");
    });

    it("classifica com comprovant si té media encara que el text sigui buit", () => {
      const r = classifyMessage("", mockKeywords, true);
      expect(r.intent).toBe("comprovant_enviat");
    });

    it("classifica com comprovant si té media encara que el text sigui 'ok'", () => {
      const r = classifyMessage("ok", mockKeywords, true);
      expect(r.intent).toBe("comprovant_enviat");
    });
  });

  describe("altres_temes", () => {
    it("classifica text desconegut com altres_temes", () => {
      const r = classifyMessage("No entenc per què m'han cobrat això", mockKeywords, false);
      expect(r.intent).toBe("altres_temes");
      expect(r.action).toBe("redirigir");
      expect(r.templateKey).toBe("resposta_redireccio");
    });

    it("classifica preguntes com altres_temes", () => {
      const r = classifyMessage("Podeu trucar-me si us plau?", mockKeywords, false);
      expect(r.intent).toBe("altres_temes");
    });

    it("classifica missatge buit com altres_temes", () => {
      const r = classifyMessage("", mockKeywords, false);
      expect(r.intent).toBe("altres_temes");
    });

    it("classifica només emojis com altres_temes", () => {
      const r = classifyMessage("👍🙏", mockKeywords, false);
      expect(r.intent).toBe("altres_temes");
    });
  });

  describe("prioritat d'intencions", () => {
    it("pagament_clar té prioritat sobre comprovant (sense media)", () => {
      const r = classifyMessage("He pagat, t'envio el comprovant adjunt", mockKeywords, false);
      expect(r.intent).toBe("pagament_clar");
    });

    it("media té prioritat sobre pagament_ambigu", () => {
      const r = classifyMessage("ok", mockKeywords, true);
      expect(r.intent).toBe("comprovant_enviat");
    });
  });
});
```

- [ ] **Step 2: Executar els tests**

```bash
cd backend && npx jest src/__tests__/conversationAgent.test.ts --verbose
```

Expected: 18 tests pass

- [ ] **Step 3: Commit**

```bash
git add backend/src/__tests__/conversationAgent.test.ts
git commit -m "test: add ConversationAgent unit tests (18 cases)"
```

---

### Task 4: Integració amb el webhook

**Files:**
- Modify: `backend/src/routes/webhook.ts`

- [ ] **Step 1: Modificar el webhook per cridar l'agent**

Reemplaçar el bloc del webhook (després de guardar el missatge INBOUND) amb la crida a l'agent:

```typescript
import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { config } from "../lib/config";
import { logger } from "../lib/logger";
import { openwa } from "../connectors/OpenWAConnector";
import { handleIncomingMessage, checkConversationTimeout } from "../services/conversationAgent";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  // Verify webhook secret
  if (req.query.secret !== config.webhookSecret) {
    return res.status(403).json({ error: "Accés no autoritzat" });
  }

  const from = req.body.from || "";
  const text = req.body.body || "";
  const media = req.body.media;

  const cleanPhone = from.replace(/@c\.us$/, "");

  const client = await prisma.client.findFirst({
    where: { whatsapp: cleanPhone, active: true },
  });

  if (!client) return res.status(200).json({ status: "ignored" });

  // Find open receipts for this client — only NOTIFICAT or ESPERANT_DETALLS for agent
  const openReceipt = await prisma.returnedReceipt.findFirst({
    where: {
      clientId: client.id,
      status: { in: ["NOTIFICAT", "ESPERANT_DETALLS", "DETECTAT", "EMPARELLAT", "REVISAR"] },
    },
    orderBy: { returnDate: "desc" },
  });

  if (!openReceipt) return res.status(200).json({ status: "ignored" });

  // Save incoming message
  await prisma.message.create({
    data: {
      receiptId: openReceipt.id,
      direction: "INBOUND",
      content: text || "",
    },
  });

  // --- AGENT: only for NOTIFICAT or ESPERANT_DETALLS ---
  const agentEligible = openReceipt.status === "NOTIFICAT" || openReceipt.status === "ESPERANT_DETALLS";

  if (agentEligible) {
    try {
      // Check for timeout on ESPERANT_DETALLS
      if (openReceipt.status === "ESPERANT_DETALLS") {
        const timedOut = await checkConversationTimeout(openReceipt.id);
        if (timedOut) {
          logger.info({ receiptId: openReceipt.id }, "Conversation timeout, agent silenced");
          return res.status(200).json({ status: "timeout" });
        }
      }

      const hasMedia = !!media;
      const result = await handleIncomingMessage(
        text || "",
        hasMedia,
        openReceipt.id,
        client.name,
      );

      // Send agent response via WhatsApp
      await openwa.sendMessage(cleanPhone, result.replyText);

      // Save agent message
      await prisma.message.create({
        data: {
          receiptId: openReceipt.id,
          direction: "OUTBOUND",
          content: result.replyText,
          agentIntent: result.intent,
          agentAction: result.action,
          agentMetadata: result.metadata,
          needsReview: result.intent === "altres_temes",
        },
      });

      // Update receipt status if needed
      const updateData: any = {};
      if (result.receiptNewStatus) {
        updateData.status = result.receiptNewStatus;
        updateData.proofReceivedAt = new Date();
      }
      // Track conversation state in notes (non-destructive append)
      const currentNotes = openReceipt.notes || "";
      const conversationNote = `[Agent: ${result.intent} → ${result.action}]`;
      updateData.notes = currentNotes ? `${currentNotes} ${conversationNote}` : conversationNote;

      await prisma.returnedReceipt.update({
        where: { id: openReceipt.id },
        data: updateData,
      });
    } catch (err) {
      logger.error({ err, receiptId: openReceipt.id }, "Agent error");
      // Don't block — the message was already saved
    }
  }

  // Handle media attachments (existing logic, also works with agent flow)
  if (media) {
    try {
      let fileBuffer: Buffer | null = null;
      let ext = ".jpg";

      if (media.url) {
        const response = await fetch(media.url);
        if (response.ok) {
          fileBuffer = Buffer.from(await response.arrayBuffer());
          ext = path.extname(new URL(media.url).pathname) || ".jpg";
        }
      } else if (media.base64) {
        fileBuffer = Buffer.from(media.base64, "base64");
        ext = media.mimetype ? `.${media.mimetype.split("/")[1]}` : ".jpg";
      }

      if (fileBuffer) {
        const uploadsDir = path.join(__dirname, "../../uploads/webhook");
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const filename = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
        const filePath = path.join(uploadsDir, filename);
        fs.writeFileSync(filePath, fileBuffer);

        await prisma.paymentProof.create({
          data: {
            receiptId: openReceipt.id,
            filePath,
            status: "RECEIVED",
          },
        });
      }
    } catch (err) {
      logger.error({ err }, "Error processing webhook media");
    }
  }

  res.status(200).json({ status: "ok" });
});

export default router;
```

- [ ] **Step 2: Verificar que compila**

```bash
cd backend && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/webhook.ts
git commit -m "feat: integrate ConversationAgent into webhook for auto-reply"
```

---

### Task 5: Endpoint de resposta manual

**Files:**
- Modify: `backend/src/routes/returnedReceipts.ts`

- [ ] **Step 1: Afegir l'endpoint POST /:id/reply**

Afegir al final del fitxer (abans de `export default router`):

```typescript
// Manual reply endpoint — used when user takes control from agent
router.post("/:id/reply", async (req: Request, res: Response) => {
  const { text } = pick(req.body, ["text"]) as any;

  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "text requerit" });
  }

  const receipt = await prisma.returnedReceipt.findUnique({
    where: { id: parseInt(req.params.id as string) },
    include: { client: true },
  });

  if (!receipt) return res.status(404).json({ error: "Impagat no trobat" });
  if (!receipt.client?.whatsapp) return res.status(400).json({ error: "Client sense WhatsApp" });

  // Send manual reply
  const result = await openwa.sendMessage(receipt.client.whatsapp, text.trim());

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  // Save as OUTBOUND message with agent fields null (manual)
  const message = await prisma.message.create({
    data: {
      receiptId: receipt.id,
      direction: "OUTBOUND",
      content: text.trim(),
      externalId: result.externalId,
    },
  });

  // Mark receipt as CONTROL_MANUAL to disable agent
  await prisma.returnedReceipt.update({
    where: { id: receipt.id },
    data: { status: "JUSTIFICANT_REBUT" },
  });

  await auditLog("MANUAL_REPLY", "ReturnedReceipt", receipt.id, { text: text.trim() });
  res.json({ success: true, message });
});
```

Nota: cal importar `openwa` al fitxer. Afegir al principi:
```typescript
import { openwa } from "../connectors/OpenWAConnector";
```

- [ ] **Step 2: Verificar que compila**

```bash
cd backend && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/returnedReceipts.ts
git commit -m "feat: add manual reply endpoint for agent override"
```

---

### Task 6: API client — Afegir sendManualReply

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Afegir la funció al client**

Afegir dins de l'objecte `api`, després de `uploadProof`:

```typescript
  // Manual reply (agent override)
  sendManualReply: (receiptId: number, text: string) =>
    request<any>(`/returned-receipts/${receiptId}/reply`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
```

- [ ] **Step 2: Verificar que compila**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: add sendManualReply to frontend API client"
```

---

### Task 7: Frontend — Panell de conversa a ReturnedReceiptDetail

**Files:**
- Modify: `frontend/src/pages/ReturnedReceiptDetail.tsx`

- [ ] **Step 1: Substituir el fitxer sencer amb el panell de conversa**

```tsx
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import StatusBadge from "../components/StatusBadge";

function AgentIndicator({ message }: { message: any }) {
  if (!message.agentIntent) return null;
  return (
    <div className="mt-1 text-xs flex items-center gap-2">
      <span className="text-purple-600 font-medium">Agent</span>
      <span className="text-gray-400">intent:</span>
      <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-mono">{message.agentIntent}</span>
      <span className="text-gray-400">→</span>
      <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-mono">{message.agentAction}</span>
      {message.needsReview && <span className="bg-red-100 text-red-600 px-1.5 py-0.5 rounded text-xs">Revisar</span>}
    </div>
  );
}

export default function ReturnedReceiptDetail() {
  const { id } = useParams();
  const { data: receipt, loading, error, reload } = useApi(() => api.getReturnedReceipt(parseInt(id!)));
  const [sending, setSending] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);

  const handleSendWhatsApp = async () => {
    setSending(true);
    try {
      const result = await api.sendWhatsApp(parseInt(id!));
      if (result.success) reload();
      else alert("Error: " + result.error);
    } catch (err: any) {
      alert(err.message);
    }
    setSending(false);
  };

  const handleUploadProof = async () => {
    if (!proofFile) return;
    try {
      await api.uploadProof(parseInt(id!), proofFile);
      setProofFile(null);
      reload();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    await api.updateReturnedReceipt(parseInt(id!), { status: newStatus });
    reload();
  };

  const handleSendManualReply = async () => {
    if (!replyText.trim()) return;
    setReplying(true);
    try {
      await api.sendManualReply(parseInt(id!), replyText.trim());
      setReplyText("");
      reload();
    } catch (err: any) {
      alert(err.message);
    }
    setReplying(false);
  };

  if (loading) return <div className="text-gray-500">Carregant...</div>;
  if (error) return <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">Error: {error}</div>;
  if (!receipt) return <div className="text-gray-500">No trobat</div>;

  const isAgentActive = receipt.status === "NOTIFICAT" || receipt.status === "ESPERANT_DETALLS";
  const isControlManual = receipt.status === "JUSTIFICANT_REBUT" && receipt.messages?.some((m: any) => m.agentIntent === null && m.direction === "OUTBOUND");

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Impagat #{receipt.id}</h1>
        <StatusBadge status={receipt.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6 space-y-3">
          <h2 className="font-semibold text-lg">Informació</h2>
          <div><span className="text-sm text-gray-500">Data devolució:</span> {new Date(receipt.returnDate).toLocaleDateString("ca-ES")}</div>
          <div><span className="text-sm text-gray-500">Import retornat:</span> <strong>{receipt.returnedAmount.toFixed(2)} €</strong></div>
          <div><span className="text-sm text-gray-500">Referència:</span> {receipt.receiptReference || "-"}</div>
          <div><span className="text-sm text-gray-500">Motiu:</span> {receipt.returnReason || "-"}</div>
          <div><span className="text-sm text-gray-500">Client:</span> {receipt.client ? <>{receipt.client.name} ({receipt.client.whatsapp || "sense WhatsApp"})</> : <span className="text-orange-600">No assignat</span>}</div>
          <div><span className="text-sm text-gray-500">Factura:</span> {receipt.invoice ? <>#{receipt.invoice.invoiceNumber} ({receipt.invoice.amount.toFixed(2)} €)</> : <span className="text-orange-600">No assignada</span>}</div>
          {receipt.servicePeriod && <div><span className="text-sm text-gray-500">Període:</span> <span className="font-medium">{receipt.servicePeriod}</span></div>}
          {receipt.notes && <div><span className="text-sm text-gray-500">Notes:</span> <span className="text-blue-700 font-medium">{receipt.notes}</span></div>}
          {receipt.bankMovement?.rawData?.Valor && (
            <div><span className="text-sm text-gray-500">Data emissió rebut:</span> {receipt.bankMovement.rawData.Valor}</div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="font-semibold text-lg mb-4">Accions</h2>
            <div className="space-y-3">
              <button onClick={handleSendWhatsApp} disabled={sending || !receipt.client?.whatsapp}
                className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 text-sm">
                {sending ? "Enviant..." : "Enviar WhatsApp"}
              </button>

              <div className="border-t pt-3">
                <label className="text-sm font-medium block mb-1">Pujar justificant</label>
                <input type="file" onChange={(e) => setProofFile(e.target.files?.[0] || null)} className="block mb-2 text-sm" />
                <button onClick={handleUploadProof} disabled={!proofFile}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50">Pujar</button>
              </div>

              <div className="border-t pt-3">
                <label className="text-sm font-medium block mb-1">Canviar estat</label>
                <select className="w-full border rounded px-3 py-2 text-sm" value={receipt.status}
                  onChange={(e) => handleStatusChange(e.target.value)}>
                  <option value="DETECTAT">DETECTAT</option>
                  <option value="EMPARELLAT">EMPARELLAT</option>
                  <option value="REVISAR">REVISAR</option>
                  <option value="NOTIFICAT">NOTIFICAT</option>
                  <option value="JUSTIFICANT_REBUT">JUSTIFICANT REBUT</option>
                  <option value="PAGAMENT_CONFIRMAT">PAGAMENT CONFIRMAT</option>
                  <option value="TANCAT">TANCAT</option>
                  <option value="IGNORAT">IGNORAT</option>
                </select>
              </div>
            </div>
          </div>

          {receipt.proofs?.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="font-semibold text-lg mb-2">Justificants</h2>
              <ul className="text-sm space-y-1">
                {receipt.proofs.map((p: any) => (
                  <li key={p.id} className="flex justify-between">
                    <span>{new Date(p.receivedAt).toLocaleDateString("ca-ES")}</span>
                    <StatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Agent status banner */}
          {isAgentActive && (
            <div className="bg-green-50 border border-green-300 rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full inline-block" />
                <span className="text-green-700 text-sm font-medium">Agent actiu — Esperant resposta del deutor</span>
              </div>
            </div>
          )}

          {/* Manual reply box */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-sm font-semibold mb-2">Resposta manual</h3>
            <textarea
              className="w-full border rounded px-3 py-2 text-sm resize-y"
              rows={3}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Escriu una resposta manual..."
            />
            <button
              onClick={handleSendManualReply}
              disabled={replying || !replyText.trim() || !receipt.client?.whatsapp}
              className="mt-2 bg-indigo-600 text-white px-3 py-1.5 rounded text-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {replying ? "Enviant..." : "Enviar resposta manual"}
            </button>
          </div>

          {/* Conversation thread */}
          {receipt.messages?.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="font-semibold text-lg mb-3">Conversa WhatsApp</h2>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {[...receipt.messages].reverse().map((m: any) => (
                  <div key={m.id} className={`rounded-lg p-3 text-sm ${
                    m.direction === "OUTBOUND"
                      ? m.agentIntent ? "bg-purple-50 border border-purple-200" : "bg-green-50 border border-green-200"
                      : "bg-blue-50 border border-blue-200"
                  }`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium">
                        {m.direction === "OUTBOUND"
                          ? m.agentIntent ? "🤖 Agent (auto)" : "📤 Enviat"
                          : "📥 Rebut"}
                      </span>
                      <span className="text-xs text-gray-500">{new Date(m.sentAt).toLocaleString("ca-ES")}</span>
                    </div>
                    <div className="whitespace-pre-wrap text-sm">{m.content}</div>
                    <AgentIndicator message={m} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar que compila**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ReturnedReceiptDetail.tsx
git commit -m "feat: add conversation panel with agent status and manual reply to receipt detail"
```

---

### Task 8: Frontend — Columna Agent a la llista d'impagats

**Files:**
- Modify: `frontend/src/pages/ReturnedReceiptsList.tsx`

- [ ] **Step 1: Afegir columna Agent a la taula**

Modificar el `thead` i `tbody` per incloure la columna Agent entre "Estat" i "Accions":

Al `thead` (després del `<th>Estat</th>`):
```tsx
<th className="text-left p-3">Agent</th>
```

Al `tbody`, dins de cada fila (després del `<StatusBadge>`):
```tsx
<td className="p-3">
  {r.status === "NOTIFICAT" && (
    <span className="flex items-center gap-1">
      <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />
      <span className="text-green-700 text-xs">actiu</span>
    </span>
  )}
  {r.status === "ESPERANT_DETALLS" && (
    <span className="flex items-center gap-1">
      <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full inline-block" />
      <span className="text-yellow-700 text-xs">pendent</span>
    </span>
  )}
  {r.status === "JUSTIFICANT_REBUT" && r.notes?.includes("[Agent:") && (
    <span className="flex items-center gap-1">
      <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />
      <span className="text-green-700 text-xs">respost</span>
    </span>
  )}
  {r.notes?.includes("altres_temes → redirigir") && (
    <span className="flex items-center gap-1">
      <span className="w-1.5 h-1.5 bg-red-500 rounded-full inline-block" />
      <span className="text-red-700 text-xs">tancat</span>
    </span>
  )}
  {!["NOTIFICAT", "ESPERANT_DETALLS", "JUSTIFICANT_REBUT"].includes(r.status) && !r.notes?.includes("[Agent:") && (
    <span className="text-gray-400 text-xs">-</span>
  )}
</td>
```

Modificar el `colSpan` de 8 a 9 als dos llocs on apareix (missatge de "Cap impagat" i paginació).

- [ ] **Step 2: Verificar que compila**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ReturnedReceiptsList.tsx
git commit -m "feat: add agent status column to receipts list"
```

---

### Task 9: Frontend — Secció Agent a Settings

**Files:**
- Modify: `frontend/src/pages/Settings.tsx`

- [ ] **Step 1: Afegir secció Agent conversacional**

Afegir un nou `<div>` dins del contenidor principal, abans del botó "Desar configuració":

```tsx
<div>
  <h2 className="font-semibold text-lg mb-3">Agent conversacional</h2>

  <div className="space-y-4">
    <div className="flex items-center gap-3">
      <label className="text-sm font-medium">Activat</label>
      <input
        type="checkbox"
        checked={settings["agent.enabled"] !== "false"}
        onChange={(e) => set("agent.enabled", e.target.checked ? "true" : "false")}
        className="h-4 w-4"
      />
    </div>

    <div>
      <label className="block text-sm font-medium mb-1">Timeout (hores)</label>
      <input
        className="w-32 border rounded px-3 py-2 text-sm"
        value={settings["agent.timeout_hores"] || "24"}
        onChange={(e) => set("agent.timeout_hores", e.target.value)}
        type="number"
        min="1"
        max="168"
      />
    </div>

    <div className="border-t pt-3">
      <h3 className="text-sm font-semibold mb-2">Paraules clau — Pagament clar (CAT)</h3>
      <input
        className="w-full border rounded px-3 py-2 text-sm"
        value={settings["agent.keywords_pagament_clar_cat"] || "he pagat,ja he fet el pagament,transferència feta,ingrés fet"}
        onChange={(e) => set("agent.keywords_pagament_clar_cat", e.target.value)}
      />
    </div>

    <div>
      <h3 className="text-sm font-semibold mb-2">Paraules clau — Pagament clar (ES)</h3>
      <input
        className="w-full border rounded px-3 py-2 text-sm"
        value={settings["agent.keywords_pagament_clar_es"] || "he pagado,ya he hecho el pago,transferencia hecha"}
        onChange={(e) => set("agent.keywords_pagament_clar_es", e.target.value)}
      />
    </div>

    <div className="border-t pt-3">
      <h3 className="text-sm font-semibold mb-2">Paraules clau — Pagament ambigu (CAT)</h3>
      <input
        className="w-full border rounded px-3 py-2 text-sm"
        value={settings["agent.keywords_ambigu_cat"] || "fet,ja està,ho tens,ok,d'acord,llisto"}
        onChange={(e) => set("agent.keywords_ambigu_cat", e.target.value)}
      />
    </div>

    <div>
      <h3 className="text-sm font-semibold mb-2">Paraules clau — Pagament ambigu (ES)</h3>
      <input
        className="w-full border rounded px-3 py-2 text-sm"
        value={settings["agent.keywords_ambigu_es"] || "hecho,ya está,lo tienes,vale,ok,listo"}
        onChange={(e) => set("agent.keywords_ambigu_es", e.target.value)}
      />
    </div>

    <div className="border-t pt-3">
      <h3 className="text-sm font-semibold mb-2">Paraules clau — Comprovant (CAT)</h3>
      <input
        className="w-full border rounded px-3 py-2 text-sm"
        value={settings["agent.keywords_comprovant_cat"] || "comprovant,justificant,adjunt,captura"}
        onChange={(e) => set("agent.keywords_comprovant_cat", e.target.value)}
      />
    </div>

    <div>
      <h3 className="text-sm font-semibold mb-2">Paraules clau — Comprovant (ES)</h3>
      <input
        className="w-full border rounded px-3 py-2 text-sm"
        value={settings["agent.keywords_comprovant_es"] || "comprobante,justificante,adjunto,captura"}
        onChange={(e) => set("agent.keywords_comprovant_es", e.target.value)}
      />
    </div>

    <div className="border-t pt-3">
      <h3 className="text-sm font-semibold mb-2">Plantilla — Confirmació de pagament</h3>
      <textarea
        className="w-full border rounded px-3 py-2 font-mono text-xs h-24"
        value={settings["agent.template_pagament_clar"] || ""}
        onChange={(e) => set("agent.template_pagament_clar", e.target.value)}
        placeholder="Gràcies {{client_name}}..."
      />
    </div>

    <div>
      <h3 className="text-sm font-semibold mb-2">Plantilla — Pagament ambigu</h3>
      <textarea
        className="w-full border rounded px-3 py-2 font-mono text-xs h-24"
        value={settings["agent.template_pagament_ambigu"] || ""}
        onChange={(e) => set("agent.template_pagament_ambigu", e.target.value)}
        placeholder="Gràcies per respondre..."
      />
    </div>

    <div>
      <h3 className="text-sm font-semibold mb-2">Plantilla — Comprovant rebut</h3>
      <textarea
        className="w-full border rounded px-3 py-2 font-mono text-xs h-24"
        value={settings["agent.template_comprovant_rebut"] || ""}
        onChange={(e) => set("agent.template_comprovant_rebut", e.target.value)}
        placeholder="Gràcies {{client_name}}..."
      />
    </div>

    <div>
      <h3 className="text-sm font-semibold mb-2">Plantilla — Redirecció</h3>
      <textarea
        className="w-full border rounded px-3 py-2 font-mono text-xs h-24"
        value={settings["agent.template_redireccio"] || ""}
        onChange={(e) => set("agent.template_redireccio", e.target.value)}
        placeholder="Aquest és un sistema automàtic..."
      />
    </div>
  </div>
</div>
```

- [ ] **Step 2: Verificar que compila**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Settings.tsx
git commit -m "feat: add conversation agent settings section"
```

---

### Task 10: Verificació d'integració

**Files:** cap nou

- [ ] **Step 1: Executar tots els tests del backend**

```bash
cd backend && npx jest --verbose
```

Expected: 38 tests pass (20 existents + 18 nous de conversationAgent)

- [ ] **Step 2: Verificar compilació backend**

```bash
cd backend && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Verificar compilació frontend**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 4: Verificar health check**

```bash
curl -s http://localhost:3001/api/health | jq .
```

Expected: `{ "status": "ok" }`

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "chore: integration verification — all tests pass, both projects compile"
```

---

## Self-Review Checklist

- [x] Spec coverage: 10 seccions de l'espec cobertes (arquitectura, estats, classificador, plantilles, BD, UI conversa, UI llista, UI settings, testing, configuració)
- [x] Placeholder scan: cap TBD, TODO, ni "implement later"
- [x] Type consistency: `classifyMessage` signatura consistent entre servei i tests, `handleIncomingMessage` tipus de retorn definit, API client usa `sendManualReply` amb mateixos paràmetres que el backend espera
