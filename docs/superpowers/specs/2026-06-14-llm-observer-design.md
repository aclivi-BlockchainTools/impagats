# Especificació: LLM Observer per l'Agent WhatsApp

**Data:** 2026-06-14
**Context:** Afegir una LLM en mode observador/aprenentatge per monitorar converses,
detectar missatges mal classificats, proposar nous intents, paraules clau i respostes,
i crear suggeriments que un humà pugui aprovar abans d'aplicar-los.

## Principis de seguretat (NO NEGOCIABLES)

1. La LLM **NO** pot enviar missatges automàticament al client
2. La LLM **NO** pot modificar regles automàticament sense aprovació explícita
3. La LLM **NO** ha de rebre dades personals innecessàries (DNI, telèfon, IBAN, nom complet, dades bancàries crues)
4. L'agent actual de regles i plantilles **continua sent qui decideix** les respostes automàtiques
5. La LLM **només classifica, suggereix i resumeix**
6. L'observador es pot **activar/desactivar** completament des de Settings
7. Tot suggeriment requereix **aprovació humana explícita** abans d'aplicar-se

---

## Arquitectura

### 3 nivells d'observació

```
Nivell 1: Classificació de missatges individuals
  └─ Trigger: cada missatge entrant amb intent=unknown, payment_claim, o risc

Nivell 2: Revisió de conversa completa
  └─ Trigger: cada 3 missatges, canvi d'estat, o tancament de cas (TANCAT/PAGAMENT_CONFIRMAT/IGNORAT)
  └─ També al primer missatge humà de resposta manual (reply) si la conversa té ≥3 missatges

Nivell 3: Auditoria periòdica de l'agent
  └─ Trigger: manual (botó) o programat (cron)
```

### Diagrama de fluxe

```
webhook.ts
  → classify() [classificador actual, SEMPRE primer]
  → guardar missatge entrant + respondre amb plantilla [comportament actual, INALTERAT]
  → [async, no bloqueja] Si LLM observer activat:
      → comprovar trigger (intent, risc, etc.)
      → si N1: anonimitzar missatge + context
        si N2: anonimitzar conversa completa
      → cridar LLM provider
      → parsejar resposta JSON
      → guardar AgentLearningSuggestion (PENDING)
      → si needsReview=true → afegir CaseNote "[Revisió LLM suggerida]"
```

### Components

| Component | Fitxer | Responsabilitat |
|-----------|--------|-----------------|
| `anonymizer.ts` | `src/lib/anonymizer.ts` | Neteja dades personals (regex) |
| `llmObserverService.ts` | `src/services/llmObserverService.ts` | Orquestra: anonimitzar → provider → parsejar → guardar |
| `llmProviders.ts` | `src/services/llmProviders.ts` | Adaptadors OpenAI, Anthropic, DeepSeek |
| `AgentLearningSuggestion` | Prisma model | Persistència suggeriments (els 3 nivells) |
| `AgentKeywordRule` | Prisma model | Regles de paraules clau |
| `AgentObserverSection.tsx` | `frontend/src/components/AgentObserverSection.tsx` | Pestanya dins Settings |
| `observerRoutes.ts` | `backend/src/routes/observer.ts` | Endpoints CRUD suggeriments |
| `anonymizer.test.ts` | `__tests__/anonymizer.test.ts` | Tests d'anonimització |
| `llmObserverService.test.ts` | `__tests__/llmObserverService.test.ts` | Tests del servei |

---

## Models Prisma

### AgentLearningSuggestion

```prisma
model AgentLearningSuggestion {
  id                  Int       @id @default(autoincrement())
  messageId           Int?
  clientId            Int?
  receiptId           Int?
  originalTextHash    String?   // SHA-256 del text original
  anonymizedText      String?   // text o conversa anonimitzada
  analysisType        String    @default("message_classification")
  // "message_classification" | "conversation_review" | "agent_audit" | "template_review"

  // --- Nivell 1: classificació missatge ---
  currentIntent       String?
  suggestedIntent     String?
  confidence          Float?
  suggestedReply      String?
  suggestedKeywords   Json?     // ["paraula1", "paraula2"]
  suggestedStateChange String?

  // --- Nivell 2 i 3: revisió conversa / auditoria ---
  conversationQuality String?   // excellent | good | fair | poor
  agentEffectiveness  Float?    // 0.0 - 1.0
  issues              Json?     // [{type, description, messages?, suggestedIntent?}]
  suggestedImprovements Json?   // [string, ...]

  // --- Comuns ---
  risk                String?   // low | medium | high
  reason              String?
  status              String    @default("PENDING") // PENDING | APPROVED | REJECTED | APPLIED
  provider            String?   // openai | anthropic | deepseek
  model               String?
  createdAt           DateTime  @default(now())
  reviewedAt          DateTime?
}
```

