# Gestió d'impagats bancaris i reclamació WhatsApp — Pla d'implementació

> **Per agents:** SUB-SKILL REQUERIT: usar superpowers:subagent-driven-development (recomanat) o superpowers:executing-plans per implementar aquest pla tasca per tasca. Els passos usen checkbox (`- [ ]`) per seguiment.

**Objectiu:** Construir una app web per importar moviments bancaris, detectar impagats, relacionar-los amb clients i factures, i enviar reclamacions per WhatsApp via OpenWA.

**Arquitectura:** Monorepo simple amb `backend/` (Express + Prisma + PostgreSQL) i `frontend/` (React + Vite + Tailwind). Docker Compose per postgres; backend i frontend en local durant dev.

**Tech Stack:** Node.js 20+, TypeScript, Express, Prisma, PostgreSQL 16, React 18, Vite, Tailwind CSS, Docker Compose

---

### Task 1: Estructura del projecte i Docker

**Files:**
- Create: `docker-compose.yml`
- Create: `.gitignore`

- [ ] **Step 1: Crear docker-compose.yml**

```yaml
version: "3.8"
services:
  postgres:
    image: postgres:16
    container_name: impagats-db
    environment:
      POSTGRES_USER: impagats
      POSTGRES_PASSWORD: impagats
      POSTGRES_DB: impagats
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

- [ ] **Step 2: Crear .gitignore**

```
node_modules/
dist/
.env
*.log
uploads/
.superpowers/
```

- [ ] **Step 3: Verificar Docker**

Run: `docker compose up -d`
Expected: postgres s'aixeca. Verificar amb `docker ps`.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml .gitignore
git commit -m "feat: project scaffold with postgres docker"
```

---

### Task 2: Backend — package.json i TypeScript

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/.env`
- Create: `backend/.env.example`

- [ ] **Step 1: Crear backend/package.json**

```json
{
  "name": "impagats-backend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@prisma/client": "^5.22.0",
    "cors": "^2.8.5",
    "express": "^4.21.0",
    "multer": "^1.4.5-lts.1",
    "csv-parse": "^5.5.6",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/multer": "^1.4.12",
    "@types/node": "^22.9.0",
    "prisma": "^5.22.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Crear backend/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Crear backend/.env**

```
DATABASE_URL="postgresql://impagats:impagats@localhost:5432/impagats"
OPENWA_BASE_URL=""
OPENWA_API_KEY=""
PORT=3001
```

- [ ] **Step 4: Crear backend/.env.example** (mateix contingut sense valors reals)

- [ ] **Step 5: Instal·lar dependències**

Run: `cd backend && npm install`
Expected: node_modules creat sense errors.

- [ ] **Step 6: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/tsconfig.json backend/.env.example
git commit -m "feat: backend package.json and typescript config"
```

---

### Task 3: Prisma schema i migració inicial

**Files:**
- Create: `backend/prisma/schema.prisma`

- [ ] **Step 1: Crear backend/prisma/schema.prisma**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Client {
  id          Int       @id @default(autoincrement())
  name        String
  nif         String?
  phone       String?
  whatsapp    String?
  email       String?
  externalRef String?
  active      Boolean   @default(true)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  invoices         Invoice[]
  returnedReceipts ReturnedReceipt[]
}

model Invoice {
  id            Int      @id @default(autoincrement())
  clientId       Int
  invoiceNumber String
  date          DateTime
  dueDate       DateTime?
  amount        Float
  status        String   @default("pending")
  externalRef   String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  client           Client           @relation(fields: [clientId], references: [id])
  returnedReceipts ReturnedReceipt[]
}

model BankMovement {
  id        Int      @id @default(autoincrement())
  rawData   Json
  concept   String?
  amount    Float
  date      DateTime
  reference String?
  iban      String?
  isReturn  Boolean  @default(false)
  createdAt DateTime @default(now())

  returnedReceipts   ReturnedReceipt[]
  reconciliationMatches ReconciliationMatch[]
}

model ReturnedReceipt {
  id               Int       @id @default(autoincrement())
  clientId          Int?
  invoiceId         Int?
  bankMovementId    Int
  receiptReference  String?
  returnedAmount    Float
  returnDate        DateTime
  returnReason      String?
  status            String    @default("DETECTED")
  notes             String?
  detectedAt        DateTime  @default(now())
  notifiedAt        DateTime?
  proofReceivedAt   DateTime?
  paymentConfirmedAt DateTime?
  closedAt          DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  client        Client?        @relation(fields: [clientId], references: [id])
  invoice       Invoice?       @relation(fields: [invoiceId], references: [id])
  bankMovement  BankMovement   @relation(fields: [bankMovementId], references: [id])
  messages      Message[]
  proofs        PaymentProof[]
  reconciliation ReconciliationMatch[]
}

model Message {
  id         Int       @id @default(autoincrement())
  receiptId   Int
  direction  String
  content    String?
  sentAt     DateTime  @default(now())
  status     String    @default("sent")
  externalId String?

  receipt ReturnedReceipt @relation(fields: [receiptId], references: [id])
}

model PaymentProof {
  id         Int       @id @default(autoincrement())
  receiptId   Int
  filePath   String
  status     String    @default("RECEIVED")
  receivedAt DateTime  @default(now())
  notes      String?

  receipt ReturnedReceipt @relation(fields: [receiptId], references: [id])
}

model ReconciliationMatch {
  id              Int       @id @default(autoincrement())
  receiptId        Int
  bankMovementId   Int
  amount          Float
  matchedAt       DateTime  @default(now())
  confidence      Float     @default(1.0)
  manual          Boolean   @default(false)

  receipt       ReturnedReceipt @relation(fields: [receiptId], references: [id])
  bankMovement  BankMovement    @relation(fields: [bankMovementId], references: [id])
}

model AuditLog {
  id         Int      @id @default(autoincrement())
  action     String
  entityType String
  entityId   Int?
  details    Json?
  createdAt  DateTime @default(now())
}

model AppSettings {
  key       String @id
  value     String
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 2: Generar client Prisma i executar migració**

```bash
cd backend && npx prisma migrate dev --name init
```
Expected: migració aplicada a postgres, `node_modules/@prisma/client` generat.

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/
git commit -m "feat: prisma schema with all entities"
```

---

### Task 4: Backend — lib prisma i config

**Files:**
- Create: `backend/src/lib/prisma.ts`
- Create: `backend/src/lib/config.ts`

- [ ] **Step 1: Crear backend/src/lib/prisma.ts**

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
export default prisma;
```

- [ ] **Step 2: Crear backend/src/lib/config.ts**

```typescript
import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "3001"),
  openwaBaseUrl: process.env.OPENWA_BASE_URL || "",
  openwaApiKey: process.env.OPENWA_API_KEY || "",
};
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/lib/
git commit -m "feat: prisma client and config modules"
```

---

### Task 5: Backend — app.ts amb middleware i error handler

**Files:**
- Create: `backend/src/middleware/auditLog.ts`
- Create: `backend/src/middleware/errorHandler.ts`
- Create: `backend/src/app.ts`
- Create: `backend/src/index.ts`

- [ ] **Step 1: Crear backend/src/middleware/auditLog.ts**

```typescript
import prisma from "../lib/prisma";

export async function auditLog(action: string, entityType: string, entityId?: number, details?: any) {
  await prisma.auditLog.create({
    data: { action, entityType, entityId, details },
  });
}
```

- [ ] **Step 2: Crear backend/src/middleware/errorHandler.ts**

```typescript
import { Request, Response, NextFunction } from "express";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error(err.stack);
  res.status(500).json({ error: err.message || "Error intern" });
}
```

- [ ] **Step 3: Crear backend/src/app.ts**

```typescript
import express from "express";
import cors from "cors";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
app.use(cors());
app.use(express.json());
app.use(errorHandler);

export default app;
```

- [ ] **Step 4: Crear backend/src/index.ts**

```typescript
import app from "./app";
import { config } from "./lib/config";

app.listen(config.port, () => {
  console.log(`Backend listening on port ${config.port}`);
});
```

- [ ] **Step 5: Verificar que arrenca**

Run: `cd backend && npx tsx src/index.ts`
Expected: "Backend listening on port 3001"

- [ ] **Step 6: Commit**

```bash
git add backend/src/
git commit -m "feat: express app with error handler and audit log"
```

---

### Task 6: Backend — CRUD Clients

**Files:**
- Create: `backend/src/routes/clients.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Crear backend/src/routes/clients.ts**

