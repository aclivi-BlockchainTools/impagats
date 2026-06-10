# Disseny: Gestió d'impagats bancaris i reclamació WhatsApp

## Visió general

Aplicació web per importar moviments bancaris (CSV, futur API Caixa Guissona), detectar devolucions de rebuts, relacionar-les amb clients i factures, i enviar reclamacions per WhatsApp via OpenWA.

Stack: React + Vite (frontend), Node.js + Express (backend), PostgreSQL + Prisma, Tailwind, Docker Compose.

---

## 1. Model de dades (Prisma)

### Entitats

- **Client**: nom, NIF/CIF, telèfon, whatsapp, email, externalRef, active
- **Invoice**: clientId (FK), invoiceNumber, date, dueDate, amount, status, externalRef
- **BankMovement**: rawData (JSON), concept, amount, date, reference, iban, isReturn (bool)
- **ReturnedReceipt**: clientId (FK?, nullable), invoiceId (FK?, nullable), bankMovementId (FK), receiptReference, returnedAmount, returnDate, returnReason, status (enum), notes, detectedAt, notifiedAt, proofReceivedAt, paymentConfirmedAt, closedAt
- **Message**: receiptId (FK), direction (INBOUND/OUTBOUND), content, sentAt, status, externalId
- **PaymentProof**: receiptId (FK), filePath, status (RECEIVED/VALIDATED/REJECTED), receivedAt, notes
- **ReconciliationMatch**: receiptId (FK), bankMovementId (FK), amount, matchedAt, confidence, manual
- **AuditLog**: action, entityType, entityId, details (JSON), createdAt
- **AppSettings**: key (PK), value

### Estats de ReturnedReceipt

`DETECTED → MATCHED → NOTIFIED → PROOF_RECEIVED → PAYMENT_CONFIRMED → CLOSED`

Estats alternatius: `NEEDS_REVIEW` (des de DETECTED), `IGNORED` (des de qualsevol punt).

### Decisions de disseny

- `BankMovement.rawData` guarda el JSON del moviment original per poder re-processar sense perdre dades.
- `ReturnedReceipt.clientId` i `invoiceId` són opcionals: un impagat pot detectar-se sense client/factura confirmats.
- `Message` guarda tot l'historial WhatsApp (enviat i rebut).
- `PaymentProof` és entitat separada: un impagat pot tenir múltiples justificants.
- `AppSettings` key-value per configuració dinàmica (paraules clau, plantilla WhatsApp, OpenWA, IBAN).

---

## 2. Arquitectura del backend

### Estructura

```
backend/
├── prisma/schema.prisma
├── src/
│   ├── index.ts              # entry point
│   ├── app.ts                # express() + middleware global
│   ├── routes/               # endpoints REST
│   ├── services/             # lògica de negoci
│   ├── connectors/           # BankConnector (iface), CaixaGuissona, OpenWA
│   ├── middleware/            # errorHandler, auditLog
│   └── lib/                  # prisma client, config (env vars)
└── package.json
```

### Capes

- **Routes** → validació d'entrada, criden serveis, retornen JSON
- **Services** → lògica de negoci: csvImporter, returnDetector, matchingEngine, reconciliation, notificationService
- **Connectors** → interfície `BankConnector` amb `fetchMovements(from, to)`, implementació placeholder `CaixaGuissonaConnector` (llança NotImplementedError), i `OpenWAConnector` funcional

### Endpoints

| Ruta | Mètodes |
|------|---------|
| /api/clients | GET, POST |
| /api/clients/:id | GET, PUT, DELETE |
| /api/invoices | GET, POST |
| /api/invoices/:id | GET, PUT, DELETE |
| /api/bank-movements | GET, POST (import CSV) |
| /api/returned-receipts | GET (amb filtres) |
| /api/returned-receipts/:id | GET, PUT (canvi estat) |
| /api/returned-receipts/:id/match | POST (matching manual) |
| /api/returned-receipts/:id/send-whatsapp | POST |
| /api/returned-receipts/:id/proof | POST (upload fitxer) |
| /api/messages | GET (?receiptId=) |
| /api/settings | GET, PUT |
| /api/dashboard | GET |
| /api/openwa/webhook | POST (missatges entrants) |

