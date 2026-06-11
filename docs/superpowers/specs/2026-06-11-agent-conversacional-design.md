# Disseny: Agent conversacional per resposta automàtica a impagats

## Visió general

Agent automàtic que respon als missatges entrants de WhatsApp (deutors) després d'enviar una reclamació. L'agent detecta confirmacions de pagament, demana detalls si cal, i redirigeix altres temes a les vies de comunicació habituals. L'usuari pot revisar i prendre control manual de qualsevol conversa des de la UI.

---

## 1. Arquitectura

```
WhatsApp → webhook.ts → ConversationAgent.classify() → ConversationAgent.respond() → OpenWA
                              │
                              └── guarda Message amb intent/acció
```

### Components

| Component | Fitxer | Responsabilitat |
|-----------|--------|-----------------|
| **ConversationAgent** | `backend/src/services/conversationAgent.ts` | Orquestra: classifica, decideix acció, genera resposta |
| **IntentClassifier** | Dins ConversationAgent | Regex multi-idioma (CAT/ES) per classificar missatges |
| **ResponseTemplates** | AppSettings | Plantilles de resposta configurables amb variables |
| **Message (ampliat)** | `prisma/schema.prisma` | + camps: `agentIntent`, `agentAction`, `needsReview` |

### Integració amb webhook existent

El webhook (`/api/openwa/webhook`) ja rep missatges entrants. S'hi afegeix:
1. Rebre missatge → guardar a Message (existent)
2. Si el missatge és INBOUND i hi ha un ReturnedReceipt en estat NOTIFICAT o ESPERANT_DETALLS → cridar ConversationAgent
3. Si l'agent respon → enviar per OpenWA i guardar Message OUTBOUND

---

## 2. Màquina d'estats de conversa

### Estats nous (per fil de conversa, no pel receipt)

| Estat | Descripció |
|-------|------------|
| `NOTIFICAT` | Punt de partida: WhatsApp enviat, esperant resposta |
| `ESPERANT_DETALLS` | El deutor ha respost ambiguament, l'agent demana més informació |
| `REDIRIGIT` | El deutor parla d'un altre tema, l'agent s'ha desactivat per aquest fil |
| `CONTROL_MANUAL` | L'usuari ha pres el control, les respostes són manuals |

Els estats del ReturnedReceipt es mantenen independents (DETECTAT → EMPARELLAT → NOTIFICAT → JUSTIFICANT_REBUT → PAGAMENT_CONFIRMAT → TANCAT).

### Transicions

```
NOTIFICAT ──┬── pagament_clar ──────→ JUSTIFICANT_REBUT (receipt)
            │                          Agent respon confirmació
            │
            ├── pagament_ambigu ────→ ESPERANT_DETALLS (conversa)
            │                          Agent demana referència/data
            │                          Timeout 24h → fil tancat
            │
            ├── altres_temes ───────→ REDIRIGIT (conversa)
            │                          Agent envia redirecció
            │                          No torna a respondre
            │
            └── control_manual ─────→ CONTROL_MANUAL (conversa)
                                       Usuari respon des de UI
```

---

## 3. Classificador d'intencions

### Algorisme

1. Normalitzar text (minúscules, eliminar accents opcionalment)
2. Provar regex de cada intenció en ordre de prioritat
3. Primera coincidència guanya
4. Si no hi ha coincidència → `altres_temes`

### Intencions (ordre de prioritat)

#### 1. `pagament_clar` — Confirmació explícita de pagament

**CAT**: `he pagat`, `ja he fet el pagament`, `transferència feta`, `ingrés fet`, `he fet l'ingrés`, `he realitzat el pagament`, `he fet la transferència`, `transferencia feta`, `he fet el ingres`, `ja he pagat`, `pagament fet`

**ES**: `he pagado`, `ya he hecho el pago`, `transferencia hecha`, `ingreso hecho`, `he realizado el pago`, `ya está pagado`, `pago hecho`, `ya he pagado`

**Acció**: `confirmar_i_demanar_comprovant`
**Resposta**: `resposta_pagament_clar`
**Efecte**: Receipt → JUSTIFICANT_REBUT

#### 2. `pagament_ambigu` — Possible confirmació sense detalls

**CAT**: `fet`, `ja està`, `ho tens`, `t'ho he enviat`, `ok`, `d'acord`, `listo`, `solucionat`

**ES**: `hecho`, `ya está`, `lo tienes`, `te lo he enviado`, `vale`, `listo`, `solucionado`

