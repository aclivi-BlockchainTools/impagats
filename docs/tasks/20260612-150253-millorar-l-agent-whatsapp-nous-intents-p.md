# Tasca: Millorar l'agent WhatsApp: nous intents (payment_promise, qu

Data: 2026-06-12 15:02:53
Projecte: impagats
Model recomanat: deepseek-v4-pro
Categoria: implementació

## Prompt

Millorar l'agent WhatsApp: nous intents (payment_promise, question_about_debt, complaint_or_problem), estat PENDENT_REVISIO per proof_media, anti-repetició (30 min + 3 consecutius fora de flux), plantilla d'error de guardat de fitxer, tests.

## Context usat

Projecte: impagats

Última tasca: Enviament WhatsApp múltiple: seleccionar diversos impagats d (implementat: sí)

## Tasca sol·licitada

Millorar l'agent WhatsApp: nous intents (payment_promise, question_about_debt, complaint_or_problem), estat PENDENT_REVISIO per proof_media, anti-repetició (30 min + 3 consecutius fora de flux), plantilla d'error de guardat de fitxer, tests.

## Instruccions

1. NO proposis implementar funcionalitats que l'Estat actual indica com a completades o funcionals.
2. ...

## Resposta del model

✅ Ja fet
- Enviament WhatsApp múltiple: selecció i enviament a diversos impagats – implementat.

🔧 Pendent real
- Nous intents: `payment_promise`, `question_about_debt`, `complaint_or_problem` (cal afegir reconeixement, fluxos i accions al bot).
- Estat `PENDENT_REVISIO` per `proof_media`: en rebre una prova de pagament, el deute passa a aquest estat en lloc de tancar‑se automàticament.
- Anti‑repetició:
  - Cooldown de 30 minuts entre enviament del mateix missatge (mateixa plantilla) al mateix usuari.
  - Límit de 3 missatges consecutius fora de flux (respostes no reconegudes) abans de derivar/aturar.
- Plantilla d’error de guardat de fitxer: missatge fix per mostrar a l’usuari si falla l’emmagatzematge de la prova.
- Tests: cobertura de les noves funcionalitats (unitat/ integració).

⚠️ Riscos
- Interferència amb fluxos existents (pot trencar la métrica de tancament si es modifica l’estat final).
- Ambigüitat en la definició de «fora de flux» i en la detecció del «mateix missatge».
- Emmagatzematge de fitxers: si falla, cal evitar perdre la prova i deixar l’estat coherent.
- Tests fràgils si depenen d’emmagatzematge real; necessiten dobles o mocks.

📋 10 següents passos prioritzats (camí més simple)
1. Documentar els fluxos dels tres nous intents (respostes esperades, dades a recollir – data de promesa, text de pregunta/queixa) i les accions sobre l’impagat.
2. Implementar el reconeixement d’intents amb regles simples (paraules clau o expressions regulars) per no dependre de models complexos.
3. Afegir l’estat `PENDENT_REVISIO` al model de dades i modificar el gestor de `proof_media`: guardar l’arxiu, canviar l’estat i notificar (ex. flag a backoffice), mai tancar el deute automàticament.
4. Crear la plantilla d’error (text fix) i retornar-la a l’usuari quan falli l’emmagatzematge, sense canviar l’estat de l’impagat.
5. Implementar l’anti‑repetició més simple:
   - Desa la marca de temps de l’últim missatge per (`usuari`, `plantilla`). Si l’interval < 30 min, no reenvia.
   - Porta un comptador de respostes consecutives fora de flux. Si arriba a 3, desactiva els missatges automàtics per a aquell usuari i crea una alerta per revisió manual.
6. Actualitzar el flux principal del bot perquè consulti els cooldowns/comptadors i, si un intent vàlid arriba, reinicia el comptador de fora de flux.
7. Escriure tests unitaris per a la lògica de reconeixement d’intents, comprovant que cada variació de text es classifica correctament i s’executa l’acció esperada.
8. Escriure tests d’integració per al flux de `proof_media`: enviament correcte → canvi a PENDENT_REVISIO, i escenari d’error d’emmagatzematge → missatge de plantilla d’error.
9. Fer tests específics per a l’anti‑repetició: manera de comprovar que no s’envia el mateix missatge abans de 30 min, que 3 respostes incorrectes seguides aturen l’agent, i que una resposta correcta reinicia el comptador.
10. Revisar, netejar i documentar el codi final, assegurant que no s’ha afegit complexitat innecessària (mantenir la solució plana i directa).

## Estat

Implementat: sí
Verificat: sí
Completat: sí

## Notes

- 2026-06-12 15:18: Bug: downloadMedia() feia fetch(url) sense X-Api-Key. OpenWA requereix autenticació per servir fitxers. Solució: afegit paràmetre apiKey opcional a downloadMedia i downloadAndSaveProof. Webhook ara obté apiKey via openwa.getConfig() i la passa.
- 2026-06-12 15:17: Arreglat el bug de descàrrega de media: downloadMedia() feia fetch(url) sense el header X-Api-Key que OpenWA requereix per servir fitxers. Modificat downloadMedia(url, apiKey?) i downloadAndSaveProof per acceptar apiKey opcional. El webhook ara obté l'apiKey via openwa.getConfig() i la passa a downloadMedia. Tests: 132 OK, build OK. → Implementat:sí Verificat:no Completat:no
- 2026-06-12 15:09: 5 fitxers modificats. Backend: 132 tests, 10 suites, build OK. Frontend: build OK. Sense migracions de BD necessàries.
- 2026-06-12 15:09: Modificats 5 fitxers: messageClassifier.ts (payment_promise, renombrar intents, isPaymentPromise detector), replyTemplates.ts (4 noves plantilles), webhook.ts (PENDENT_REVISIO, anti-repetició 30min i 3 consecutius, plantilla error guardat), returnedReceipts.ts (nous estats a simulate/execute-agent), messageClassifier.test.ts (53 tests, +20 respecte abans). Backend: 132 tests, build OK. Frontend: build OK. → Implementat:sí Verificat:no Completat:no
-
