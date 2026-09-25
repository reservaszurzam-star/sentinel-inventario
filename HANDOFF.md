# HANDOFF.md

Guía de arquitectura y contexto del proyecto **LogixZazu** para quien retome el trabajo (humano o agente).

## Comandos

```bash
npm run dev        # Dev server en puerto 3000
npm run build      # Build de producción (Vite)
npm run lint       # Type-check de TypeScript (tsc --noEmit)
npm run test       # Corre tests una vez (Vitest)
npm run test:watch # Tests en modo watch
```

## Stack

React 19 + TypeScript + Vite (SPA), `HashRouter`, Tailwind CSS v4, Supabase, Recharts.

## Arquitectura

### Estado global

Todo el estado de la aplicación vive en `src/store/AppContext.tsx` (708 líneas) vía React Context. Contiene: productos, ubicaciones, niveles de stock, transacciones, contactos, usuarios, órdenes de compra, ajustes de inventario, reservas, permisos por rol y logs de auditoría. Todas las páginas consumen este contexto — no hay Redux, Zustand ni otro store.

`src/store/mappers.ts` convierte filas crudas de Supabase a los tipos de TypeScript definidos en `src/types.ts`.

Las actualizaciones en tiempo real llegan por suscripciones Postgres LISTEN de Supabase (`supabase.channel('brand_' + activeBrand)`, una por tabla) más un polling silencioso de respaldo cada 5 segundos. Todos los datos están filtrados por la marca activa (`OVERSHARK | BRAVOS | BOX_PRIME`), guardada en el contexto y usada como filtro en cada consulta.

### Diseño multi-marca

Cada tabla de la BD tiene una columna `brand`. La marca activa se selecciona en el sidebar (`src/components/Layout.tsx`) y fluye por `AppContext` hacia todas las queries y escrituras. Cambiar de marca recarga los datos de esa marca.

### Permisos (`src/lib/permissions.ts`)

Control de acceso basado en roles. Cinco roles (`src/types.ts` → `Role`):

- `ADMIN_GENERAL`
- `CEO`
- `ADMINISTRADOR`
- `JEFE_ALMACEN`
- `DESPACHADOR`

`canView()` (usado en `visibleNav` de Layout) y `canEdit()` controlan el acceso a cada módulo, con tres niveles: `'none' | 'view' | 'full'`. Los permisos por rol están en `DEFAULT_ROLE_PERMISSIONS` y también se guardan en la tabla `role_permissions`, cargándose al contexto al iniciar sesión (pueden diferir de los defaults si se editaron desde el módulo Usuarios).

Módulos actualmente controlados por permiso (claves usadas como `id` de ruta/nav): `dashboard`, `analysis`, `inventory`, `locations`, `operations`, `adjustments`, `purchase-orders`, `history`, `contacts`, `reports`, `labels`, `warehouse-map`, `users`, `operation-history`, `reservations`, `odoo-stock`, `warehouse-sim`.

`DESPACHADOR` está restringido a solo crear requerimientos dentro de `purchase-orders` (ver commit `feat(despachador)`).

### Supabase

- **Auth**: basada en sesión. Los usuarios inactivos son expulsados por política RLS.
- **DB**: acceso directo a tablas vía JS SDK (`src/lib/supabase.ts`).
- **Edge Functions** (`supabase/functions/`):
  - `odoo-stock` — proxy XML-RPC hacia Odoo (evita CORS del navegador)
  - `send-email` — notificaciones de operaciones por correo
  - `update-user-auth` — crear/actualizar/eliminar usuarios de Supabase Auth
- **Migrations** (`supabase/migrations/`): schema base, RLS, RPCs, y migraciones incrementales (`migration_audit_log`, `migration_dispatch_requirement`, `migration_notifications`, `migration_reception_no_stock`, `migration_reservations`, `migration_rpcs`, `migration_schema_polish`, `migration_storage`, `migration_performance_indexes`).

### Escritura de transacciones