### Importació CSV

1. L'usuari puja un CSV
2. El backend analitza amb un parser flexible (suporta columnes amb noms diferents)
3. Cada fila es guarda com a `BankMovement` amb `rawData` (JSON)
4. `returnDetector` analitza els moviments nous i crea `ReturnedReceipt` si detecta devolució (paraules clau configurables, import, concepte)
5. `matchingEngine` intenta relacionar cada impagat amb una factura existent per import, referència, número de factura, client o data

### Seguretat

- Variables sensibles en `.env` (DATABASE_URL, OPENWA_BASE_URL, OPENWA_API_KEY)
- `AppSettings` no guarda secrets (només config no sensible)
- AuditLog per totes les accions crítiques (crear/editar clients, enviar WhatsApp, canviar estat impagat)

---

## 3. Arquitectura del frontend

### Estructura

```
frontend/
├── src/
│   ├── App.tsx                # Router
│   ├── pages/                 # 9 pàgines
│   ├── components/            # Layout, StatusBadge, StatsCard, etc.
│   ├── hooks/useApi.ts        # fetch wrapper
│   └── lib/api.ts             # funcions fetch tipades
└── package.json
```

### Rutes

| Path | Pàgina |
|------|--------|
| / | Dashboard |
| /clients | Llistat clients |
| /clients/new, /clients/:id | Formulari client |
| /invoices | Llistat factures |
| /invoices/new, /invoices/:id | Formulari factura |
| /import | Importació CSV |
| /receipts | Llistat impagats (amb filtres) |
| /receipts/:id | Detall impagat + accions (WhatsApp, justificant) |
| /settings | Configuració OpenWA + keywords |

### Layout

Sidebar esquerra amb navegació + àrea de contingut dreta.

---

## 4. Integració OpenWA

### Enviament de missatges

- `OpenWAConnector.sendMessage(phone, text)` → POST a `{OPENWA_BASE_URL}/api/sendMessage`
- Configuració: `OPENWA_BASE_URL` i `OPENWA_API_KEY` a `.env`
- Plantilla editable via `AppSettings` amb variables: `{{client_name}}`, `{{invoice_number}}`, `{{amount}}`, `{{receipt_reference}}`, `{{company_iban}}`, `{{company_name}}`
- No enviament automàtic: sempre requereix acció manual de l'usuari

### Recepció de missatges (webhook)

- Endpoint `/api/openwa/webhook` rep missatges entrants i fitxers (justificants)
- Si el missatge té un fitxer adjunt i hi ha un impagat obert pel remitent, es guarda com a `PaymentProof` i l'impagat passa a `PROOF_RECEIVED`

---

## 5. Conciliació d'abonaments

- Quan s'importen moviments nous (CSV o futur API), `reconciliation` busca transferències entrants que coincideixin amb impagats oberts per import, client, concepte o referència
- Si hi ha match amb confiança alta → `PAYMENT_CONFIRMED`
- Si hi ha dubte → es mostra suggeriment per validació manual

---

## 6. Configuració Docker

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16
  backend:
    build: ./backend
    depends_on: [postgres]
    env_file: ./backend/.env
  frontend:
    build: ./frontend
    depends_on: [backend]
```

En desenvolupament: Docker només per postgres. Backend i frontend s'executen en local amb `npm run dev`.

---

## 7. No inclòs / pendent de decisions futures

- Autenticació d'usuaris (monousuari en MVP)
- API Caixa Guissona real (placeholder preparat)
- Enviament automàtic de WhatsApp (sempre manual en primera versió)
- Workers amb BullMQ/Redis (arquitectura preparada, no implementada en MVP)