### AgentKeywordRule

```prisma
model AgentKeywordRule {
  id        Int      @id @default(autoincrement())
  intent    String?
  pattern   String
  type      String   @default("KEYWORD") // KEYWORD | REGEX
  language  String?  // ca | es | both
  priority  Int      @default(0)
  active    Boolean  @default(true)
  source    String   @default("MANUAL")  // MANUAL | LLM
  createdAt DateTime @default(now())
}
```

### Integració AgentKeywordRule amb el classificador

Quan una AgentKeywordRule s'activa (source=LLM o MANUAL):

1. El `messageClassifier.ts` llegeix les regles actives al init i les cacheja
2. Cada funció detectora (`isPaymentPromise`, `isWrongPerson`, etc.) consulta el conjunt de paraules clau del seu intent
3. Si una paraula clau fa match, suma puntuació al detector
4. Les regles de type=REGEX s'afegeixen directament a les funcions

A nivell tècnic:
- `classify()` rep un paràmetre opcional `extraKeywords: Map<string, string[]>` (intent → paraules)
- El webhook carrega les regles actives i les passa al classificador
- Alternativa: el classificador llegeix les regles directament de la BD (més net)

**Decisió**: el classificador llegeix directament de la BD al init i fa reload cada 5 minuts o quan s'aprova una nova regla.

### Actualització de KNOWN_SETTINGS

Afegir `observer.` al prefixos permesos a `settings.ts`:
```typescript
if (!KNOWN_SETTINGS.includes(key) && !key.startsWith("agent.") && !key.startsWith("observer.")) continue;
```

### Afegir a ReturnedReceiptStatusHistory

El camp `actorType` existent accepta `"LLM_OBSERVER"` com a valor vàlid.

---

## Funcions d'anonimització

### `anonymizeText(text: string): string`

Substitucions amb regex:
- `CLIENT <nom>` → `CLIENT`
- `+34 6XX XXX XXX` / `6XXXXXXXX` → `PHONE`
- `ESXX XXXX XXXX XXXX XXXX XXXX` → `IBAN`
- `XXXXXXX-X` / `XXXXXXXXX` (DNI/NIF/NIE) → `DOCUMENT`
- `xxx@xxx.xxx` → `EMAIL`
- Manté imports (números seguits de €) i mesos/any si són necessaris

### `anonymizeConversation(messages, context): AnonymizedConversation`

Retorna:
```json
{
  "messages": [
    {"direction": "INBOUND", "text": "Hola, he pagat el rebut"},
    {"direction": "OUTBOUND", "text": "Gràcies. Envia el justificant..."}
  ],
  "context": {
    "pendingAmount": "150.00",
    "pendingPeriods": ["2026-05"],
    "hasProof": true,
    "hasReconciliation": false,
    "status": "NOTIFICAT",
    "messageCount": 5,
    "durationDays": 3
  }
}
```

Regles:
- `direction: "OUTBOUND"` no s'anonimitza tant (és text de l'agent, no del client)
- `direction: "INBOUND"` s'anonimitza completament
- imports i períodes es conserven (necessaris per entendre el context)

---

## Serveis

### llmProviderFactory

```typescript
type LLMProvider = "openai" | "anthropic" | "deepseek";

interface LLMProviderConfig {
  provider: LLMProvider;
  model: string;
  apiKey: string;
  baseUrl?: string; // per DeepSeek local
}

function createProvider(config: LLMProviderConfig): LLMProviderAdapter;
```

Adaptadors:
- **OpenAI**: `POST https://api.openai.com/v1/chat/completions` amb `response_format: { type: "json_object" }`
- **Anthropic**: `POST https://api.anthropic.com/v1/messages` amb prompt que demana JSON
- **DeepSeek**: `POST {baseUrl}/chat/completions` (LiteLLM local) amb `response_format: { type: "json_object" }`

### llmObserverService

