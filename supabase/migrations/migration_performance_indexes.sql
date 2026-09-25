-- =====================================================================
-- LogixZazu — Migración: ÍNDICES DE RENDIMIENTO Y OPTIMIZACIÓN DE CONSULTAS
-- =====================================================================
-- Descripción:
-- Esta migración agrega índices B-tree sobre claves foráneas (FK) faltantes
-- y crea índices compuestos diseñados para acelerar las consultas más críticas
-- del sistema (Operaciones, Kárdex, Boletines diarios, Selector de Productos
-- y Órdenes de Compra).
--
-- Modo de Ejecución:
-- Supabase Dashboard → SQL Editor → Pegar este script → Run.
--
-- Nota sobre Cero-Downtime:
-- En PostgreSQL / Supabase, si la base de datos está bajo alta concurrencia
-- en producción masiva, se puede ejecutar cada índice individualmente fuera de
-- un bloque de transacción usando `CREATE INDEX CONCURRENTLY IF NOT EXISTS`.
-- Para despliegues estándar o bases de datos de inventario con tráfico regular,
-- la ejecución en bloque con `IF NOT EXISTS` garantiza idempotencia y seguridad.
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. ÍNDICES DE CLAVES FORÁNEAS (FKs) FALTANTES
-- PostgreSQL no indexa automáticamente las columnas FK referenciadas.
-- Sin estos índices, joins y cascading checks realizan sequential scans.
-- =====================================================================

-- Transactions: Ubicaciones de origen y destino
CREATE INDEX IF NOT EXISTS idx_transactions_from_location 
  ON public.transactions(from_location_id);

CREATE INDEX IF NOT EXISTS idx_transactions_to_location 
  ON public.transactions(to_location_id);

-- Purchase Orders: Proveedor y Ubicación destino
CREATE INDEX IF NOT EXISTS idx_po_supplier 
  ON public.purchase_orders(supplier_id);

CREATE INDEX IF NOT EXISTS idx_po_location 
  ON public.purchase_orders(location_id);

-- Product Locations: Ubicación asignada
CREATE INDEX IF NOT EXISTS idx_product_locations_location 
  ON public.product_locations(location_id);


-- =====================================================================
-- 2. ÍNDICES COMPUESTOS PARA ACELERACIÓN DE CONSULTAS
-- =====================================================================

-- Optimiza la pestaña de Operaciones y reportes filtrados por marca, tipo y fecha
-- Query: WHERE brand = ? AND type = ? ORDER BY date DESC
CREATE INDEX IF NOT EXISTS idx_transactions_brand_type_date 
  ON public.transactions(brand, type, date DESC);

-- Optimiza la búsqueda de transacciones por guía o número de referencia (Boletines)
-- Query: WHERE reference = ? O agrupaciones por referencia
CREATE INDEX IF NOT EXISTS idx_transactions_reference 
  ON public.transactions(reference);

-- Optimiza el catálogo de productos y el selector en cascada por Marca + Nombre (Familia)
-- Query: WHERE brand = ? ORDER BY name ASC
CREATE INDEX IF NOT EXISTS idx_products_brand_name 
  ON public.products(brand, name);

-- Optimiza la búsqueda por código de producto/código de barras por marca
-- Query: WHERE brand = ? AND code = ?
CREATE INDEX IF NOT EXISTS idx_products_brand_code 
  ON public.products(brand, code);

-- Optimiza la lista de Órdenes de Compra por Marca, Estado y Fecha
-- Query: WHERE brand = ? AND status = ? ORDER BY date DESC
CREATE INDEX IF NOT EXISTS idx_po_brand_status_date 
  ON public.purchase_orders(brand, status, date DESC);

COMMIT;

-- =====================================================================
-- 3. PLAN DE ROLLBACK (REVERSIÓN)
-- En caso de requerir revertir estos índices, ejecutar las siguientes sentencias:
-- =====================================================================
/*
DROP INDEX IF EXISTS public.idx_transactions_from_location;
DROP INDEX IF EXISTS public.idx_transactions_to_location;
DROP INDEX IF EXISTS public.idx_po_supplier;
DROP INDEX IF EXISTS public.idx_po_location;
DROP INDEX IF EXISTS public.idx_product_locations_location;
DROP INDEX IF EXISTS public.idx_transactions_brand_type_date;
DROP INDEX IF EXISTS public.idx_transactions_reference;
DROP INDEX IF EXISTS public.idx_products_brand_name;
DROP INDEX IF EXISTS public.idx_products_brand_code;
DROP INDEX IF EXISTS public.idx_po_brand_status_date;
*/