```typescript
import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { auditLog } from "../middleware/auditLog";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  const clients = await prisma.client.findMany({ orderBy: { name: "asc" } });
  res.json(clients);
});

router.get("/:id", async (req: Request, res: Response) => {
  const client = await prisma.client.findUnique({ where: { id: parseInt(req.params.id) } });
  if (!client) return res.status(404).json({ error: "Client no trobat" });
  res.json(client);
});

router.post("/", async (req: Request, res: Response) => {
  const client = await prisma.client.create({ data: req.body });
  await auditLog("CREATE", "Client", client.id, req.body);
  res.status(201).json(client);
});

router.put("/:id", async (req: Request, res: Response) => {
  const client = await prisma.client.update({
    where: { id: parseInt(req.params.id) },
    data: req.body,
  });
  await auditLog("UPDATE", "Client", client.id, req.body);
  res.json(client);
});

router.delete("/:id", async (req: Request, res: Response) => {
  await prisma.client.delete({ where: { id: parseInt(req.params.id) } });
  await auditLog("DELETE", "Client", parseInt(req.params.id));
  res.status(204).send();
});

export default router;
```

- [ ] **Step 2: Afegir ruta a backend/src/app.ts** (abans de `app.use(errorHandler)`)

```typescript
import clientsRouter from "./routes/clients";
app.use("/api/clients", clientsRouter);
```

- [ ] **Step 3: Verificar**

Run: `curl http://localhost:3001/api/clients`
Expected: `[]`

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/clients.ts backend/src/app.ts
git commit -m "feat: clients CRUD endpoints"
```

---

### Task 7: Backend — CRUD Factures

**Files:**
- Create: `backend/src/routes/invoices.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Crear backend/src/routes/invoices.ts**

```typescript
import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { auditLog } from "../middleware/auditLog";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  const { clientId } = req.query;
  const where = clientId ? { clientId: parseInt(clientId as string) } : {};
  const invoices = await prisma.invoice.findMany({
    where,
    include: { client: true },
    orderBy: { date: "desc" },
  });
  res.json(invoices);
});

router.get("/:id", async (req: Request, res: Response) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: parseInt(req.params.id) },
    include: { client: true },
  });
  if (!invoice) return res.status(404).json({ error: "Factura no trobada" });
  res.json(invoice);
});

router.post("/", async (req: Request, res: Response) => {
  const invoice = await prisma.invoice.create({ data: req.body });
  await auditLog("CREATE", "Invoice", invoice.id, req.body);
  res.status(201).json(invoice);
});

router.put("/:id", async (req: Request, res: Response) => {
  const invoice = await prisma.invoice.update({
    where: { id: parseInt(req.params.id) },
    data: req.body,
  });
  await auditLog("UPDATE", "Invoice", invoice.id, req.body);
  res.json(invoice);
});

router.delete("/:id", async (req: Request, res: Response) => {
  await prisma.invoice.delete({ where: { id: parseInt(req.params.id) } });
  await auditLog("DELETE", "Invoice", parseInt(req.params.id));
  res.status(204).send();
});

export default router;
```

- [ ] **Step 2: Afegir a backend/src/app.ts**

```typescript
import invoicesRouter from "./routes/invoices";
app.use("/api/invoices", invoicesRouter);
```

- [ ] **Step 3: Verificar**

Run: `curl http://localhost:3001/api/invoices`
Expected: `[]`

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/invoices.ts backend/src/app.ts
git commit -m "feat: invoices CRUD endpoints"
```

---

### Task 8: Backend — BankConnector interface i CaixaGuissona placeholder

**Files:**
- Create: `backend/src/connectors/BankConnector.ts`
- Create: `backend/src/connectors/CaixaGuissonaConnector.ts`

- [ ] **Step 1: Crear backend/src/connectors/BankConnector.ts**

```typescript
export interface BankMovementRaw {
  concept?: string;
  amount: number;
  date: Date;
  reference?: string;
  iban?: string;
  rawData: Record<string, any>;
}

export interface BankConnector {
  fetchMovements(from: Date, to: Date): Promise<BankMovementRaw[]>;
}
```

- [ ] **Step 2: Crear backend/src/connectors/CaixaGuissonaConnector.ts**

```typescript
import { BankConnector, BankMovementRaw } from "./BankConnector";