**Acció**: `demanar_detalls`
**Resposta**: `resposta_pagament_ambigu`
**Efecte**: Conversa → ESPERANT_DETALLS, timeout 24h

#### 3. `comprovant_enviat` — El deutor envia o diu que envia comprovant

**CAT**: `t'envio el comprovant`, `adjunt`, `justificant`, `aquí tens el rebut`, `captura`, `foto del pagament`, `et passo el comprovant`, `t'envió el justificant`

**ES**: `te envio el comprobante`, `adjunto`, `justificante`, `aquí tienes el recibo`, `captura`, `foto del pago`, `te paso el comprobante`

**Acció**: `acusar_recepcio_comprovant`
**Resposta**: `resposta_comprovant_rebut`
**Efecte**: Receipt → JUSTIFICANT_REBUT

#### 4. `altres_temes` — Qualsevol altra cosa (default)

**Acció**: `redirigir`
**Resposta**: `resposta_redireccio`
**Efecte**: Conversa → REDIRIGIT, agent silenciat per aquest receipt

### Extracció de dades

De cada missatge classificat com a pagament, s'intenta extreure:

| Dada | Regex CAT/ES |
|------|-------------|
| Import | `/(\d+[,.]?\d*)\s*(?:€\|euros?)/i` |
| Referència | `/(?:ref[erencia]*\|referència\|referencia)[\s:]*[#nº]*\s*(\w+)/i` |
| Data | `/(?:ahir\|avui\|el dia\|el)\s*(\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?)/i` |
| Fitxer | Detectat via webhook: si el missatge entrant té `media.url` o `media.base64` |

---

## 4. Plantilles de resposta

Configurables a AppSettings. Variables suportades: `{{client_name}}`, `{{reference}}`, `{{amount}}`.

### `resposta_pagament_clar`
```
Gràcies {{client_name}}. He registrat la teva confirmació{{#reference}} amb referència {{reference}}{{/reference}}. Si ens pots enviar el comprovant del pagament, ens ajudaria a verificar-lo. Per a qualsevol altra consulta, contacta amb nosaltres per les vies habituals.
```

### `resposta_pagament_ambigu`
```
Gràcies per respondre. Em pots confirmar la data o referència del pagament per poder-ho registrar correctament? Recorda que aquest és un sistema automàtic — per a qualsevol altra consulta, contacta amb nosaltres per les vies habituals.
```

### `resposta_comprovant_rebut`
```
Gràcies {{client_name}}. He rebut el teu comprovant i el revisarem en breu. Si tot és correcte, confirmarem el pagament. Per a qualsevol altra consulta, contacta amb nosaltres per les vies habituals.
```

### `resposta_redireccio`
```
Aquest és un sistema automàtic de confirmació de pagaments. Per a qualsevol altra consulta o aclariment, contacta amb nosaltres per les vies de comunicació habituals. Gràcies.
```

### Sistema de templates simple

Les variables `{{...}}` es substitueixen directament. Els blocs `{{#reference}}...{{/reference}}` només es renderitzen si la variable té valor. Sense dependència de Mustache/Handlebars — implementació pròpia mínima (~15 LOC).

---

## 5. Canvis al model de dades

### Message (ampliació)

```prisma
model Message {
  // ... camps existents ...
  agentIntent   String?   // intenció detectada: pagament_clar, pagament_ambigu, altres_temes
  agentAction   String?   // acció presa: confirmar, demanar_detalls, redirigir
  agentMetadata Json?     // dades extretes: { reference, amount, date }
  needsReview   Boolean   @default(false) // true si l'usuari ha de revisar
}
```

Nova migració: `npx prisma migrate dev --name add-agent-fields-to-message`

---

## 6. UI — Vista de conversa

### ReturnedReceiptDetail.tsx — Secció nova "Conversa WhatsApp"

**Agent actiu (estat NOTIFICAT o ESPERANT_DETALLS):**
- Banner verd: "Agent actiu — Esperant resposta del deutor"
- Botó "Assumir control manual"
- Fil de missatges amb etiquetes: INBOUND, OUTBOUND, AGENT
- Cada missatge de l'agent mostra la intenció detectada i l'acció presa
- Etiqueta informativa sota cada resposta de l'agent: "Agent: intent pagament_clar → acció confirmar → estat JUSTIFICANT_REBUT"

**Control manual (estat CONTROL_MANUAL):**
- Banner porpra: "Control manual — L'agent està desactivat"
- Botó "Reactivar agent"
- Textarea per escriure resposta manual
- Botó "Enviar"

### ReturnedReceiptsList.tsx — Columna nova

