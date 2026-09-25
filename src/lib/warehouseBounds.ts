import { Rack3D, RoomShape, RoomConfig } from '../types/warehouse3d';

export interface BoundingBox2D {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * Retorna la caja límite exterior del almacén.
 */
export function getRoomBoundingBox(width: number, length: number): BoundingBox2D {
  return {
    minX: -width / 2,
    maxX: width / 2,
    minZ: -length / 2,
    maxZ: length / 2,
  };
}

/**
 * Retorna las zonas de recorte prohibidas (vacíos fuera de las líneas amarillas).
 */
export function getRoomCutoutBoxes(
  width: number,
  length: number,
  roomShape: RoomShape | string = 'RECTANGULAR',
  roomConfig?: RoomConfig
): BoundingBox2D[] {
  if (roomShape === 'L_SHAPE') {
    const wingW = Math.min(Math.max(roomConfig?.wingWidth || Math.round(width * 0.45), 4), width - 3);
    const wingL = Math.min(Math.max(roomConfig?.wingLength || Math.round(length * 0.45), 4), length - 3);
    const orientation = roomConfig?.orientation || 'BOTTOM_LEFT';

    switch (orientation) {
      case 'BOTTOM_RIGHT':
        // Recorte en la esquina Noroeste (Arriba-Izquierda)
        return [
          {
            minX: -width / 2,
            maxX: width / 2 - wingW,
            minZ: -length / 2,
            maxZ: length / 2 - wingL,
          },
        ];
      case 'TOP_LEFT':
        // Recorte en la esquina Sureste (Abajo-Derecha)
        return [
          {
            minX: -width / 2 + wingW,
            maxX: width / 2,
            minZ: -length / 2 + wingL,
            maxZ: length / 2,
          },
        ];
      case 'TOP_RIGHT':
        // Recorte en la esquina Suroeste (Abajo-Izquierda)
        return [
          {
            minX: -width / 2,
            maxX: width / 2 - wingW,
            minZ: -length / 2 + wingL,
            maxZ: length / 2,
          },
        ];
      case 'BOTTOM_LEFT':
      default:
        // Recorte en la esquina Noreste (Arriba-Derecha)
        return [
          {
            minX: -width / 2 + wingW,
            maxX: width / 2,
            minZ: -length / 2,
            maxZ: length / 2 - wingL,
          },
        ];
    }
  }

  if (roomShape === 'U_SHAPE') {
    const spineL = length * 0.4;
    const wingW = width * 0.35;
    // Patio central abierto en el Sur
    return [
      {
        minX: -width / 2 + wingW,
        maxX: width / 2 - wingW,
        minZ: -length / 2 + spineL,
        maxZ: length / 2,
      },
    ];
  }

  if (roomShape === 'CUSTOM_GRID' && roomConfig?.customGrid) {
    const { cellSize, cols, rows, cells } = roomConfig.customGrid;
    const gridW = cols * cellSize;
    const gridL = rows * cellSize;
    const startX = -gridW / 2;
    const startZ = -gridL / 2;
    const cutouts: BoundingBox2D[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!cells[r] || cells[r][c] === 0) {
          cutouts.push({
            minX: startX + c * cellSize,
            maxX: startX + (c + 1) * cellSize,
            minZ: startZ + r * cellSize,
            maxZ: startZ + (r + 1) * cellSize,
          });
        }
      }
    }
    return cutouts;
  }

  return [];
}

/**
 * Valida si un punto (x, z) se encuentra estrictamente dentro del piso del almacén.
 */
