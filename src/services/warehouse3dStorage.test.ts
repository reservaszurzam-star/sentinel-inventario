import { describe, it, expect } from 'vitest';
import { generateDefaultLayout, hydrateRacksWithInventory } from './warehouse3dStorage';
import { Location, Product, StockLevel, ProductLocation } from '../types';

describe('warehouse3dStorage', () => {
  it('generates a valid default 3D layout for a brand', () => {
    const layout = generateDefaultLayout('OVERSHARK');
    expect(layout.brand).toBe('OVERSHARK');
    expect(layout.racks.length).toBeGreaterThanOrEqual(4);

    const firstRack = layout.racks[0];
    expect(firstRack.bays).toBe(2);
    expect(firstRack.levels).toBe(4);
    expect(firstRack.position).toHaveLength(3);

    const slotKey = '1-1';
    expect(firstRack.slots[slotKey]).toBeDefined();
    expect(firstRack.slots[slotKey].code).toBe('ESTANTE-BLANCO-A-01-N1-C1');
    expect(firstRack.slots[slotKey].capacity).toBe(150);
  });

  it('hydrates racks with real inventory and designated product locations', () => {
    const layout = generateDefaultLayout('BRAVOS');
    const mockLocations: Location[] = [
      { id: 'loc-1', name: 'ESTANTE-BLANCO-A-01-N1-C1', type: 'BIN' },
    ];
    const mockProducts: Product[] = [
      { id: 'prod-100', code: 'BRV-0100', name: 'HOODIE URBAN', color: 'Negro', category: 'Poleras' },
    ];
    const mockProductLocations: ProductLocation[] = [
      { id: 'pl-1', brand: 'BRAVOS', productId: 'prod-100', locationId: 'loc-1' },
    ];
    const mockStockLevels: StockLevel[] = [
      { id: 'sl-1', productId: 'prod-100', locationId: 'loc-1', quantity: 42 },
    ];

    const hydrated = hydrateRacksWithInventory(
      layout.racks,
      mockLocations,
      mockProducts,
      mockStockLevels,
      mockProductLocations
    );

    const slot = hydrated[0].slots['1-1'];
    expect(slot.locationId).toBe('loc-1');
    expect(slot.stockUnits).toBe(42);
    expect(slot.productId).toBe('prod-100');
    expect(slot.productName).toBe('HOODIE URBAN');
    expect(slot.productColor).toBe('Negro');
  });
});