Columna "Agent" amb indicador:
- Punt verd + "actiu" — esperant resposta
- Punt groc + "pendent" — ESPERANT_DETALLS, timeout actiu
- Punt vermell + "tancat" — REDIRIGIT
- Punt porpra + "manual" — CONTROL_MANUAL

### Settings.tsx — Secció nova

Secció "Agent conversacional" dins la pestanya de configuració:
- Toggle enable/disable
- Llista de keywords editables per cada intenció i idioma
- Plantilles de resposta editables
- Timeout (hores)

---

## 7. Limitacions i decisions

### Què NO fa l'agent
- No negocia imports ni condicions de pagament
- No gestiona múltiples rebuts en una conversa
- No fa seguiment proactiu (recordatoris) — requereix resposta del deutor
- No processa àudio ni notes de veu
- No tradueix — respon en el mateix idioma que la plantilla (català)

### Decisions
- L'agent **sempre** respon en català (plantilles fixes). No detecta l'idioma del missatge entrant.
- Si el deutor insisteix després d'un REDIRIGIT, l'agent no torna a respondre (evita bucles).
- El timeout de 24h per ESPERANT_DETALLS es comprova via check lazy: quan es consulta el receipt o quan arriba un nou missatge, si han passat >24h des de l'últim missatge de l'agent, el fil es tanca automàticament.
- Les paraules clau es guarden com a strings separats per comes a AppSettings.
- L'usuari pot modificar keywords i plantilles des de Settings sense tocar codi.

---

## 8. Estratègia de testing

### Tests unitaris (conversationAgent.test.ts)
- Classificació de cada intenció en CAT i ES
- Missatges amb paraules clau combinades (ex: "ok" dins d'un missatge llarg)
- Extracció d'import, referència, data
- Missatge buit, només "ok", només emojis
- Missatges que haurien de ser `altres_temes`

### Tests d'integració
- Webhook rep missatge → Agent classifica → Resposta enviada → Estat actualitzat
- Receipt en estat que no és NOTIFICAT → Agent ignorat
- Dos missatges seguits del mateix deutor (conversa multi-torn)
- Silenci després de REDIRIGIT

### Tests E2E (Playwright)
- Flux complet: notificar → rebre resposta → veure conversa a UI
- Prendre control manual i enviar resposta

---

## 9. Configuració a AppSettings

| Key | Valor per defecte | Descripció |
|-----|-------------------|------------|
| `agent.enabled` | `true` | Activar/desactivar agent globalment |
| `agent.keywords_pagament_clar_cat` | `he pagat,ja he fet el pagament,transferència feta,...` | Paraules clau CAT |
| `agent.keywords_pagament_clar_es` | `he pagado,ya he hecho el pago,...` | Paraules clau ES |
| `agent.keywords_ambigu_cat` | `fet,ja està,ho tens,ok,d'acord,llistot` | Ambigües CAT |
| `agent.keywords_ambigu_es` | `hecho,ya está,lo tienes,vale,ok,listo` | Ambigües ES |
| `agent.keywords_comprovant_cat` | `comprovant,justificant,adjunt,captura` | Comprovant CAT |
| `agent.keywords_comprovant_es` | `comprobante,justificante,adjunto,captura` | Comprovant ES |
| `agent.template_pagament_clar` | (veure secció 4) | Plantilla confirmació |
| `agent.template_pagament_ambigu` | (veure secció 4) | Plantilla ambigüitat |
| `agent.template_comprovant_rebut` | (veure secció 4) | Plantilla comprovant |
| `agent.template_redireccio` | (veure secció 4) | Plantilla redirecció |
| `agent.timeout_hores` | `24` | Timeout per ESPERANT_DETALLS |

---

## 10. Abast dels canvis

### Fitxers nous
- `backend/src/services/conversationAgent.ts` (~200 LOC)
- `backend/src/__tests__/conversationAgent.test.ts` (~120 LOC)

### Fitxers modificats
- `backend/src/routes/webhook.ts` (+15 LOC) — cridar ConversationAgent
- `backend/prisma/schema.prisma` (+4 camps a Message)
- `frontend/src/pages/ReturnedReceiptDetail.tsx` (+80 LOC) — panell conversa
- `frontend/src/pages/ReturnedReceiptsList.tsx` (+20 LOC) — columna agent
- `frontend/src/pages/Settings.tsx` (+30 LOC) — secció configuració agent

### Migració
- `npx prisma migrate dev --name add-agent-fields-to-message`

### Total estimat
~450 LOC + tests
