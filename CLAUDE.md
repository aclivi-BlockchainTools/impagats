# Impagats — Context del projecte

## Què és

App web per gestionar impagats bancaris: importar moviments (CSV), detectar devolucions de rebuts, relacionar-les amb clients i factures, i reclamar per WhatsApp via OpenWA.

**Repo:** https://github.com/aclivi-BlockchainTools/impagats (privat)

## Stack

- **Frontend**: React 18 + Vite 6 + Tailwind 3 + React Router 6 (port 5173, ara 5174)
- **Backend**: Node.js + Express 4 + TypeScript (port 3001)
- **BD**: PostgreSQL 16 a Docker (port 5433 host → 5432 container)
- **ORM**: Prisma 5
- **WhatsApp**: Servidor OpenWA a `192.168.0.194:2785`, API Key configurada

## Estructura de fitxers

```
impagats/
├── docker-compose.yml
├── README.md
├── CLAUDE.md                          ← aquest fitxer
├── docs/
│   ├── tasks/                         ← tasques (platform MCP)
│   └── superpowers/
│       ├── specs/2026-06-10-impagats-design.md
│       └── plans/2026-06-10-impagats-plan.md
├── backend/
│   ├── Dockerfile
│   ├── .env                         ← DATABASE_URL, OPENWA_*, PORT
│   ├── package.json
│   ├── tsconfig.json
│   ├── jest.config.js               ← Jest + ts-jest
│   ├── prisma/
│   │   ├── schema.prisma            ← 9 models
│   │   └── migrations/
│   └── src/
│       ├── index.ts                 ← entry point (logger)
│       ├── app.ts                   ← express() + routes
│       ├── __tests__/               ← 3 suites, 20 tests
│       ├── lib/
│       │   ├── prisma.ts
│       │   ├── config.ts
│       │   ├── logger.ts            ← pino structured logging
│       │   └── validation.ts        ← whitelist d'input (pick)
│       ├── middleware/
│       │   ├── auditLog.ts          ← amb try/catch + logger
│       │   └── errorHandler.ts      ← usa logger
│       ├── connectors/
│       │   ├── BankConnector.ts     ← interfície
│       │   ├── CaixaGuissonaConnector.ts ← placeholder
│       │   └── OpenWAConnector.ts   ← sendMessage, testConnection, registerWebhook
│       ├── services/
│       │   ├── csvImporter.ts
│       │   ├── returnDetector.ts
│       │   ├── matchingEngine.ts    ← resolveStatus (WhatsApp-aware)
│       │   ├── reconciliation.ts
│       │   └── notificationService.ts
│       └── routes/
│           ├── clients.ts
│           ├── invoices.ts
│           ├── bankMovements.ts     ← transacció Prisma a l'import
│           ├── returnedReceipts.ts  ← paginació, creació manual
│           ├── messages.ts
│           ├── webhook.ts           ← sense multer, suporta media
│           ├── settings.ts
│           ├── dashboard.ts
│           └── health.ts            ← GET /api/health
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    ├── vite.config.ts               ← proxy /api → localhost:3001
    └── src/
        ├── main.tsx
        ├── App.tsx                  ← router + ErrorBoundary
        ├── index.css                ← Tailwind
        ├── lib/api.ts               ← client HTTP
        ├── hooks/useApi.ts          ← hook genèric
        ├── components/
        │   ├── Layout.tsx           ← sidebar + content
        │   ├── ErrorBoundary.tsx    ← captura errors de render
        │   ├── StatusBadge.tsx
        │   └── StatsCard.tsx
        └── pages/
            ├── Dashboard.tsx
            ├── ClientsList.tsx
            ├── ClientForm.tsx
            ├── InvoicesList.tsx
            ├── InvoiceForm.tsx
            ├── BankImport.tsx
            ├── ReturnedReceiptsList.tsx
            ├── ReturnedReceiptForm.tsx   ← creació manual d'impagat
            ├── ReturnedReceiptDetail.tsx
            └── Settings.tsx
```

## Model de dades (9 entitats)