Las transacciones nuevas deben pasar por el RPC `execute_transaction` de Supabase — nunca insertar directamente en la tabla `transactions`. El RPC actualiza los niveles de stock de forma atómica. Cancelar usa el RPC `cancel_transaction` (revierte el stock). Un `UPDATE` directo sobre `transactions` solo es aceptable para campos de metadata: `reference`, `contact_id`, `date`.

### Integración con Odoo

`src/lib/odooService.ts` expone `fetchOdooAll()` y helpers por recurso. Llaman a la Edge Function de Supabase, que habla XML-RPC con `https://zazuexpress2.odoo.com`. Las credenciales (URL, DB, usuario, API key) viven en Supabase secrets — los valores hardcodeados como fallback en `supabase/functions/odoo-stock/index.ts` deberían moverse a secrets para producción.

`src/pages/OdooStock.tsx` es de solo lectura: carga datos de Odoo, construye un `attrMap` para lookup O(1) de atributos por variante, y clasifica atributos como color o talla vía regex. Los filtros usan comparaciones `.trim()` para evitar desalineces por espacios en blanco.

### Routing

React Router v7 con `HashRouter`. Las rutas están definidas en `src/App.tsx`. El sidebar en `src/components/Layout.tsx` (array `navItems`) controla orden y visibilidad de los módulos — el orden del array define el número de índice (`num`) mostrado junto al ícono, no el orden de declaración de rutas en `App.tsx`.

### Build

Vite con manual chunk splitting (`react-vendor`, `supabase`, `charts`, `icons`, `qr`, `utils`). El umbral de warning de tamaño de chunk es 700 KB. `supabase/functions/` está excluido de la compilación TypeScript principal — las Edge Functions corren bajo Deno y se type-checkean por separado.

## Arquitectura Modular de Operaciones (`src/components/operations/`)

El monolito original `src/pages/Operations.tsx` (~3,832 líneas) fue desacoplado en componentes especializados bajo una arquitectura limpia y modular:

- `src/components/operations/constants.ts`: Tipos (`ActiveOp`, `LineItem`, `OperationGuide`), badges de estado, prefijos de guía y utilidades puras.
- `src/components/operations/ui.tsx`: Componentes de presentación reutilizables (`OptButton`, `FormGroup`, `PreviewRow`).
- `src/components/operations/CascadeProductSelector.tsx`: Selector en cascada (Familia → Color → Talla) con ordenamiento textil estandarizado.
- `src/components/operations/OperationForm.tsx`: Lógica transaccional completa (Recepción, Despacho, Traslado) con pad de firma digital, subida de foto a Supabase Storage y despacho de notificaciones por email.
- `src/components/operations/WriteOffForm.tsx`: Registro de bajas/daños y devoluciones a proveedor.
- `src/components/operations/BulletinsTab.tsx`: Agrupación y consulta de boletines diarios por fecha y número de guía.
- `src/components/operations/TransactionLog.tsx`: Kárdex y tabla de auditoría con paginación, filtros de fecha, edición inline, cancelación suave y purga administrativa.
- `src/components/operations/OperationsReport.tsx`: Tarjetas de KPI, barra de distribución de movimientos, kárdex por producto y exportación a PDF y Excel.
- `src/components/operations/BulletinModal.tsx`, `GuideModal.tsx`, `QRScannerModal.tsx`: Modales de soporte para lectura e impresión.
- `src/pages/Operations.tsx`: Contenedor principal de pestañas (~150 líneas) que re-exporta los subcomponentes para garantizar 100% de retrocompatibilidad con `PurchaseOrders.tsx`.

## Convenciones críticas

### Dominio Textil Centralizado

1. **Orden de Tallas (`src/lib/sizes.ts`)**:
   - Define `SIZE_ORDER` (`XS → S → M → L → XL → XXL → XXXL → TALLA UNICA → S/T`).
   - Funciones `sizeRank()` y `sortSizes()` disponibles globalmente.
   - Cuenta con suite de pruebas unitarias en `src/lib/sizes.test.ts`.

