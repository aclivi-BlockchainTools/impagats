# Tasca: Enviament WhatsApp múltiple: seleccionar diversos impagats d

Data: 2026-06-11 15:33:39
Projecte: impagats
Model recomanat: claude-haiku
Categoria: auditoria

## Prompt

Enviament WhatsApp múltiple: seleccionar diversos impagats del mateix client i enviar un sol missatge amb el resum de tots els rebuts pendents (períodes, factures, imports i total)

## Context usat

Projecte: impagats

Última tasca: Auditoria completa del projecte: analitzar codi, arquitectur (implementat: sí)

## Tasca sol·licitada

Enviament WhatsApp múltiple: seleccionar diversos impagats del mateix client i enviar un sol missatge amb el resum de tots els rebuts pendents (períodes, factures, imports i total)

## Instruccions

1. NO proposis implementar funcionalitats que l'Estat actual indica com a completades o funcionals.
2. Si una àrea ja està implementada però no verificada, marca-la...

## Resposta del model

## Prompt preparat per Claude Code

Copia el contingut següent com a prompt a Claude Code:

---

Projecte: impagats

Última tasca: Auditoria completa del projecte: analitzar codi, arquitectur (implementat: sí)

## Tasca sol·licitada

Enviament WhatsApp múltiple: seleccionar diversos impagats del mateix client i enviar un sol missatge amb el resum de tots els rebuts pendents (períodes, factures, imports i total)

## Instruccions

1. NO proposis implementar funcionalitats que l'Estat actual indica com a completades o funcionals.
2. Si una àrea ja està implementada però no verificada, marca-la com a 'verificar', no com a 'implementar'.
3. Si la tasca és d'anàlisi o següents passos, estructura la resposta en:
   - ✅ Ja fet
   - 🔧 Pendent real
   - ⚠️ Riscos
   - 📋 10 següents passos prioritzats
4. Proposa sempre el camí més simple. No afegeixis complexitat innecessària.

---

**Model recomanat:** claude-haiku


## Estat

Implementat: sí
Verificat: sí
Completat: sí

## Notes

- 2026-06-12 14:49: Commit 9fa8865 i push a master. 46 fitxers, +3762/-625 línies. CLAUDE.md actualitzat amb OpenWA webhook, Decimal, plantilles, outbox, DELETE cascada, fast-xml-parser, auth, tests. → Implementat:no Verificat:no Completat:no
- 2026-06-12 11:02: Safata admin: WorkTray component amb 8 filtres per estat integrat al Dashboard. Logs: pino a csvImporter (duplicats + resum) i returnDetector (detecció + resum). Tests: sepaXmlImporter amb fast-xml-parser (12 tests), importDedup (9 tests), proofService (13 tests). Bug arreglat: getNested no parsejava números (fast-xml-parser converteix a number). → Implementat:sí Verificat:no Completat:no
- 2026-06-12 10:45: Continuació: Afegits 25 tests (proofService 13 + importDedup 9). Arreglat bug validació MIME a proofService (era massa permissiva). Frontend ReceiptActions, ReturnedReceiptsList i ReturnedReceiptDetail actualitzats amb tots els estats nous i case notes/historial. → Implementat:sí Verificat:no Completat:no
- 2026-06-12 10:43: ReceiptActions: dropdown amb 12 estats, labels actualitzats, isAgentActive amb ESPERANT_JUSTIFICANT/PAGAMENT_DECLARAT. ReturnedReceiptsList: filter amb 12 estats, agent column amb nous estats, bulk-send actualitzat. ReturnedReceiptDetail: case notes + status history integrats. → Implementat:sí Verificat:no Completat:no
- 2026-06-12 10:40: statusHistory integrat a webhook, returnedReceipts (PUT, match, proof), outboxService, reconciliation. Frontend: api.ts amb auth token, StatusBadge amb 12 estats traduïts, Login page, App.tsx amb ruta /login, Dashboard amb 8 comptadors (nous estats), backend dashboard amb waitingProof, paymentClaimed, whatsappError. → Implementat:sí Verificat:no Completat:no
- 2026-06-12 10:31: Implementades les 20 millores en 5 fases. Backend: 76 tests (7 suites), build OK. Frontend: build OK. Documentació creada. → Implementat:sí Verificat:no Completat:no
- 2026-06-12 10:27: Fase 3: csvImporter genera importHash (SHA-256) i suporta ImportBatch. SEPA XML reescrit amb fast-xml-parser. matchingEngine crea MatchCandidate amb scoring (≥0.9 auto, 0.4-0.89 REVISAR, <0.4 auto-crea). bankMovements crea ImportBatch. Tests actualitzats. → Implementat:sí Verificat:no Completat:no
- 2026-06-12 10:24: Fase 2: Creat messageClassifier.ts (7 intents tancats), proofService.ts (validació MIME, hash SHA-256), outboxService.ts (cua amb retry + delay 8-20s), webhook.ts reescrit (ordre correcte 11 passos), notificationService usa outbox. Afegida ruta /api/outbox. → Implementat:sí Verificat:no Completat:no
- 2026-06-12 10:19: Schema Prisma actualitzat (11 models, Decimal, nous estats). Creat reply-templates.ts amb 8 plantilles fixes. Validation.ts actualitzat amb 12 estats. Tots els fitxers adaptats als nous tipus. 43 tests passen, TypeScript compila net. → Implementat:sí Verificat:no Completat:no
- 2026-06-12 10:12: Commit f85fd6b: CLAUDE.md actualitzat (GitHub repo, execute-agent, webhook, .env). Pujat a GitHub. → Implementat:no Verificat:no Completat:no
- 2026-06-12 08:14: Creat repo privat a github.com/aclivi-BlockchainTools/impagats. Pujats tots els commits (4) de la branca master amb backend, frontend, docs i config. → Implementat:sí Verificat:no Completat:no
- 2026-06-11 16:55: Afegit endpoint POST /api/returned-receipts/:id/execute-agent que executa el flux complet real: desa INBOUND, classifica, envia WhatsApp, desa OUTBOUND amb metadata, actualitza estat. Afegit botó "Enviar resposta de l'agent per WhatsApp" al panell "Provar agent" del detall. → Implementat:sí Verificat:sí Completat:sí
- 2026-06-11 16:49: Commit amb 38 fitxers: +1676/-930 línies. Missatge descriptiu amb totes les millores. → Implementat:no Verificat:no Completat:no
- 2026-06-11 16:40: 7 fixes: 1) pagament_ambigu → ESPERANT_DETALLS, 2) altres_temes → REVISAR, 3) timeout actualitza l'estat, 4) agent.enabled es comprova al webhook, 5) errors de l'agent envien fallback al deutor + marquen REVISAR, 6) extractReference/Amount/Date millorats, 7) proofReceivedAt només per pagament_clar/comprovant → Implementat:sí Verificat:no Completat:no
- 2026-06-11 16:03: Afegit endpoint POST /api/returned-receipts/:id/simulate-agent que executa l'agent sense enviar. Afegida secció "Provar agent" al detall d'impagat: l'usuari escriu com si fos el deutor, veu la classificació (intent + acció), el canvi d'estat previst i la resposta que enviaria l'agent. → Implementat:sí Verificat:sí Completat:sí
- 2026-06-11 15:36: Implementat: sendBulkWhatsApp a notificationService.ts, endpoint POST /api/returned-receipts/send-bulk-whatsapp, plantilla múltiple configurable (whatsapp_template_multiple), botó WhatsApp múltiple a la llista d'impagats (només actiu si selecció del mateix client), secció de plantilla múltiple a Settings → Implementat:sí Verificat:sí Completat:sí
-
