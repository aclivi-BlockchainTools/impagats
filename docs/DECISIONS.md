# Decisions i aprenentatges — Impagats

Historial detallat de decisions, aprenentatges i context tècnic acumulat al llarg del projecte.
Consulta CLAUDE.md per al resum executiu i la informació estructural.

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

## Aprenentatges de la sessió 2026-06-18

### UI/UX — Sidebar, Dashboard i Safata

- **Sidebar reorganitzada** a `Layout.tsx`: seccions amb etiquetes (Principal/Gestió/Administració), icones emoji i separador per Monitor
- **Dashboard "Què cal fer ara?"**: targetes amb enllaços directes a `/work-tray?filter=<clau>`. Substitueix l'antic WorkTray incrustat (eliminat)
- **components/WorkTray.tsx eliminat**: era un duplicat simplificat de pages/WorkTray.tsx. Ara la Safata és la font única de veritat
- **Safata suporta `?filter=`**: usant `useSearchParams()` + `useEffect` per pre-seleccionar el filtre des d'enllaços externs
- **Dashboard↔Safata match exacte**: els comptes de les targetes han de coincidir amb els estats del filtre de destinació. El backend retorna comptes individuals (`countRevisar`, `countPendentRevisio`, `countJustificantRebut`, `countPagamentDeclarat`) per evitar desajustos
- **Fusió filtres proof**: `proof_pending` a la Safata inclou PENDENT_REVISIO (WhatsApp webhook) + JUSTIFICANT_REBUT (manual upload). Són el mateix (justificant rebut) per canals diferents
- **Filtre `proof_received` eliminat** de la Safata (redundant, fusionat amb `proof_pending`)

### UI/UX — Llista d'impagats

- **Accions ràpides**: botons WhatsApp i Ignorar a cada fila sense obrir el detall. WhatsApp només per estats DETECTAT/EMPARELLAT/REVISAR/ERROR_WHATSAPP amb WhatsApp al client. Ignorar per a tots menys TANCAT/IGNORAT
- **Indicadors d'urgència**: `border-l-4` acolorit per antiguitat: vermell ≥15d, ambre ≥7d, groc ≥3d
- **Temps relatiu**: funció `relativeTime()` mostra "Avui", "Ahir", "Fa 3 dies", "Fa 2 setmanes" sota la data
- **refreshKey**: estat `useState(0)` per forçar recàrrega de dades després d'accions ràpides sense tocar els paràmetres de paginació/filtre

### Backend — Dashboard API

- Nous camps al response: `countRevisar`, `countPendentRevisio`, `countJustificantRebut`, `countPagamentDeclarat`
- S'extreuen de l'objecte `counts` del `groupBy` ja existent (no cal query extra)

## Aprenentatges de la sessió 2026-06-18 (part 2)

### Bug emptyToNullNumber — undefined → null
- `emptyToNullNumber(v)` convertia `undefined` a `null` (`v === "" || v === null || v === undefined ? null : Number(v)`)
- Quan el frontend envia `{ status: "PAGAMENT_CONFIRMAT" }` (sense `clientId`), Zod passa `undefined` al preprocess → esdevé `null` → Prisma sobreescriu `clientId` a NULL
- Fix: `(v === "" ? null : v)` — `undefined` passa a Zod `.optional()` que el tracta com a camp absent de l'update

### Plantilles per defecte — doble font
- `DEFAULT_TEMPLATE`/`DEFAULT_MULTIPLE_TEMPLATE` a `Settings.tsx` han de coincidir amb `TEMPLATE_INITIAL_NOTIFICATION`/`TEMPLATE_MULTIPLE_NOTIFICATION` a `replyTemplates.ts`
- Si difereixen, el placeholder de Settings no reflecteix el que realment s'envia

### Recàrrec 2€ per devolució
- Càlcul dinàmic a `notificationService.ts` (sense BD): compta tots els impagats del client, si >1 afegeix 2€ per rebut notificat
- Noves variables de plantilla: `{{return_fee_per_receipt}}`, `{{return_fee_total}}`, `{{total_with_fee}}`
- Plantilla editable a Settings amb clau `whatsapp_template_fee_line` (per defecte `TEMPLATE_FEE_LINE` a replyTemplates.ts)
- Notificació múltiple: cada rebut mostra `+ 2,00 € (despesa devolució)` a la línia

### WorkTray — filtres amb customFilter
- `TrayFilter` té camp opcional `customFilter: (r: any) => boolean` per subdividir estats sense canviar el backend
- REVISAR dividit en: `review_nowhatsapp` (sense WhatsApp) i `review_other` (amb WhatsApp)
- NOTIFICAT dividit en: `notified_replied` (té missatges INBOUND) i `notified_no_response` (sense resposta)
- S'aplica tant al `useMemo` de filtratge com als comptadors de les píndoles