2. **Paleta Textil y Melange (`src/lib/colors.ts`)**:
   - Normaliza nombres y variaciones de color textil peruano contra `TEXTILE_COLOR_MAP`.
   - Soporte para patrones jaspeados y melange mediante gradientes lineales CSS (`background`).
   - Cálculo automático de contraste/luminancia (`isLight`).
   - Cuenta con suite de pruebas unitarias en `src/lib/colors.test.ts`.

### Manejo de fechas (timezone)

`Transaction.date` es `timestamptz`, almacenado en UTC por Supabase. La app corre en Perú (UTC-5). **Nunca usar `new Date('YYYY-MM-DD')` directamente** — se parsea como medianoche UTC y se renderiza como el día anterior en hora local. Siempre:

- **Parsear para mostrar**: `new Date('YYYY-MM-DD' + 'T00:00:00')` (fuerza medianoche local) o `date-fns/parseISO` + `addMinutes(offset)`.
- **Comparar contra valores de `<input type="date">`**: recortar el string ISO — `tx.date.slice(0, 10)` da `YYYY-MM-DD` en UTC, seguro para comparación de strings con inputs de fecha.
- **Guardar en BD**: usar `'YYYY-MM-DDT12:00:00Z'` (mediodía UTC) para que la fecha calendario sea correcta en cualquier zona horaria americana.

### Generación de PDF (Reports.tsx)

Reports usa `jsPDF` + `jspdf-autotable`. Hay dos flujos de PDF:

1. **Reportes estándar** — `exportPDF()` con `drawHeader()` / `drawFooter()`.
2. **PDF Entrega** (`exportPDFEntrega`) — modal separado (`showEntregaModal`) con su propio estado de rango de fechas (`entregaDateFrom`, `entregaDateTo`), independiente de los filtros globales del reporte (`dateFrom`, `dateTo`). La tabla pivote se construye a partir de transacciones `RECEPTION` filtradas, no de `inventoryRows`. Header/footer usan `drawEntregaHeader()` / `drawEntregaFooter()` sin rellenos de color (friendly para impresión).

Ruta del logo: `/Zazu/zazu-logo/zazu-dark mode.png` (ojo con el espacio en el nombre de archivo). Se obtiene como blob → base64 antes de `pdf.addImage()`.

## Módulos (páginas)

Todas en `src/pages/`. Mapeo id de permiso → archivo → ruta:

| id permiso | archivo | ruta |
|---|---|---|
| dashboard | Dashboard.tsx | /dashboard |
| analysis | Analysis.tsx | /analysis |
| inventory | Inventory.tsx | /inventory |
| locations | Locations.tsx | /locations |
| operations | Operations.tsx | /operations |
| history | History.tsx | /history |
| contacts | Contacts.tsx | /contacts |
| users | Users.tsx | /users |
| purchase-orders | PurchaseOrders.tsx | /purchase-orders |
| adjustments | Adjustments.tsx | /adjustments |
| reports | Reports.tsx | /reports |
| labels | Labels.tsx | /labels |
| warehouse-map | WarehouseMap.tsx | /warehouse-map |
| operation-history | OperationHistory.tsx | /operation-history |
| reservations | Reservations.tsx | /reservations |
| odoo-stock | OdooStock.tsx | /odoo-stock |
| warehouse-sim | WarehouseSim.tsx | /warehouse-sim |

`Login.tsx`, `PendingAccess.tsx` y `ResetPassword.tsx` no están sujetas a permisos (se muestran fuera del flujo autenticado normal de `AppShell`).

### WarehouseSim (`src/pages/WarehouseSim.tsx`) — nuevo, sin commitear

Módulo de **simulación visual** de flujo de almacén, autocontenido (no toca Supabase ni datos reales). Sirve para demo/entrenamiento del flujo operativo.