export class CaixaGuissonaConnector implements BankConnector {
  // Placeholder — no s'implementa fins tenir documentació i credencials
  async fetchMovements(_from: Date, _to: Date): Promise<BankMovementRaw[]> {
    throw new Error("CaixaGuissonaConnector no implementat — pendent de documentació i credencials");
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/connectors/
git commit -m "feat: BankConnector interface and CaixaGuissona placeholder"
```

---

### Task 9: Backend — CSV import service

**Files:**
- Create: `backend/src/services/csvImporter.ts`
- Create: `backend/src/services/returnDetector.ts`
- Create: `backend/src/routes/bankMovements.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Crear backend/src/services/csvImporter.ts**

```typescript
import { parse } from "csv-parse/sync";
import prisma from "../lib/prisma";

interface CsvRow {
  [key: string]: string;
}

const COLUMN_ALIASES: Record<string, string[]> = {
  concept: ["concepto", "concepte", "descripcion", "descripcio", "description", "concept"],
  amount: ["importe", "import", "amount", "quantitat"],
  date: ["fecha", "data", "date", "fecha_operacion", "data_operacio"],
  reference: ["referencia", "referencia", "reference", "ref"],
  iban: ["iban", "IBAN", "cuenta", "compte", "account"],
};

function findColumn(row: CsvRow, aliases: string[]): string | undefined {
  const keys = Object.keys(row);
  return aliases.find((a) => keys.some((k) => k.toLowerCase().trim() === a.toLowerCase()));
}

function getValue(row: CsvRow, aliases: string[]): string | undefined {
  const col = findColumn(row, aliases);
  return col ? row[col]?.trim() : undefined;
}

function parseAmount(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

export async function importCsv(filePath: string): Promise<{ imported: number; skipped: number }> {
  const fs = await import("fs");
  const content = fs.readFileSync(filePath, "utf-8");
  const rows: CsvRow[] = parse(content, {
    columns: true,
    delimiter: ";",
    skip_empty_lines: true,
    bom: true,
  });

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const concept = getValue(row, COLUMN_ALIASES.concept) || "";
    const amount = parseAmount(getValue(row, COLUMN_ALIASES.amount));
    const dateStr = getValue(row, COLUMN_ALIASES.date);
    const reference = getValue(row, COLUMN_ALIASES.reference);
    const iban = getValue(row, COLUMN_ALIASES.iban);

    if (!concept || !dateStr || isNaN(amount)) {
      skipped++;
      continue;
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      skipped++;
      continue;
    }

    await prisma.bankMovement.create({
      data: {
        rawData: row as any,
        concept,
        amount,
        date,
        reference,
        iban,
      },
    });
    imported++;
  }

  return { imported, skipped };
}
```

- [ ] **Step 2: Crear backend/src/services/returnDetector.ts**

```typescript
import prisma from "../lib/prisma";

const DEFAULT_KEYWORDS = [
  "devolucio", "devolución", "recibo devuelto", "impagado",
  "retorno", "adeudo devuelto", "SEPA", "recibo",
];

export async function detectReturns(): Promise<number> {
  const settings = await prisma.appSettings.findMany();
  const keywordsSetting = settings.find((s) => s.key === "return_keywords");
  const keywords = keywordsSetting
    ? keywordsSetting.value.split(",").map((k) => k.trim().toLowerCase())
    : DEFAULT_KEYWORDS;

  const movements = await prisma.bankMovement.findMany({
    where: { isReturn: false },
  });

  let detected = 0;

  for (const mv of movements) {
    const concept = (mv.concept || "").toLowerCase();
    const isNegative = mv.amount < 0;

    const keywordMatch = keywords.some((kw) => concept.includes(kw));

    if (keywordMatch && isNegative) {
      await prisma.bankMovement.update({
        where: { id: mv.id },
        data: { isReturn: true },
      });

      const existing = await prisma.returnedReceipt.findFirst({
        where: { bankMovementId: mv.id },
      });

      if (!existing) {
        await prisma.returnedReceipt.create({
          data: {
            bankMovementId: mv.id,
            returnedAmount: Math.abs(mv.amount),
            returnDate: mv.date,
            returnReason: concept,
            receiptReference: mv.reference || concept,
            status: "DETECTED",
          },
        });
        detected++;
      }
    }
  }

  return detected;
}
```

- [ ] **Step 3: Crear backend/src/routes/bankMovements.ts**

```typescript
import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import prisma from "../lib/prisma";
import { auditLog } from "../middleware/auditLog";
import { importCsv } from "../services/csvImporter";
import { detectReturns } from "../services/returnDetector";

const upload = multer({ dest: path.join(__dirname, "../../uploads") });
const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  const movements = await prisma.bankMovement.findMany({
    orderBy: { date: "desc" },
  });
  res.json(movements);
});

router.post("/", upload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "Fitxer CSV requerit" });

  const { imported, skipped } = await importCsv(req.file.path);
  const detected = await detectReturns();

  await auditLog("IMPORT_CSV", "BankMovement", undefined, { imported, skipped, detected });

  res.json({ imported, skipped, detected });
});

export default router;
```

- [ ] **Step 4: Afegir a backend/src/app.ts**

```typescript
import bankMovementsRouter from "./routes/bankMovements";
app.use("/api/bank-movements", bankMovementsRouter);
```

- [ ] **Step 5: Verificar amb CSV de prova**

Crear `test.csv`:
```
concepte;import;data;referencia
devolucio rebut llum;-150.50;2026-06-01;REC001
pagament normal;200.00;2026-06-02;PAY001
```

Run:
```bash
curl -F "file=@test.csv" http://localhost:3001/api/bank-movements
```
Expected: `{"imported":2,"skipped":0,"detected":1}`

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/ backend/src/routes/bankMovements.ts backend/src/app.ts
git commit -m "feat: CSV import with return detection"
```

---

### Task 10: Backend — matching engine

**Files:**
- Create: `backend/src/services/matchingEngine.ts`
- Modify: `backend/src/routes/bankMovements.ts` (cridar matching després de detectar)

- [ ] **Step 1: Crear backend/src/services/matchingEngine.ts**

```typescript
import prisma from "../lib/prisma";

export async function matchReceipt(receiptId: number): Promise<void> {
  const receipt = await prisma.returnedReceipt.findUnique({
    where: { id: receiptId },
  });

  if (!receipt || receipt.status === "IGNORED" || receipt.status === "CLOSED") return;

  // Matching per referència exacta (número de factura al concepte)
  const ref = receipt.receiptReference || "";
  const invoiceMatch = ref.match(/[\d]{4,}/);
  if (invoiceMatch) {
    const invoice = await prisma.invoice.findFirst({
      where: { invoiceNumber: invoiceMatch[0] },
    });
    if (invoice) {
      await prisma.returnedReceipt.update({
        where: { id: receiptId },
        data: { invoiceId: invoice.id, clientId: invoice.clientId, status: "MATCHED" },
      });
      return;
    }
  }

  // Matching per import
  const invoicesByAmount = await prisma.invoice.findMany({
    where: { amount: { gte: receipt.returnedAmount * 0.95, lte: receipt.returnedAmount * 1.05 } },
  });

  if (invoicesByAmount.length === 1) {
    await prisma.returnedReceipt.update({
      where: { id: receiptId },
      data: {
        invoiceId: invoicesByAmount[0].id,
        clientId: invoicesByAmount[0].clientId,
        status: "MATCHED",
      },
    });
    return;
  }

  if (invoicesByAmount.length > 1) {
    await prisma.returnedReceipt.update({
      where: { id: receiptId },
      data: { status: "NEEDS_REVIEW" },
    });
    return;
  }

  // Cap match
  await prisma.returnedReceipt.update({
    where: { id: receiptId },
    data: { status: "NEEDS_REVIEW" },
  });
}

export async function matchAllDetected(): Promise<number> {
  const detected = await prisma.returnedReceipt.findMany({
    where: { status: "DETECTED" },
  });

  for (const r of detected) {
    await matchReceipt(r.id);
  }

  return detected.length;
}
```

- [ ] **Step 2: Afegir matching al final de bankMovements.ts POST** (després de `detectReturns`)

Al handler POST de `backend/src/routes/bankMovements.ts`, afegir:
```typescript
import { matchAllDetected } from "../services/matchingEngine";

// dins el handler:
const matched = await matchAllDetected();
// canviar res.json a: { imported, skipped, detected, matched }
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/matchingEngine.ts backend/src/routes/bankMovements.ts
git commit -m "feat: auto-matching engine for returned receipts"
```

---

### Task 11: Backend — ReturnedReceipts routes

**Files:**
- Create: `backend/src/routes/returnedReceipts.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Crear backend/src/routes/returnedReceipts.ts**

```typescript
import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { auditLog } from "../middleware/auditLog";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  const { status, clientId, minAmount, maxAmount, from, to } = req.query;
  const where: any = {};

  if (status) where.status = status as string;
  if (clientId) where.clientId = parseInt(clientId as string);
  if (minAmount || maxAmount) {
    where.returnedAmount = {};
    if (minAmount) where.returnedAmount.gte = parseFloat(minAmount as string);
    if (maxAmount) where.returnedAmount.lte = parseFloat(maxAmount as string);
  }
  if (from || to) {
    where.returnDate = {};
    if (from) where.returnDate.gte = new Date(from as string);
    if (to) where.returnDate.lte = new Date(to as string);
  }

  const receipts = await prisma.returnedReceipt.findMany({
    where,
    include: { client: true, invoice: true, bankMovement: true },
    orderBy: { returnDate: "desc" },
  });
  res.json(receipts);
});

router.get("/:id", async (req: Request, res: Response) => {
  const receipt = await prisma.returnedReceipt.findUnique({
    where: { id: parseInt(req.params.id) },
    include: {
      client: true,
      invoice: true,
      bankMovement: true,
      messages: { orderBy: { sentAt: "desc" } },
      proofs: true,
    },
  });
  if (!receipt) return res.status(404).json({ error: "Impagat no trobat" });
  res.json(receipt);
});

router.put("/:id", async (req: Request, res: Response) => {
  const { status, notes, clientId, invoiceId } = req.body;
  const updateData: any = { status, notes, clientId, invoiceId };

  if (status === "NOTIFIED") updateData.notifiedAt = new Date();
  if (status === "PROOF_RECEIVED") updateData.proofReceivedAt = new Date();
  if (status === "PAYMENT_CONFIRMED") updateData.paymentConfirmedAt = new Date();
  if (status === "CLOSED") updateData.closedAt = new Date();

  const receipt = await prisma.returnedReceipt.update({
    where: { id: parseInt(req.params.id) },
    data: updateData,
  });

  await auditLog("UPDATE_STATUS", "ReturnedReceipt", receipt.id, { from: req.body, to: updateData });
  res.json(receipt);
});

router.post("/:id/match", async (req: Request, res: Response) => {
  const { clientId, invoiceId } = req.body;
  const receipt = await prisma.returnedReceipt.update({
    where: { id: parseInt(req.params.id) },
    data: { clientId, invoiceId, status: "MATCHED" },
  });
  await auditLog("MANUAL_MATCH", "ReturnedReceipt", receipt.id, { clientId, invoiceId });
  res.json(receipt);
});

export default router;
```

- [ ] **Step 2: Afegir a backend/src/app.ts**

```typescript
import returnedReceiptsRouter from "./routes/returnedReceipts";
app.use("/api/returned-receipts", returnedReceiptsRouter);
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/returnedReceipts.ts backend/src/app.ts
git commit -m "feat: returned receipts CRUD with filters and manual match"
```

---

### Task 12: Backend — OpenWA connector i WhatsApp service

**Files:**
- Create: `backend/src/connectors/OpenWAConnector.ts`
- Create: `backend/src/services/notificationService.ts`
- Modify: `backend/src/routes/returnedReceipts.ts` (afegir endpoint send-whatsapp)

- [ ] **Step 1: Crear backend/src/connectors/OpenWAConnector.ts**

```typescript
import { config } from "../lib/config";

export class OpenWAConnector {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = config.openwaBaseUrl;
    this.apiKey = config.openwaApiKey;
  }

  async sendMessage(phone: string, text: string): Promise<{ success: boolean; externalId?: string; error?: string }> {
    if (!this.baseUrl) {
      return { success: false, error: "OPENWA_BASE_URL no configurat" };
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": this.apiKey,
        },
        body: JSON.stringify({ phone, message: text }),
      });

      if (!res.ok) {
        return { success: false, error: `OpenWA responded with ${res.status}` };
      }

      const data = await res.json();
      return { success: true, externalId: data.id || data.messageId };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}

export const openwa = new OpenWAConnector();
```

- [ ] **Step 2: Crear backend/src/services/notificationService.ts**

```typescript
import prisma from "../lib/prisma";
import { openwa } from "../connectors/OpenWAConnector";
import { auditLog } from "../middleware/auditLog";

const DEFAULT_TEMPLATE = `Hola {{client_name}},

Hem rebut una devolució del rebut corresponent a la factura {{invoice_number}}.

Import retornat: {{amount}} €
Concepte/rebut: {{receipt_reference}}

Et demanem que facis la transferència de l'import pendent al següent compte:

{{company_iban}}

Un cop feta, si us plau envia'ns per aquest WhatsApp el justificant bancari de la transferència.

Gràcies.
{{company_name}}`;

function resolveTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value || "");
  }
  return result;
}

export async function sendWhatsApp(receiptId: number): Promise<{ success: boolean; error?: string }> {
  const receipt = await prisma.returnedReceipt.findUnique({
    where: { id: receiptId },
    include: { client: true, invoice: true },
  });

  if (!receipt) return { success: false, error: "Impagat no trobat" };
  if (!receipt.client) return { success: false, error: "Sense client assignat" };
  if (!receipt.client.whatsapp) return { success: false, error: "Client sense WhatsApp" };

  // Obtenir plantilla i IBAN d'AppSettings
  const settings = await prisma.appSettings.findMany();
  const templateSetting = settings.find((s) => s.key === "whatsapp_template");
  const ibanSetting = settings.find((s) => s.key === "company_iban");
  const nameSetting = settings.find((s) => s.key === "company_name");

  const template = templateSetting?.value || DEFAULT_TEMPLATE;
  const companyIban = ibanSetting?.value || "ES00 0000 0000 0000 0000 0000";
  const companyName = nameSetting?.value || "Empresa";

  const text = resolveTemplate(template, {
    client_name: receipt.client.name,
    invoice_number: receipt.invoice?.invoiceNumber || "N/A",
    amount: receipt.returnedAmount.toFixed(2),
    receipt_reference: receipt.receiptReference || "",
    company_iban: companyIban,
    company_name: companyName,
  });

  const result = await openwa.sendMessage(receipt.client.whatsapp, text);

  // Guardar missatge
  await prisma.message.create({
    data: {
      receiptId,
      direction: "OUTBOUND",
      content: text,
      status: result.success ? "sent" : "failed",
      externalId: result.externalId,
    },
  });

  if (result.success) {
    await prisma.returnedReceipt.update({
      where: { id: receiptId },
      data: { status: "NOTIFIED", notifiedAt: new Date() },
    });
    await auditLog("SEND_WHATSAPP", "ReturnedReceipt", receiptId);
  }

  return result;
}
```

- [ ] **Step 3: Afegir endpoint a returnedReceipts.ts**

Al final del fitxer `backend/src/routes/returnedReceipts.ts`, abans d'export default:
```typescript
import { sendWhatsApp } from "../services/notificationService";

router.post("/:id/send-whatsapp", async (req: Request, res: Response) => {
  const result = await sendWhatsApp(parseInt(req.params.id));
  if (!result.success) return res.status(400).json({ error: result.error });
  res.json(result);
});
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/connectors/OpenWAConnector.ts backend/src/services/notificationService.ts backend/src/routes/returnedReceipts.ts
git commit -m "feat: OpenWA connector and WhatsApp notification service"
```

---

### Task 13: Backend — PaymentProof upload i webhook OpenWA

**Files:**
- Create: `backend/src/routes/messages.ts`
- Modify: `backend/src/routes/returnedReceipts.ts` (endpoint proof)
- Modify: `backend/src/app.ts` (routes messages + webhook)

- [ ] **Step 1: Afegir endpoint proof a returnedReceipts.ts**

Al `backend/src/routes/returnedReceipts.ts`:
```typescript
import multer from "multer";
import path from "path";

const proofUpload = multer({ dest: path.join(__dirname, "../../uploads/proofs") });

router.post("/:id/proof", proofUpload.single("file"), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "Fitxer requerit" });

  const proof = await prisma.paymentProof.create({
    data: {
      receiptId: parseInt(req.params.id),
      filePath: req.file.path,
      status: "RECEIVED",
    },
  });

  await prisma.returnedReceipt.update({
    where: { id: parseInt(req.params.id) },
    data: { status: "PROOF_RECEIVED", proofReceivedAt: new Date() },
  });

  await auditLog("UPLOAD_PROOF", "ReturnedReceipt", parseInt(req.params.id));
  res.status(201).json(proof);
});
```

- [ ] **Step 2: Crear backend/src/routes/messages.ts**

```typescript
import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  const { receiptId } = req.query;
  const where = receiptId ? { receiptId: parseInt(receiptId as string) } : {};
  const messages = await prisma.message.findMany({
    where,
    orderBy: { sentAt: "desc" },
  });
  res.json(messages);
});

export default router;
```

- [ ] **Step 3: Crear endpoint webhook a app.ts (inline o fitxer separat)**

Crear `backend/src/routes/webhook.ts`:
```typescript
import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import multer from "multer";
import path from "path";

const upload = multer({ dest: path.join(__dirname, "../../uploads/webhook") });
const router = Router();

// OpenWA webhook per missatges entrants
router.post("/", upload.single("file"), async (req: Request, res: Response) => {
  const { from, body, type } = req.body;

  // Buscar clients amb aquest WhatsApp
  const client = await prisma.client.findFirst({
    where: { whatsapp: from, active: true },
  });

  if (!client) return res.status(200).json({ status: "ignored" });

  // Buscar impagats oberts del client
  const openReceipt = await prisma.returnedReceipt.findFirst({
    where: {
      clientId: client.id,
      status: { in: ["NOTIFIED", "DETECTED", "MATCHED", "NEEDS_REVIEW"] },
    },
    orderBy: { returnDate: "desc" },
  });

  if (!openReceipt) return res.status(200).json({ status: "ignored" });

  // Guardar missatge entrant
  await prisma.message.create({
    data: {
      receiptId: openReceipt.id,
      direction: "INBOUND",
      content: body || "",
    },
  });

  // Si hi ha fitxer adjunt, guardar com a justificant
  if (req.file) {
    await prisma.paymentProof.create({
      data: {
        receiptId: openReceipt.id,
        filePath: req.file.path,
        status: "RECEIVED",
      },
    });

    await prisma.returnedReceipt.update({
      where: { id: openReceipt.id },
      data: { status: "PROOF_RECEIVED", proofReceivedAt: new Date() },
    });
  }

  res.status(200).json({ status: "ok" });
});

export default router;
```

- [ ] **Step 4: Afegir rutes a app.ts**

```typescript
import messagesRouter from "./routes/messages";
import webhookRouter from "./routes/webhook";
app.use("/api/messages", messagesRouter);
app.use("/api/openwa/webhook", webhookRouter);
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/returnedReceipts.ts backend/src/routes/messages.ts backend/src/routes/webhook.ts backend/src/app.ts
git commit -m "feat: payment proof upload and OpenWA webhook"
```

---

### Task 14: Backend — Settings i Dashboard

**Files:**
- Create: `backend/src/routes/settings.ts`
- Create: `backend/src/routes/dashboard.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Crear backend/src/routes/settings.ts**

```typescript
import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { auditLog } from "../middleware/auditLog";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  const settings = await prisma.appSettings.findMany();
  const result: Record<string, string> = {};
  for (const s of settings) result[s.key] = s.value;
  res.json(result);
});

