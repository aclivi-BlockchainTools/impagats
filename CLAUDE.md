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
├── docs/
│   ├── context.md                    ← aquest fitxer
│   └── superpowers/
│       ├── specs/2026-06-10-impagats-design.md
│       └── plans/2026-06-10-impagats-plan.md
├── backend/
│   ├── Dockerfile
│   ├── .env                         ← DATABASE_URL, OPENWA_*, PORT
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/schema.prisma         ← 9 models
│   └── src/
│       ├── index.ts                 ← entry point
│       ├── app.ts                   ← express() + routes
│       ├── lib/
│       │   ├── prisma.ts
│       │   └── config.ts
│       ├── middleware/
│       │   ├── auditLog.ts
│       │   └── errorHandler.ts
│       ├── connectors/
│       │   ├── BankConnector.ts         ← interfície
│       │   ├── CaixaGuissonaConnector.ts ← placeholder
│       │   └── OpenWAConnector.ts       ← sendMessage, testConnection, registerWebhook
│       ├── services/
│       │   ├── csvImporter.ts
│       │   ├── returnDetector.ts
│       │   ├── matchingEngine.ts
│       │   ├── reconciliation.ts
│       │   └── notificationService.ts
│       └── routes/
│           ├── clients.ts
│           ├── invoices.ts
│           ├── bankMovements.ts
│           ├── returnedReceipts.ts
│           ├── messages.ts
│           ├── webhook.ts
│           ├── settings.ts
│           └── dashboard.ts
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    ├── vite.config.ts               ← proxy /api → localhost:3001
    └── src/
        ├── main.tsx
        ├── App.tsx                  ← router
        ├── index.css                ← Tailwind
        ├── lib/api.ts               ← client HTTP
        ├── hooks/useApi.ts          ← hook genèric
        ├── components/
        │   ├── Layout.tsx           ← sidebar + content
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
`DETECTED → MATCHED → NOTIFIED → PROOF_RECEIVED → PAYMENT_CONFIRMED → CLOSED`
(+ `NEEDS_REVIEW`, `IGNORED`)

## Endpoints API

| Ruta | Mètodes |
|------|---------|
| `/api/clients` | GET, POST |
| `/api/clients/:id` | GET, PUT, DELETE |
| `/api/invoices` | GET, POST |
| `/api/invoices/:id` | GET, PUT, DELETE |
| `/api/bank-movements` | GET (llistat), POST (import CSV) |
| `/api/returned-receipts` | GET (filtres: status, clientId, amount, dates) |
| `/api/returned-receipts/:id` | GET, PUT (status) |
| `/api/returned-receipts/:id/match` | POST (manual match) |
| `/api/returned-receipts/:id/send-whatsapp` | POST |
| `/api/returned-receipts/:id/proof` | POST (upload fitxer) |
| `/api/messages` | GET (?receiptId=) |
| `/api/settings` | GET, PUT |
| `/api/settings/test-openwa` | POST |
| `/api/settings/register-webhook` | POST |
| `/api/settings/webhooks` | GET |
| `/api/dashboard` | GET |
| `/api/openwa/webhook` | POST (rep missatges entrants) |

## Pàgines del frontend

| Ruta | Pàgina |
|------|--------|
| `/` | Dashboard (5 targetes d'estats) |
| `/clients` | Llistat clients |
| `/clients/new`, `/clients/:id` | Formulari crear/editar client |
| `/invoices` | Llistat factures |
| `/invoices/new`, `/invoices/:id` | Formulari crear/editar factura |
| `/import` | Importar CSV (resultats: imported, detected, matched, reconciled) |
| `/receipts` | Llistat impagats (filtre per estat) |
| `/receipts/:id` | Detall impagat (accions: WhatsApp, pujar justificant, canviar estat) |
| `/settings` | Configuració (empresa, OpenWA, keywords, plantilla, webhook) |

## Fluxe principal

1. **Crear clients i factures** manualment
2. **Importar CSV** → detecta devolucions (paraules clau + import negatiu)
3. **Matching automàtic** → relaciona amb factures per referència o import (±5%)
4. **Revisar impagats** → validar o corregir matches
5. **Enviar WhatsApp** → manual des del detall (plantilla editable)
6. **Rebre resposta** → webhook rep missatges entrants, guarda justificants
7. **Conciliar** → noves transferències entrants es creuen amb impagats oberts

## Configuració OpenWA

- Servidor: `192.168.0.194:2785`
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
- Connector Caixa Guissona com a placeholder (no inventar endpoints)
- WhatsApp sempre manual (no automàtic)
- Secrets al .env, configuració no sensible a AppSettings
- Port 5433 per postgres (5432 ocupat per openwa-postgres)
- Port 8080 per frontend producció (80 ocupat)
