  -- =====================================================
-- LogixZazu — Migración: DISEÑO DE PRODUCTOS + DISTRIBUCIÓN AUTOMÁTICA
--
-- 1) Tabla product_locations: define para cada product_id su
--    UBICACIÓN DESIGNADA (vista en el módulo de Ubicaciones).
--    Control central: módulo "DISEÑO DE PRODUCTOS".
--
-- 2) execute_transaction: cuando una RECEPCIÓN aterriza en
--    ALMACEN-RESERVA GENERAL, el stock se DISTRIBUYE AUTOMÁTICAMENTE
--    hacia la ubicación designada del producto y la reserva queda en 0.
--    - Si el producto NO tiene ubicación designada → el stock se
--      queda en la reserva general (para que se asigne luego).
--
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- =====================================================

-- ---------- Tabla product_locations ----------
create table if not exists public.product_locations (
  id          uuid primary key default gen_random_uuid(),
  brand       text not null,
  product_id  text not null references public.products(id) on delete cascade,
  location_id text not null references public.locations(id) on delete cascade,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (brand, product_id)
);

alter table public.product_locations enable row level security;

drop policy if exists "product_locations_select" on public.product_locations;
create policy "product_locations_select" on public.product_locations
  for select using (true);

drop policy if exists "product_locations_insert" on public.product_locations;
create policy "product_locations_insert" on public.product_locations
  for insert with check (true);

drop policy if exists "product_locations_update" on public.product_locations;
create policy "product_locations_update" on public.product_locations
  for update using (true) with check (true);

drop policy if exists "product_locations_delete" on public.product_locations;
create policy "product_locations_delete" on public.product_locations
  for delete using (true);

create index if not exists idx_product_locations_product on public.product_locations(product_id);
create index if not exists idx_product_locations_brand   on public.product_locations(brand);

-- ---------- execute_transaction: RECEPCIÓN + DISTRIBUCIÓN ----------
create or replace function execute_transaction(
  p_brand text,
  p_type text,
  p_product_id text,
  p_quantity integer,
  p_from_location_id text,
  p_to_location_id text,
  p_reference text,
  p_user_name text,
  p_contact_id uuid,
  p_signature text,
  p_serial_number text,
  p_force_new_entry boolean default false
) returns uuid language plpgsql security definer as $$
declare
  v_tx_id uuid;
  v_current_stock integer;
  v_dest_location text := p_to_location_id;  -- destino efectivo (puede redirigirse)
  v_is_reserve boolean := false;
  v_designation_loc_id text := null;
begin
  -- ---------------------------------------------------------------
  -- RECEPCIÓN + DISTRIBUCIÓN AUTOMÁTICA
  -- Si el destino es la reserva general, se redirige el stock a la
  -- ubicación designada del producto. La reserva queda en 0.
  -- ---------------------------------------------------------------
  if p_type = 'RECEPTION' then
    v_is_reserve := p_to_location_id is not null
      and exists (
        select 1 from locations l
        where l.id = p_to_location_id
          and upper(l.name) = 'ALMACEN-RESERVA GENERAL'
      );

    if v_is_reserve then
      -- Buscar la ubicación designada del producto
      select pl.location_id::text
        into v_designation_loc_id
        from product_locations pl
        where pl.brand = p_brand
          and pl.product_id = p_product_id
        limit 1;

      if v_designation_loc_id is not null then
        -- Redirige el destino hacia la ubicación designada
        v_dest_location := v_designation_loc_id;
      end if;
    end if;
  end if;

  -- Validar stock solo para DISPATCH y TRANSFER
  if p_type in ('DISPATCH', 'TRANSFER') then
    select quantity into v_current_stock
    from stock_levels
    where brand = p_brand and product_id = p_product_id and location_id = p_from_location_id;

    if coalesce(v_current_stock, 0) < p_quantity then
      raise exception 'STOCK_INSUFICIENTE: disponible=%', coalesce(v_current_stock, 0);
    end if;
  end if;

  -- Insertar transacción (siempre — registro histórico con destino efectivo)
  insert into transactions (
    brand, type, product_id, quantity, from_location_id, to_location_id,
    reference, user_name, contact_id, signature, serial_number
  ) values (
    p_brand, p_type, p_product_id, p_quantity,
    p_from_location_id, v_dest_location,
    p_reference, p_user_name, p_contact_id, p_signature, p_serial_number
  ) returning id into v_tx_id;

  -- RECEPCIÓN: suma a la ubicación efectiva (designada o reserva)
  if p_type = 'RECEPTION' then
    insert into stock_levels (brand, product_id, location_id, quantity)
    values (p_brand, p_product_id, v_dest_location, p_quantity)
    on conflict (brand, product_id, location_id)
    do update set quantity = stock_levels.quantity + excluded.quantity, updated_at = now();
  end if;

  -- DESPACHO: descuenta del stock en el almacén origen
  if p_type = 'DISPATCH' then
    update stock_levels
    set quantity = quantity - p_quantity, updated_at = now()
    where brand = p_brand and product_id = p_product_id and location_id = p_from_location_id;
    delete from stock_levels where brand = p_brand and quantity <= 0;
  end if;

  -- TRASLADO: mueve entre almacenes (no cambia el total de inventario)
  if p_type = 'TRANSFER' then
    update stock_levels
    set quantity = quantity - p_quantity, updated_at = now()
    where brand = p_brand and product_id = p_product_id and location_id = p_from_location_id;
    delete from stock_levels where brand = p_brand and quantity <= 0;
    insert into stock_levels (brand, product_id, location_id, quantity)
    values (p_brand, p_product_id, v_dest_location, p_quantity)
    on conflict (brand, product_id, location_id)
    do update set quantity = stock_levels.quantity + excluded.quantity, updated_at = now();
  end if;

  return v_tx_id;