| Entitat | Camps clau |
|---------|-----------|
| **Client** | name, poble, phone, whatsapp, email, externalRef, active |
| **Invoice** | clientId, invoiceNumber, date, dueDate, amount, status |
| **BankMovement** | rawData (JSON), concept, amount, date, reference, iban, isReturn |
| **ReturnedReceipt** | clientId?, invoiceId?, bankMovementId, returnedAmount, returnDate, status, timestamps |
| **Message** | receiptId, direction (INBOUND/OUTBOUND), content, status |
| **PaymentProof** | receiptId, filePath, status (RECEIVED/VALIDATED/REJECTED) |
| **ReconciliationMatch** | receiptId, bankMovementId, amount, confidence |
| **AuditLog** | action, entityType, entityId, details (JSON) |
| **AppSettings** | key (PK), value |

## Estats de ReturnedReceipt (12)

`DETECTAT → EMPARELLAT → NOTIFICAT → ESPERANT_JUSTIFICANT | PAGAMENT_DECLARAT → JUSTIFICANT_REBUT → PENDENT_REVISIO → PAGAMENT_CONFIRMAT → TANCAT`
(+ `REVISAR`, `ERROR_WHATSAPP`, `IGNORAT`)

- **DETECTAT**: devolució trobada al CSV, pendent de matching
- **EMPARELLAT**: client amb WhatsApp confirmat, llest per enviar missatge
- **REVISAR**: cal revisió manual (auto-creat, sense WhatsApp, match baix, timeout agent, error agent)
- **NOTIFICAT**: WhatsApp enviat
- **ESPERANT_DETALLS**: agent ha demanat més dades (resposta ambigua), esperant resposta del deutor
- **JUSTIFICANT_REBUT**: client ha respost amb comprovant
- **PAGAMENT_CONFIRMAT**: transferència rebuda i conciliada
- **TANCAT**: tancat manualment
- **IGNORAT**: ignorat (fals positiu)

## Endpoints API

| Ruta | Mètodes |
|------|---------|
| `/api/clients` | GET, POST |
| `/api/clients/:id` | GET, PUT, DELETE |
| `/api/invoices` | GET, POST |
| `/api/invoices/:id` | GET, PUT, DELETE |
| `/api/bank-movements` | GET (paginat: ?page=&limit=), POST (import CSV) |
| `/api/bank-movements/xml` | POST (import SEPA XML pain.002) |
| `/api/returned-receipts` | GET (filtres + paginat: ?page=&limit=), POST (creació manual) |
| `/api/returned-receipts/:id` | GET, PUT (status) |
| `/api/returned-receipts/:id/match` | POST (manual match) |
| `/api/returned-receipts/:id/send-whatsapp` | POST |
| `/api/returned-receipts/:id/reply` | POST (resposta manual, desactiva agent) |
| `/api/returned-receipts/:id/simulate-agent` | POST (provar agent sense enviar) |
| `/api/returned-receipts/:id/execute-agent` | POST (executar flux agent complet: classificar + WhatsApp + canvi estat) |
| `/api/returned-receipts/:id/proof` | POST (upload fitxer) |
| `/api/returned-receipts/send-bulk-whatsapp` | POST (missatge resum per N impagats del mateix client) |
| `/api/returned-receipts/:id` | DELETE (esborra receipt + messages + proofs + matches) |
| `/api/messages` | GET (?receiptId=) |
| `/api/settings` | GET, PUT |
| `/api/settings/test-openwa` | POST |
| `/api/settings/register-webhook` | POST |
| `/api/settings/webhooks` | GET |
| `/api/dashboard` | GET |
| `/api/health` | GET (health check + DB) |
| `/api/openwa/webhook` | POST (rep missatges entrants, JSON) |

## Pàgines del frontend

