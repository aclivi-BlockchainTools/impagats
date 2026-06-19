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

Implementat: no
Verificat: no
Completat: no

## Notes

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
