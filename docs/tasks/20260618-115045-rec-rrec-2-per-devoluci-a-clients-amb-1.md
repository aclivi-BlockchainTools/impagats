# Tasca: Recàrrec 2€ per devolució a clients amb >1 impagat

Data: 2026-06-18 11:50:45
Projecte: impagats
Model recomanat: deepseek-v4-pro
Categoria: manual

## Contingut

## Què
Clients amb més d'un impagat (històric complet) tenen recàrrec de 2€ per cada rebut notificat, visible a les plantilles WhatsApp.

## Canvis
- `replyTemplates.ts`: noves variables `return_fee_per_receipt`, `return_fee_total`, `total_with_fee`. Nova plantilla `TEMPLATE_FEE_LINE`.
- `notificationService.ts`: `sendWhatsApp()` i `sendBulkWhatsApp()` compten total rebuts del client, si >1 apliquen recàrrec.
- `Settings.tsx`: documentació de noves variables.

## Verificació
- Tests: 165/165 pass
- Build backend: OK
- Build frontend: OK

## Estat

Implementat: sí
Verificat: no
Completat: no

## Notes

- 2026-06-19 15:30: T1: notify-all només encua, resposta {total, queued, skipped, skippedDetails}. T2: query recordatoris arreglada (primer mira notifiedAt). T3: UI recordatoris a Settings, unificat agent_timeout_hours, formatReminder() a llistes/safata/detall, test scheduler (173 tests). T4: CLAUDE.md compacte 128 línies, detalls a DECISIONS.md. → Implementat:sí Verificat:no Completat:no
- 2026-06-19 14:45: Commit d9a1ffb amb tots els canvis del dia (18 fitxers). Push a origin/master OK. CLAUDE.md actualitzat amb noves seccions: webhook fromMe, outbox no duplicat, OpenWA error, safata 5 cubells, columnes ordenables, useApi persistent, StatsCard enllaços. → Implementat:no Verificat:no Completat:no
- 2026-06-19 14:44: 172 tests OK, build frontend + backend nets
- 2026-06-19 09:33: Safata reorganitzada de 4 a 5 cubells: "Per revisar" (REVISAR, color ambre) separat de "Pendent de revisió" (PENDENT_REVISIO+JUSTIFICANT_REBUT, color rosa). Funció reviewReason() mostra el motiu específic (Falta WhatsApp, Sense client, Timeout agent, Error agent, Revisió pendent). Filtres avançats reorganitzats. Dashboard actualitzat amb el nou cubell. → Implementat:sí Verificat:no Completat:no
- 2026-06-19 09:20: Substituïda la targeta genèrica "Pendents revisió" (que barrejava DETECTAT+EMPARELLAT+REVISAR) per 3 targetes separades: "Per processar" (blau, DETECTAT+EMPARELLAT), "Revisar" (taronja, REVISAR), "Pendent de revisió" (rosa, PENDENT_REVISIO). Cada una amb icona i color diferents. → Implementat:sí Verificat:no Completat:no
- 2026-06-19 09:17: Afegits a WorkTray.tsx: funció hasClientReplied(), 2 filtres avançats nous (review_replied/review_no_response), vora verda esquerra + icona ↩ en files amb resposta del client dins del cubell "Per revisar" → Implementat:sí Verificat:no Completat:no
- 2026-06-19 08:59: 3 causes arrel corregides: 1) fromMe check al webhook (ignora ecos de missatges sortints), 2) es salten missatges sense text ni media, 3) eliminada la creació duplicada de Message a outboxService.processOne. notificationService actualitzat per crear Message del primer rebut. 2 duplicats esborrats de la BD. → Implementat:sí Verificat:no Completat:no
- 2026-06-19 08:35: 1) Corregits tots els errors TypeScript: opcional chaining a ReturnedReceiptDetail.tsx, tipus ProofViewer.tsx, DashboardData a types.ts, form a InvoiceForm.tsx. Build frontend net. 2) CLAUDE.md actualitzat: 18 entitats, 172 tests/14 suites, port 2886, ESPERANT_DETALLS→ESPERANT_JUSTIFICANT. 3) Tasca Recàrrec 2€ marcada completada (ja implementada a f5e4216). → Implementat:sí Verificat:no Completat:no
- 2026-06-19 08:35: Implementat al commit f5e4216 (fix: recàrrec 2€ per devolució, plantilles alineades, filtres WorkTray i bug clientId). El codi a notificationService.ts inclou la lògica de recàrrec de 2€ per clients amb >1 impagat.
- 2026-06-18 16:35: 5 tasques completades: docker-compose (fix), scheduler (feat), notify-all (feat), manteniment (chore), Safata 4 cubells (feat) → Implementat:no Verificat:no Completat:no
- 2026-06-18 16:26: Creat scheduler.ts amb 4 blocs (outbox retry amb backoff, promeses vençudes, timeout agent, recordatoris). Modificat outboxService per backoff. Migració reminderCount/lastReminderAt. Endpoint POST /api/scheduler/run. Plantilla TEMPLATE_REMINDER. 7 tests nous. → Implementat:sí Verificat:no Completat:no
- 2026-06-18 16:20: TASCA 1: docker-compose amb volum storage_data, env vars ${VAR:-}, healthcheck postgres, prisma migrate deploy al Dockerfile, advertència JWT_SECRET en prod, .env.example i OPERATIVA.md actualitzats → Implementat:sí Verificat:no Completat:no
- 2026-06-18 14:33: Commit + push: 7 fitxers (recàrrec 2€, plantilles alineades, filtres WorkTray, bugfix clientId) → Implementat:sí Verificat:no Completat:no
- 2026-06-18 14:33: Verificat: 165 tests pass, backend tsc OK, frontend tsc OK
- 2026-06-18 14:25: Arreglat bug: emptyToNullNumber(undefined) convertia a null, fent que canviar l'estat d'un impagat desvinculés el client. Ara undefined passa per Zod .optional() correctament (camp absent de l'update). → Implementat:sí Verificat:no Completat:no
- 2026-06-18 14:13: Dividit filtres REVISAR i NOTIFICAT a WorkTray: review_nowhatsapp (sense WhatsApp), review_other (altres), notified_replied (han contestat), notified_no_response (sense resposta). Afegit camp customFilter al TrayFilter. → Implementat:sí Verificat:no Completat:no
- 2026-06-18 12:58: Afegida plantilla editable de despesa devolució a Settings. Tests 165/165 OK, build OK.
- 2026-06-18 12:58: Afegit textarea a Settings.tsx (clau whatsapp_template_fee_line) i actualitzat notificationService.ts per usar la plantilla custom o la default TEMPLATE_FEE_LINE → Implementat:sí Verificat:no Completat:no
- 2026-06-18 11:50: Implementat i verificat (tests pass, build OK). Pendents de testeig funcional.
-