router.put("/", async (req: Request, res: Response) => {
  const updates = req.body as Record<string, string>;
  for (const [key, value] of Object.entries(updates)) {
    await prisma.appSettings.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
  await auditLog("UPDATE_SETTINGS", "AppSettings", undefined, updates);
  res.json({ ok: true });
});

export default router;
```

- [ ] **Step 2: Crear backend/src/routes/dashboard.ts**

```typescript
import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  const total = await prisma.returnedReceipt.count();
  const pending = await prisma.returnedReceipt.count({
    where: { status: { in: ["DETECTED", "MATCHED", "NEEDS_REVIEW"] } },
  });
  const notified = await prisma.returnedReceipt.count({
    where: { status: "NOTIFIED" },
  });
  const proofPending = await prisma.paymentProof.count({
    where: { status: "RECEIVED" },
  });
  const closed = await prisma.returnedReceipt.count({
    where: { status: "CLOSED" },
  });

  const pendingTotal = await prisma.returnedReceipt.aggregate({
    _sum: { returnedAmount: true },
    where: { status: { notIn: ["CLOSED", "IGNORED", "PAYMENT_CONFIRMED"] } },
  });

  res.json({
    total,
    pending,
    notified,
    proofPending,
    closed,
    pendingAmount: pendingTotal._sum.returnedAmount || 0,
  });
});

