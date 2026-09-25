import * as THREE from 'three';
import { RoomShape, RoomConfig, CustomGridConfig } from '../../types/warehouse3d';
import { isPointInsideRoom } from '../../lib/warehouseBounds';

export interface Point2D {
  x: number;
  z: number;
}

export interface EntranceDoorInfo {
  center: Point2D;
  wallNormal: Point2D; // apunta hacia el exterior del almacén
  width: number;
  height: number;
  edgeIndex: number;
}

export type RoofDisplayMode = 'SOLID' | 'TRANSLUCENT' | 'HIDDEN';

export interface WallSegment {
  p1: Point2D;
  p2: Point2D;
  dir?: 'N' | 'S' | 'W' | 'E';
  isEntranceWall?: boolean;
}

/**
 * Extrae los segmentos de muro exterior y ubica el portón para un plano dibujado por cuadros (CUSTOM_GRID).
 */
export function getCustomGridWallSegments(
  customGrid: CustomGridConfig
): { segments: WallSegment[]; doorInfo: EntranceDoorInfo } {
  const { cellSize, cols, rows, cells } = customGrid;
  const gridW = cols * cellSize;
  const gridL = rows * cellSize;
  const minX = -gridW / 2;
  const minZ = -gridL / 2;

  const rawSegments: { p1: Point2D; p2: Point2D; dir: 'N' | 'S' | 'W' | 'E'; row: number; col: number }[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (cells[r] && cells[r][c] === 1) {
        const x1 = minX + c * cellSize;
        const x2 = minX + (c + 1) * cellSize;
        const z1 = minZ + r * cellSize;
        const z2 = minZ + (r + 1) * cellSize;

        // North edge (z = z1)
        if (r === 0 || !cells[r - 1] || cells[r - 1][c] !== 1) {
          rawSegments.push({ p1: { x: x1, z: z1 }, p2: { x: x2, z: z1 }, dir: 'N', row: r, col: c });
        }
        // South edge (z = z2)
        if (r === rows - 1 || !cells[r + 1] || cells[r + 1][c] !== 1) {
          rawSegments.push({ p1: { x: x1, z: z2 }, p2: { x: x2, z: z2 }, dir: 'S', row: r, col: c });
        }
        // West edge (x = x1)
        if (c === 0 || cells[r][c - 1] !== 1) {
          rawSegments.push({ p1: { x: x1, z: z1 }, p2: { x: x1, z: z2 }, dir: 'W', row: r, col: c });
        }
        // East edge (x = x2)
        if (c === cols - 1 || cells[r][c + 1] !== 1) {
          rawSegments.push({ p1: { x: x2, z: z1 }, p2: { x: x2, z: z2 }, dir: 'E', row: r, col: c });
        }
      }
    }
  }

  const merged: WallSegment[] = [];

  // Group horizontal segments (N and S) by row and merge collinear adjacent segments
  for (const dir of ['N', 'S'] as const) {
    for (let r = 0; r < rows; r++) {
      const segs = rawSegments
        .filter(s => s.dir === dir && s.row === r)
        .sort((a, b) => a.p1.x - b.p1.x);

      let current: { p1: Point2D; p2: Point2D; dir: 'N' | 'S' | 'W' | 'E' } | null = null;
      for (const seg of segs) {
        if (!current) {
          current = { p1: { ...seg.p1 }, p2: { ...seg.p2 }, dir };
        } else if (Math.abs(current.p2.x - seg.p1.x) < 0.001) {
          current.p2.x = seg.p2.x;
        } else {
          merged.push(current);
          current = { p1: { ...seg.p1 }, p2: { ...seg.p2 }, dir };
        }
      }
      if (current) merged.push(current);
    }
  }

  // Group vertical segments (W and E) by col and merge collinear adjacent segments
  for (const dir of ['W', 'E'] as const) {
    for (let c = 0; c < cols; c++) {
      const segs = rawSegments
        .filter(s => s.dir === dir && s.col === c)
        .sort((a, b) => a.p1.z - b.p1.z);

      let current: { p1: Point2D; p2: Point2D; dir: 'N' | 'S' | 'W' | 'E' } | null = null;
      for (const seg of segs) {
        if (!current) {
          current = { p1: { ...seg.p1 }, p2: { ...seg.p2 }, dir };
        } else if (Math.abs(current.p2.z - seg.p1.z) < 0.001) {
          current.p2.z = seg.p2.z;
        } else {
          merged.push(current);
          current = { p1: { ...seg.p1 }, p2: { ...seg.p2 }, dir };
        }
      }
      if (current) merged.push(current);
    }
  }

  // Pick entrance door wall on the southernmost exterior wall
  const southWalls = merged.filter(s => s.dir === 'S');

  let doorWidth = 3.6;
  let doorCenter = { x: 0, z: gridL / 2 };

  if (southWalls.length > 0) {
    // Preferir muros con longitud cómoda (>= 2.4m) ubicados al sur
    const wideWalls = southWalls.filter(s => Math.abs(s.p2.x - s.p1.x) >= 2.4);
    const candidateList = wideWalls.length > 0 ? wideWalls : southWalls;

    candidateList.sort((a, b) => {
      const diffZ = b.p1.z - a.p1.z;
      if (Math.abs(diffZ) > 0.01) return diffZ;
      return Math.abs(b.p2.x - b.p1.x) - Math.abs(a.p2.x - a.p1.x);
    });

    const best = candidateList[0];
    const segLen = Math.abs(best.p2.x - best.p1.x);

    // Ajustar ancho del portón para que quepan jambas sólidas de muro a cada lado
    if (segLen >= 4.0) {
      doorWidth = 3.6;
    } else if (segLen >= 2.4) {
      doorWidth = Math.min(3.0, segLen - 0.6);
    } else {
      doorWidth = Math.max(0.8, segLen * 0.7);
    }

    doorCenter = {
      x: (best.p1.x + best.p2.x) / 2,
      z: best.p1.z,
    };
    best.isEntranceWall = true;
  }

  const doorInfo: EntranceDoorInfo = {
    center: doorCenter,
    wallNormal: { x: 0, z: 1 },
    width: doorWidth,
    height: 3.2,
    edgeIndex: 0,
  };

  return { segments: merged, doorInfo };
}