| Ruta | Pàgina |
|------|--------|
| `/` | Dashboard (5 targetes d'estats) |
| `/clients` | Llistat clients |
| `/clients/new`, `/clients/:id` | Formulari crear/editar client |
| `/invoices` | Llistat factures |
| `/invoices/new`, `/invoices/:id` | Formulari crear/editar factura |
| `/import` | Importar CSV (resultats: imported, detected, matched, reconciled) |
| `/receipts` | Llistat impagats (filtre per estat, columnes Notes i Data emissió) |
| `/receipts/new` | Formulari creació manual d'impagat |
| `/receipts/:id` | Detall impagat (accions: WhatsApp, pujar justificant, canviar estat) |
| `/settings` | Configuració (empresa, OpenWA, keywords, plantilla, webhook) |

## Fluxe principal

1. **Crear clients i factures** manualment, o **importar CSV** → auto-crea clients
2. **Importar CSV o XML SEPA** → detecta devolucions (paraules clau + import negatiu / XML pain.002), calcula període de servei
3. **Matching automàtic** → extreu nom client del concepte, fuzzy match amb BD, auto-crea si no existeix
4. **Crear impagat manual** → des de `/receipts/new` (sense necessitat de CSV)
5. **Revisar impagats** → validar o corregir matches
6. **Enviar WhatsApp** → manual des del detall (plantilla editable amb variables)
7. **Rebre resposta** → webhook rep missatges entrants, agent respon automàticament
8. **Agent conversacional** → classifica resposta del deutor (CAT/ES), confirma pagament o redirigeix
9. **Resposta manual** → usuari pot prendre control i respondre manualment des del detall
10. **Conciliar** → noves transferències entrants es creuen amb impagats oberts

### Variables plantilla WhatsApp
`{{client_name}}`, `{{invoice_number}}`, `{{amount}}`, `{{receipt_reference}}`, `{{service_period}}`, `{{company_iban}}`, `{{company_name}}`

## Configuració OpenWA

- Servidor: `192.168.0.194:2886`
- Sessió configurada: `tlliure` (id: `390fd350-...`)
- Altres sessions disponibles: `keleris`, `importmatica`
- Webhook registrat: `http://192.168.0.177:3001/api/openwa/webhook?secret=impagats-webhook-secret`
- Events: `message.received`

## Comandes per arrencar

```bash
# Postgres
docker compose up -d postgres

# Backend (terminal 1)
cd backend && npm run dev     # → localhost:3001

# Frontend (terminal 2)
cd frontend && npm run dev    # → localhost:5174 (o 5173 si lliure)
```

## Decisions preses

- Monorepo simple (backend/ + frontend/), sense workspaces
- Monousuari (sense login)
- CSV amb delimitador `;`, noms de columna flexibles (català/castellà/anglès)
- CSV: primera fila amb metadades → es detecta i salta automàticament
- CSV: dates en format DD/MM/YY suportades (no MM/DD/YY)
- Columna "Valor" del CSV → data d'emissió del rebut original → període de servei = mes anterior
- Detecció de devolucions: cerca paraules clau (DEV.REBUT, devolució...) + import negatiu
- Matching: 1) núm. factura al concepte, 2) nom client extret del concepte, 3) import ±5%
- Si no es troba client, es crea automàticament → estat REVISAR (pendent de completar WhatsApp)
- Client sense WhatsApp → REVISAR (no es pot enviar missatge). Només EMPARELLAT si té WhatsApp
- WhatsApp: número sense prefix "+" ni sufix "@c.us" (OpenWA no els accepta)
- WhatsApp sempre manual (no automàtic)
- Import CSV dins d'una transacció Prisma ($transaction) per atomicitat
- Paginació als GET de llistes: resposta `{ data, total, page, limit }`. Màxim 100 per pàgina
- CORS restringit a localhost:5174 (dev) i configurable (CORS_ORIGIN) en prod
- Uploads limitats: CSV 5MB, comprovants 10MB, JSON body 1MB
- Webhook OpenWA rep JSON (no multipart), suporta media per URL/base64
- Webhook verificat amb token secret per URL (WEBHOOK_SECRET al .env, "impagats-webhook-secret")
- Webhook cerca rebuts en: NOTIFICAT, ESPERANT_DETALLS, DETECTAT, EMPARELLAT, REVISAR, JUSTIFICANT_REBUT
- Agent només auto-respon en NOTIFICAT/ESPERANT_DETALLS; altres estats guarden missatge en silenci
- .env conté OPENWA_BASE_URL, OPENWA_API_KEY i WEBHOOK_SECRET configurats
- Structured logging amb pino + pino-pretty en dev
- Tests amb Jest + ts-jest. 43 tests en 6 suites (csvImporter, returnDetector, matchingEngine, conversationAgent, health, clients)
- Agent conversacional: classificació regex CAT/ES, 4 intencions (pagament_clar, pagament_ambigu, comprovant_enviat, altres_temes)
- Agent: paraules clau i plantilles configurables via AppSettings (Settings UI)
- Agent: timeout 24h configurable per ESPERANT_DETALLS → timeout expirat → REVISAR amb nota [Timeout agent]
- Agent: no respon si està desactivat (agent.enabled=false) o si el deutor ha estat redirigit
- Agent: resposta sempre en català (plantilles fixes)
- Agent: si falla → envia missatge de disculpa al deutor + marca REVISAR + [Agent error]
- Agent: endpoint simulate-agent (preview sense enviar) + execute-agent (flux complet real)
- Agent: execute-agent és resilient — si WhatsApp falla, igualment guarda missatges i actualitza estat
- Plantilla WhatsApp múltiple: {{receipts_list}} + {{total_amount}} (selecció N impagats → 1 missatge)
- DELETE d'impagats: esborra en cascada (messages, proofs, reconciliationMatches)
- Import SEPA XML (pain.002.001.03): extreu nom deutor, IBAN, import, data, núm. factura (de Ustrd), codi rebuig
- SEPA XML: `ReqdColltnDt` = data d'emissió del rebut → període de servei = mes anterior
- Seed script: `cd backend && DATABASE_URL=... npx ts-node seed.ts` per restaurar dades de prova
- Frontend amb ErrorBoundary i estats d'error a totes les pàgines
- Components frontend separats: CompanySection, OpenWASection, AgentSection, ReceiptInfo, ReceiptActions, ConversationView, StatusBadge, StatsCard
- Graceful shutdown: SIGTERM/SIGINT tanquen servidor HTTP + prisma.$disconnect()
- Connector Caixa Guissona com a placeholder (no inventar endpoints)
- Validació d'input: Zod schemas (createClientSchema, createInvoiceSchema, createReceiptSchema, updateReceiptSchema...) amb validate()
- Filtre de tipus MIME a uploads: CSV, imatges i PDF
- Error handler: distingeix errors Prisma (P2025→404, P2002→409), Zod (400), genèrics (500). Async routes amb asyncHandler wrapper
- Prisma: tipus TxClient exportat (Omit<PrismaClient, ...>) per funcions que accepten tx opcional dins $transaction
- Secrets al .env, configuració no sensible a AppSettings
- Health check: GET /api/health amb verificació de connexió a BD
- Reconciliació: matches de confiança ≥0.8 → PAGAMENT_CONFIRMAT, 0.6-0.8 → REVISAR
- Camp `servicePeriod` a ReturnedReceipt (auto-calculat al crear impagat manual amb data d'emissió)
- Port 5433 per postgres (5432 ocupat per openwa-postgres)
- Port 8080 per frontend producció (80 ocupat)
- Estats traduïts al català
- Dashboard: groupBy per als comptadors principals (1 query en lloc de 5). Resum per deutor: rebuts, períodes, total deute
- Cercador de text i eliminació massiva amb checkboxes a totes les llistes
- Columnes ordenables als impagats (clicar capçalera)
- Camps editables al detall de l'impagat (client, factura, ref, període, motiu, notes)
- Columna Motiu amb significat del codi SEPA (AM04 → "AM04 - Fons insuficients")
- Columna Núm. Factura i Període a la llista d'impagats
- Client: només WhatsApp (sense telèfon) al formulari
- SEPA XML: data invàlida fa fallback a data de factura (Ustrd) → mai es descarta cap impagat
- SEPA XML: codis de rebuig traduïts al català

## OpenWA — format webhook real

- Webhook rep `{event:"message.received", data:{from, body, media, chatId, to, type, fromMe}}`
- `from` pot ser `@lid` (ID intern) o `@c.us` (número real). Netejar amb `from.replace(/@[\w.]+$/, "")`
- Si `@lid`, resoldre contacte via `GET /api/sessions/{id}/contacts/{from}` → `contact.id` té el `@c.us` real
- `@g.us` = grup, `@lid` = llista interna d'OpenWA

## Prisma Decimal → JSON string

- Els camps `Decimal @db.Decimal(10,2)` es serialitzen com a **string** en JSON (`"18.15"`)
- El frontend NO pot fer `.toFixed(2)` directament. Usar helper `formatAmount(val)` que accepta `string|number`
- `formatAmount` és a `frontend/src/lib/api.ts`

## Plantilles WhatsApp

- `replyTemplates.ts` exporta `render(template, vars: TemplateVars): string`
- Cridar `render()` SEMPRE, tant per plantilles custom d'AppSettings com per les default
- Si no es crida `render()`, les variables `{{client_name}}` s'envien en brut al client

## Outbox — processament immediat

- `enqueueMessage()` encua en PENDING. NO envia res a OpenWA.
- Cal cridar `processOneMessage(outboxId)` després per enviar immediatament
- Si no, els missatges queden PENDING fins que s'executi `POST /api/outbox/process`
- L'outbox cancel·la automàticament missatges PENDING antics del mateix rebut abans d'encuar-ne un de nou

## DELETE cascada

Abans d'esborrar un ReturnedReceipt, netejar TOTES les FK:
message → paymentProof → reconciliationMatch → matchCandidate → whatsappOutbox → caseNote → statusHistory

## fast-xml-parser

- `parseAttributeValue: true` converteix strings numèriques a `number` (ex: `"150.50"` → `150.5`)
- La funció `getNested()` ha de gestionar `typeof current === "number"` o retorna null
- `removeNSPrefix: false` permet buscar claus amb namespace. Sense prefix = clau exacta

## Classificador de missatges (7 intents tancats)

- `messageClassifier.ts`: proof_media, payment_claim_without_proof, question, complaint, wrong_person, audio, unknown
- `replyTemplates.ts`: 8 plantilles fixes amb `getReplyTemplate(intent)`
- Totes les respostes són plantilles fixes, sense redacció lliure

## Auth JWT

- `auth.ts` middleware: protegeix totes les rutes excepte `/api/health`, `/api/openwa/webhook`, `/api/auth`
- `.env`: JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD_HASH (bcrypt)
- Sense JWT_SECRET → auth desactivat (mode dev)
- Frontend: token a `localStorage.auth_token`, header `Authorization: Bearer <token>`

## Nous endpoints

| Ruta | Descripció |
|------|-----------|
| `POST /api/auth/login` | Login {email, password} → {token} |
| `GET /api/auth/me` | Verificar token |
| `GET /api/outbox` | Llistar cua |
| `GET /api/outbox/stats` | Estadístiques {pending, sending, sent, failed, cancelled} |
| `POST /api/outbox/process` | Processar cua manualment |
| `POST /api/outbox/:id/retry` | Reenviar missatge fallit |
| `POST /api/outbox/:id/cancel` | Cancel·lar missatge |
| `GET /api/case-notes/:id/notes` | Notes internes d'un rebut |
| `POST /api/case-notes/:id/notes` | Crear nota {body} |
| `GET /api/case-notes/:id/history` | Historial d'estats d'un rebut |

## Tests i build

- Backend: `cd backend && npm test` (112 tests, 10 suites), `npm run build` (tsc)
- Frontend: `cd frontend && npm run build` (tsc + vite)

## Aprenentatges de la sessió 2026-06-12/14

### Agent WhatsApp — intents i plantilles
- 11 intents tancats: greeting_or_identity, proof_media, additional_proof_received, pending_review_status, payment_claim_without_proof, payment_promise, question_about_debt, complaint_or_problem, wrong_person, audio, unknown
- Ordre de classificació: media → PENDENT_REVISIO context → audio → greeting → wrong_person → payment_claim → payment_promise → complaint → question → unknown
- Plantilles editables via AppSettings amb clau `template_{intent}` (ex: `template_greeting`). Valors per defecte a replyTemplates.ts
- Anti-repetició: 30 min per intent, 3 consecutius fora de flux → REVISAR. Proof_media i errors de guardat bypassen anti-repetició
- `pending_review_status` només s'activa si currentStatus === "PENDENT_REVISIO"
- `additional_proof_received` quan hasExistingProof i arriba un nou media
- Resposta manual: `POST /api/returned-receipts/:id/reply` — abans no cridava processOneMessage, els missatges quedaven PENDING

### Pipeline media OpenWA
- Webhook rep `media: { mimetype, filename, data }` — **no** url ni base64
- `media.data` és el fitxer en base64 → `Buffer.from(media.data, "base64")`
- `downloadMedia(url, apiKey?)` amb header X-Api-Key per descàrrega
- MIME: prioritza `media.mimetype` del webhook. Si és octet-stream, infereix de l'extensió del fitxer
- `isAllowedMimeType` neteja paràmetres (`split(";")`) i normalitza variants (`image/jpg` → `image/jpeg`)
- Guardat: `storage/proofs/YYYY/MM/proof_{receiptId}_{timestamp}_{hash}.{ext}`
- Logging en 4 passos: [saveProof] Fallada 1/4 (MIME), 2/4 (directori), 3/4 (escriptura), 4/4 (BD)
- Endpoint debug: `GET /api/health/media-debug`
- Servir fitxers: `GET /api/proofs/:id/file` amb Content-Type i Content-Disposition

### SEPA XML
- `computeServicePeriod(date, invoiceDate?)`: si hi ha invoiceDate → mes de la factura; si no → mes anterior a la data d'emissió
- Dedup: primer per importHash, després per concept+date+amount+reference (fallback per imports antics sense hash)
- Fuzzy matching per paraula exacta (NO substring — evita falsos positius amb inicials com "M" dins "DRAMANE")
- MatchCandidate: receiptId ha de ser receipt.id (no movement.id) — FK violation si no
- `Valor` = data d'emissió del rebut (DD/MM/YY), `invoiceDate` = data de la factura (del Ustrd)

### UX — Detall d'impagat
- Conversa WhatsApp a amplada completa, ordre cronològic, auto-scroll al final amb useRef
- Historial d'estats i notes amb max-height i scroll independent
- ProofViewer: miniatures per imatges, icona per PDF, enllaços "Veure"/"Obrir"

### Dashboard
- Períodes ordenats per `periodToSort()` (YYYYMM), no alfabèticament
- Deutors amb >1 període: fons ambre + icona 🔁

### Configuració
- CORS callback-style per xarxa local
- Vite: `host: "0.0.0.0"`, port fix 5174 al vite.config.ts
- Arrencar Vite SEMPRE des del directori frontend: `(cd frontend && npx vite --host 0.0.0.0 --port 5174)`
- Si s'arrenca des d'un altre directori, Vite no troba index.html i retorna 404
- Chrome de Playwright: `/opt/google/chrome/chrome` ha de ser el Chromium de Playwright, no el del snap

### Notes duplicades
- El webhook filtra notes que ja existeixen: `newNotes.filter(n => !currentNotes.includes(n))`

## Aprenentatges de la sessió 2026-06-14

### UI/UX — Dashboard i targetes
- StatsCard amb `icon`, `subtitle` i `accent` (border-l-4 de color) per targetes més visuals
- Dashboard: targetes agrupades per context (pendents → taronja, procés → blau/lila, confirmat → verd, error → vermell)
- Mètriques: pendents revisió, notificats, esperant justificant, justificant rebut, pagament declarat, error WhatsApp, tancats/confirmats, import pendent

### UI/UX — Taula d'impagats
- Resum superior amb totals globals (servidor) i de pàgina actual
- Filtres ràpids amb píndoles: Pendents, Notificats, Esperant justificant, Justificant rebut, Error WhatsApp
- Columna "Seguiment" amb `SeguimentBadge` (text descriptiu + punt de color) en lloc de text curt
- Capçaleres de columna renombrades: "Data devolució", "Factura", "Motiu devolució", "Seguiment"
- `hover:bg-blue-50/50` a les files
- Import alineat a la dreta amb `font-semibold`
- Paginació: controls Anterior/Següent, `useEffect(() => { reload(); }, [page, filters])`
- Canvi de filtre reinicia pàgina a 1

### UI/UX — StatusBadge
- `statusConfig` object amb `label`, `bg`, `text`, `dot` per cada estat
- Badges amb punt de color (`w-1.5 h-1.5 rounded-full`) + text
- Agrupació cromàtica: groc/taronja (pendent), blau/lila (procés), verd (confirmat), vermell (error), gris (ignorat)
- Noms d'estat interns NO es canvien, només labels i estils

### UI/UX — Detall d'impagat
- Capçalera "fitxa de cas": ID, estat, client, WhatsApp, import, període, última acció
- ReceiptInfo: layout 2 columnes amb grid, motius bancaris traduïts al català
- Traducció: FALTA DE FONDOS → "Falta de fons", COMPTE BLOQUEJAT → "Compte bloquejat", etc.
- `<details>` desplegable amb dades bancàries crues originals

### UI/UX — Importació bancària
- Títol "Importació bancària", descripcions de cada format
- Caixa "Flux recomanat" amb passos numerats
- Targetes de resultat amb colors per categoria (importats, duplicats, devolucions, matching, conciliacions)
- Layout: menú "Importar CSV" → "Importació bancària"

### Backend — uniqueClients
- `GET /api/returned-receipts`: resposta inclou `uniqueClients` (groupBy clientId) a més de `data`, `total`, `page`, `limit`
- `Promise.all` amb 3 queries: findMany, count, groupBy

### WorkTray
- Imports amb `formatAmount()` (suporta Decimal strings de Prisma)

## Aprenentatges de la sessió 2026-06-14 (part 2)

### Agent amb més context (FASE 2)
- `ClassificationInput` ampliat amb: `clientName`, `invoiceNumber`, `receiptAmount`, `servicePeriod`, `pendingReceiptCount`, `hasReconciliationMatch`, `lastMessages`
- `ClassificationResult` té nou flag `shouldBlockWhatsapp`
- Webhook carrega context complet abans de classificar: client, factura, altres rebuts pendents, abonaments, últims missatges
- Si `payment_claim` i `hasReconciliationMatch` → `pending_review_status` (no insistir en justificant)
- Si `question_about_debt` amb dades → `case_info_request` (respon amb info del cas)

### Nous intents (FASE 3)
- **13 intents tancats**: + `unsubscribe` (baixa del canal), + `case_info_request` (info contextual del cas)
- `unsubscribe`: detecta "no m'enviïs més", "esborreu el meu número", "doneu-me de baixa", "STOP", "BAIXA"
- `case_info_request`: pregunta sobre deute amb prou context per respondre amb detalls del cas
- `wrong_person`: ara bloqueja WhatsApp automàticament (`shouldBlockWhatsapp: true`)
- `unsubscribe` i `wrong_person` tenen prioritat sobre greeting/payment_claim
- `payment_promise` té prioritat sobre `payment_claim` (evita classificar promeses futures com claims)
- `unsubscribe` i `case_info_request` no estan subjectes a anti-repetició

### Promeses de pagament (FASE 4)
- Nou model `PaymentPromise` (receiptId, clientId, body, promisedDate, status)
- `extractPromisedDate()`: extreu data de "demà", "divendres", "dia X", "setmana que ve", "final de mes", "mes que ve"
- Webhook crea PaymentPromise automàticament quan `payment_promise`
- DELETE cascada inclou PaymentPromise

### Bloqueig WhatsApp i seguretat (FASE 9)
- Nou camp `Client.whatsappBlocked` (Boolean, default false)
- Webhook bloqueja WhatsApp automàticament per `unsubscribe` i `wrong_person`
- `enqueueMessage` rebutja missatges si client té `whatsappBlocked`
- `sendWhatsApp` rebutja si client bloquejat
- Notes al rebut: "[Possible telèfon incorrecte — WhatsApp bloquejat]", "[Client demana no rebre més WhatsApps — canal bloquejat]"

### Safata de treball (FASE 5)
- Nova pàgina `WorkTray.tsx` a `/work-tray` amb menú "Safata"
- 10 grups de filtres: justificants pendents, pagaments declarats, justificants rebuts, promeses, notificats sense resposta, errors WhatsApp, requereixen revisió, confirmats, tancats, ignorats
- Accions recomanades automàtiques segons estat
- Columna "Dies notificat" amb colors (vermell ≥7d, ambre ≥3d)
- Columna "Última resposta" del client

### Conciliació (FASE 6)
- `reconciliation.ts` reescrit amb scoring multi-factor (0-100):
  - Import exacte: +50, ±2%: +30, ±10%: +10
  - Nom client al concepte: +30 (2+ parts) o +15 (1 part)
  - Factura al concepte: +40
  - Referència al concepte: +20
  - Període al concepte: +10
  - Data posterior al retorn: +5
  - Suma de 2-3 rebuts: +65-70
- Nous endpoints: `POST /api/reconciliation/run`, `GET /api/reconciliation/matches`
- Score ≥80 → PAGAMENT_CONFIRMAT, 40-79 → REVISAR, <40 → no match
- `reconcileNewMovements` busca en estats: NOTIFICAT, JUSTIFICANT_REBUT, PAGAMENT_DECLARAT, ESPERANT_JUSTIFICANT, PENDENT_REVISIO

### Vista client (FASE 7)
- `ClientForm.tsx` millorat: targetes resum (deute total, rebuts pendents, factures, WhatsApp)
- Matriu mensual de 12 mesos amb colors (verd=confirmat, vermell=pendent, blau=notificat, groc=en revisió, gris=sense dades)
- Llista de rebuts del client amb enllaços al detall

### Timeline (FASE 8)
- Nou component `Timeline.tsx`: línia temporal unificada amb punts de color per tipus d'esdeveniment
- Fonts: statusHistory, messages, proofs, reconciliationMatches, caseNotes, paymentPromises
- Integrat a `ReturnedReceiptDetail.tsx` a baix de tot
- Backend: GET `/:id` ara inclou `reconciliation` (amb bankMovement) i `paymentPromises`

### Configuració (FASE 10)
- `AgentSection.tsx` reescrit amb:
  - Mode segur (només guardar, no respondre)
  - Màx. missatges desconeguts
  - 12 plantilles editables (tots els intents)
- Plantilles antigues (4 intents) eliminades de la UI

### Tests (FASE 11)
- 18 tests nous a `messageClassifier.test.ts` (total: 119 tests, 10 suites)
- Cobertura: unsubscribe, wrong_person amb bloqueig, context (payment_claim amb abonament, question_about_debt amb/sense dades), payment_promise amb nous patrons

### Nous endpoints
| Ruta | Descripció |
|------|-----------|
| `POST /api/reconciliation/run` | Executar conciliació manual |
| `GET /api/reconciliation/matches` | Llistar matches amb score |

### Migracions
- `Client.whatsappBlocked` (Boolean, default false)
- `PaymentPromise` (nou model: receiptId, clientId, body, promisedDate, status)
- `Client.poble` (rename nif → poble)
- `Baixa` (nou model: clientId únic, date)

## Aprenentatges de la sessió 2026-06-17

### Camp poble
- `nif` renombrat a `poble` (String?) al model Client, validació Zod, seed.ts, ClientForm, ClientsList
- Migració: `ALTER TABLE "Client" RENAME COLUMN "nif" TO "poble"`
- Canvi fet via `prisma migrate resolve` + `prisma db execute` per problemes amb shadow DB

### Baixes
- Nou model `Baixa` (id, clientId únic, date, createdAt) amb relació 1:1 a Client
- Endpoint `GET/POST/DELETE /api/baixes` (protegit amb auth)
- Pàgina `BaixesList.tsx` a ruta `/baixes`, enllaç "Baixes" al menú lateral
- Clients de baixa mostren badge vermell "Baixa" a ClientsList, ReturnedReceiptsList i ReceiptInfo
- API: GET /clients i GET /returned-receipts inclouen `baixa: true` al include

### Re-avaluació WhatsApp
- `reEvaluateClientReceipts(clientId)` a matchingEngine.ts: quan s'afegeix WhatsApp a un client, tots els seus rebuts REVISAR passen a EMPARELLAT
- Cridat des de PUT /api/clients/:id si `v.data.whatsapp`
- Creació manual d'impagat: comprova WhatsApp del client abans d'assignar estat (EMPARELLAT/REVISAR/DETECTAT)

### Validació Zod
- `emptyToNullNumber` preprocess: converteix `""` → `null` per camps numèrics opcionals
- Aplicat a `updateReceiptSchema.clientId` i `updateReceiptSchema.invoiceId`
- Evita error "expected number, received string" quan el frontend envia camps buits

### Fitxers no rastrejats
- `.gitignore` actualitzat: `.playwright-mcp/`, `backend/storage/`, `*.png`, `*.jpg`, `test.csv`

### Prisma shadow DB
- Si la shadow DB falla, crear migració manualment:
  1. `mkdir prisma/migrations/{timestamp}_{name}`
  2. Escriure `migration.sql`
  3. `npx prisma migrate resolve --applied {name}`
  4. `npx prisma db execute --file prisma/migrations/{name}/migration.sql`
  5. `npx prisma generate`