export default router;
```

- [ ] **Step 3: Afegir rutes a app.ts**

```typescript
import settingsRouter from "./routes/settings";
import dashboardRouter from "./routes/dashboard";
app.use("/api/settings", settingsRouter);
app.use("/api/dashboard", dashboardRouter);
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/settings.ts backend/src/routes/dashboard.ts backend/src/app.ts
git commit -m "feat: settings and dashboard endpoints"
```

---

### Task 15: Backend — Reconciliation service

**Files:**
- Create: `backend/src/services/reconciliation.ts`
- Modify: `backend/src/routes/bankMovements.ts` (cridar reconciliation després de matching)

- [ ] **Step 1: Crear backend/src/services/reconciliation.ts**

```typescript
import prisma from "../lib/prisma";

export async function reconcileNewMovements(): Promise<number> {
  const openReceipts = await prisma.returnedReceipt.findMany({
    where: { status: { in: ["NOTIFIED", "PROOF_RECEIVED"] } },
    include: { client: true },
  });

  const unreconciledMovements = await prisma.bankMovement.findMany({
    where: {
      amount: { gt: 0 },
      isReturn: false,
      reconciliationMatches: { none: {} },
    },
  });

  let matched = 0;

  for (const mv of unreconciledMovements) {
    for (const receipt of openReceipts) {
      const amountTolerance = 0.05;
      const minAmount = receipt.returnedAmount * (1 - amountTolerance);
      const maxAmount = receipt.returnedAmount * (1 + amountTolerance);

      if (mv.amount >= minAmount && mv.amount <= maxAmount) {
        // Match per import
        let confidence = 0.6;

        // Si hi ha client, buscar coincidència al concepte
        if (receipt.client && mv.concept) {
          const nameParts = receipt.client.name.toLowerCase().split(" ");
          const conceptLow = mv.concept.toLowerCase();
          const nameMatch = nameParts.some((p) => p.length > 2 && conceptLow.includes(p));
          if (nameMatch) confidence = 0.9;
        }

        if (confidence >= 0.8) {
          await prisma.reconciliationMatch.create({
            data: {
              receiptId: receipt.id,
              bankMovementId: mv.id,
              amount: mv.amount,
              confidence,
            },
          });

          await prisma.returnedReceipt.update({
            where: { id: receipt.id },
            data: { status: "PAYMENT_CONFIRMED", paymentConfirmedAt: new Date() },
          });

          matched++;
          break; // Un moviment només casa amb un impagat
        }
      }
    }
  }

  return matched;
}
```

- [ ] **Step 2: Afegir a bankMovements.ts POST** (després de matchAllDetected)

```typescript
import { reconcileNewMovements } from "../services/reconciliation";
// dins el handler, després de matchAllDetected():
const reconciled = await reconcileNewMovements();
// canviar res.json: { imported, skipped, detected, matched, reconciled }
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/reconciliation.ts backend/src/routes/bankMovements.ts
git commit -m "feat: reconciliation service for incoming transfers"
```

---

### Task 16: Frontend — scaffold Vite + Tailwind + Router

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/postcss.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/index.css`

- [ ] **Step 1: Crear frontend/package.json**

```json
{
  "name": "impagats-frontend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.15",
    "typescript": "^5.6.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: Crear frontend/vite.config.ts**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
```

- [ ] **Step 3: Crear frontend/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Crear frontend/tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
```

- [ ] **Step 5: Crear frontend/postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 6: Crear frontend/index.html**

```html
<!DOCTYPE html>
<html lang="ca">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Impagats</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Crear frontend/src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 8: Crear frontend/src/main.tsx**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
```

- [ ] **Step 9: Crear frontend/src/App.tsx**

```tsx
import { Routes, Route } from "react-router-dom";

function App() {
  return (
    <Routes>
      <Route path="/" element={<div>Dashboard placeholder</div>} />
    </Routes>
  );
}