```typescript
class LLMObserverService {
  private enabled: boolean;

  constructor() { this.enabled = false; }

  async loadConfig(): Promise<void>;
  isEnabled(): boolean;

  // Nivell 1
  async classifyMessage(input: {
    text: string;
    currentIntent: string;
    currentStatus: string;
    pendingAmount?: string;
    pendingPeriods?: string[];
    hasProof: boolean;
    hasReconciliation: boolean;
    lastMessages: string[]; // anonimitzats
    probableLanguage: "ca" | "es" | "unknown";
  }): Promise<MessageSuggestion | null>;

  // Nivell 2
  async reviewConversation(input: {
    receiptId: number;
    messages: AnonymizedMessage[];
    context: ConversationContext;
  }): Promise<ConversationReview | null>;

  // Nivell 3
  async auditAgent(input: {
    period: { from: string; to: string };
    stats: AgentStats;
    topUnknown: string[];
    topCorrectedIntents: string[];
  }): Promise<AgentAudit | null>;
}
```

### Respostes JSON esperades de la LLM

**Nivell 1 (classificació):**
```json
{
  "intent": "PAYMENT_PROMISE",
  "confidence": 0.85,
  "needsReview": false,
  "suggestedReply": "D'acord, gràcies per avisar...",
  "suggestedKeywords": ["pago", "viernes", "semana que viene"],
  "suggestedStateChange": null,
  "risk": "low",
  "reason": "El client promet pagar divendres"
}
```

**Nivell 2 (revisió conversa):**
```json
{
  "analysisType": "conversation_review",
  "summary": "El client va enviar justificant, l'agent ho va rebre bé. Però després va preguntar si estava tot correcte i l'agent va respondre genèricament 3 cops.",
  "conversationQuality": "poor",
  "agentEffectiveness": 0.4,
  "issues": [
    {
      "type": "repetitive_response",
      "description": "3 respostes genèriques consecutives",
      "messages": [4, 6, 8]
    },
    {
      "type": "missed_intent",
      "description": "Pregunta 'quan triga la revisió?' no detectada",
      "suggestedIntent": "review_timeline_question"
    }
  ],
  "suggestedImprovements": [
    "Crear intent 'review_timeline_question' amb plantilla específica",
    "Millorar anti-repetició amb variació de respostes"
  ],
  "risk": "medium",
  "needsReview": true
}
```

**Nivell 3 (auditoria):**
```json
{
  "analysisType": "agent_audit",
  "period": "2026-06-07..2026-06-14",
  "stats": {
    "totalMessages": 230,
    "unknownRate": 0.18,
    "humanReviewRate": 0.32,
    "avgResolutionDays": 5.2,
    "blockRate": 0.03
  },
  "topIssues": [
    "18% de missatges classificats com unknown — suggerir nous intents",
    "32% de casos requereixen revisió humana — massa alta"
  ],
  "suggestedNewIntents": [
    {
      "name": "review_timeline_question",
      "keywords": ["quan triga", "quan estara", "termini revisio"],
      "suggestedReply": "La revisió pot trigar uns dies. Si tot és correcte t'avisarem."
    }
  ],
  "templatesToImprove": [
    {
      "intent": "question_about_debt",
      "issue": "Resposta genèrica — clients reenvien la pregunta",
      "suggestion": "Afegir variant amb info del cas si està disponible"
    }
  ]
}
```

---

## Integració amb el webhook actual

Al final del webhook (després de tot el procés actual), executar de forma **asíncrona i no bloquejant**:

```typescript
// === 13. LLM Observer (async, no bloqueja resposta) ===
if (llmObserver.isEnabled()) {
  setImmediate(async () => {
    try {
      // N1: Classificació alternativa si l'actual és dubtosa
      const lowConfidenceIntents = ["unknown", "payment_claim_without_proof"];
      const hasUnprocessedMedia = !!media && !proofSaved && !isAudio;

      if (lowConfidenceIntents.includes(classification.intent) ||
          hasUnprocessedMedia ||
          (classification.intent === "question_about_debt" && !clientName)) {

        const anonymizedInput = await buildAnonymizedInput({...});
        const suggestion = await llmObserver.classifyMessage(anonymizedInput);

        if (suggestion) {
          await saveSuggestion(suggestion, "message_classification");

          if (suggestion.needsReview) {
            await addCaseNote(receiptId, "[Revisió LLM suggerida: veure Aprenentatge]");
          }
        }
      }

      // N2: Revisió de conversa cada 3 missatges o al tancar
      const messageCount = await prisma.message.count({ where: { receiptId } });
      const shouldReviewConversation =
        messageCount > 0 && messageCount % 3 === 0;

      if (shouldReviewConversation) {
        const convInput = await buildAnonymizedConversation(receiptId);
        const review = await llmObserver.reviewConversation(convInput);
        if (review) {
          await saveSuggestion(review, "conversation_review");
        }
      }
    } catch (err) {
      logger.error({ err, receiptId }, "LLM Observer error");
    }
  });
}
```