/**
 * Retorna la lista ordenada de vértices 2D (x, z) que forman el perímetro cerrado del almacén.
 */
export function getRoomPolygonVertices(
  width: number,
  length: number,
  roomShape: RoomShape | string = 'RECTANGULAR',
  roomConfig?: RoomConfig
): Point2D[] {
  const x0 = -width / 2;
  const x1 = width / 2;
  const z0 = -length / 2;
  const z1 = length / 2;

  if (roomShape === 'L_SHAPE') {
    const wingW = Math.min(Math.max(roomConfig?.wingWidth || Math.round(width * 0.45), 4), width - 3);
    const wingL = Math.min(Math.max(roomConfig?.wingLength || Math.round(length * 0.45), 4), length - 3);
    const orientation = roomConfig?.orientation || 'BOTTOM_LEFT';

    switch (orientation) {
      case 'BOTTOM_RIGHT':
        return [
          { x: x0, z: z1 - wingL },
          { x: x0, z: z1 },
          { x: x1, z: z1 },
          { x: x1, z: z0 },
          { x: x1 - wingW, z: z0 },
          { x: x1 - wingW, z: z1 - wingL },
        ];
      case 'TOP_LEFT':
        return [
          { x: x0, z: z0 },
          { x: x0, z: z1 },
          { x: x0 + wingW, z: z1 },
          { x: x0 + wingW, z: z0 + wingL },
          { x: x1, z: z0 + wingL },
          { x: x1, z: z0 },
        ];
      case 'TOP_RIGHT':
        return [
          { x: x0, z: z0 },
          { x: x0, z: z0 + wingL },
          { x: x1 - wingW, z: z0 + wingL },
          { x: x1 - wingW, z: z1 },
          { x: x1, z: z1 },
          { x: x1, z: z0 },
        ];
      case 'BOTTOM_LEFT':
      default:
        return [
          { x: x0, z: z0 },
          { x: x0, z: z1 },
          { x: x1, z: z1 },
          { x: x1, z: z1 - wingL },
          { x: x0 + wingW, z: z1 - wingL },
          { x: x0 + wingW, z: z0 },
        ];
    }
  }

  if (roomShape === 'U_SHAPE') {
    const spineL = length * 0.4;
    const wingW = width * 0.35;
    return [
      { x: x0, z: z0 },
      { x: x0, z: z1 },
      { x: x0 + wingW, z: z1 },
      { x: x0 + wingW, z: z0 + spineL },
      { x: x1 - wingW, z: z0 + spineL },
      { x: x1 - wingW, z: z1 },
      { x: x1, z: z1 },
      { x: x1, z: z0 },
    ];
  }

  // RECTANGULAR
  return [
    { x: x0, z: z0 },
    { x: x0, z: z1 },
    { x: x1, z: z1 },
    { x: x1, z: z0 },
  ];
}