export default App;
```

- [ ] **Step 10: Instal·lar i verificar**

```bash
cd frontend && npm install && npm run dev
```

Expected: Vite dev server a http://localhost:5173

- [ ] **Step 11: Commit**

```bash
git add frontend/
git commit -m "feat: frontend scaffold with Vite, Tailwind, React Router"
```

---

### Task 17: Frontend — Layout, useApi hook, api lib

**Files:**
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/hooks/useApi.ts`
- Create: `frontend/src/components/Layout.tsx`
- Create: `frontend/src/components/StatusBadge.tsx`
- Create: `frontend/src/components/StatsCard.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Crear frontend/src/lib/api.ts**

```typescript
const BASE = "/api";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Error de xarxa" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Dashboard
  getDashboard: () => request<any>("/dashboard"),

  // Clients
  getClients: () => request<any[]>("/clients"),
  getClient: (id: number) => request<any>(`/clients/${id}`),
  createClient: (data: any) => request<any>("/clients", { method: "POST", body: JSON.stringify(data) }),
  updateClient: (id: number, data: any) => request<any>(`/clients/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteClient: (id: number) => request<void>(`/clients/${id}`, { method: "DELETE" }),

  // Invoices
  getInvoices: (clientId?: number) => request<any[]>(`/invoices${clientId ? `?clientId=${clientId}` : ""}`),
  getInvoice: (id: number) => request<any>(`/invoices/${id}`),
  createInvoice: (data: any) => request<any>("/invoices", { method: "POST", body: JSON.stringify(data) }),
  updateInvoice: (id: number, data: any) => request<any>(`/invoices/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteInvoice: (id: number) => request<void>(`/invoices/${id}`, { method: "DELETE" }),

  // Bank movements
  getBankMovements: () => request<any[]>("/bank-movements"),
  importCsv: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return fetch(BASE + "/bank-movements", { method: "POST", body: formData }).then((r) => r.json());
  },

  // Returned receipts
  getReturnedReceipts: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<any[]>(`/returned-receipts${qs}`);
  },
  getReturnedReceipt: (id: number) => request<any>(`/returned-receipts/${id}`),
  updateReturnedReceipt: (id: number, data: any) => request<any>(`/returned-receipts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  matchReceipt: (id: number, data: any) => request<any>(`/returned-receipts/${id}/match`, { method: "POST", body: JSON.stringify(data) }),
  sendWhatsApp: (id: number) => request<any>(`/returned-receipts/${id}/send-whatsapp`, { method: "POST" }),
  uploadProof: (id: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return fetch(BASE + `/returned-receipts/${id}/proof`, { method: "POST", body: formData }).then((r) => r.json());
  },

  // Messages
  getMessages: (receiptId?: number) => request<any[]>(`/messages${receiptId ? `?receiptId=${receiptId}` : ""}`),

  // Settings
  getSettings: () => request<Record<string, string>>("/settings"),
  updateSettings: (data: Record<string, string>) => request<any>("/settings", { method: "PUT", body: JSON.stringify(data) }),
};
```

- [ ] **Step 2: Crear frontend/src/hooks/useApi.ts**

```typescript
import { useState, useEffect, useCallback } from "react";

export function useApi<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: load };
}
```

- [ ] **Step 3: Crear frontend/src/components/Layout.tsx**

```tsx
import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/clients", label: "Clients" },
  { to: "/invoices", label: "Factures" },
  { to: "/import", label: "Importar CSV" },
  { to: "/receipts", label: "Impagats" },
  { to: "/settings", label: "Configuració" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-slate-800 text-white flex flex-col">
        <div className="p-4 text-xl font-bold border-b border-slate-700">Impagats</div>
        <nav className="flex-1 p-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block px-3 py-2 rounded mb-1 text-sm ${isActive ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-700"}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: Crear frontend/src/components/StatusBadge.tsx**

```tsx
const statusColors: Record<string, string> = {
  DETECTED: "bg-yellow-100 text-yellow-800",
  MATCHED: "bg-blue-100 text-blue-800",
  NEEDS_REVIEW: "bg-orange-100 text-orange-800",
  NOTIFIED: "bg-purple-100 text-purple-800",
  PROOF_RECEIVED: "bg-green-100 text-green-800",
  PAYMENT_CONFIRMED: "bg-emerald-100 text-emerald-800",
  CLOSED: "bg-gray-100 text-gray-800",
  IGNORED: "bg-gray-100 text-gray-500",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusColors[status] || "bg-gray-100 text-gray-800"}`}>
      {status}
    </span>
  );
}
```

- [ ] **Step 5: Crear frontend/src/components/StatsCard.tsx**

```tsx
export default function StatsCard({ label, value, color = "bg-white" }: { label: string; value: string | number; color?: string }) {
  return (
    <div className={`${color} rounded-lg shadow p-4`}>
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
```

- [ ] **Step 6: Actualitzar frontend/src/App.tsx**

```tsx
import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<div>Dashboard</div>} />
        <Route path="/clients" element={<div>Clients</div>} />
        <Route path="/invoices" element={<div>Invoices</div>} />
        <Route path="/import" element={<div>Import</div>} />
        <Route path="/receipts" element={<div>Receipts</div>} />
        <Route path="/settings" element={<div>Settings</div>} />
      </Routes>
    </Layout>
  );
}

export default App;
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/
git commit -m "feat: layout, api lib, useApi hook, StatusBadge, StatsCard"
```

---

### Task 18: Frontend — Pàgina Dashboard

**Files:**
- Create: `frontend/src/pages/Dashboard.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Crear frontend/src/pages/Dashboard.tsx**

```tsx
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import StatsCard from "../components/StatsCard";

export default function Dashboard() {
  const { data, loading } = useApi(() => api.getDashboard());

  if (loading) return <div>Carregant...</div>;
  if (!data) return <div>Sense dades</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard label="Impagats pendents" value={data.pending} color="bg-yellow-50" />
        <StatsCard label="Import pendent" value={`${data.pendingAmount.toFixed(2)} €`} color="bg-red-50" />
        <StatsCard label="Avisats sense resposta" value={data.notified} color="bg-purple-50" />
        <StatsCard label="Justificants pendents" value={data.proofPending} color="bg-blue-50" />
        <StatsCard label="Tancats" value={data.closed} color="bg-green-50" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Actualitzar App.tsx** — substituir l'element placeholder de "/" per:

```tsx
import Dashboard from "./pages/Dashboard";
// ...
<Route path="/" element={<Dashboard />} />
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Dashboard.tsx frontend/src/App.tsx
git commit -m "feat: dashboard page with stats cards"
```

---

### Task 19: Frontend — Pàgines Clients (llistat + formulari)

**Files:**
- Create: `frontend/src/pages/ClientsList.tsx`
- Create: `frontend/src/pages/ClientForm.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Crear frontend/src/pages/ClientsList.tsx**

```tsx
import { Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";

export default function ClientsList() {
  const { data: clients, loading, reload } = useApi(() => api.getClients());

  const handleDelete = async (id: number) => {
    if (!confirm("Segur que vols eliminar aquest client?")) return;
    await api.deleteClient(id);
    reload();
  };

  if (loading) return <div>Carregant...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Clients</h1>
        <Link to="/clients/new" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Nou client</Link>
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Nom</th>
              <th className="text-left p-3">NIF</th>
              <th className="text-left p-3">WhatsApp</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Estat</th>
              <th className="text-right p-3">Accions</th>
            </tr>
          </thead>
          <tbody>
            {clients?.map((c: any) => (
              <tr key={c.id} className="border-t">
                <td className="p-3">{c.name}</td>
                <td className="p-3">{c.nif || "-"}</td>
                <td className="p-3">{c.whatsapp || "-"}</td>
                <td className="p-3">{c.email || "-"}</td>
                <td className="p-3">{c.active ? "Actiu" : "Inactiu"}</td>
                <td className="p-3 text-right space-x-2">
                  <Link to={`/clients/${c.id}`} className="text-blue-600 hover:underline">Editar</Link>
                  <button onClick={() => handleDelete(c.id)} className="text-red-600 hover:underline">Eliminar</button>
                </td>
              </tr>
            ))}
            {clients?.length === 0 && <tr><td colSpan={6} className="p-3 text-center text-gray-500">Cap client</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Crear frontend/src/pages/ClientForm.tsx**

```tsx
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";

export default function ClientForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [form, setForm] = useState({ name: "", nif: "", phone: "", whatsapp: "", email: "", externalRef: "", active: true });

  useEffect(() => {
    if (isEdit) {
      api.getClient(parseInt(id!)).then(setForm);
    }
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEdit) {
      await api.updateClient(parseInt(id!), form);
    } else {
      await api.createClient(form);
    }
    navigate("/clients");
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{isEdit ? "Editar client" : "Nou client"}</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 max-w-lg space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nom *</label>
          <input required className="w-full border rounded px-3 py-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">NIF/CIF</label>
          <input className="w-full border rounded px-3 py-2" value={form.nif} onChange={(e) => setForm({ ...form, nif: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Telèfon</label>
            <input className="w-full border rounded px-3 py-2" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">WhatsApp</label>
            <input className="w-full border rounded px-3 py-2" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input type="email" className="w-full border rounded px-3 py-2" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Referència externa</label>
          <input className="w-full border rounded px-3 py-2" value={form.externalRef} onChange={(e) => setForm({ ...form, externalRef: e.target.value })} />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          <label className="text-sm">Actiu</label>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">{isEdit ? "Desar" : "Crear"}</button>
          <button type="button" onClick={() => navigate("/clients")} className="border px-4 py-2 rounded hover:bg-gray-50">Cancel·lar</button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Actualitzar App.tsx:**

```tsx
import ClientsList from "./pages/ClientsList";
import ClientForm from "./pages/ClientForm";
// ...
<Route path="/clients" element={<ClientsList />} />
<Route path="/clients/new" element={<ClientForm />} />
<Route path="/clients/:id" element={<ClientForm />} />
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ClientsList.tsx frontend/src/pages/ClientForm.tsx frontend/src/App.tsx
git commit -m "feat: clients list and form pages"
```

---

### Task 20: Frontend — Pàgines Factures (llistat + formulari)

**Files:**
- Create: `frontend/src/pages/InvoicesList.tsx`
- Create: `frontend/src/pages/InvoiceForm.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Crear frontend/src/pages/InvoicesList.tsx**

```tsx
import { Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";

export default function InvoicesList() {
  const { data: invoices, loading, reload } = useApi(() => api.getInvoices());

  const handleDelete = async (id: number) => {
    if (!confirm("Segur que vols eliminar aquesta factura?")) return;
    await api.deleteInvoice(id);
    reload();
  };

  if (loading) return <div>Carregant...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Factures</h1>
        <Link to="/invoices/new" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Nova factura</Link>
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Núm. Factura</th>
              <th className="text-left p-3">Client</th>
              <th className="text-left p-3">Data</th>
              <th className="text-right p-3">Import</th>
              <th className="text-left p-3">Estat</th>
              <th className="text-right p-3">Accions</th>
            </tr>
          </thead>
          <tbody>
            {invoices?.map((inv: any) => (
              <tr key={inv.id} className="border-t">
                <td className="p-3">{inv.invoiceNumber}</td>
                <td className="p-3">{inv.client?.name || "-"}</td>
                <td className="p-3">{new Date(inv.date).toLocaleDateString("ca-ES")}</td>
                <td className="p-3 text-right">{inv.amount.toFixed(2)} €</td>
                <td className="p-3">{inv.status}</td>
                <td className="p-3 text-right space-x-2">
                  <Link to={`/invoices/${inv.id}`} className="text-blue-600 hover:underline">Editar</Link>
                  <button onClick={() => handleDelete(inv.id)} className="text-red-600 hover:underline">Eliminar</button>
                </td>
              </tr>
            ))}
            {invoices?.length === 0 && <tr><td colSpan={6} className="p-3 text-center text-gray-500">Cap factura</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Crear frontend/src/pages/InvoiceForm.tsx**

```tsx
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useApi } from "../hooks/useApi";

export default function InvoiceForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const { data: clients } = useApi(() => api.getClients());

  const [form, setForm] = useState({
    clientId: 0, invoiceNumber: "", date: "", dueDate: "",
    amount: 0, status: "pending", externalRef: "",
  });

  useEffect(() => {
    if (isEdit) {
      api.getInvoice(parseInt(id!)).then((inv) => setForm({
        ...inv,
        date: inv.date.slice(0, 10),
        dueDate: inv.dueDate ? inv.dueDate.slice(0, 10) : "",
      }));
    }
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEdit) {
      await api.updateInvoice(parseInt(id!), form);
    } else {
      await api.createInvoice(form);
    }
    navigate("/invoices");
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{isEdit ? "Editar factura" : "Nova factura"}</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 max-w-lg space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Client *</label>
          <select required className="w-full border rounded px-3 py-2" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: parseInt(e.target.value) })}>
            <option value={0}>Selecciona client...</option>
            {clients?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Número de factura *</label>
          <input required className="w-full border rounded px-3 py-2" value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Data *</label>
            <input required type="date" className="w-full border rounded px-3 py-2" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Venciment</label>
            <input type="date" className="w-full border rounded px-3 py-2" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Import *</label>
          <input required type="number" step="0.01" className="w-full border rounded px-3 py-2" value={form.amount} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) })} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Referència externa</label>
          <input className="w-full border rounded px-3 py-2" value={form.externalRef} onChange={(e) => setForm({ ...form, externalRef: e.target.value })} />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">{isEdit ? "Desar" : "Crear"}</button>
          <button type="button" onClick={() => navigate("/invoices")} className="border px-4 py-2 rounded hover:bg-gray-50">Cancel·lar</button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Actualitzar App.tsx:**

