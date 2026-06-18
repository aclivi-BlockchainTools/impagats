# Operativa — Impagats

## Flux complet de l'aplicació

1. **Crear clients i factures** manualment al panell, o importar CSV/XML SEPA.
2. **Importar CSV o XML SEPA** → detecta devolucions per paraules clau + import negatiu / codi de rebuig.
3. **Matching automàtic** → extreu nom client del concepte, fuzzy match (≥0.9 auto, 0.4-0.89 REVISAR, <0.4 auto-crea).
4. **Crear impagat manual** des de `/receipts/new` (sense necessitat de fitxer).
5. **Enviar WhatsApp** → s'encua a l'outbox. Un worker envia amb delay 8-20s i retry (max 3).
6. **Rebre resposta** → webhook rep missatges entrants, classifica i respon amb plantilles fixes.
7. **Justificant rebut** → el fitxer es valida, es guarda amb hash SHA-256, i el cas passa a PENDENT_REVISIO.
8. **Confirmació manual** → un admin revisa el justificant i marca PAGAMENT_CONFIRMAT o TANCAT.

## Estats del rebut

| Estat | Descripció |
|-------|-----------|
| **DETECTAT** | Devolució trobada al CSV/XML, pendent de matching |
| **EMPARELLAT** | Client amb WhatsApp confirmat, llest per notificar |
| **REVISAR** | Cal revisió manual (match dubtós, sense WhatsApp, queixa, error) |
| **NOTIFICAT** | WhatsApp enviat al client |
| **ESPERANT_JUSTIFICANT** | Client ha respost però no ha enviat justificant |
| **PAGAMENT_DECLARAT** | Client diu que ha pagat però no ha adjuntat fitxer |
| **JUSTIFICANT_REBUT** | S'ha rebut un fitxer de justificant |
| **PENDENT_REVISIO** | Justificant rebut, pendent de revisió humana |
| **PAGAMENT_CONFIRMAT** | Pagament confirmat manualment o per conciliació |
| **TANCAT** | Cas tancat |
| **ERROR_WHATSAPP** | Error en l'enviament WhatsApp (3 intents fallits) |
| **IGNORAT** | Fals positiu, ignorat |

### Regles de transició

- **JUSTIFICANT_REBUT** només es marca si s'ha guardat un fitxer correctament.
- "Ja he pagat" sense fitxer → **PAGAMENT_DECLARAT**.
- **PAGAMENT_CONFIRMAT** només per acció manual o conciliació bancària.
- Després de rebre justificant → **PENDENT_REVISIO** (no confirmació automàtica).

## Classificador de missatges

L'agent classifica, no conversa. Intents:

| Intent | Què detecta | Resposta | Canvi d'estat |
|--------|------------|----------|--------------|
| **proof_media** | Imatge/PDF amb fitxer guardat | "Hem rebut el justificant" | JUSTIFICANT_REBUT |
| **payment_claim_without_proof** | "Ja he pagat" sense fitxer | "Envia el justificant" | PAGAMENT_DECLARAT |
| **question** | Preguntes sobre factura/import | "Canal automàtic, contacteu per vies habituals" | - |
| **complaint** | Queixes, disputes | "Canal automàtic, contacteu per vies habituals" | REVISAR |
| **wrong_person** | "No soc jo" | "Contacteu per vies habituals" | REVISAR |
| **audio** | Àudio de WhatsApp | "No gestionem àudios" | - |
| **unknown** | Qualsevol altra cosa | "Canal automàtic, contacteu per vies habituals" | - |

## Com importar CSV/XML

### CSV
- Delimitador `;`
- Columnes reconegudes: Importe/Amount, Concepte/Concept, Data/Date, Referencia/Reference, IBAN
- Dates: DD/MM/YY o DD/MM/YYYY
- Primera fila amb metadades → es detecta i salta automàticament
- Duplicats: detectats per hash (date + amount + concept + reference + iban)