/**
 * Calcula la ubicación y dimensiones del portón principal de acceso.
 */
export function getEntranceDoorInfo(
  width: number,
  length: number,
  roomShape: RoomShape | string = 'RECTANGULAR',
  roomConfig?: RoomConfig
): EntranceDoorInfo {
  if (roomShape === 'CUSTOM_GRID' && roomConfig?.customGrid) {
    return getCustomGridWallSegments(roomConfig.customGrid).doorInfo;
  }

  const x0 = -width / 2;
  const x1 = width / 2;
  const z1 = length / 2;
  const wingW = Math.min(Math.max(roomConfig?.wingWidth || Math.round(width * 0.45), 4), width - 3);

  let doorCenterX = 0;
  let doorCenterZ = z1;
  let doorW = 3.6;

  if (roomShape === 'L_SHAPE') {
    const orientation = roomConfig?.orientation || 'BOTTOM_LEFT';
    if (orientation === 'BOTTOM_LEFT' || orientation === 'TOP_LEFT') {
      doorCenterX = x0 + wingW / 2;
    } else {
      doorCenterX = x1 - wingW / 2;
    }
    if (orientation === 'TOP_LEFT' || orientation === 'TOP_RIGHT') {
      doorW = Math.min(3.6, Math.max(1.6, wingW - 0.6));
    }
  } else if (roomShape === 'U_SHAPE') {
    doorCenterX = x0 + (width * 0.35) / 2;
    doorW = Math.min(3.6, Math.max(1.6, width * 0.35 - 0.6));
  }

  return {
    center: { x: doorCenterX, z: doorCenterZ },
    wallNormal: { x: 0, z: 1 }, // apunta hacia el Sur exterior
    width: doorW,
    height: 3.2,
    edgeIndex: 1, // Muro frontal sur
  };
}

/**
 * Crea un letrero 3D iluminado sobre el portón de entrada.
 */
function createEntranceSignMesh(text: string, width: number, height: number): THREE.Group {
  const group = new THREE.Group();

  // Panel base de soporte
  const frameGeo = new THREE.BoxGeometry(width + 0.2, height + 0.1, 0.08);
  const frameMat = new THREE.MeshStandardMaterial({
    color: '#0f172a',
    roughness: 0.4,
    metalness: 0.8,
  });
  const frameMesh = new THREE.Mesh(frameGeo, frameMat);
  group.add(frameMesh);

  // Lona o letrero retroiluminado
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Fondo oscuro con degradado tecnológico
    const grad = ctx.createLinearGradient(0, 0, 1024, 0);
    grad.addColorStop(0, '#0284c7');
    grad.addColorStop(0.5, '#0369a1');
    grad.addColorStop(1, '#0284c7');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 256);

    // Borde brillante
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 14;
    ctx.strokeRect(10, 10, 1004, 236);

    // Texto principal
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 68px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.toUpperCase(), 512, 100);

    // Subtítulo
    ctx.fillStyle = '#bae6fd';
    ctx.font = 'bold 36px monospace';
    ctx.fillText('ACCESO PRINCIPAL • ZONA DE CARGA Y DESCARGA', 512, 180);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const signGeo = new THREE.PlaneGeometry(width, height);
  const signMat = new THREE.MeshBasicMaterial({ map: texture });
  const signMesh = new THREE.Mesh(signGeo, signMat);
  signMesh.position.z = 0.05;
  group.add(signMesh);

  return group;
}

/**
 * Construye el conjunto arquitectónico completo:
 * Muros perimetrales, zócalos, portón de acceso, techo, vigas reticuladas y lámparas LED.
 */
