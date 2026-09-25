import { Rack3D, Warehouse3DLayout } from '../types/warehouse3d';
import { Location, Product, StockLevel, ProductLocation } from '../types';
import { supabase } from '../lib/supabase';

const STORAGE_KEY_PREFIX = 'logix_warehouse_3d_layout_';

/**
 * Genera una disposición inicial realista en 3D para una marca si aún no tiene ninguna.
 */
export function generateDefaultLayout(brand: string): Warehouse3DLayout {
  const racks: Rack3D[] = [
    {
      id: `rack-${brand.toLowerCase()}-a1`,
      brand,
      name: 'ESTANTE BLANCO A-01',
      aisle: 'Pasillo 1',
      zone: 'Zona Textil Principal',
      position: [-4, 0, -4],
      rotationY: 0,
      bays: 2,
      levels: 4,
      bayWidth: 0.65,
      depth: 0.55,
      levelHeight: 0.55,
      color: '#ffffff', // Mueble de casilleros en madera blanca
      materialType: 'WHITE_WOOD',
      boardThickness: 0.03,
      slots: {},
      updatedAt: new Date().toISOString(),
    },
    {
      id: `rack-${brand.toLowerCase()}-a2`,
      brand,
      name: 'ESTANTE BLANCO A-02',
      aisle: 'Pasillo 1',
      zone: 'Zona Textil Principal',
      position: [3, 0, -4],
      rotationY: 0,
      bays: 2,
      levels: 4,
      bayWidth: 0.65,
      depth: 0.55,
      levelHeight: 0.55,
      color: '#ffffff',
      materialType: 'WHITE_WOOD',
      boardThickness: 0.03,
      slots: {},
      updatedAt: new Date().toISOString(),
    },
    {
      id: `rack-${brand.toLowerCase()}-b1`,
      brand,
      name: 'ESTANTE BLANCO B-01',
      aisle: 'Pasillo 2',
      zone: 'Zona Central',
      position: [-4, 0, 3],
      rotationY: 0,
      bays: 2,
      levels: 4,
      bayWidth: 0.65,
      depth: 0.55,
      levelHeight: 0.55,
      color: '#ffffff',
      materialType: 'WHITE_WOOD',
      boardThickness: 0.03,
      slots: {},
      updatedAt: new Date().toISOString(),
    },
    {
      id: `rack-${brand.toLowerCase()}-b2`,
      brand,
      name: 'ESTANTE BLANCO B-02',
      aisle: 'Pasillo 2',
      zone: 'Zona Central',
      position: [3, 0, 3],
      rotationY: 0,
      bays: 2,
      levels: 4,
      bayWidth: 0.65,
      depth: 0.55,
      levelHeight: 0.55,
      color: '#ffffff',
      materialType: 'WHITE_WOOD',
      boardThickness: 0.03,
      slots: {},
      updatedAt: new Date().toISOString(),
    },
  ];

  // Inicializar slots en cada rack
  racks.forEach(rack => {
    for (let l = 1; l <= rack.levels; l++) {
      for (let b = 1; b <= rack.bays; b++) {
        const key = `${l}-${b}`;
        rack.slots[key] = {
          level: l,
          bay: b,
          code: `${rack.name.replace(/\s+/g, '-')}-N${l}-C${b}`,
          capacity: 150,
          stockUnits: 0,
        };
      }
    }
  });

  return {
    brand,
    name: `Almacén Central ${brand}`,
    warehouseWidth: 26,
    warehouseLength: 30,
    racks,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Carga el layout 3D de la marca desde localStorage o genera uno por defecto.
 * Si no existe aún en storage, persiste el default de inmediato para evitar estados volátiles.
 */
export function loadWarehouse3DLayout(brand: string): Warehouse3DLayout {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${brand}`);
    if (raw) {
      const parsed = JSON.parse(raw) as Warehouse3DLayout;
      if (parsed && Array.isArray(parsed.racks) && parsed.racks.length > 0) {
        // Asegurar que todos los estantes utilicen el acabado de tablas de madera blanca
        parsed.racks = parsed.racks.map(r => ({
          ...r,
          color: (!r.color || r.color === '#1e40af' || r.color === '#d97706') ? '#f8fafc' : r.color,
          materialType: r.materialType || 'WHITE_WOOD',
          boardThickness: r.boardThickness || 0.038,
        }));
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error cargando layout 3D desde storage:', err);
  }

  const defaultLayout = generateDefaultLayout(brand);
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${brand}`, JSON.stringify(defaultLayout));
  } catch (err) {
    console.warn('No se pudo inicializar layout en localStorage:', err);
  }
  return defaultLayout;
}

/**
 * Consulta asíncronamente Supabase para obtener el layout más reciente de la nube.
 * Si no está disponible o falla, recurre a localStorage de forma transparente.
 */
