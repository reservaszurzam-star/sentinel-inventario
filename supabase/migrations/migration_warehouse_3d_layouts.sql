-- =====================================================
-- LogixZazu — Migración: LAYOUT 3D DE ALMACÉN Y RACKS
--
-- Tabla warehouse_3d_layouts: almacena la diagramación espacial 3D
-- de estanterías industriales por marca (coordenadas, dimensiones,
-- bahías, niveles y slotting).
--
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- =====================================================

create table if not exists public.warehouse_3d_layouts (
  id uuid primary key default gen_random_uuid(),
  brand text not null unique check (brand in ('OVERSHARK','BRAVOS','BOX_PRIME')),
  name text not null,
  layout_data jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.warehouse_3d_layouts enable row level security;

drop policy if exists "warehouse_3d_layouts_select" on public.warehouse_3d_layouts;
create policy "warehouse_3d_layouts_select" on public.warehouse_3d_layouts
  for select using (true);

drop policy if exists "warehouse_3d_layouts_insert" on public.warehouse_3d_layouts;
create policy "warehouse_3d_layouts_insert" on public.warehouse_3d_layouts
  for insert with check (true);

drop policy if exists "warehouse_3d_layouts_update" on public.warehouse_3d_layouts;
create policy "warehouse_3d_layouts_update" on public.warehouse_3d_layouts
  for update using (true) with check (true);

drop policy if exists "warehouse_3d_layouts_delete" on public.warehouse_3d_layouts;
create policy "warehouse_3d_layouts_delete" on public.warehouse_3d_layouts
  for delete using (true);

create index if not exists idx_warehouse_3d_layouts_brand on public.warehouse_3d_layouts(brand);
