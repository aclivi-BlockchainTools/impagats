# Impagats — Context del projecte

## Què és

App web per gestionar impagats bancaris: importar moviments (CSV), detectar devolucions de rebuts, relacionar-les amb clients i factures, i reclamar per WhatsApp via OpenWA.

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
| **Client** | name, nif, phone, whatsapp, email, externalRef, active |
| **Invoice** | clientId, invoiceNumber, date, dueDate, amount, status |
| **BankMovement** | rawData (JSON), concept, amount, date, reference, iban, isReturn |
| **ReturnedReceipt** | clientId?, invoiceId?, bankMovementId, returnedAmount, returnDate, status, timestamps |
| **Message** | receiptId, direction (INBOUND/OUTBOUND), content, status |
| **PaymentProof** | receiptId, filePath, status (RECEIVED/VALIDATED/REJECTED) |
| **ReconciliationMatch** | receiptId, bankMovementId, amount, confidence |
| **AuditLog** | action, entityType, entityId, details (JSON) |
| **AppSettings** | key (PK), value |

### Estats de ReturnedReceipt
`DETECTAT → EMPARELLAT → NOTIFICAT → JUSTIFICANT_REBUT → PAGAMENT_CONFIRMAT → TANCAT`
(+ `REVISAR`, `IGNORAT`)

- **DETECTAT**: devolució trobada al CSV, pendent de matching
- **EMPARELLAT**: client amb WhatsApp confirmat, llest per enviar missatge
- **REVISAR**: cal revisió manual (auto-creat, sense WhatsApp, o match baix)
- **NOTIFICAT**: WhatsApp enviat
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
| `/api/returned-receipts/:id/proof` | POST (upload fitxer) |
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
- Webhook registrat: `http://192.168.0.194:3001/api/openwa/webhook`
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
- Webhook verificat amb token secret per URL (WEBHOOK_SECRET al .env, sense default)
- Structured logging amb pino + pino-pretty en dev
- Tests amb Jest + ts-jest. 40 tests en 4 suites (csvImporter, returnDetector, matchingEngine, conversationAgent)
- Agent conversacional: classificació regex CAT/ES, 4 intencions (pagament_clar, pagament_ambigu, comprovant_enviat, altres_temes)
- Agent: paraules clau i plantilles configurables via AppSettings (Settings UI)
- Agent: timeout 24h configurable per ESPERANT_DETALLS
- Agent: no respon si el deutor ha estat redirigit (evita bucles)
- Agent: resposta sempre en català (plantilles fixes)
- DELETE d'impagats: esborra en cascada (messages, proofs, reconciliationMatches)
- Import SEPA XML (pain.002.001.03): extreu nom deutor, IBAN, import, data, núm. factura (de Ustrd), codi rebuig
- SEPA XML: `ReqdColltnDt` = data d'emissió del rebut → període de servei = mes anterior
- Seed script: `cd backend && DATABASE_URL=... npx ts-node seed.ts` per restaurar dades de prova
- Frontend amb ErrorBoundary i estats d'error a totes les pàgines
- Connector Caixa Guissona com a placeholder (no inventar endpoints)
- Validació d'input: whitelist de camps permesos a cada ruta (pick())
- Filtre de tipus MIME a uploads: CSV, imatges i PDF
- Error handler: no exposa detalls interns en producció, usa logger
- Secrets al .env, configuració no sensible a AppSettings
- Health check: GET /api/health amb verificació de connexió a BD
- Reconciliació: matches de confiança ≥0.8 → PAGAMENT_CONFIRMAT, 0.6-0.8 → REVISAR
- Camp `servicePeriod` a ReturnedReceipt (auto-calculat al crear impagat manual amb data d'emissió)
- Port 5433 per postgres (5432 ocupat per openwa-postgres)
- Port 8080 per frontend producció (80 ocupat)
- Estats traduïts al català
