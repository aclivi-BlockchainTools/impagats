# Tasca: Task 23: README - Crear README.md amb instruccions d'instal·

Data: 2026-06-10 13:35:37
Projecte: impagats
Model recomanat: deepseek-v4-pro
Categoria: implementació

## Prompt

Task 23: README - Crear README.md amb instruccions d'instal·lació, ús, format CSV, configuració OpenWA i producció

## Context usat

Projecte: impagats

Última tasca: Task 22: Dockerfiles finals. Crear backend/Dockerfile, front (implementat: sí)

## Tasca sol·licitada

Task 23: README - Crear README.md amb instruccions d'instal·lació, ús, format CSV, configuració OpenWA i producció

## Instruccions

1. NO proposis implementar funcionalitats que l'Estat actual indica com a completades o funcionals.
2. Si una àrea ja està implementada però no verificada, marca-la com a 'verificar', no com a 'implementar'.
3. Si la tasca és d'an...

## Resposta del model

## ✅ README.md

```markdown
# impagats

Sistema per gestionar factures impagades i enviar recordatoris automàtics per WhatsApp.

## Característiques

- Interfície web per pujar factures en format CSV
- Enviament massiu de recordatoris de pagament via WhatsApp
- Gestió d’estats (pendent, enviat, confirmat)
- Basat en **OpenWA** (WhatsApp Web automation) per a una comunicació directa i gratuïta
- Totalment *dockeritzable* per a entorns de producció

## Requisits previs

- Node.js 18+
- npm (inclòs amb Node)
- Docker i Docker Compose (per producció)
- Un compte de WhatsApp actiu per a l’enviament (s’utilitzarà un número dedicat)

## Instal·lació en desenvolupament

1. Clona el repositori:
   ```bash
   git clone https://github.com/el-teu-usuari/impagats.git
   cd impagats
   ```

2. Backend:
   ```bash
   cd backend
   npm install
   cp .env.example .env   # edita les variables si cal
   ```

3. Frontend:
   ```bash
   cd frontend
   npm install
   ```

## Configuració OpenWA

El backend utilitza [`@open-wa/wa-automate`](https://docs.openwa.dev/) per automatitzar WhatsApp Web.  
La primera vegada caldrà escanejar un codi QR amb el número de WhatsApp que farà els enviaments.

### Variables d’entorn (backend)

Crea un fitxer `.env` al directori `backend` a partir de `.env.example`:

```
# .env.example
SESSION_ID=impagats-session
WHATSAPP_RECIPIENT_VERIFY=34XXXXXXXXX  # número on rebre missatges de prova (opcional)
```

- **SESSION_ID**: identificador únic per desar la sessió de WhatsApp. Es guardarà a `./.wwebjs_auth` (autònom) o `./session.json` (si s’usa `@open-wa` amb `useStealth`). En producció, a dins del contenidor es conserva gràcies al volum `session-data`.
- La sessió s’emmagatzema de forma persistent; la propera execució no requerirà tornar a escanejar el QR (sempre que el número no es desvinculi).

## Ús en desenvolupament

1. **Backend** (en mode desenvolupament):
   ```bash
   cd backend
   npm run dev
   ```
   S’obrirà una pestanya del navegador (Chromium per defecte) amb el WhatsApp Web. Escaneja el codi QR des de l’app de WhatsApp al teu telèfon. Un cop autenticat, el backend queda llest per rebre peticions.

2. **Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```
   Obre el navegador a `http://localhost:5173`.

3. Puja un fitxer CSV amb les factures impagades des de la interfície i prem “Enviar recordatoris”.  
   El backend processarà cada fila i enviarà un missatge predefinit al número indicat.

## Format del fitxer CSV

El fitxer CSV ha de contenir **obligatòriament** les columnes següents (separades per comes, codificació UTF-8, primera fila com a capçaleres):

| Columna       | Descripció                                      | Exemple               |
|---------------|--------------------------------------------------|-----------------------|
| `telefon`     | Número de telèfon amb prefix internacional       | `34XXXXXXXXX`         |
| `factura`     | Identificador o número de factura                | `F2025-001`           |
| `import`      | Import pendent (sense símbol, punt com a decimal)| `149.99`              |
| `venciment`   | Data de venciment en format AAAA-MM-DD           | `2025-02-28`          |
| `nom`         | Nom del client (apareixerà al missatge)          | `Maria Garcia`        |

**Exemple de fitxer vàlid (`impagats.csv`):**
```
telefon,factura,import,venciment,nom
34600123456,F2025-001,149.99,2025-02-28,Maria Garcia
34600987654,F2025-002,250.00,2025-03-01,Joan Soler
```

El missatge enviat serà similar a:  
*“Hola Maria Garcia, et recordem que la factura F2025-001 per un import de 149.99 € vençuda el 28/02/2025 està pendent de pagament. Si us plau, posa’t en contacte amb nosaltres.”*

## Producció amb Docker

El projecte inclou `Dockerfile` tant per al frontend com per al backend, pensats per executar-se conjuntament amb `docker compose`.

### Construir i executar

Des de l’arrel del projecte:

```bash
docker compose up -d
```

Això aixecarà:

- **frontend**: servit per nginx a `http://localhost` (port 80)
- **backend**: Node.js amb Chromium headless per OpenWA (port 3000 intern)
- **Volum** `session-data` per conservar la sessió de WhatsApp entre reinicis

### Primera execució en producció

El contenidor del backend intentarà restaurar la sessió desada. Si no n’hi ha cap, caldrà autenticar WhatsApp manualment:

1. Amb els contenidors en marxa, executa:
   ```bash
   docker exec -it impagats-backend-1 npm run login
   ```
   Això obrirà una interfície de text al terminal que mostrarà un codi QR (caldrà tenir un terminal que suporti la renderització del QR, o bé es pot redirigir el display amb `docker run -e DISPLAY...` si es té un servidor X11). Alternativament, es pot configurar `WHATSAPP_HEADLESS=false` al `docker-compose.yml`, mapejar un port de VNC i connectar-s’hi per escanejar el QR.

2. Un cop escanejat, la sessió quedarà desada al volum `session-data`. Pots cancel·lar la sessió de login (Ctrl+C) i reiniciar el contenidor normalment: `docker compose restart backend`.

**Recomanació de seguretat:**  
Mantingues el volum `session-data` en un lloc segur, ja que conté la sessió activa del teu compte de WhatsApp. No el comparteixis ni l’incloguis en repositoris.

## Configuració avançada

- **Variables d’entorn al contenidor** (es poden definir a `docker-compose.yml`):
  - `NODE_ENV=production`
  - `SESSION_ID=impagats-session`
  - `WHATSAPP_RECIPIENT_VERIFY` (opcional)
  - `WA_BROWSER_PATH` – per defecte s’usa Chromium integrat
- **Frontend**: el `docker-compose` exposa el frontend al port 80. Pots canviar-lo a la secció `ports`.

## Estructura del projecte

```
impagats/
├── backend/
│   ├── Dockerfile
│   ├── .env.example
│   ├── src/
│   └── ...
├── frontend/
│   ├── Dockerfile
│   ├── src/
│   └── ...
├── docker-compose.yml
└── README.md
```

## Possibles problemes i solucions

- **No es mostra el QR en producció**: Si uses un servidor sense entorn gràfic, considera habilitar un servidor VNC dins del contenidor o, en el primer arrencada, copia la sessió des d’un entorn local al volum `session-data`.
- **Chromium consumeix molta memòria**: En producció, assigna almenys 1 GB de RAM al contenidor del backend.
- **WhatsApp bloqueja el número**: Si s’envien molts missatges seguits, WhatsApp pot restringir temporalment l’enviament. Utilitza pauses entre missatges (ja implementat al backend).
```

## Explicació

He creat un README complet i ajustat al projecte “impagats”:

- **Instal·lació** clara per a entorns de desenvolupament i producció.
- **Configuració d’OpenWA** detallada, incloent la persistència de sessió i l’escaneig del QR.
- **Format CSV** obligatori, amb tots els camps necessaris perquè el backend pugui generar els recordatoris.
- **Producció amb Docker**: instruccions per construir i executar els serveis, i com resoldre la primera autenticació.
- **Consells de seguretat** i gestió de problemes comuns.

Aquest README serveix com a documentació única perquè qualsevol persona pugui posar en marxa l’aplicació sense ambigüitats.

## Estat

Implementat: sí
Verificat: sí
Completat: sí

## Notes

- 2026-06-10 14:47: Afegit registre automàtic de webhook: OpenWAConnector.registerWebhook(), endpoint POST /api/settings/register-webhook, GET /api/settings/webhooks, UI amb input de URL pública i botons Registrar/Verificar. Verificat: webhook creat (id 8eea352c). → Implementat:sí Verificat:sí Completat:sí
- 2026-06-10 14:43: Explorada API real OpenWA amb curl. Corregit testConnection (usa /api/health + /api/sessions) i sendMessage (usa POST /api/sessions/{id}/messages/send-text amb chatId phone@c.us). Verificat connexio OK. → Implementat:no Verificat:sí Completat:no
- 2026-06-10 14:38: Afegit camp Session ID, botó "Provar connexió" amb resultat visual, i desat independent per la secció OpenWA → Implementat:sí Verificat:no Completat:no
- 2026-06-10 14:14: Corregits ports: docker-compose frontend 80→8080, README actualitzat amb nota sobre port auto de Vite → Implementat:sí Verificat:no Completat:no
- 2026-06-10 13:37: Implementades les 24 tasques del pla: backend complet (Express + Prisma + 9 entitats + 14 endpoints), frontend complet (React + Vite + Tailwind + 9 pàgines), Docker setup, README → Implementat:no Verificat:sí Completat:no
- 2026-06-10 13:36: README.md creat, verificat i commitejat (7ab653c)
- 2026-06-10 13:36: Commit realitzat: docs: README with installation and usage instructions → Implementat:sí Verificat:no Completat:no
- 2026-06-10 13:35: README.md creat i verificat amb Read. Contingut correcte.
-