```tsx
import InvoicesList from "./pages/InvoicesList";
import InvoiceForm from "./pages/InvoiceForm";
// ...
<Route path="/invoices" element={<InvoicesList />} />
<Route path="/invoices/new" element={<InvoiceForm />} />
<Route path="/invoices/:id" element={<InvoiceForm />} />
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/InvoicesList.tsx frontend/src/pages/InvoiceForm.tsx frontend/src/App.tsx
git commit -m "feat: invoices list and form pages"
```

---

### Task 21: Frontend — Pàgines Import CSV, Impagats, Detall, Configuració

**Files:**
- Create: `frontend/src/pages/BankImport.tsx`
- Create: `frontend/src/pages/ReturnedReceiptsList.tsx`
- Create: `frontend/src/pages/ReturnedReceiptDetail.tsx`
- Create: `frontend/src/pages/Settings.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Crear frontend/src/pages/BankImport.tsx**

```tsx
import { useState } from "react";
import { api } from "../lib/api";

export default function BankImport() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    const res = await api.importCsv(file);
    setResult(res);
    setLoading(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Importar CSV</h1>
      <div className="bg-white rounded-lg shadow p-6 max-w-lg space-y-4">
        <p className="text-sm text-gray-600">Puja un fitxer CSV amb columnes de concepte, import, data i referència. El delimitador ha de ser punt i coma (;).</p>
        <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] || null)} className="block" />
        <button onClick={handleImport} disabled={!file || loading} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
          {loading ? "Important..." : "Importar"}
        </button>
        {result && (
          <div className="bg-gray-50 rounded p-4 text-sm space-y-1">
            <p>Moviments importats: <strong>{result.imported}</strong></p>
            <p>Saltats: <strong>{result.skipped}</strong></p>
            <p>Devolucions detectades: <strong>{result.detected}</strong></p>
            <p>Auto-matching: <strong>{result.matched || 0}</strong></p>
            <p>Conciliacions: <strong>{result.reconciled || 0}</strong></p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Crear frontend/src/pages/ReturnedReceiptsList.tsx**

```tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import StatusBadge from "../components/StatusBadge";

export default function ReturnedReceiptsList() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const { data: receipts, loading } = useApi(() => api.getReturnedReceipts(filters));

  if (loading) return <div>Carregant...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Impagats</h1>
      <div className="bg-white rounded-lg shadow p-4 mb-4 flex gap-4">
        <select className="border rounded px-3 py-2 text-sm" value={filters.status || ""} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">Tots els estats</option>
          <option value="DETECTED">DETECTED</option>
          <option value="MATCHED">MATCHED</option>
          <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
          <option value="NOTIFIED">NOTIFIED</option>
          <option value="PROOF_RECEIVED">PROOF_RECEIVED</option>
          <option value="PAYMENT_CONFIRMED">PAYMENT_CONFIRMED</option>
          <option value="CLOSED">CLOSED</option>
          <option value="IGNORED">IGNORED</option>
        </select>
      </div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Data</th>
              <th className="text-left p-3">Client</th>
              <th className="text-left p-3">Referència</th>
              <th className="text-right p-3">Import</th>
              <th className="text-left p-3">Estat</th>
              <th className="text-right p-3">Accions</th>
            </tr>
          </thead>
          <tbody>
            {receipts?.map((r: any) => (
              <tr key={r.id} className="border-t">
                <td className="p-3">{new Date(r.returnDate).toLocaleDateString("ca-ES")}</td>
                <td className="p-3">{r.client?.name || "-"}</td>
                <td className="p-3">{r.receiptReference || "-"}</td>
                <td className="p-3 text-right">{r.returnedAmount.toFixed(2)} €</td>
                <td className="p-3"><StatusBadge status={r.status} /></td>
                <td className="p-3 text-right">
                  <Link to={`/receipts/${r.id}`} className="text-blue-600 hover:underline">Detall</Link>
                </td>
              </tr>
            ))}
            {receipts?.length === 0 && <tr><td colSpan={6} className="p-3 text-center text-gray-500">Cap impagat</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Crear frontend/src/pages/ReturnedReceiptDetail.tsx**

```tsx
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { api } from "../lib/api";
import StatusBadge from "../components/StatusBadge";

export default function ReturnedReceiptDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: receipt, loading, reload } = useApi(() => api.getReturnedReceipt(parseInt(id!)));
  const [sending, setSending] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);

  const handleSendWhatsApp = async () => {
    setSending(true);
    const result = await api.sendWhatsApp(parseInt(id!));
    if (result.success) reload();
    else alert("Error: " + result.error);
    setSending(false);
  };

  const handleUploadProof = async () => {
    if (!proofFile) return;
    await api.uploadProof(parseInt(id!), proofFile);
    setProofFile(null);
    reload();
  };

  const handleStatusChange = async (newStatus: string) => {
    await api.updateReturnedReceipt(parseInt(id!), { status: newStatus });
    reload();
  };

  if (loading) return <div>Carregant...</div>;
  if (!receipt) return <div>No trobat</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Impagat #{receipt.id}</h1>
        <StatusBadge status={receipt.status} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6 space-y-3">
          <h2 className="font-semibold text-lg">Informació</h2>
          <div><span className="text-sm text-gray-500">Data devolució:</span> {new Date(receipt.returnDate).toLocaleDateString("ca-ES")}</div>
          <div><span className="text-sm text-gray-500">Import retornat:</span> <strong>{receipt.returnedAmount.toFixed(2)} €</strong></div>
          <div><span className="text-sm text-gray-500">Referència:</span> {receipt.receiptReference || "-"}</div>
          <div><span className="text-sm text-gray-500">Motiu:</span> {receipt.returnReason || "-"}</div>
          <div><span className="text-sm text-gray-500">Client:</span> {receipt.client ? <>{receipt.client.name} ({receipt.client.whatsapp || "sense WhatsApp"})</> : "No assignat"}</div>
          <div><span className="text-sm text-gray-500">Factura:</span> {receipt.invoice ? <>#{receipt.invoice.invoiceNumber} ({receipt.invoice.amount.toFixed(2)} €)</> : "No assignada"}</div>
        </div>

        <div className="space-y-4">
          {/* Accions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="font-semibold text-lg mb-4">Accions</h2>
            <div className="space-y-3">
              <button onClick={handleSendWhatsApp} disabled={sending || !receipt.client?.whatsapp}
                className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50">
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
                  <option value="DETECTED">DETECTED</option>
                  <option value="MATCHED">MATCHED</option>
                  <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
                  <option value="NOTIFIED">NOTIFIED</option>
                  <option value="PROOF_RECEIVED">PROOF_RECEIVED</option>
                  <option value="PAYMENT_CONFIRMED">PAYMENT_CONFIRMED</option>
                  <option value="CLOSED">CLOSED</option>
                  <option value="IGNORED">IGNORED</option>
                </select>
              </div>
            </div>
          </div>

          {/* Justificants */}
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

          {/* Historial WhatsApp */}
          {receipt.messages?.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="font-semibold text-lg mb-2">WhatsApp</h2>
              <ul className="text-sm space-y-2">
                {receipt.messages.map((m: any) => (
                  <li key={m.id} className={`p-2 rounded ${m.direction === "OUTBOUND" ? "bg-green-50" : "bg-blue-50"}`}>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{m.direction}</span>
                      <span>{new Date(m.sentAt).toLocaleString("ca-ES")}</span>
                    </div>
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Crear frontend/src/pages/Settings.tsx**

```tsx
import { useState, useEffect } from "react";
import { api } from "../lib/api";

export default function Settings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getSettings().then(setSettings);
  }, []);

  const handleSave = async () => {
    await api.updateSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const set = (key: string, value: string) => setSettings({ ...settings, [key]: value });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Configuració</h1>
      <div className="bg-white rounded-lg shadow p-6 max-w-2xl space-y-6">
        <div>
          <h2 className="font-semibold text-lg mb-3">Dades d'empresa</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nom empresa</label>
              <input className="w-full border rounded px-3 py-2" value={settings.company_name || ""} onChange={(e) => set("company_name", e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">IBAN</label>
              <input className="w-full border rounded px-3 py-2" value={settings.company_iban || ""} onChange={(e) => set("company_iban", e.target.value)} />
            </div>
          </div>
        </div>

        <div>
          <h2 className="font-semibold text-lg mb-3">Paraules clau per detectar devolucions</h2>
          <input className="w-full border rounded px-3 py-2" value={settings.return_keywords || ""}
            onChange={(e) => set("return_keywords", e.target.value)}
            placeholder="devolucio, devolución, recibo devuelto, impagado, ..." />
          <p className="text-xs text-gray-500 mt-1">Separades per comes</p>
        </div>

        <div>
          <h2 className="font-semibold text-lg mb-3">Plantilla WhatsApp</h2>
          <textarea className="w-full border rounded px-3 py-2 font-mono text-sm h-48"
            value={settings.whatsapp_template || ""}
            onChange={(e) => set("whatsapp_template", e.target.value)}
            placeholder="Hola {{client_name}}, ..." />
          <p className="text-xs text-gray-500 mt-1">Variables: {"{{client_name}}"}, {"{{invoice_number}}"}, {"{{amount}}"}, {"{{receipt_reference}}"}, {"{{company_iban}}"}, {"{{company_name}}"}</p>
        </div>

        <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          {saved ? "Desat!" : "Desar configuració"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Actualitzar App.tsx:**

```tsx
import BankImport from "./pages/BankImport";
import ReturnedReceiptsList from "./pages/ReturnedReceiptsList";
import ReturnedReceiptDetail from "./pages/ReturnedReceiptDetail";
import Settings from "./pages/Settings";
// ...
<Route path="/import" element={<BankImport />} />
<Route path="/receipts" element={<ReturnedReceiptsList />} />
<Route path="/receipts/:id" element={<ReturnedReceiptDetail />} />
<Route path="/settings" element={<Settings />} />
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/BankImport.tsx frontend/src/pages/ReturnedReceiptsList.tsx frontend/src/pages/ReturnedReceiptDetail.tsx frontend/src/pages/Settings.tsx frontend/src/App.tsx
git commit -m "feat: CSV import, receipts list/detail, and settings pages"
```

---

### Task 22: Backend Dockerfile i docker-compose final

**Files:**
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Crear backend/Dockerfile**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY prisma ./prisma/
COPY dist ./dist/
RUN npx prisma generate
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

- [ ] **Step 2: Crear frontend/Dockerfile**

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

- [ ] **Step 3: Crear frontend/nginx.conf**

```
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
    location /api/ {
        proxy_pass http://backend:3001;
    }
}
```

- [ ] **Step 4: Actualitzar docker-compose.yml**

```yaml
version: "3.8"
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: impagats
      POSTGRES_PASSWORD: impagats
      POSTGRES_DB: impagats
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
  backend:
    build: ./backend
    ports:
      - "3001:3001"
    depends_on:
      - postgres
    environment:
      DATABASE_URL: "postgresql://impagats:impagats@postgres:5432/impagats"
      PORT: "3001"
      OPENWA_BASE_URL: "${OPENWA_BASE_URL:-}"
      OPENWA_API_KEY: "${OPENWA_API_KEY:-}"
  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend
volumes:
  pgdata:
```

- [ ] **Step 5: Commit**

```bash
git add backend/Dockerfile frontend/Dockerfile frontend/nginx.conf docker-compose.yml
git commit -m "feat: Dockerfiles and final docker-compose"
```

---

### Task 23: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Crear README.md**

```markdown
# Impagats

Aplicació de gestió d'impagats bancaris i reclamació automàtica per WhatsApp.

## Requisits

- Node.js 20+
- Docker i Docker Compose
- (Opcional) Servidor OpenWA per enviament WhatsApp

## Instal·lació

1. Clonar el repositori
2. Copiar variables d'entorn: `cp backend/.env.example backend/.env`
3. Editar `backend/.env` amb les teves dades
4. Aixecar PostgreSQL: `docker compose up -d postgres`
5. Instal·lar dependències backend: `cd backend && npm install`
6. Executar migracions: `cd backend && npx prisma migrate dev`
7. Instal·lar dependències frontend: `cd frontend && npm install`
8. Arrencar backend: `cd backend && npm run dev`
9. Arrencar frontend: `cd frontend && npm run dev`
10. Obrir http://localhost:5173

## Configuració OpenWA

1. Assegura't de tenir un servidor OpenWA en marxa
2. Configura `OPENWA_BASE_URL` i `OPENWA_API_KEY` al `.env`
3. Configura el webhook d'OpenWA per apuntar a `http://<backend>:3001/api/openwa/webhook`

## Ús

1. Crea clients i factures
2. Importa un CSV amb moviments bancaris (delimitador `;`)
3. L'app detecta automàticament les devolucions i les relaciona amb factures
4. Revisa els impagats detectats
5. Des del detall d'un impagat, envia el missatge WhatsApp al client
6. Quan el client respon amb un justificant, es registra automàticament via webhook

## Format CSV

Columnes esperades (amb noms flexibles):
- concepte / concepto / descripcion / description
- import / importe / amount
- data / fecha / date
- referencia / referencia / reference (opcional)
- iban / cuenta / compte / account (opcional)

Delimitador: punt i coma (;)

## Producció

```bash
docker compose up -d
```

Backend a http://localhost:3001, frontend a http://localhost.

## Llicència

Privat.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README with installation and usage instructions"
```

---

### Task 24: Verificació final i smoke test

- [ ] **Step 1: Aixecar PostgreSQL**

```bash
docker compose up -d postgres && sleep 3
```

- [ ] **Step 2: Executar migracions**

```bash
cd backend && npx prisma migrate dev
```
Expected: "Applying migration..."

- [ ] **Step 3: Arrencar backend**

```bash
cd backend && npm run dev &
sleep 3
```

- [ ] **Step 4: Smoke test CRUD**

```bash
# Crear client
curl -X POST http://localhost:3001/api/clients \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Client","nif":"12345678Z","whatsapp":"34600000000"}'

# Llistar
curl http://localhost:3001/api/clients

# Dashboard
curl http://localhost:3001/api/dashboard
```
Expected: Totes les respostes 2xx amb JSON vàlid.

- [ ] **Step 5: Provar importació CSV**

Crear `test.csv`:
```
concepte;import;data
devolucio rebut gas;-89.50;2026-06-01
pagament rebut;500.00;2026-06-02
```

```bash
curl -F "file=@test.csv" http://localhost:3001/api/bank-movements
```
Expected: `{"imported":2,"skipped":0,"detected":1,"matched":0,"reconciled":0}`

- [ ] **Step 6: Verificar frontend compila**

```bash
cd frontend && npm run build
```
Expected: "✓ built in ..."

- [ ] **Step 7: Netejar i documentar resultat**

```bash
kill %1  # aturar backend
rm test.csv
```

El smoke test ha de passar complet. Si hi ha errors, corregir abans de declarar completat.
```