end;
$$;


-- =====================================================
-- RPC: receive_purchase_order → RECEPCIÓN + DISTRIBUCIÓN
-- Aplica la MISMA lógica de distribución automática que
-- execute_transaction cuando el destino de la OC es
-- ALMACEN-RESERVA GENERAL.
-- =====================================================
create or replace function receive_purchase_order(
  p_po_id uuid,
  p_user_name text,
  p_qtys jsonb
) returns void language plpgsql security definer as $$
declare
  v_po record;
  v_payload jsonb;
  v_product_id text;
  v_qty integer;
  v_dest_location_id text;
  v_designation_loc_id text;
  v_total_qty integer := 0;
  v_total_received integer := 0;
  v_new_status text;
  v_is_reserve boolean := false;
begin
  select * into v_po from purchase_orders where id = p_po_id for update;
  if not found then
    raise exception 'PO_NOT_FOUND';
  end if;
  if v_po.location_id is null then
    raise exception 'PO_WITHOUT_LOCATION';
  end if;

  -- Determinar si el destino de la OC es la reserva general
  select exists (
    select 1 from locations l
    where l.id = v_po.location_id
      and upper(l.name) = 'ALMACEN-RESERVA GENERAL'
  ) into v_is_reserve;

  for v_payload in select * from jsonb_array_elements(p_qtys) loop
    v_product_id := v_payload->>'product_id';
    v_qty := (v_payload->>'qty')::integer;
    if v_qty is null or v_qty <= 0 then
      continue;
    end if;

    v_dest_location_id := v_po.location_id;

    -- Distribución automática: si el destino es reserva general y el
    -- producto tiene ubicación designada, redirige el stock.
    if v_is_reserve then
      select pl.location_id::text
        into v_designation_loc_id
        from product_locations pl
        where pl.brand = v_po.brand
          and pl.product_id = v_product_id
        limit 1;

      if v_designation_loc_id is not null then
        v_dest_location_id := v_designation_loc_id;
      end if;
    end if;

    -- Insertar la transacción RECEPTION con destino efectivo
    insert into transactions (
      brand, type, product_id, quantity,
      from_location_id, to_location_id,
      reference, user_name, contact_id, status
    ) values (
      v_po.brand, 'RECEPTION', v_product_id, v_qty,
      null, v_dest_location_id,
      v_po.reference, p_user_name, v_po.supplier_id, 'COMPLETED'
    );

    -- Upsert stock_levels en el destino efectivo (designado o reserva)
    insert into stock_levels (brand, product_id, location_id, quantity)
    values (v_po.brand, v_product_id, v_dest_location_id, v_qty)
    on conflict (brand, product_id, location_id) do update
      set quantity = stock_levels.quantity + excluded.quantity,
          updated_at = now();

    -- Incrementar received_quantity en el item de la OC
    update purchase_order_items
    set received_quantity = received_quantity + v_qty
    where purchase_order_id = p_po_id and product_id = v_product_id;
  end loop;

  -- Recalcular estado de la OC
  select
    coalesce(sum(quantity), 0),
    coalesce(sum(received_quantity), 0)
  into v_total_qty, v_total_received
  from purchase_order_items
  where purchase_order_id = p_po_id;

  if v_total_received <= 0 then
    v_new_status := v_po.status;
  elsif v_total_received >= v_total_qty then
    v_new_status := 'COMPLETED';
  else
    v_new_status := 'PARTIAL';
  end if;

  update purchase_orders set status = v_new_status where id = p_po_id;
end;
$$;
