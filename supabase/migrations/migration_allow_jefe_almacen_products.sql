-- =====================================================================
-- LogixZazu — Migración: Permitir a JEFE_ALMACEN crear productos y variantes
-- =====================================================================
-- Descripción:
-- En el frontend (src/lib/permissions.ts), el rol JEFE_ALMACEN cuenta con
-- permisos completos ('full') sobre el módulo de Inventario. Sin embargo,
-- en PostgreSQL la política previa de RLS ('products_insert') limitaba la
-- inserción exclusivamente a ('ADMIN_GENERAL', 'CEO', 'ADMINISTRADOR').
--
-- Esta migración añade 'JEFE_ALMACEN' a la política de inserción de la
-- tabla `products`, permitiendo que el personal de almacén pueda registrar
-- nuevos productos y crear variantes de prendas en cualquiera de las marcas.
--
-- Modo de Ejecución:
-- Supabase Dashboard → SQL Editor → Pegar este script → Run.
-- =====================================================================

BEGIN;

DROP POLICY IF EXISTS "products_insert" ON public.products;

CREATE POLICY "products_insert" ON public.products
  FOR INSERT WITH CHECK (
    get_my_role() IN ('ADMIN_GENERAL', 'CEO', 'ADMINISTRADOR', 'JEFE_ALMACEN')
  );

COMMIT;

-- =====================================================================
-- PLAN DE ROLLBACK (REVERSIÓN)
-- =====================================================================
/*
DROP POLICY IF EXISTS "products_insert" ON public.products;
CREATE POLICY "products_insert" ON public.products
  FOR INSERT WITH CHECK (
    get_my_role() IN ('ADMIN_GENERAL', 'CEO', 'ADMINISTRADOR')
  );
*/
