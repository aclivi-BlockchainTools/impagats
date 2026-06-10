# Tasca: Task 19: Frontend — Clients pages (list + form). Create Clie

Data: 2026-06-10 13:21:17
Projecte: impagats
Model recomanat: deepseek-v4-pro
Categoria: implementació

## Prompt

Task 19: Frontend — Clients pages (list + form). Create ClientsList.tsx, ClientForm.tsx, modify App.tsx with routes for /clients, /clients/new, /clients/:id.

## Context usat

Projecte: impagats

Última tasca: Crear pla d'implementació (implementat: sí)

## Tasca sol·licitada

Task 19: Frontend — Clients pages (list + form). Create ClientsList.tsx, ClientForm.tsx, modify App.tsx with routes for /clients, /clients/new, /clients/:id.

## Instruccions

1. NO proposis implementar funcionalitats que l'Estat actual indica com a completades o funcionals.
2. Si una àrea ja està implementada però no verificada, marca-la com a 'verificar', no com a 'implementar'.
3. Si la tasca...

## Resposta del model

✅ **Ja fet**  
- Pla d’implementació creat (tasca anterior completada).  
- (Si escau) Backend de clients podria estar ja disponible, però frontend encara no implementat.

🔧 **Pendent real**  
- Crear `ClientsList.tsx` amb taula, càrrega, error i estat buit.  
- Crear `ClientForm.tsx` per crear i editar clients.  
- Modificar `App.tsx` per afegir rutes: `/clients`, `/clients/new`, `/clients/:id`.  
- Connectar amb l’API per obtenir i guardar dades.  
- Validació bàsica del formulari i gestió d’estats.

⚠️ **Riscos**  
- L’API pot no estar completada; caldrà definir contractes primer.  
- Coherència visual/UX amb la resta de l’app (tipus de components).  
- Possibles diferències de versió de React Router.  
- Gestió d’errors de xarxa o dades no trobades (404).

📋 **10 següents passos prioritzats**  
1. Confirmar els *endpoints* de clients (GET /clients, POST /clients, GET /clients/:id, PUT /clients/:id) i l’estructura de dades.  
2. Definir un tipus TypeScript `Client` amb els camps necessaris.  
3. Configurar les rutes a `App.tsx` amb React Router:  
   - `/clients` → `ClientsList`  
   - `/clients/new` → `ClientForm` (creació)  
   - `/clients/:id` → `ClientForm` (edició)  
4. Crear un servei senzill (`api/clients.ts`) amb funcions `getAll`, `getById`, `create`, `update`.  
5. Implementar `ClientsList`:  
   - `useEffect` per carregar clients en muntar.  
   - Mostrar un indicador de càrrega (`Loading...`).  
   - Mostrar un missatge si no hi ha clients.  
   - Renderitzar una taula amb nom, email, telèfon i accions (editar).  
6. Implementar `ClientForm`:  
   - Obtenir l’ID de la ruta amb `useParams`.  
   - Si ID existent, carregar les dades del client per editar.  
   - Formulari amb camps controlats (`useState`).  
   - Gestionar l’enviament: `create` o `update` segons el cas.  
   - Redirigir a `/clients` després d’un guardat exitós (`useNavigate`).  
7. Afegir validació mínima: camps obligatoris, mostrar errors sota cada camp.  
8. Connectar la navegació: botó “Nou client” a la llista, enllaços d’edició a cada fila, botó “Tornar” al formulari.  
9. Provar el flux complet: crear, editar, llistar, errors de xarxa, client no trobat (404).  
10. Revisar estils i responsivitat per mantenir consistència amb la resta de l’app (Tailwind o similar si ja s’utilitza).

## Estat

Implementat: sí
Verificat: no
Completat: no

## Notes

- 2026-06-10 13:31: Creat backend/Dockerfile, frontend/Dockerfile, frontend/nginx.conf. Modificat docker-compose.yml per afegir serveis backend i frontend amb les configuracions especificades. → Implementat:sí Verificat:no Completat:no
- 2026-06-10 13:29: Task 21 completada. 4 noves pàgines creades (BankImport, ReturnedReceiptsList, ReturnedReceiptDetail, Settings). App.tsx actualitzat amb rutes reals. TypeScript check i build passen correctament. Commit realitzat.
- 2026-06-10 13:29: Commit realitzat: feat: CSV import, receipts list/detail, and settings pages (5 files, 309 insertions) → Implementat:no Verificat:no Completat:no
- 2026-06-10 13:29: Creates 4 noves pàgines (BankImport.tsx, ReturnedReceiptsList.tsx, ReturnedReceiptDetail.tsx, Settings.tsx) i modificat App.tsx per substituir els placeholders per les rutes reals. TypeScript check i build passen correctament. → Implementat:sí Verificat:sí Completat:sí
- 2026-06-10 13:25: Commit realitzat: feat: invoices list and form pages. 3 files changed, 137 insertions, 1 deletion. → Implementat:no Verificat:no Completat:no
- 2026-06-10 13:25: Created frontend/src/pages/InvoicesList.tsx and frontend/src/pages/InvoiceForm.tsx. Modified frontend/src/App.tsx to add imports and replace invoice placeholder routes with real components. TypeScript verification passed (npx tsc --noEmit, zero errors). → Implementat:sí Verificat:no Completat:no
- 2026-06-10 13:23: Task 19 completed. Created ClientsList.tsx (table with loading/empty states, delete), ClientForm.tsx (create/edit with all fields), updated App.tsx with 3 routes. TypeScript check passed. Committed as 0c89b35.
- 2026-06-10 13:23: Committed: feat: clients list and form pages (3 files, 130 insertions) → Implementat:sí Verificat:sí Completat:sí
- 2026-06-10 13:22: TypeScript check passed with zero errors. All 3 files compile correctly.
- 2026-06-10 13:22: Created ClientsList.tsx and ClientForm.tsx, modified App.tsx to add 3 routes (/clients, /clients/new, /clients/:id). TypeScript check passed with no errors. → Implementat:sí Verificat:no Completat:no
-