- Mapa SVG con 5 zonas: `supplier → reception → reserve → dispatch → client`, conectadas por 4 rutas de operación (`RECEPCION`, `A_RESERVAS`, `REQUERIMIENTO`, `DESPACHO`), cada una con su color.
- Genera "paquetes" (operaciones) aleatorios que viajan por curvas bezier entre zonas, con velocidad configurable (0.5×–3×).
- Cada ~2 min (`CONFIRM_INTERVAL`, ajustado por velocidad) se abre un modal de confirmación de lote con 30s de ventana (`CONFIRM_WINDOW`); si expira, el lote se rechaza automáticamente.
- KPIs: operaciones totales, en tránsito, confirmados, rechazados, eficiencia (%).
- Panel de alertas y log de operaciones (últimas 60 entradas).
- Motor de animación vía `requestAnimationFrame`, sin librerías externas de animación.

Integración ya cableada: ruta en `App.tsx`, ítem de nav "SIMULACIÓN" (ícono `Activity`) en `Layout.tsx`, y permiso `warehouse-sim` en los 5 roles (`full` para `ADMIN_GENERAL`/`CEO`, `none` para el resto).

### Almacén 3D & Diagramación de Racks (`src/pages/Warehouse3D.tsx`)

Módulo interactivo de visualización y modelado 3D del almacén textil utilizando Three.js:
- **Lienzo Full-Bleed:** El visor 3D utiliza el 100% del ancho y más del 85% de la altura útil de pantalla (`h-[calc(100vh-4rem)]`), con cabecera de cabina compacta (~36px) y KPIs colapsables.
- **Barra de Herramientas Unificada:** Selector de Vista 3D vs. Planilla 2D, modos de mapa de calor/prendas/categorías, presets de cámara (`Iso`, `Cenital`, `Frontal`, `↺`), modo primera persona caminable (`[🚪 Caminar]`), selector de techo (`Cristal`, `Sólido`, `Oculto`) y buscador con foco automático.
- **Diseñador Técnico de Planta por Cuadrícula (CAD 2D):**
  - Muros perimetrales inteligentes resaltados con bordes dorado/ámbar en tiempo real.
  - Reglas métricas superior (X) y lateral (Z) para medición milimétrica en metros.
  - Steppers `[-]` y `[+]` para ajuste rápido de dimensiones.
  - Píldora de telemetría de coordenadas y métricas de superficie ($m^2$) y perímetro lineal ($m$).
- **Persistencia y Resiliencia ante Polling:**
  - Separación de efectos: La recarga del diseño físico sólo ocurre al montar o cambiar de marca (`[activeBrand]`). El polling de inventario cada 5s sólo actualiza las cantidades de stock en baldas (`hydrateRacksWithInventory`) sin reiniciar el plano ni deseleccionar estanterías.
  - Persistencia híbrida en `localStorage` (`logix_warehouse_3d_layout_<BRAND>`) y sincronización en la nube vía Supabase (`warehouse_3d_layouts`).

## Testing

Vitest + jsdom.
- `src/lib/permissions.test.ts` (Permisos RBAC)
- `src/store/mappers.test.ts` (Mappers y contratos de BD)
- `src/lib/sizes.test.ts` (Ordenamiento y ranking de tallas textiles)
- `src/lib/colors.test.ts` (Normalización de colores, melange y contraste)
- `src/lib/warehouseBounds.test.ts` (Validación de límites y colisiones 3D)
- `src/components/warehouse3d/architecturalBuilder.test.ts` (Generación de mallas Three.js)
- `src/components/warehouse3d/firstPersonControls.test.ts` (Controlador de primera persona)
- `src/services/warehouse3dStorage.test.ts` (Persistencia y serialización de layout)

Total: 8 suites de pruebas, 39 tests automatizados pasando al 100%.

## Scripts de Mantenimiento (`scripts/`)

- `scripts/database/`: Scripts Node.js para inspección puntual, verificación de ubicaciones, bins y stock contra Supabase.
- `scripts/refactor-archive/`: Archivo histórico de scripts CJS antiguos de refactorización previa.

## Variables de entorno

Ver `.env.example` para las claves esperadas (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_FUNCTIONS_URL`). No commitear `.env` real.