export function buildWarehouseArchitecture(
  width: number,
  length: number,
  roomShape: RoomShape | string = 'RECTANGULAR',
  roomConfig?: RoomConfig,
  wallHeight = 4.8,
  roofMode: RoofDisplayMode | string = 'SOLID'
): THREE.Group {
  const root = new THREE.Group();
  root.name = 'WarehouseArchitecture';

  const vertices = getRoomPolygonVertices(width, length, roomShape, roomConfig);
  const doorInfo = getEntranceDoorInfo(width, length, roomShape, roomConfig);
  const wallThickness = 0.22;
  const baseboardHeight = 0.25;

  // Materiales de alta calidad arquitectónica
  const wallMat = new THREE.MeshStandardMaterial({
    color: '#e2e8f0', // Blanco hueso industrial limpio
    roughness: 0.85,
    metalness: 0.08,
  });

  const baseboardMat = new THREE.MeshStandardMaterial({
    color: '#334155', // Zócalo gris oscuro industrial
    roughness: 0.6,
  });

  const steelTrussMat = new THREE.MeshStandardMaterial({
    color: '#1e293b', // Vigas metálicas oscuras
    roughness: 0.4,
    metalness: 0.8,
  });

  // -----------------------------------------------------------------------------------
  // 1. MUROS PERIMETRALES (Siguiendo exactamente los vértices del polígono o cuadrícula)
  // -----------------------------------------------------------------------------------
  const wallsGroup = new THREE.Group();
  wallsGroup.name = 'Walls';

  interface BuiltWallSegment {
    p1: Point2D;
    p2: Point2D;
    isEntranceWall: boolean;
  }

  let wallSegmentsToBuild: BuiltWallSegment[] = [];
  let effectiveDoorInfo = doorInfo;

  if (roomShape === 'CUSTOM_GRID' && roomConfig?.customGrid) {
    const gridRes = getCustomGridWallSegments(roomConfig.customGrid);
    effectiveDoorInfo = gridRes.doorInfo;
    wallSegmentsToBuild = gridRes.segments.map(s => ({
      p1: s.p1,
      p2: s.p2,
      isEntranceWall: !!s.isEntranceWall,
    }));
  } else {
    const n = vertices.length;
    for (let i = 0; i < n; i++) {
      const p1 = vertices[i];
      const p2 = vertices[(i + 1) % n];
      const isEntranceWall =
        Math.abs(p1.z - length / 2) < 0.1 &&
        Math.abs(p2.z - length / 2) < 0.1 &&
        doorInfo.center.x >= Math.min(p1.x, p2.x) &&
        doorInfo.center.x <= Math.max(p1.x, p2.x);

      wallSegmentsToBuild.push({ p1, p2, isEntranceWall });
    }
  }

  for (const seg of wallSegmentsToBuild) {
    const { p1, p2, isEntranceWall } = seg;
    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const edgeLength = Math.hypot(dx, dz);
    const angle = Math.atan2(dz, dx);
    const midX = (p1.x + p2.x) / 2;
    const midZ = (p1.z + p2.z) / 2;

    if (isEntranceWall) {
      // Muro con portón abierto
      const doorW = effectiveDoorInfo.width;
      const doorH = effectiveDoorInfo.height;
      const wallMinX = Math.min(p1.x, p2.x);
      const wallMaxX = Math.max(p1.x, p2.x);

      // Tramo izquierdo
      const leftW = effectiveDoorInfo.center.x - doorW / 2 - wallMinX;
      if (leftW > 0.05) {
        const leftWallGeo = new THREE.BoxGeometry(leftW, wallHeight, wallThickness);
        const leftWall = new THREE.Mesh(leftWallGeo, wallMat);
        leftWall.position.set(wallMinX + leftW / 2, wallHeight / 2, midZ);
        leftWall.castShadow = true;
        leftWall.receiveShadow = true;
        wallsGroup.add(leftWall);

        // Zócalo izquierdo
        const leftZocGeo = new THREE.BoxGeometry(leftW, baseboardHeight, wallThickness + 0.04);
        const leftZoc = new THREE.Mesh(leftZocGeo, baseboardMat);
        leftZoc.position.set(wallMinX + leftW / 2, baseboardHeight / 2, midZ);
        wallsGroup.add(leftZoc);
      }

      // Tramo derecho
      const rightW = wallMaxX - (effectiveDoorInfo.center.x + doorW / 2);
      if (rightW > 0.05) {
        const rightWallGeo = new THREE.BoxGeometry(rightW, wallHeight, wallThickness);
        const rightWall = new THREE.Mesh(rightWallGeo, wallMat);
        rightWall.position.set(wallMaxX - rightW / 2, wallHeight / 2, midZ);
        rightWall.castShadow = true;
        rightWall.receiveShadow = true;
        wallsGroup.add(rightWall);

        // Zócalo derecho
        const rightZocGeo = new THREE.BoxGeometry(rightW, baseboardHeight, wallThickness + 0.04);
        const rightZoc = new THREE.Mesh(rightZocGeo, baseboardMat);
        rightZoc.position.set(wallMaxX - rightW / 2, baseboardHeight / 2, midZ);
        wallsGroup.add(rightZoc);
      }

      // Dintel superior (tramo sobre el portón de entrada)
      const lintelH = wallHeight - doorH;
      if (lintelH > 0.1) {
        const lintelGeo = new THREE.BoxGeometry(doorW, lintelH, wallThickness);
        const lintelMesh = new THREE.Mesh(lintelGeo, wallMat);
        lintelMesh.position.set(effectiveDoorInfo.center.x, doorH + lintelH / 2, midZ);
        lintelMesh.castShadow = true;
        lintelMesh.receiveShadow = true;
        wallsGroup.add(lintelMesh);
      }

      // ---------------------------------------------------------------------------------
      // PORTÓN INDUSTRIAL DE ENTRADA
      // ---------------------------------------------------------------------------------
      const doorGroup = new THREE.Group();
      doorGroup.name = 'EntrancePortal';

      // Marco metálico exterior
      const frameThick = 0.15;
      const leftPost = new THREE.Mesh(
        new THREE.BoxGeometry(frameThick, doorH, frameThick * 1.5),
        steelTrussMat
      );
      leftPost.position.set(effectiveDoorInfo.center.x - doorW / 2 + frameThick / 2, doorH / 2, midZ);
      doorGroup.add(leftPost);

      const rightPost = new THREE.Mesh(
        new THREE.BoxGeometry(frameThick, doorH, frameThick * 1.5),
        steelTrussMat
      );
      rightPost.position.set(effectiveDoorInfo.center.x + doorW / 2 - frameThick / 2, doorH / 2, midZ);
      doorGroup.add(rightPost);

      const topPost = new THREE.Mesh(
        new THREE.BoxGeometry(doorW, frameThick, frameThick * 1.5),
        steelTrussMat
      );
      topPost.position.set(effectiveDoorInfo.center.x, doorH - frameThick / 2, midZ);
      doorGroup.add(topPost);

      // Cortina metálica seccional parcialmente enrollada (abierta a 2.8m de altura)
      const rollUpH = 0.5;
      const rollUpGeo = new THREE.BoxGeometry(Math.max(0.6, doorW - 0.2), rollUpH, 0.08);
      const rollUpMat = new THREE.MeshStandardMaterial({
        color: '#475569',
        roughness: 0.3,
        metalness: 0.8,
      });
      const rollUpMesh = new THREE.Mesh(rollUpGeo, rollUpMat);
      rollUpMesh.position.set(effectiveDoorInfo.center.x, doorH - rollUpH / 2, midZ);
      doorGroup.add(rollUpMesh);

      // Letrero 3D iluminado sobre el portón (dimensionado para no desbordar)
      const signW = Math.min(Math.max(1.2, doorW - 0.2), 3.8);
      const signMesh = createEntranceSignMesh('LOGIX ZAZU WAREHOUSE', signW, 0.85);
      signMesh.position.set(effectiveDoorInfo.center.x, doorH + 0.6, midZ + 0.15);
      doorGroup.add(signMesh);

      // Franja de piso de seguridad chevron (precaución)
      const cautionGeo = new THREE.PlaneGeometry(doorW, 1.2);
      const cautionMat = new THREE.MeshBasicMaterial({
        color: '#f59e0b',
        transparent: true,
        opacity: 0.8,
      });
      const cautionMesh = new THREE.Mesh(cautionGeo, cautionMat);
      cautionMesh.rotation.x = -Math.PI / 2;
      cautionMesh.position.set(effectiveDoorInfo.center.x, 0.018, midZ);
      doorGroup.add(cautionMesh);

      wallsGroup.add(doorGroup);
    } else {
      // Muro continuo sólido
      const wallGeo = new THREE.BoxGeometry(edgeLength, wallHeight, wallThickness);
      const wallMesh = new THREE.Mesh(wallGeo, wallMat);
      wallMesh.position.set(midX, wallHeight / 2, midZ);
      wallMesh.rotation.y = -angle;
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      wallsGroup.add(wallMesh);

      // Zócalo de protección en la base
      const zocGeo = new THREE.BoxGeometry(edgeLength, baseboardHeight, wallThickness + 0.03);
      const zocMesh = new THREE.Mesh(zocGeo, baseboardMat);
      zocMesh.position.set(midX, baseboardHeight / 2, midZ);
      zocMesh.rotation.y = -angle;
      wallsGroup.add(zocMesh);
    }

    // Columnas esquineras
    const colGeo = new THREE.BoxGeometry(wallThickness * 1.5, wallHeight, wallThickness * 1.5);
    const colMesh = new THREE.Mesh(colGeo, steelTrussMat);
    colMesh.position.set(p1.x, wallHeight / 2, p1.z);
    colMesh.castShadow = true;
    wallsGroup.add(colMesh);
  }

  root.add(wallsGroup);

  // -----------------------------------------------------------------------------------
  // 2. TECHO ARQUITECTÓNICO & VIGAS RETICULADAS
  // -----------------------------------------------------------------------------------
  if (roofMode !== 'HIDDEN') {
    const roofGroup = new THREE.Group();
    roofGroup.name = 'Ceiling';

    let roofMat: THREE.Material;
    if (roofMode === 'TRANSLUCENT') {
      roofMat = new THREE.MeshStandardMaterial({
        color: '#334155',
        transparent: true,
        opacity: 0.4,
        roughness: 0.3,
        side: THREE.DoubleSide,
      });
    } else {
      roofMat = new THREE.MeshStandardMaterial({
        color: '#f8fafc',
        roughness: 0.8,
        metalness: 0.05,
        side: THREE.DoubleSide,
      });
    }

    if (roomShape === 'CUSTOM_GRID' && roomConfig?.customGrid) {
      const { cellSize, cols, rows, cells } = roomConfig.customGrid;
      const gridW = cols * cellSize;
      const gridL = rows * cellSize;
      const startX = -gridW / 2;
      const startZ = -gridL / 2;

      for (let r = 0; r < rows; r++) {
        let cStart = -1;
        for (let c = 0; c <= cols; c++) {
          const isActive = c < cols && cells[r] && cells[r][c] === 1;
          if (isActive && cStart === -1) {
            cStart = c;
          } else if (!isActive && cStart !== -1) {
            const cEnd = c - 1;
            const spanCols = cEnd - cStart + 1;
            const spanW = spanCols * cellSize;
            const spanL = cellSize;
            const centerX = startX + (cStart + cEnd + 1) / 2 * cellSize;
            const centerZ = startZ + (r + 0.5) * cellSize;

            const panelGeo = new THREE.PlaneGeometry(spanW, spanL);
            const panelMesh = new THREE.Mesh(panelGeo, roofMat);
            panelMesh.rotation.x = Math.PI / 2;
            panelMesh.position.set(centerX, wallHeight, centerZ);
            panelMesh.receiveShadow = true;
            roofGroup.add(panelMesh);

            cStart = -1;
          }
        }
      }
    } else {
      // Generar la forma 2D del polígono para la losa del techo
      const shape = new THREE.Shape();
      shape.moveTo(vertices[0].x, -vertices[0].z);
      for (let i = 1; i < vertices.length; i++) {
        shape.lineTo(vertices[i].x, -vertices[i].z);
      }
      shape.closePath();

      const roofGeo = new THREE.ShapeGeometry(shape);
      const ceilingMesh = new THREE.Mesh(roofGeo, roofMat);
      ceilingMesh.rotation.x = Math.PI / 2;
      ceilingMesh.position.y = wallHeight;
      ceilingMesh.receiveShadow = true;
      roofGroup.add(ceilingMesh);
    }

    // Vigas reticuladas de acero industrial transversales y luminarias
    // Geometrías y materiales compartidos para máximo rendimiento (0 sobrecarga de GPU)
    const hangerGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.35);
    const lampGeo = new THREE.BoxGeometry(1.8, 0.06, 0.14);
    const lampMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });

    if (roomShape === 'CUSTOM_GRID' && roomConfig?.customGrid) {
      const { cellSize, cols, rows, cells } = roomConfig.customGrid;
      const gridW = cols * cellSize;
      const gridL = rows * cellSize;
      const startX = -gridW / 2;
      const startZ = -gridL / 2;

      // Colocar vigas transversales cada ~4.5 metros (o cada N filas)
      const rowStep = Math.max(1, Math.round(4.5 / cellSize));
      for (let r = 1; r < rows - 1; r += rowStep) {
        let cStart = -1;
        for (let c = 0; c <= cols; c++) {
          const isActive = c < cols && cells[r] && cells[r][c] === 1;
          if (isActive && cStart === -1) {
            cStart = c;
          } else if (!isActive && cStart !== -1) {
            const cEnd = c - 1;
            const spanCols = cEnd - cStart + 1;
            const spanW = spanCols * cellSize;
            if (spanW >= 3.0) {
              const centerX = startX + (cStart + cEnd + 1) / 2 * cellSize;
              const centerZ = startZ + (r + 0.5) * cellSize;
              const trussW = spanW - 0.4;
              const trussGeo = new THREE.BoxGeometry(trussW, 0.28, 0.12);
              const trussMesh = new THREE.Mesh(trussGeo, steelTrussMat);
              trussMesh.position.set(centerX, wallHeight - 0.15, centerZ);
              roofGroup.add(trussMesh);

              for (let lx = centerX - trussW / 2 + 2; lx <= centerX + trussW / 2 - 2; lx += 3.5) {
                const hangerMesh = new THREE.Mesh(hangerGeo, steelTrussMat);
                hangerMesh.position.set(lx, wallHeight - 0.18, centerZ);
                roofGroup.add(hangerMesh);

                const lampMesh = new THREE.Mesh(lampGeo, lampMat);
                lampMesh.position.set(lx, wallHeight - 0.36, centerZ);
                roofGroup.add(lampMesh);
              }
            }
            cStart = -1;
          }
        }
      }
    } else {
      const trussSpacing = 4.5;
      const minZ = -length / 2 + 2;
      const maxZ = length / 2 - 2;

      for (let z = minZ; z <= maxZ; z += trussSpacing) {
        // Encontrar los tramos válidos de X dentro del almacén en esta coordenada Z
        let inStart: number | null = null;
        const step = 0.5;
        const xMin = -width / 2;
        const xMax = width / 2;

        for (let x = xMin; x <= xMax + 0.01; x += step) {
          const inside = isPointInsideRoom(x, z, width, length, roomShape, roomConfig, 0.2);
          if (inside && inStart === null) {
            inStart = x;
          } else if (!inside && inStart !== null) {
            const inEnd = x - step;
            const spanW = inEnd - inStart;
            if (spanW >= 3.0) {
              const midSpanX = (inStart + inEnd) / 2;
              const trussW = spanW - 0.4;
              const trussGeo = new THREE.BoxGeometry(trussW, 0.28, 0.12);
              const trussMesh = new THREE.Mesh(trussGeo, steelTrussMat);
              trussMesh.position.set(midSpanX, wallHeight - 0.15, z);
              roofGroup.add(trussMesh);

              for (let lx = midSpanX - trussW / 2 + 2; lx <= midSpanX + trussW / 2 - 2; lx += 3.5) {
                const hangerMesh = new THREE.Mesh(hangerGeo, steelTrussMat);
                hangerMesh.position.set(lx, wallHeight - 0.18, z);
                roofGroup.add(hangerMesh);

                const lampMesh = new THREE.Mesh(lampGeo, lampMat);
                lampMesh.position.set(lx, wallHeight - 0.36, z);
                roofGroup.add(lampMesh);
              }
            }
            inStart = null;
          }
        }
      }
    }

    root.add(roofGroup);
  }

  // -----------------------------------------------------------------------------------
  // 3. SUELO EXTERIOR (Vereda perimetral y asfalto arquitectónico)
  // -----------------------------------------------------------------------------------
  const apronGeo = new THREE.PlaneGeometry(width + 12, length + 12);
  const apronMat = new THREE.MeshStandardMaterial({
    color: '#090e17', // Asfalto exterior oscuro
    roughness: 0.95,
  });
  const apronMesh = new THREE.Mesh(apronGeo, apronMat);
  apronMesh.rotation.x = -Math.PI / 2;
  apronMesh.position.y = -0.01;
  apronMesh.receiveShadow = true;
  root.add(apronMesh);

  return root;
}
