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
