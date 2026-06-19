# Impagats — Context del projecte

Historial detallat de decisions i aprenentatges: `docs/DECISIONS.md`.

## Què és

App web per gestionar impagats bancaris: importar moviments (CSV/SEPA XML), detectar devolucions de rebuts, relacionar-les amb clients i factures, i reclamar per WhatsApp via OpenWA.

**Repo:** https://github.com/aclivi-BlockchainTools/impagats (privat)

## Stack

- **Frontend**: React 18 + Vite 6 + Tailwind 3 + React Router 6 (port 5174)
- **Backend**: Node.js + Express 4 + TypeScript (port 3001)
- **BD**: PostgreSQL 16 a Docker (port 5433 host → 5432 container)
- **ORM**: Prisma 5
- **WhatsApp**: Servidor OpenWA a `192.168.0.194:2886`, API Key configurada

## Estructura

```
impagats/
├── docker-compose.yml
├── docs/                        ← DECISIONS.md, tasks/, OPERATIVA.md
├── backend/
│   ├── prisma/schema.prisma     ← 18 models
│   └── src/
│       ├── connectors/OpenWAConnector.ts
│       ├── middleware/ (auth, auditLog, errorHandler)
│       ├── routes/ (clients, invoices, bankMovements, returnedReceipts, messages, webhook, settings, dashboard, health)
│       └── services/ (csvImporter, sepaXmlImporter, returnDetector, matchingEngine, messageClassifier,
│                      conversationAgent, replyTemplates, notificationService, outboxService, proofService,
│                      reconciliation, scheduler, statusHistory, llmObserverService)
└── frontend/
    └── src/
        ├── lib/api.ts + types.ts
        ├── hooks/useApi.ts
        ├── components/ (Layout, StatusBadge, StatsCard, SortHead, ReceiptInfo, ReceiptActions, ...)
        └── pages/ (Dashboard, WorkTray, ClientsList, ClientForm, InvoicesList, InvoiceForm,
                    BankImport, ReturnedReceiptsList, ReturnedReceiptForm, ReturnedReceiptDetail, Settings)
```

## Model de dades (18 entitats)

| Entitat | Funció |
|---------|--------|
| Client, Invoice | Clients i factures |
| BankMovement, ImportBatch | Moviments bancaris importats |
| ReturnedReceipt | L'impagat (entitat central) |
| Message, PaymentProof, PaymentPromise | Conversa WhatsApp i comprovants |
| WhatsappOutbox | Cua d'enviament WhatsApp |
| ReconciliationMatch, MatchCandidate | Conciliació bancària |
| CaseNote, ReturnedReceiptStatusHistory, AuditLog | Auditoria i notes |
| AgentLearningSuggestion, AgentKeywordRule | Observabilitat de l'agent |
| AppSettings, Baixa | Configuració i baixes |

## Estats de ReturnedReceipt

`DETECTAT → EMPARELLAT → NOTIFICAT → ESPERANT_JUSTIFICANT | PAGAMENT_DECLARAT → JUSTIFICANT_REBUT → PENDENT_REVISIO → PAGAMENT_CONFIRMAT → TANCAT`
(+ `REVISAR`, `ERROR_WHATSAPP`, `IGNORAT`)

## Endpoints API

| Ruta | Mètodes / Descripció |
|------|---------------------|
| `/api/clients`, `/:id` | CRUD clients |
| `/api/invoices`, `/:id` | CRUD factures |
| `/api/bank-movements`, `/xml` | GET paginat, POST CSV, POST SEPA XML |
| `/api/returned-receipts`, `/:id` | GET paginat+filtres, POST creació, PUT estat |
| `/api/returned-receipts/notify-all` | POST — encuar tots els EMPARELLAT |
| `/api/returned-receipts/:id/send-whatsapp` | POST — enviament individual |
| `/api/returned-receipts/:id/simulate-agent`, `/execute-agent` | POST — agent |
| `/api/returned-receipts/send-bulk-whatsapp` | POST — N rebuts mateix client |
| `/api/messages` | GET (?receiptId=) |
| `/api/settings`, `/test-openwa`, `/register-webhook`, `/webhooks` | Configuració |
| `/api/dashboard`, `/debtors` | Dashboard |
| `/api/health` | Health check + DB |
| `/api/openwa/webhook` | POST — rep missatges entrants d'OpenWA |
| `/api/auth/login`, `/auth/me` | Auth JWT |
| `/api/outbox`, `/stats`, `/process`, `/:id/retry`, `/:id/cancel` | Cua WhatsApp |
| `/api/case-notes/:id/notes`, `/history` | Notes i historial |
| `/api/scheduler/run` | POST — tick manual |

## Pàgines del frontend

| Ruta | Pàgina |
|------|--------|
| `/` | Dashboard |
| `/work-tray` | Safata de treball (5 cubells) |
| `/clients`, `/clients/new`, `/clients/:id` | Clients |
| `/invoices`, `/invoices/new`, `/invoices/:id` | Factures |
| `/import` | Importar CSV |
| `/receipts`, `/receipts/new`, `/receipts/:id` | Impagats |
| `/settings` | Configuració |

## Fluxe principal

1. Crear clients/factures o importar CSV → auto-crea clients
2. Importar CSV/XML → detecta devolucions, calcula període de servei
3. Matching automàtic → extreu client del concepte, fuzzy match amb BD
4. Revisar/safata → 5 cubells d'acció amb filtres avançats
5. Enviar WhatsApp → manual des del detall (plantilla amb variables)
6. Webhook rep resposta → agent classifica i respon automàticament
7. Conciliar → transferències entrants es creuen amb impagats oberts

## Scheduler

- `scheduler.ts`: worker en segon pla (outbox retry, promeses vençudes, timeout agent, recordatoris)
- Config via AppSettings: `scheduler_enabled`, `reminder_interval_days`, `reminder_max`, `agent_timeout_hours`
- Recordatoris escalonats: s'envien cada X dies (màx. N) des de la notificació, si no hi ha resposta
- UI de configuració a Settings > Agent WhatsApp
- Notify-all només encua (PENDING), el scheduler drena amb pacing 8-20s

## Safata — 5 cubells

Per notificar → Esperant resposta → Per revisar (REVISAR) → Pendent de revisió (proofs) → Tancat
Filtres avançats amb `customFilter`. Columnes ordenables. Comptador de recordatoris visible.

## Comandes

```bash
docker compose up -d postgres
cd backend && npm run dev     # → localhost:3001
cd frontend && npm run dev    # → localhost:5174
cd backend && npm test        # 173 tests, 14 suites
```

Per a detalls complets de decisions, aprenentatges i configuració: `docs/DECISIONS.md`.
