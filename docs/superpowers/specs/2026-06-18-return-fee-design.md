# Recàrrec 2€ per devolució — Disseny

## Resum

Clients amb més d'un impagat (històric complet) tenen un recàrrec de 2€ per cada rebut notificat. El recàrrec és visible a les plantilles WhatsApp.

## Regles

1. **Llindar**: total d'impagats del client (qualsevol estat) > 1 → s'aplica recàrrec
2. **Import**: 2€ fixos per rebut notificat
3. **Càlcul**: dinàmic, sense persistir a BD
4. **Notificació simple** (1 rebut): si el client té >1 impagats totals, la plantilla mostra `+ 2€ despesa devolució` i el total amb recàrrec
5. **Notificació múltiple** (N rebuts): cada rebut mostra `+ 2€` al costat, i el total inclou tots els recàrrecs

## Canvis

### 1. `replyTemplates.ts` — Noves variables

Afegir a `TemplateVars`:
- `return_fee_per_receipt`: string ("2,00")
- `return_fee_total`: string (2€ × n rebuts notificats)
- `total_with_fee`: string (import total + recàrrec total)

Plantilla `TEMPLATE_INITIAL_NOTIFICATION`: afegir línia de despesa + total amb recàrrec (només si hi ha fee).
Plantilla `TEMPLATE_MULTIPLE_NOTIFICATION`: cada rebut mostra `+ 2€` i el total inclou els recàrrecs.

### 2. `notificationService.ts` — Càlcul del recàrrec

`sendWhatsApp()`:
- Comptar tots els rebuts del client (`prisma.returnedReceipt.count({ where: { clientId } })`)
- Si > 1: calcular `returnFee = 2.00`, `totalWithFee = amount + 2.00`
- Passar variables a la plantilla

`sendBulkWhatsApp()`:
- Mateix comptatge
- Si > 1: cada rebut de la llista mostra `+ 2€`, total inclou recàrrecs
- `receiptsList` modificat per mostrar el recàrrec per rebut

### 3. `Settings.tsx` — Documentació de variables

Actualitzar la llista de variables disponibles amb les noves.
