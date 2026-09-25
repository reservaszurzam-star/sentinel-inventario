import { describe, it, expect } from 'vitest';
import {
  getRoomPolygonVertices,
  getEntranceDoorInfo,
  buildWarehouseArchitecture,
} from './architecturalBuilder';

describe('architecturalBuilder', () => {
  it('generates 4 vertices for rectangular room', () => {
    const vertices = getRoomPolygonVertices(20, 30, 'RECTANGULAR');
    expect(vertices).toHaveLength(4);
    expect(vertices[0]).toEqual({ x: -10, z: -15 });
    expect(vertices[1]).toEqual({ x: -10, z: 15 });
    expect(vertices[2]).toEqual({ x: 10, z: 15 });
    expect(vertices[3]).toEqual({ x: 10, z: -15 });
  });

  it('generates 6 vertices for L_SHAPE with correct corners for BOTTOM_LEFT', () => {
    const vertices = getRoomPolygonVertices(24, 20, 'L_SHAPE', {
      mainWidth: 24,
      mainLength: 20,
      wingWidth: 10,
      wingLength: 10,
      orientation: 'BOTTOM_LEFT',
    });
    expect(vertices).toHaveLength(6);
    // Outer bounds: X in [-12, 12], Z in [-10, 10]
    expect(vertices[0]).toEqual({ x: -12, z: -10 });
    expect(vertices[1]).toEqual({ x: -12, z: 10 });
    expect(vertices[2]).toEqual({ x: 12, z: 10 });
  });

  it('calculates entrance door info on the accessible south facade', () => {
    const doorRect = getEntranceDoorInfo(20, 30, 'RECTANGULAR');
    expect(doorRect.center.z).toBe(15);
    expect(doorRect.width).toBeGreaterThan(3);

    const doorL = getEntranceDoorInfo(24, 20, 'L_SHAPE', {
      mainWidth: 24,
      mainLength: 20,
      wingWidth: 10,
      wingLength: 10,
      orientation: 'BOTTOM_LEFT',
    });
    expect(doorL.center.z).toBe(10);
    // In BOTTOM_LEFT, door is on the active left wing: x0 + wingW / 2 = -12 + 5 = -7
    expect(doorL.center.x).toBe(-7);
  });

  it('calculates entrance door info correctly for CUSTOM_GRID', () => {
    const customGrid = {
      cellSize: 2,
      cols: 4,
      rows: 4,
      cells: [
        [0, 1, 1, 0],
        [0, 1, 1, 0],
        [1, 1, 1, 1],
        [1, 1, 1, 1],
      ],
    };
    const door = getEntranceDoorInfo(8, 8, 'CUSTOM_GRID', { customGrid });
    expect(door).toBeDefined();
    // Southmost wall at row 3 (Z = 4)
    expect(door.center.z).toBe(4);
    expect(door.width).toBeGreaterThanOrEqual(1.6);
  });

  it('builds Three.js architectural group for CUSTOM_GRID without errors', () => {
    const customGrid = {
      cellSize: 2,
      cols: 4,
      rows: 4,
      cells: [
        [0, 1, 1, 0],
        [1, 1, 1, 1],
      ],
    };
    const archGroup = buildWarehouseArchitecture(8, 4, 'CUSTOM_GRID', { customGrid }, 4.8, 'SOLID');
    expect(archGroup).toBeDefined();
    expect(archGroup.name).toBe('WarehouseArchitecture');
  });

  it('builds Three.js architectural group without errors', () => {
    const archGroup = buildWarehouseArchitecture(20, 30, 'RECTANGULAR', undefined, 4.8, 'SOLID');
    expect(archGroup).toBeDefined();
    expect(archGroup.name).toBe('WarehouseArchitecture');
    expect(archGroup.children.length).toBeGreaterThan(0);
  });
});
