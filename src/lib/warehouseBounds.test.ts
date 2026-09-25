import { describe, it, expect } from 'vitest';
import {
  isPointInsideRoom,
  getRoomCutoutBoxes,
  clampRackPosition,
  getRackHalfExtents,
  isRackInsideRoom,
} from './warehouseBounds';
import { Rack3D } from '../types/warehouse3d';

describe('warehouseBounds', () => {
  const dummyRack: Rack3D = {
    id: 'rack-test',
    brand: 'TEST',
    name: 'RACK 1',
    aisle: 'Pasillo 1',
    position: [0, 0, 0],
    rotationY: 0,
    bays: 2,
    levels: 4,
    bayWidth: 0.65,
    depth: 0.55,
    levelHeight: 0.55,
    slots: {},
    updatedAt: new Date().toISOString(),
  };

  it('valida que puntos dentro del rectángulo sean verdaderos y fuera falsos', () => {
    expect(isPointInsideRoom(0, 0, 20, 20, 'RECTANGULAR')).toBe(true);
    expect(isPointInsideRoom(9, 9, 20, 20, 'RECTANGULAR')).toBe(true);
    expect(isPointInsideRoom(15, 0, 20, 20, 'RECTANGULAR')).toBe(false);
    expect(isPointInsideRoom(0, -15, 20, 20, 'RECTANGULAR')).toBe(false);
  });

  it('detecta el recorte prohibido del plano en L en orientación BOTTOM_LEFT', () => {
    // Almacén 20x20, ala 10x10, recodo BOTTOM_LEFT (recorte en Noreste: X > 0, Z < 0)
    const cutouts = getRoomCutoutBoxes(20, 20, 'L_SHAPE', {
      mainWidth: 20,
      mainLength: 20,
      wingWidth: 10,
      wingLength: 10,
      orientation: 'BOTTOM_LEFT',
    });

    expect(cutouts.length).toBe(1);
    expect(cutouts[0].minX).toBe(0);
    expect(cutouts[0].maxX).toBe(10);
    expect(cutouts[0].minZ).toBe(-10);
    expect(cutouts[0].maxZ).toBe(0);

    // Punto en el vacío prohibido (Noreste)
    expect(isPointInsideRoom(5, -5, 20, 20, 'L_SHAPE', {
      mainWidth: 20,
      mainLength: 20,
      wingWidth: 10,
      wingLength: 10,
      orientation: 'BOTTOM_LEFT',
    })).toBe(false);

    // Punto en el piso válido (Suroeste)
    expect(isPointInsideRoom(-5, 5, 20, 20, 'L_SHAPE', {
      mainWidth: 20,
      mainLength: 20,
      wingWidth: 10,
      wingLength: 10,
      orientation: 'BOTTOM_LEFT',
    })).toBe(true);
  });

  it('clampRackPosition no permite colocar un estante en el vacío de la L', () => {
    const config = {
      mainWidth: 20,
      mainLength: 20,
      wingWidth: 10,
      wingLength: 10,
      orientation: 'BOTTOM_LEFT' as const,
    };

    // Intentar ubicar el estante en el recorte (X=5, Z=-5)
    const [clampedX, clampedZ] = clampRackPosition(5, -5, dummyRack, 20, 20, 'L_SHAPE', config);

    // La posición ajustada debe estar 100% dentro del piso legal
    expect(isRackInsideRoom(clampedX, clampedZ, dummyRack, 20, 20, 'L_SHAPE', config)).toBe(true);
  });

  it('valida contención y recortes de plano dibujado por cuadros (CUSTOM_GRID)', () => {
    // Cuadrícula 4 cols x 4 rows con celda 2m (8m x 8m total)
    // Esquina superior derecha (row 0, col 3) vacía (0)
    // Centro (row 1-2, col 1-2) activo (1)
    const customConfig = {
      customGrid: {
        cellSize: 2,
        cols: 4,
        rows: 4,
        cells: [
          [1, 1, 1, 0], // row 0: (Z = -4 a -2)
          [1, 1, 1, 1], // row 1: (Z = -2 a 0)
          [1, 1, 1, 1], // row 2: (Z = 0 a 2)
          [0, 1, 1, 1], // row 3: (Z = 2 a 4), col 0 vacía
        ],
      },
    };

    // Punto en celda activa (0, 0) -> row 2, col 2
    expect(isPointInsideRoom(0, 0, 8, 8, 'CUSTOM_GRID', customConfig)).toBe(true);

    // Punto en celda vacía row 0, col 3: X in [2, 4], Z in [-4, -2] -> (3, -3)
    expect(isPointInsideRoom(3, -3, 8, 8, 'CUSTOM_GRID', customConfig)).toBe(false);

    // Punto en celda vacía row 3, col 0: X in [-4, -2], Z in [2, 4] -> (-3, 3)
    expect(isPointInsideRoom(-3, 3, 8, 8, 'CUSTOM_GRID', customConfig)).toBe(false);

    // Punto fuera de toda la cuadrícula (X=10, Z=0)
    expect(isPointInsideRoom(10, 0, 8, 8, 'CUSTOM_GRID', customConfig)).toBe(false);

    // Recortes generados deben incluir las 2 celdas vacías
    const cutouts = getRoomCutoutBoxes(8, 8, 'CUSTOM_GRID', customConfig);
    expect(cutouts.length).toBe(2);

    // Clamp debe mover un estante desde la celda vacía (3, -3) a una celda activa válida
    const [cx, cz] = clampRackPosition(3, -3, dummyRack, 8, 8, 'CUSTOM_GRID', customConfig);
    expect(isRackInsideRoom(cx, cz, dummyRack, 8, 8, 'CUSTOM_GRID', customConfig)).toBe(true);
  });
});
