# Tasca: Auditoria completa del projecte: analitzar codi, arquitectur

Data: 2026-06-11 14:40:36
Projecte: impagats
Model recomanat: claude-sonnet
Categoria: auditoria

## Prompt

Auditoria completa del projecte: analitzar codi, arquitectura, qualitat, tests, frontend, backend, BD i identificar totes les àrees de millora

## Context usat

Projecte: impagats

Última tasca: Task 9: Frontend — Secció Agent a Settings. Afegir secció "A (implementat: sí)

## Tasca sol·licitada

Auditoria completa del projecte: analitzar codi, arquitectura, qualitat, tests, frontend, backend, BD i identificar totes les àrees de millora

## Instruccions

1. NO proposis implementar funcionalitats que l'Estat actual indica com a completades o funcionals.
2. Si una àrea ja està implementada però no verificada, marca-la com a 'verificar', no com a 'implemen...

## Resposta del model

## Prompt preparat per Claude Code

Copia el contingut següent com a prompt a Claude Code:

---

Projecte: impagats

Última tasca: Task 9: Frontend — Secció Agent a Settings. Afegir secció "A (implementat: sí)

## Tasca sol·licitada

Auditoria completa del projecte: analitzar codi, arquitectura, qualitat, tests, frontend, backend, BD i identificar totes les àrees de millora

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

**Model recomanat:** claude-sonnet


## Estat

Implementat: sí
Verificat: no
Completat: no

## Notes

- 2026-06-11 15:21: Actualitzada DEFAULT_TEMPLATE a notificationService.ts i Settings.tsx: ara inclou {{invoice_number}} i {{service_period}} integrats en una frase narrativa inicial → Implementat:sí Verificat:no Completat:no
- 2026-06-11 14:57: Implementades les 8 fases del pla: Zod+validació, asyncHandler+error handling, refactor duplicació (bankMovements 295→85 línies), serveis amb suport tx, separació components frontend (6 nous), dashboard amb groupBy, tests integració (3 nous), graceful shutdown, neteja pino frontend, getDashboardDebtors → Implementat:sí Verificat:sí Completat:sí
- 2026-06-11 14:42: Auditoria completa: llegits tots els fitxers (~40) de backend, frontend, tests, configuració. Anàlisi de duplicació, seguretat, rendiment, qualitat de codi. → Implementat:sí Verificat:no Completat:no
-
