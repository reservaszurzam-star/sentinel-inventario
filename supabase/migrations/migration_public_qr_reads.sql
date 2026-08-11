-- =====================================================
-- Migration to allow Public (Anonymous) Reads for QRs
-- =====================================================

BEGIN;

DROP POLICY IF EXISTS "products_select" ON products;
CREATE POLICY "products_select" ON products FOR SELECT USING (true);

DROP POLICY IF EXISTS "locations_select" ON locations;
CREATE POLICY "locations_select" ON locations FOR SELECT USING (true);

DROP POLICY IF EXISTS "stock_levels_select" ON stock_levels;
CREATE POLICY "stock_levels_select" ON stock_levels FOR SELECT USING (true);

COMMIT;
