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

Implementat: no
Verificat: no
Completat: no

## Notes

- 2026-06-11 16:49: Commit amb 38 fitxers: +1676/-930 línies. Missatge descriptiu amb totes les millores. → Implementat:no Verificat:no Completat:no
- 2026-06-11 16:40: 7 fixes: 1) pagament_ambigu → ESPERANT_DETALLS, 2) altres_temes → REVISAR, 3) timeout actualitza l'estat, 4) agent.enabled es comprova al webhook, 5) errors de l'agent envien fallback al deutor + marquen REVISAR, 6) extractReference/Amount/Date millorats, 7) proofReceivedAt només per pagament_clar/comprovant → Implementat:sí Verificat:no Completat:no
- 2026-06-11 16:03: Afegit endpoint POST /api/returned-receipts/:id/simulate-agent que executa l'agent sense enviar. Afegida secció "Provar agent" al detall d'impagat: l'usuari escriu com si fos el deutor, veu la classificació (intent + acció), el canvi d'estat previst i la resposta que enviaria l'agent. → Implementat:sí Verificat:sí Completat:sí
- 2026-06-11 15:36: Implementat: sendBulkWhatsApp a notificationService.ts, endpoint POST /api/returned-receipts/send-bulk-whatsapp, plantilla múltiple configurable (whatsapp_template_multiple), botó WhatsApp múltiple a la llista d'impagats (només actiu si selecció del mateix client), secció de plantilla múltiple a Settings → Implementat:sí Verificat:sí Completat:sí
-