export function isPointInsideRoom(
  x: number,
  z: number,
  width: number,
  length: number,
  roomShape: RoomShape | string = 'RECTANGULAR',
  roomConfig?: RoomConfig,
  margin = 0
): boolean {
  if (roomShape === 'CUSTOM_GRID' && roomConfig?.customGrid) {
    const { cellSize, cols, rows, cells } = roomConfig.customGrid;
    const gridW = cols * cellSize;
    const gridL = rows * cellSize;
    const minX = -gridW / 2;
    const minZ = -gridL / 2;

    const checkOffsets = margin > 0
      ? [
          [0, 0],
          [-margin, 0],
          [margin, 0],
          [0, -margin],
          [0, margin],
          [-margin * 0.707, -margin * 0.707],
          [margin * 0.707, -margin * 0.707],
          [-margin * 0.707, margin * 0.707],
          [margin * 0.707, margin * 0.707],
        ]
      : [[0, 0]];

    for (const [ox, oz] of checkOffsets) {
      const px = x + ox;
      const pz = z + oz;
      const col = Math.floor((px - minX) / cellSize);
      const row = Math.floor((pz - minZ) / cellSize);
      if (col < 0 || col >= cols || row < 0 || row >= rows) return false;
      if (!cells[row] || cells[row][col] !== 1) return false;
    }
    return true;
  }

  const outer = getRoomBoundingBox(width, length);

  // Debe estar dentro del rectángulo exterior
  if (
    x < outer.minX + margin ||
    x > outer.maxX - margin ||
    z < outer.minZ + margin ||
    z > outer.maxZ - margin
  ) {
    return false;
  }

  // NO debe estar dentro de ningún recorte prohibido (vacío en L o U)
  const cutouts = getRoomCutoutBoxes(width, length, roomShape, roomConfig);
  for (const cut of cutouts) {
    if (
      x > cut.minX - margin &&
      x < cut.maxX + margin &&
      z > cut.minZ - margin &&
      z < cut.maxZ + margin
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Calcula la semi-huella (half-extents) en X y Z de un estante según su orientación y tipo.
 */
export function getRackHalfExtents(rack: Rack3D): { hx: number; hz: number } {
  const bayW = rack.bayWidth || 0.65;
  const depth = rack.depth || 0.55;
  const boardThick = rack.boardThickness || 0.03;

  if (rack.furnitureType === 'CORNER_L') {
    const baysX = rack.bays || 2;
    const baysZ = rack.secondaryBays || 2;
    const totalLenX = baysX * bayW + depth;
    const totalLenZ = baysZ * bayW + depth;
    return { hx: totalLenX / 2, hz: totalLenZ / 2 };
  }

  const bays = rack.bays || 2;
  const totalW = bays * bayW + (bays + 1) * boardThick;
  const rot = Math.abs(rack.rotationY || 0) % Math.PI;
  const isRotated90 = rot > Math.PI / 4 && rot < (3 * Math.PI) / 4;

  const width = isRotated90 ? depth : totalW;
  const length = isRotated90 ? totalW : depth;

  return { hx: width / 2, hz: length / 2 };
}

/**
 * Valida si un estante completo (sus 4 esquinas) se encuentra 100% dentro de las líneas amarillas.
 */
export function isRackInsideRoom(
  x: number,
  z: number,
  rack: Rack3D,
  width: number,
  length: number,
  roomShape: RoomShape | string = 'RECTANGULAR',
  roomConfig?: RoomConfig
): boolean {
  const { hx, hz } = getRackHalfExtents(rack);

  // Verificar las 4 esquinas del mueble
  const corners = [
    { x: x - hx, z: z - hz },
    { x: x + hx, z: z - hz },
    { x: x - hx, z: z + hz },
    { x: x + hx, z: z + hz },
    { x, z }, // centro
  ];

  return corners.every(c =>
    isPointInsideRoom(c.x, c.z, width, length, roomShape, roomConfig, 0.05)
  );
}

/**
 * Ajusta magnéticamente la posición de un estante para confinarlo estrictamente dentro de las líneas amarillas.
 * Si el usuario intenta moverlo fuera o al vacío, el estante se detiene en el borde permitido.
 */
export function clampRackPosition(
  targetX: number,
  targetZ: number,
  rack: Rack3D,
  width: number,
  length: number,
  roomShape: RoomShape | string = 'RECTANGULAR',
  roomConfig?: RoomConfig
): [number, number] {
  const { hx, hz } = getRackHalfExtents(rack);
  const outer = getRoomBoundingBox(width, length);

  // 1. Limitar al rectángulo general
  let clampedX = Math.max(outer.minX + hx + 0.1, Math.min(outer.maxX - hx - 0.1, targetX));
  let clampedZ = Math.max(outer.minZ + hz + 0.1, Math.min(outer.maxZ - hz - 0.1, targetZ));

  // 2. Si es forma en L o U, evitar penetrar en el recorte prohibido
  const cutouts = getRoomCutoutBoxes(width, length, roomShape, roomConfig);
  for (const cut of cutouts) {
    // Si la caja del estante se solapa con el recorte prohibido:
    const rackMinX = clampedX - hx;
    const rackMaxX = clampedX + hx;
    const rackMinZ = clampedZ - hz;
    const rackMaxZ = clampedZ + hz;

    const overlapsX = rackMaxX > cut.minX && rackMinX < cut.maxX;
    const overlapsZ = rackMaxZ > cut.minZ && rackMinZ < cut.maxZ;

    if (overlapsX && overlapsZ) {
      // Determinar cuál eje está más cerca del borde para empujar hacia el lado legal
      const pushLeft = Math.abs(rackMaxX - cut.minX);
      const pushRight = Math.abs(rackMinX - cut.maxX);
      const pushTop = Math.abs(rackMaxZ - cut.minZ);
      const pushBottom = Math.abs(rackMinZ - cut.maxZ);

      const minPush = Math.min(pushLeft, pushRight, pushTop, pushBottom);

      if (minPush === pushLeft && cut.minX - hx - 0.1 >= outer.minX) {
        clampedX = cut.minX - hx - 0.1;
      } else if (minPush === pushRight && cut.maxX + hx + 0.1 <= outer.maxX) {
        clampedX = cut.maxX + hx + 0.1;
      } else if (minPush === pushTop && cut.minZ - hz - 0.1 >= outer.minZ) {
        clampedZ = cut.minZ - hz - 0.1;
      } else if (minPush === pushBottom && cut.maxZ + hz + 0.1 <= outer.maxZ) {
        clampedZ = cut.maxZ + hz + 0.1;
      } else {
        // Fallback: empujar al centro de la losa principal más cercana
        if (outer.minX + hx <= cut.minX) {
          clampedX = cut.minX - hx - 0.1;
        } else {
          clampedZ = cut.maxZ + hz + 0.1;
        }
      }
    }
  }

  // Snap a cuadrícula métrica de 0.5m
  let snappedX = Math.round(clampedX * 2) / 2;
  let snappedZ = Math.round(clampedZ * 2) / 2;

  if (roomShape === 'CUSTOM_GRID' && roomConfig?.customGrid) {
    if (!isRackInsideRoom(snappedX, snappedZ, rack, width, length, roomShape, roomConfig)) {
      const { cellSize, cols, rows, cells } = roomConfig.customGrid;
      const gridW = cols * cellSize;
      const gridL = rows * cellSize;
      const startX = -gridW / 2;
      const startZ = -gridL / 2;
      let bestDist = Infinity;
      let bestPos: [number, number] = [snappedX, snappedZ];

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (cells[r] && cells[r][c] === 1) {
            const cx = startX + (c + 0.5) * cellSize;
            const cz = startZ + (r + 0.5) * cellSize;
            if (isRackInsideRoom(cx, cz, rack, width, length, roomShape, roomConfig)) {
              const dist = Math.hypot(cx - targetX, cz - targetZ);
              if (dist < bestDist) {
                bestDist = dist;
                bestPos = [Math.round(cx * 2) / 2, Math.round(cz * 2) / 2];
              }
            }
          }
        }
      }
      return bestPos;
    }
  }

  return [snappedX, snappedZ];
}

/**
 * Encuentra una posición disponible válida dentro de la sala para un nuevo estante.
 */
export function findAvailableRoomPosition(
  rack: Rack3D,
  width: number,
  length: number,
  roomShape: RoomShape | string = 'RECTANGULAR',
  roomConfig?: RoomConfig,
  existingRacks: Rack3D[] = []
): [number, number, number] {
  const { hx, hz } = getRackHalfExtents(rack);
  const outer = getRoomBoundingBox(width, length);

  // Intentar una cuadrícula regular de búsqueda dentro del local
  const stepX = Math.max(3.5, hx * 2 + 1.2);
  const stepZ = Math.max(3.5, hz * 2 + 1.2);

  for (let z = outer.minZ + hz + 1; z <= outer.maxZ - hz - 1; z += stepZ) {
    for (let x = outer.minX + hx + 1; x <= outer.maxX - hx - 1; x += stepX) {
      if (isRackInsideRoom(x, z, rack, width, length, roomShape, roomConfig)) {
        // Verificar que no colisione directamente con otro rack existente (margen 1.5m)
        const collides = existingRacks.some(r => {
          const dx = Math.abs(r.position[0] - x);
          const dz = Math.abs(r.position[2] - z);
          return dx < 2.0 && dz < 2.0;
        });

        if (!collides) {
          return [Math.round(x * 2) / 2, 0, Math.round(z * 2) / 2];
        }
      }
    }
  }

  // Si no encuentra hueco libre ideal, hacer clamp desde una posición segura
  const safeBase = clampRackPosition(0, 0, rack, width, length, roomShape, roomConfig);
  return [safeBase[0], 0, safeBase[1]];
}
