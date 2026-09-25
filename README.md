# LogixZazu — Sistema de Gestión de Almacén e Inventario

Plataforma empresarial de control de almacén, inventario textil y kárdex operativo multimarca (`OVERSHARK`, `BRAVOS`, `BOX_PRIME`). Desarrollada con arquitectura reactiva en tiempo real sobre React 19 y Supabase.

---

## 🚀 Tech Stack

- **Frontend:** React 19, TypeScript 5.8, Vite 6, Tailwind CSS v4
- **Routing:** React Router v7 (`HashRouter`)
- **Backend & Base de Datos:** Supabase (PostgreSQL 15+, Row Level Security, Realtime LISTEN, RPCs transaccionales)
- **Edge Functions:** Supabase Edge Functions (Deno / TypeScript) para integración Odoo XML-RPC, Auth y despachos de correo
- **Visualización y Gráficos:** Recharts, Lucide Icons
- **Testing:** Vitest con jsdom

---

## 🛠️ Comandos de Desarrollo

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo (http://localhost:3000)
npm run dev

# Verificación de tipos TypeScript
npm run lint

# Ejecutar suite de pruebas unitarias
npm run test

# Pruebas unitarias en modo interactivo/watch
npm run test:watch

# Compilación para producción (dist/)
npm run build
```

---

## 📁 Estructura del Proyecto

```text
LogixZazu/
├── .env.example                      # Plantilla de variables de entorno requeridas
├── HANDOFF.md                        # Bitácora arquitectónica para desarrolladores
├── README.md                         # Documentación general y guía de inducción
├── package.json                      # Configuración de dependencias y scripts
├── scripts/                          # Herramientas operativas y utilidades
│   ├── database/                     # Scripts de diagnóstico e inspección directa (Node.js)
│   ├── refactor-archive/             # Archivo histórico de migraciones
│   └── README.md                     # Documentación de scripts y uso
├── src/
│   ├── components/                   # Componentes reutilizables de UI
│   │   ├── operations/               # Arquitectura modular del Kárdex / Operaciones
│   │   │   ├── constants.ts          # Tipos, badges y helpers puros
│   │   │   ├── ui.tsx                # Microcomponentes UI (botones, contenedores)
│   │   │   ├── CascadeProductSelector.tsx # Selector multinivel (Familia -> Color -> Talla)
│   │   │   ├── OperationForm.tsx     # Formulario de Recepción, Despacho y Traslado
│   │   │   ├── WriteOffForm.tsx      # Registro de Bajas y Devolución a Proveedor
│   │   │   ├── BulletinsTab.tsx      # Gestión de Boletines diarios agrupados
│   │   │   ├── TransactionLog.tsx    # Auditoría, edición, cancelación y purga
│   │   │   ├── OperationsReport.tsx  # Métricas, distribución y exportación (PDF / Excel)
│   │   │   ├── BulletinModal.tsx     # Visualizador e impresión de boletines
│   │   │   ├── GuideModal.tsx        # Modal de visualización de guías operativas
│   │   │   ├── QRScannerModal.tsx    # Lector de códigos QR vía cámara
│   │   │   └── index.ts              # Barrel export de operaciones
│   │   ├── FamilyQRModal.tsx         # Modal de generación e impresión de QR por familia
│   │   ├── TouchQRIngest.tsx         # Interfaz táctil de ingreso rápido de prendas por QR
│   │   └── Layout.tsx                # Shell de la aplicación y navegación por rol
│   ├── lib/                          # Dominio de negocio y utilidades
│   │   ├── colors.ts                 # Paleta textil peruana, soporte melange y luminancia
│   │   ├── colors.test.ts            # Pruebas unitarias de resolución de color
│   │   ├── sizes.ts                  # Orden y ranking estándar de tallas textiles
│   │   ├── sizes.test.ts             # Pruebas unitarias de ordenamiento de tallas
│   │   ├── permissions.ts            # Matriz RBAC (5 roles de acceso)
│   │   ├── supabase.ts               # Cliente Supabase singleton
│   │   ├── odooService.ts            # Sincronización y lectura de inventario Odoo
│   │   └── emailService.ts           # Despacho de notificaciones de guías por email
│   ├── pages/                        # Controladores de vista principales
│   │   ├── Operations.tsx            # Coordinador de pestañas de operaciones
│   │   ├── StockViewer.tsx           # Visor de inventario y stock disponible
│   │   ├── LocationViewer.tsx        # Mapeo y gestión de racks/ubicaciones
│   │   ├── PurchaseOrders.tsx        # Órdenes de compra y requerimientos
│   │   ├── WarehouseSim.tsx          # Simulador gráfico animado de almacén
│   │   └── ...
│   ├── store/
│   │   ├── AppContext.tsx            # Estado global reactivo y LISTEN Realtime
│   │   └── mappers.ts                # Mapeo de contratos BD -> Modelos TypeScript
│   └── types.ts                      # Definiciones de tipos globales del sistema
└── supabase/
    ├── functions/                    # Edge Functions (Deno / TS)
    └── migrations/                   # Scripts DDL de base de datos PostgreSQL
        └── migration_performance_indexes.sql # Índices FK y compuestos optimizados
```

---

## 🎨 Convenciones de Dominio Textil

### 1. Paleta de Colores (`src/lib/colors.ts`)
Los colores de prendas se normalizan contra `TEXTILE_COLOR_MAP`. Para acabados jaspeados (ej. *Gris Jaspe*, *Melange*), el sistema genera fondos con gradientes lineales CSS para máxima fidelidad visual:
```typescript
import { getColorStyle, getColorHex } from '@/lib/colors';

const { background, isLight } = getColorStyle("Gris Jaspe");
// Retorna gradiente css y bandera de contraste de texto
```

### 2. Ordenamiento de Tallas (`src/lib/sizes.ts`)
El orden estándar de confección peruana (`XS → S → M → L → XL → XXL → XXXL → TALLA UNICA → S/T`) está centralizado:
```typescript
import { sortSizes, sizeRank } from '@/lib/sizes';

const tallasOrdenadas = sortSizes(['L', 'XS', 'M', 'S']);
// ['XS', 'S', 'M', 'L']
```

---

## 🗄️ Base de Datos y Rendimiento

- **Transacciones Atómicas:** Todas las altas, bajas y transferencias se ejecutan mediante la función RPC `execute_transaction` de PostgreSQL, previniendo condiciones de carrera e inconsistencias de stock.
- **Índices de Rendimiento (`supabase/migrations/migration_performance_indexes.sql`):**
  - Llaves foráneas (`transactions.from_location_id`, `transactions.to_location_id`, `purchase_orders.supplier_id`, etc.).
  - Índices compuestos para consultas críticas:
    - `transactions(brand, type, date DESC)`
    - `transactions(reference)`
    - `products(brand, name)`
    - `purchase_orders(brand, status, date DESC)`

---

## 🔒 Control de Acceso (RBAC)

El acceso a rutas y acciones está gobernado por `src/lib/permissions.ts` sobre 5 roles:
1. `ADMIN_GENERAL`: Acceso total y configuración de permisos.
2. `CEO`: Supervisión ejecutiva y métricas completas.
3. `ADMINISTRADOR`: Gestión operativa y de inventario.
4. `JEFE_ALMACEN`: Operación de almacén, kárdex y ajustes.
5. `DESPACHADOR`: Creación de requerimientos y consulta de existencias.

---

## 📜 Licencia y Confidencialidad
Propiedad privada de LogixZazu. Prohibida su copia o distribución no autorizada.