export async function fetchWarehouse3DLayoutAsync(brand: string): Promise<Warehouse3DLayout> {
  try {
    const { data, error } = await supabase
      .from('warehouse_3d_layouts')
      .select('layout_data, updated_at')
      .eq('brand', brand)
      .maybeSingle();

    if (!error && data && data.layout_data) {
      const cloudLayout = data.layout_data as Warehouse3DLayout;
      if (cloudLayout && Array.isArray(cloudLayout.racks) && cloudLayout.racks.length > 0) {
        // Guardar copia local en localStorage para carga instantánea
        try {
          localStorage.setItem(`${STORAGE_KEY_PREFIX}${brand}`, JSON.stringify(cloudLayout));
        } catch {}
        return cloudLayout;
      }
    }
  } catch (err) {
    console.warn('No se pudo obtener layout 3D de Supabase, usando localStorage:', err);
  }

  return loadWarehouse3DLayout(brand);
}

/**
 * Guarda el layout 3D en localStorage y en Supabase (si está configurada la tabla).
 */
export async function saveWarehouse3DLayout(layout: Warehouse3DLayout): Promise<void> {
  try {
    layout.updatedAt = new Date().toISOString();
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${layout.brand}`, JSON.stringify(layout));

    // Intentar sincronizar con Supabase si existe una tabla de configuraciones o metadatos
    try {
      await supabase
        .from('warehouse_3d_layouts')
        .upsert({
          brand: layout.brand,
          name: layout.name,
          layout_data: layout,
          updated_at: layout.updatedAt,
        }, { onConflict: 'brand' });
    } catch {
      // Ignora silenciosamente si la tabla no ha sido migrada aún en Supabase
    }
  } catch (err) {
    console.error('Error guardando layout 3D:', err);
    throw err;
  }
}

/**
 * Hidrata los racks con los datos vivos de productos, ubicaciones y niveles de stock.
 */
export function hydrateRacksWithInventory(
  racks: Rack3D[],
  locations: Location[],
  products: Product[],
  stockLevels: StockLevel[],
  productLocations: ProductLocation[]
): Rack3D[] {
  // Mapeos rápidos
  const locationByName = new Map<string, Location>();
  locations.forEach(loc => locationByName.set(loc.name.toUpperCase().trim(), loc));
  const locationById = new Map<string, Location>();
  locations.forEach(loc => locationById.set(loc.id, loc));

  const productById = new Map<string, Product>();
  products.forEach(p => productById.set(p.id, p));

  // Mapa de product_locations: productId -> locationId
  const assignedLocByProduct = new Map<string, string>();
  productLocations.forEach(pl => assignedLocByProduct.set(pl.productId, pl.locationId));

  // Mapa inverso: locationId -> Set de productIds asignados
  const productsByLocationId = new Map<string, string[]>();
  productLocations.forEach(pl => {
    const list = productsByLocationId.get(pl.locationId) || [];
    list.push(pl.productId);
    productsByLocationId.set(pl.locationId, list);
  });

  // Stock total por locationId
  const stockByLocationId = new Map<string, number>();
  stockLevels.forEach(sl => {
    const prev = stockByLocationId.get(sl.locationId) || 0;
    stockByLocationId.set(sl.locationId, prev + sl.quantity);
  });

  return racks.map(rack => {
    const updatedSlots = { ...rack.slots };

    for (let l = 1; l <= rack.levels; l++) {
      for (let b = 1; b <= rack.bays; b++) {
        const key = `${l}-${b}`;
        const slot = updatedSlots[key] || {
          level: l,
          bay: b,
          code: `${rack.name.replace(/\s+/g, '-')}-N${l}-C${b}`,
          capacity: 150,
          stockUnits: 0,
        };

        // Buscar coincidencia en locations por código o nombre del slot
        let matchedLoc = slot.locationId ? locationById.get(slot.locationId) : undefined;
        if (!matchedLoc) {
          matchedLoc = locationByName.get(slot.code.toUpperCase().trim());
        }

        if (matchedLoc) {
          slot.locationId = matchedLoc.id;
          slot.stockUnits = stockByLocationId.get(matchedLoc.id) || 0;

          // Si hay productos asignados a esta ubicación en product_locations
          const assignedProds = productsByLocationId.get(matchedLoc.id);
          if (assignedProds && assignedProds.length > 0) {
            const firstProd = productById.get(assignedProds[0]);
            if (firstProd) {
              slot.productId = firstProd.id;
              slot.productName = firstProd.name;
              slot.productColor = firstProd.color;
              slot.productCategory = firstProd.category;
            }
          }
        }

        updatedSlots[key] = slot;
      }
    }

    return {
      ...rack,
      slots: updatedSlots,
    };
  });
}
