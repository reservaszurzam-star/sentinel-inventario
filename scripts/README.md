# Scripts de Utilidad y Mantenimiento

Este directorio agrupa herramientas y scripts para inspección, pruebas y mantenimiento del sistema.

## Estructura

- `database/`: Scripts de inspección directa de base de datos Supabase, verificación de inventario, stock y pruebas de RPC.
  - `check-bins.mjs`: Consulta y validación de ubicaciones tipo BIN.
  - `check_names.mjs`: Extracción de nombres de productos y marcas únicas.
  - `get_stock.mjs`: Consulta de niveles de stock por producto.
  - `check_transfer.mjs` / `do_transfer.mjs`: Pruebas de transferencia entre ubicaciones.
  - `test_insert.mjs` / `test_delete.mjs` / `test_stock_logic.mjs`: Tests de lógica de stock.
- `refactor-archive/`: Scripts históricos de transformación utilizados en refactorizaciones de componentes (preservados para trazabilidad).