---

## Pestanya "Aprenentatge agent" (dins Settings)

### Subpestanyes

1. **Suggeriments** (N1) — missatges individuals pendents
2. **Revisions conversa** (N2) — anàlisis completes
3. **Auditories** (N3) — informes de rendiment
4. **Paraules clau** — regles actives
5. **Configuració observer** — activar/desactivar, provider, model

### Subpestanya 1: Suggeriments

Llista paginada amb filtres (status, risk, date):
- Text anonimitzat (fons gris, `font-mono`)
- Intent actual → Intent suggerit (fletxa)
- Confiança (barra de progrés amb color: verd >80%, groc 50-80%, vermell <50%)
- Resposta suggerida (requadre diferenciat amb avís: "RESPOSTA SUGGERIDA - NO enviada automàticament")
- Paraules clau suggerides (chips)
- Risc (badge: verd=low, groc=medium, vermell=high)
- Motiu (text petit)
- Botons: [Aprovar intent] [Aprovar paraules] [Aprovar plantilla] [Rebutjar]

### Subpestanya 2: Revisions de conversa

- Resum de la conversa (text)
- Qualitat (badge: verd=excellent, blau=good, groc=fair, vermell=poor)
- Efectivitat agent (barra 0-100%)
- Problemes detectats (llista amb icona)
- Millores suggerides (llista)
- Botons: [Aprovar millores] [Rebutjar]

### Subpestanya 3: Auditories

- Selector de període (dates)
- Botó "Generar auditoria" + "Actualitzar"
- Mètriques: taxa unknown, taxa revisió humana, temps resolució
- Top intents corregits (taula)
- Intents suggerits nous (targetes)
- Plantilles a millorar (targetes)
- Botons per aprovar cada suggeriment individualment

### Subpestanya 4: Paraules clau

- Llista de AgentKeywordRules actives
- Per cada regla: intent, pattern, tipus, idioma, font (MANUAL/LLM), prioritat
- Botons: [Activar/Desactivar] [Editar] [Esborrar]
- Formulari per crear-ne manualment

### Subpestanya 5: Configuració observer

- Toggle: Activar/Desactivar LLM Observer (switch mestre)
- Provider: select (OpenAI / Anthropic / DeepSeek / Disabled)
- Model: input text (ex: "gpt-4o", "claude-opus-4-6", "deepseek-v4-pro")
- API Key: input password (des de .env, no editable)
- Llindar confiança: slider 0.0 - 1.0 (per defecte 0.7)
- Guardar text anonimitzat: toggle sí/no
- Mode estricte privacitat: toggle (si actiu, ni tan sols guarda hash)

---

## Configuració (AppSettings)

Claus noves:
| Key | Valor per defecte | Descripció |
|-----|-------------------|-----------|
| `observer.enabled` | `false` | Activar/desactivar observer |
| `observer.provider` | `deepseek` | Provider: openai, anthropic, deepseek, disabled |
| `observer.model` | `deepseek-v4-pro` | Model concret |
| `observer.confidence_threshold` | `0.7` | Llindar per marcar needsReview |
| `observer.store_anonymized` | `true` | Guardar text anonimitzat |
| `observer.strict_privacy` | `false` | Mode estricte (no guarda ni hash) |

Les API keys es llegeixen del .env:
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `DEEPSEEK_API_KEY` (si és diferent del LiteLLM local)

---

## Endpoints API

| Ruta | Mètode | Descripció |
|------|--------|-----------|
| `/api/observer/suggestions` | GET | Llistat paginat (?page=&limit=&status=&risk=&type=) |
| `/api/observer/suggestions/:id` | GET | Detall d'un suggeriment |
| `/api/observer/suggestions/:id` | PUT | Aprovar/rebutjar (?action=approve|reject) |
| `/api/observer/suggestions/:id/apply` | POST | Aplicar suggeriment (crea KeywordRule i/o template) |
| `/api/observer/summary` | GET | Resum periòdic (?from=&to=) |
| `/api/observer/audit` | POST | Generar auditoria N3 via LLM |
| `/api/observer/keywords` | GET | Llistar AgentKeywordRules |
| `/api/observer/keywords` | POST | Crear manualment |
| `/api/observer/keywords/:id` | PUT | Editar (pattern, active, intent, priority) |
| `/api/observer/keywords/:id` | DELETE | Esborrar |
| `/api/observer/test` | POST | Test de connexió amb el provider (sense guardar res) |

---

## Flux d'aprovació