### XML SEPA (pain.002.001.03)
- Suporta namespaces
- Extreu: nom deutor, IBAN, import, data, núm. factura (d'Ustrd), codi rebuig
- Codis de rebuig traduïts al català
- Duplicats: detectats per hash
- Suporta `ReqdColltnDt` com a data d'emissió del rebut

## Com funciona la cua d'enviaments (Outbox)

- Els missatges WhatsApp **no s'envien directament** des dels endpoints.
- S'encuen a la taula `WhatsappOutbox` amb estat `PENDING`.
- El **scheduler** automàtic (cada 5 min) o `POST /api/outbox/process` processa els pendents:
  - Envia d'un en un amb delay aleatori 8-20 segons
  - Reintenta fins a 3 vegades amb backoff exponencial (2, 4, 8 minuts)
  - Si falla 3 cops → `FAILED` + el rebut passa a `ERROR_WHATSAPP`
  - No envia si el rebut està `TANCAT` o `PAGAMENT_CONFIRMAT`

## Scheduler automàtic

El scheduler (`backend/src/services/scheduler.ts`) s'executa cada 5 minuts (configurable) i processa 4 blocs:

1. **Outbox**: processa missatges PENDING amb `scheduledAt <= now`
2. **Promeses vençudes**: PaymentPromise amb `promisedDate < now` → `BROKEN`, rebut a `REVISAR`
3. **Timeout agent**: rebuts en `ESPERANT_JUSTIFICANT`/`PAGAMENT_DECLARAT` >48h → `REVISAR`
4. **Recordatoris**: rebuts `NOTIFICAT` sense resposta, cada 4 dies, màx. 2 cops

Configuració via AppSettings (amb fallback a env): `scheduler_enabled`, `agent_timeout_hours` (48), `reminder_interval_days` (4), `reminder_max` (2).
Tick manual: `POST /api/scheduler/run`.

## Notificar tots post-import

Després d'importar CSV/XML, el botó "Notificar tots els emparellats" encua WhatsApp a tots els rebuts en `EMPARELLAT` amb WhatsApp (no bloquejats ni de baixa).
Endpoint: `POST /api/returned-receipts/notify-all` amb `importBatchId` opcional.

## Què passa quan arriba un justificant

1. Webhook rep el missatge amb media
2. Es descarrega el fitxer des de l'URL d'OpenWA
3. Es valida el MIME type (imatge, PDF, document)
4. Es guarda amb: nom original, MIME, mida, hash SHA-256, storagePath
5. Es crea registre `PaymentProof` amb estat `RECEIVED`
6. Es classifica com `proof_media`
7. El rebut passa a `JUSTIFICANT_REBUT`
8. S'envia resposta: "Hem rebut el justificant. El nostre equip el revisarà."
9. L'admin revisa manualment i marca `PAGAMENT_CONFIRMAT` o `TANCAT`

## Què passa quan el client pregunta

- El classificador detecta `question`
- Es respon amb plantilla fixa: "Aquest canal és automàtic..."
- **No es contesta el fons de la pregunta**
- El rebut **no canvia d'estat**

## Com confirmar manualment un pagament

1. Anar al detall de l'impagat (`/receipts/:id`)
2. Revisar el justificant (fitxer adjunt)
3. Canviar l'estat manualment a `PAGAMENT_CONFIRMAT`
4. Opcional: afegir nota interna amb `POST /api/case-notes/:id/notes`

## Variables d'entorn (.env)

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/impagats
PORT=3001
OPENWA_BASE_URL=http://192.168.0.194:2785
OPENWA_API_KEY=...
WEBHOOK_SECRET=impagats-webhook-secret
JWT_SECRET=...
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD_HASH=$2a$...
CORS_ORIGIN=http://localhost:8080
```

Per generar `ADMIN_PASSWORD_HASH`:
```bash
node -e "const bcrypt=require('bcryptjs');bcrypt.hash('password',10).then(h=>console.log(h))"
```

## Com executar en local

```bash
# 1. Postgres
docker compose up -d postgres

# 2. Backend
cd backend
npm install
npx prisma generate
npm run dev          # → localhost:3001

# 3. Frontend
cd frontend
npm install
npm run dev          # → localhost:5174
```

## Com desplegar amb Docker Compose

Crea un `.env` a l'arrel del projecte:

```env
# OpenWA (obligatori)
OPENWA_BASE_URL=http://192.168.0.194:2785
OPENWA_API_KEY=...

# Auth (obligatori en producció)
JWT_SECRET=una-clau-secreta-llarga
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD_HASH=$2a$...

# Opcional (té defaults)
WEBHOOK_SECRET=impagats-webhook-secret
CORS_ORIGIN=http://192.168.0.177:8080
```

```bash
# Desplegar tot
docker compose up -d

# Els proofs sobreviuen a down/up gràcies al volum storage_data
docker compose down
docker compose up -d
```

## Com executar tests

```bash
cd backend
npm test             # Tests unitaris (76 tests, 7 suites)
npm run build        # Compilació TypeScript

cd frontend
npm run build        # Build Vite + TypeScript
```

## Riscos coneguts d'OpenWA

- OpenWA pot perdre la sessió de WhatsApp i requerir re-escanear QR
- El webhook pot fallar si el servidor OpenWA no és accessible des del backend
- Els missatges amb media poden tardar a descarregar-se
- La cua d'enviaments requereix que el worker s'executi periòdicament (cron o manual)

## Endpoints API

| Ruta | Auth | Descripció |
|------|------|-----------|
| `GET /api/health` | No | Health check |
| `POST /api/openwa/webhook` | Secret (query o header) | Webhook OpenWA |

El webhook accepta el secret per query string (`?secret=...`) o capçalera (`X-Webhook-Secret`).
La capçalera té preferència. Documenta el secret a OpenWA amb el query string per compatibilitat.
| `POST /api/auth/login` | No | Login admin |
| `GET /api/auth/me` | JWT | Verificar token |
| `/api/clients` | JWT | CRUD clients |
| `/api/invoices` | JWT | CRUD factures |
| `/api/bank-movements` | JWT | Import CSV/XML |
| `/api/returned-receipts` | JWT | CRUD impagats + WhatsApp |
| `/api/messages` | JWT | Historial missatges |
| `/api/settings` | JWT | Configuració |
| `/api/dashboard` | JWT | Dashboard |
| `/api/outbox` | JWT | Cua WhatsApp |
| `/api/case-notes` | JWT | Notes internes + historial |