### Aprovar intent
1. Usuari clica [Aprovar intent]
2. Es crea una AgentKeywordRule amb les paraules clau suggerides (si n'hi ha)
3. Es marca el suggeriment com APPROVED
4. NO es modifica el classificador automàticament
5. Les paraules clau s'afegeixen al detector corresponent del messageClassifier

### Aprovar paraules clau
1. Usuari clica [Aprovar paraules]
2. Es crea una AgentKeywordRule per cada paraula clau suggerida
3. Es marca source=LLM
4. S'esborren les paraules del suggeriment (ja processades)

### Aprovar plantilla
1. Usuari clica [Aprovar plantilla]
2. Es crea/actualitza `template_{intent}` a AppSettings amb la resposta suggerida
3. Es marca el suggeriment com APPROVED
4. L'usuari pot editar la plantilla abans d'aprovar

### Rebutjar
1. Usuari clica [Rebutjar]
2. Es marca status=REJECTED
3. Es guarda la data de revisió

### Aplicar millores (N2)
1. Usuari clica [Aprovar millores]
2. Cada millora es processa individualment:
   - Nou intent → es crea AgentKeywordRule + es suggereix plantilla
   - Millora anti-repetició → es crea CaseNote amb la recomanació
   - etc.

---

## Nous intents suportats

La LLM pot suggerir qualsevol d'aquests intents:

| Intent | Descripció |
|--------|-----------|
| `PAYMENT_DECLARED` | Client declara haver pagat |
| `PROOF_SENT` | Justificant enviat |
| `PAYMENT_PROMISE` | Promesa de pagament futur |
| `DEBT_QUESTION` | Pregunta sobre el deute |
| `COMPLAINT_OR_DISPUTE` | Queixa o disputa |
| `WRONG_PERSON` | Número equivocat |
| `OPT_OUT_WHATSAPP` | Sol·licitud de baixa |
| `GREETING` | Salutació |
| `UNKNOWN` | No classificable |
| `HUMAN_REVIEW_REQUIRED` | Requereix revisió humana |
| `REVIEW_TIMELINE_QUESTION` | Pregunta sobre terminis de revisió |
| `CASE_INFO_REQUEST` | Sol·licitud d'informació del cas |

---

## Tests

### `anonymizer.test.ts`
- Anonimització de DNI/NIF/NIE (8 digits + lletra, 7 digits + lletra)
- Anonimització de telèfon (+34, 6XXXXXXXX, 7XXXXXXXX)
- Anonimització d'IBAN (ESXX XXXX XXXX XXXX XXXX XXXX)
- Anonimització d'email
- Anonimització de noms propis (patrons comuns)
- Conservació d'imports (números + €)
- Conservació de mesos/any
- Text sense dades personals → inalterat
- Text buit → buit

### `llmObserverService.test.ts`
- Detecció de baixa confiança (intent unknown)
- Creació de suggeriment N1
- Creació de suggeriment N2
- No enviament automàtic de resposta LLM (mock)
- Aprovació de keyword rule
- Rebuig de suggeriment
- Opt-out WhatsApp detectat
- Persona equivocada detectada
- Promesa de pagament detectada
- Mode strict privacy → no guarda hash
- Observer desactivat → no processa

### `observerRoutes.test.ts`
- GET /api/observer/suggestions paginat
- PUT /api/observer/suggestions/:id approve
- PUT /api/observer/suggestions/:id reject
- POST /api/observer/suggestions/:id/apply
- GET /api/observer/summary
- POST /api/observer/keywords
- GET /api/observer/keywords
- DELETE /api/observer/keywords/:id

---

## Configuració del .env

```
# LLM Observer (opcional)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
DEEPSEEK_API_KEY=
```

---

## Migracions

1. Crear taula `AgentLearningSuggestion`
2. Crear taula `AgentKeywordRule`
3. Sense canvis a taules existents (només s'afegeix `LLM_OBSERVER` com a valor vàlid d'actorType)

---

## Resum de canvis

| Àrea | Fitxers nous | Fitxers modificats |
|------|-------------|-------------------|
| Backend | `anonymizer.ts`, `llmObserverService.ts`, `llmProviders.ts`, `observer.ts` (routes), `anonymizer.test.ts`, `llmObserverService.test.ts`, `observerRoutes.test.ts` | `schema.prisma`, `webhook.ts`, `settings.ts`, `app.ts` |
| Frontend | `AgentObserverSection.tsx` | `Settings.tsx`, `Layout.tsx` (si cal afegir al menú), `api.ts` |
| Config | - | `.env` (keys opcionals) |
