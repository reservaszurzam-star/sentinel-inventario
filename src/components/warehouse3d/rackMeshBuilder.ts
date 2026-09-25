import * as THREE from 'three';
import {
  Rack3D,
  RackSlot3D,
  ViewMode3D,
  RoomShape,
  RoomConfig,
  FunctionalZone,
  ArchitecturalObstacle,
} from '../../types/warehouse3d';
import { getColorStyle } from '../../lib/colors';
import { getCustomGridWallSegments } from './architecturalBuilder';

// Paleta de colores para categorías cuando se usa CATEGORIES mode
const CATEGORY_PALETTE: Record<string, string> = {
  'Polos Waffle': '#3b82f6',
  'Polos Jersey': '#10b981',
  'Polos Oversize': '#8b5cf6',
  'Polos Boxy': '#f59e0b',
  'Polos Cuello V': '#ec4899',
  'Polos Henley': '#06b6d4',
  'Pantalones Cargo': '#84cc16',
  'Shorts Rústicos': '#14b8a6',
  'Poleras Franela': '#6366f1',
  'Casacas': '#f97316',
  'Accesorios': '#a855f7',
  'General': '#64748b',
};

function getCategoryColor(category?: string): string {
  if (!category) return '#64748b';
  return CATEGORY_PALETTE[category] || '#0284c7';
}

/**
 * Genera el color de la caja/prenda según el modo de visualización actual.
 */
function getBoxColor(slot: RackSlot3D, mode: ViewMode3D): THREE.Color {
  if (mode === 'HEATMAP') {
    if (slot.stockUnits <= 0) return new THREE.Color('#94a3b8'); // Gris / Vacío
    const ratio = Math.min(1, slot.stockUnits / (slot.capacity || 100));
    if (ratio < 0.25) return new THREE.Color('#ef4444'); // Rojo (bajo stock)
    if (ratio < 0.70) return new THREE.Color('#f59e0b'); // Amarillo (medio)
    return new THREE.Color('#10b981'); // Verde (óptimo / lleno)
  }

  if (mode === 'CATEGORIES') {
    return new THREE.Color(getCategoryColor(slot.productCategory));
  }

  // Modo PRODUCTS: color real de la prenda textil
  if (slot.productColor) {
    const style = getColorStyle(slot.productColor);
    return new THREE.Color(style.hex);
  }

  return new THREE.Color('#38bdf8'); // Azul cielo textil
}

/**
 * Crea un rótulo flotante superior para el nombre del mueble.
 */
function createRackLabelSprite(rackName: string, aisle: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.roundRect ? ctx.roundRect(8, 8, 496, 112, 16) : ctx.fillRect(8, 8, 496, 112);
    ctx.fill();

    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 5;
    ctx.roundRect ? ctx.roundRect(8, 8, 496, 112, 16) : ctx.strokeRect(8, 8, 496, 112);
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = '900 38px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(rackName.toUpperCase(), 256, 48);

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(aisle.toUpperCase(), 256, 92);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.4, 0.6, 1);
  return sprite;
}

/**
 * Crea un rótulo en el piso para zonas funcionales (Recepción, Packing, etc.).
 */
function createZoneFloorSprite(zoneName: string, colorHex: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = `${colorHex}33`;
    ctx.roundRect ? ctx.roundRect(4, 4, 504, 88, 12) : ctx.fillRect(4, 4, 504, 88);
    ctx.fill();

    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 4;
    ctx.roundRect ? ctx.roundRect(4, 4, 504, 88, 12) : ctx.strokeRect(4, 4, 504, 88);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 34px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(zoneName.toUpperCase(), 256, 48);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(3.2, 0.6, 1);
  return sprite;
}

// -------------------------------------------------------------------------------------
// CONSTRUCTORES DE MOBILIARIO
// -------------------------------------------------------------------------------------

/**
 * 1. ESTANTE CLÁSICO DE CUBOS (2x4, 3x4, etc. - como en la foto)
 */
function buildCubbyRack(
  rack: Rack3D,
  viewMode: ViewMode3D,
  isSelected: boolean,
  highlightSlotKey: string | null
): THREE.Group {
  const group = new THREE.Group();

  const bays = rack.bays;
  const levels = rack.levels;
  const cubbyWidth = rack.bayWidth || 0.65;
  const cubbyHeight = rack.levelHeight || 0.55;
  const depth = rack.depth || 0.55;
  const boardThickness = rack.boardThickness || 0.03;
  const baseHeight = rack.baseHeight || 0;
  const hasBackPanel = rack.hasBackPanel !== false;

  const totalWidth = bays * cubbyWidth + (bays + 1) * boardThickness;
  const totalHeight = levels * cubbyHeight + (levels + 1) * boardThickness;

  const baseColor = isSelected ? '#38bdf8' : (rack.color && rack.color !== '#1e40af' ? rack.color : '#ffffff');
  const whiteFurnitureMaterial = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness: 0.35,
    metalness: 0.02,
  });

  const interiorMaterial = new THREE.MeshStandardMaterial({
    color: isSelected ? '#e0f2fe' : '#f8fafc',
    roughness: 0.45,
    metalness: 0.01,
  });

  // Zócalo
  if (baseHeight > 0) {
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(totalWidth - 0.04, baseHeight, depth - 0.04),
      whiteFurnitureMaterial
    );
    plinth.position.set(0, baseHeight / 2, 0);
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    group.add(plinth);
  }

  // Techo
  const topPanel = new THREE.Mesh(new THREE.BoxGeometry(totalWidth, boardThickness, depth), whiteFurnitureMaterial);
  topPanel.position.set(0, baseHeight + totalHeight - boardThickness / 2, 0);
  topPanel.castShadow = true;
  topPanel.receiveShadow = true;
  group.add(topPanel);

  // Base
  const bottomPanel = new THREE.Mesh(new THREE.BoxGeometry(totalWidth, boardThickness, depth), whiteFurnitureMaterial);
  bottomPanel.position.set(0, baseHeight + boardThickness / 2, 0);
  bottomPanel.castShadow = true;
  bottomPanel.receiveShadow = true;
  group.add(bottomPanel);

  // Costado Izquierdo
  const leftWall = new THREE.Mesh(
    new THREE.BoxGeometry(boardThickness, totalHeight - 2 * boardThickness, depth),
    whiteFurnitureMaterial
  );
  leftWall.position.set(-totalWidth / 2 + boardThickness / 2, baseHeight + totalHeight / 2, 0);
  leftWall.castShadow = true;
  leftWall.receiveShadow = true;
  group.add(leftWall);

  // Costado Derecho
  const rightWall = new THREE.Mesh(
    new THREE.BoxGeometry(boardThickness, totalHeight - 2 * boardThickness, depth),
    whiteFurnitureMaterial
  );
  rightWall.position.set(totalWidth / 2 - boardThickness / 2, baseHeight + totalHeight / 2, 0);
  rightWall.castShadow = true;
  rightWall.receiveShadow = true;
  group.add(rightWall);

  // Fondo Posterior
  if (hasBackPanel) {
    const backPanel = new THREE.Mesh(
      new THREE.BoxGeometry(totalWidth - 0.005, totalHeight - 0.005, 0.012),
      interiorMaterial
    );
    backPanel.position.set(0, baseHeight + totalHeight / 2, -depth / 2 + 0.006);
    backPanel.receiveShadow = true;
    group.add(backPanel);
  }

  // Divisores verticales
  for (let b = 1; b < bays; b++) {
    const xPos = -totalWidth / 2 + b * (cubbyWidth + boardThickness) + boardThickness / 2;
    const divider = new THREE.Mesh(
      new THREE.BoxGeometry(boardThickness, totalHeight - 2 * boardThickness, depth - 0.01),
      whiteFurnitureMaterial
    );
    divider.position.set(xPos, baseHeight + totalHeight / 2, 0.005);
    divider.castShadow = true;
    divider.receiveShadow = true;
    group.add(divider);
  }

  // Baldas horizontales
  for (let l = 1; l < levels; l++) {
    const yPos = boardThickness + l * (cubbyHeight + boardThickness) - boardThickness / 2;
    for (let b = 1; b <= bays; b++) {
      const xCenter = -totalWidth / 2 + boardThickness + (b - 0.5) * cubbyWidth + (b - 1) * boardThickness;
      const shelf = new THREE.Mesh(
        new THREE.BoxGeometry(cubbyWidth, boardThickness, depth - 0.012),
        whiteFurnitureMaterial
      );
      shelf.position.set(xCenter, baseHeight + yPos, 0.006);
      shelf.castShadow = true;
      shelf.receiveShadow = true;
      group.add(shelf);
    }
  }

  // Cubículos / Slots y Cajas de prendas
  for (let l = 1; l <= levels; l++) {
    const yCenter = baseHeight + boardThickness + (l - 0.5) * cubbyHeight + (l - 1) * boardThickness;
    const shelfBaseY = yCenter - cubbyHeight / 2;

    for (let b = 1; b <= bays; b++) {
      const xCenter = -totalWidth / 2 + boardThickness + (b - 0.5) * cubbyWidth + (b - 1) * boardThickness;
      const slotKey = `${l}-${b}`;
      const slot = rack.slots[slotKey] || {
        level: l,
        bay: b,
        code: `${rack.name.replace(/\s+/g, '-')}-N${l}-C${b}`,
        capacity: 150,
        stockUnits: 0,
      };

      const isSlotHighlighted = highlightSlotKey === slotKey;
      const hitBoxMat = new THREE.MeshBasicMaterial({
        color: isSlotHighlighted ? 0x38bdf8 : 0xffffff,
        transparent: true,
        opacity: isSlotHighlighted ? 0.35 : 0.0,
        wireframe: isSlotHighlighted,
      });
      const hitBox = new THREE.Mesh(
        new THREE.BoxGeometry(cubbyWidth - 0.01, cubbyHeight - 0.01, depth - 0.02),
        hitBoxMat
      );
      hitBox.position.set(xCenter, yCenter, 0.005);
      hitBox.userData = { isSlot: true, rackId: rack.id, slotKey, slot, level: l, bay: b };
      group.add(hitBox);

      if (slot.stockUnits > 0 || slot.productId) {
        addGarmentBoxes(group, rack, slotKey, slot, xCenter, shelfBaseY, cubbyWidth, cubbyHeight, depth, viewMode);
      }
    }
  }

  return group;
}

/**
 * 2. ESTANTE ESQUINERO EN "L" (Gira 90° para aprovechar esquinas)
 */
function buildCornerLRack(
  rack: Rack3D,
  viewMode: ViewMode3D,
  isSelected: boolean,
  highlightSlotKey: string | null
): THREE.Group {
  const group = new THREE.Group();

  const baysX = rack.bays; // Cuerpos ala X
  const baysZ = rack.secondaryBays || 2; // Cuerpos ala Z
  const levels = rack.levels;
  const cubbyWidth = rack.bayWidth || 0.65;
  const cubbyHeight = rack.levelHeight || 0.55;
  const depth = rack.depth || 0.55;
  const boardThickness = rack.boardThickness || 0.03;
  const baseHeight = rack.baseHeight || 0;
  const hasBackPanel = rack.hasBackPanel !== false;

  const totalLengthX = baysX * cubbyWidth + depth;
  const totalLengthZ = baysZ * cubbyWidth + depth;
  const totalHeight = levels * cubbyHeight + (levels + 1) * boardThickness;

  const baseColor = isSelected ? '#38bdf8' : (rack.color || '#ffffff');
  const whiteMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.35, metalness: 0.02 });
  const interiorMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.45, metalness: 0.01 });

  // Ala X (Base y Techo)
  const topX = new THREE.Mesh(new THREE.BoxGeometry(totalLengthX, boardThickness, depth), whiteMat);
  topX.position.set(totalLengthX / 2 - depth / 2, baseHeight + totalHeight - boardThickness / 2, 0);
  group.add(topX);

  const botX = new THREE.Mesh(new THREE.BoxGeometry(totalLengthX, boardThickness, depth), whiteMat);
  botX.position.set(totalLengthX / 2 - depth / 2, baseHeight + boardThickness / 2, 0);
  group.add(botX);

  // Ala Z (Base y Techo)
  const topZ = new THREE.Mesh(new THREE.BoxGeometry(depth, boardThickness, totalLengthZ - depth), whiteMat);
  topZ.position.set(0, baseHeight + totalHeight - boardThickness / 2, (totalLengthZ - depth) / 2 + depth / 2);
  group.add(topZ);

  const botZ = new THREE.Mesh(new THREE.BoxGeometry(depth, boardThickness, totalLengthZ - depth), whiteMat);
  botZ.position.set(0, baseHeight + boardThickness / 2, (totalLengthZ - depth) / 2 + depth / 2);
  group.add(botZ);

  // Espaldares
  if (hasBackPanel) {
    const backX = new THREE.Mesh(new THREE.BoxGeometry(totalLengthX, totalHeight, 0.012), interiorMat);
    backX.position.set(totalLengthX / 2 - depth / 2, baseHeight + totalHeight / 2, -depth / 2 + 0.006);
    group.add(backX);

    const backZ = new THREE.Mesh(new THREE.BoxGeometry(0.012, totalHeight, totalLengthZ - depth), interiorMat);
    backZ.position.set(-depth / 2 + 0.006, baseHeight + totalHeight / 2, (totalLengthZ - depth) / 2 + depth / 2);
    group.add(backZ);
  }

  // Cubículos Ala X
  for (let l = 1; l <= levels; l++) {
    const yCenter = baseHeight + boardThickness + (l - 0.5) * cubbyHeight + (l - 1) * boardThickness;
    const shelfBaseY = yCenter - cubbyHeight / 2;

    for (let b = 1; b <= baysX; b++) {
      const xPos = depth / 2 + (b - 0.5) * cubbyWidth;
      const slotKey = `${l}-${b}`;
      const slot = rack.slots[slotKey] || {
        level: l,
        bay: b,
        code: `${rack.name}-X${b}-N${l}`,
        capacity: 150,
        stockUnits: 0,
      };

      const hitBox = new THREE.Mesh(
        new THREE.BoxGeometry(cubbyWidth - 0.02, cubbyHeight - 0.02, depth - 0.02),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: highlightSlotKey === slotKey ? 0.35 : 0.0 })
      );
      hitBox.position.set(xPos, yCenter, 0);
      hitBox.userData = { isSlot: true, rackId: rack.id, slotKey, slot, level: l, bay: b };
      group.add(hitBox);

      if (slot.stockUnits > 0 || slot.productId) {
        addGarmentBoxes(group, rack, slotKey, slot, xPos, shelfBaseY, cubbyWidth, cubbyHeight, depth, viewMode);
      }
    }

    // Cubículos Ala Z
    for (let bz = 1; bz <= baysZ; bz++) {
      const zPos = depth / 2 + (bz - 0.5) * cubbyWidth;
      const slotKey = `${l}-${baysX + bz}`;
      const slot = rack.slots[slotKey] || {
        level: l,
        bay: baysX + bz,
        code: `${rack.name}-Z${bz}-N${l}`,
        capacity: 150,
        stockUnits: 0,
      };

      const hitBox = new THREE.Mesh(
        new THREE.BoxGeometry(depth - 0.02, cubbyHeight - 0.02, cubbyWidth - 0.02),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: highlightSlotKey === slotKey ? 0.35 : 0.0 })
      );
      hitBox.position.set(0, yCenter, zPos);
      hitBox.userData = { isSlot: true, rackId: rack.id, slotKey, slot, level: l, bay: baysX + bz };
      group.add(hitBox);

      if (slot.stockUnits > 0 || slot.productId) {
        addGarmentBoxes(group, rack, slotKey, slot, 0, shelfBaseY, depth, cubbyHeight, cubbyWidth, viewMode);
      }
    }
  }

  return group;
}

/**
 * 3. ESTANTE ESCALONADO / ESCALERA (Alturas decrecientes por columna)
 */
function buildSteppedRack(
  rack: Rack3D,
  viewMode: ViewMode3D,
  isSelected: boolean,
  highlightSlotKey: string | null
): THREE.Group {
  const group = new THREE.Group();

  const bays = rack.bays;
  const maxLevels = rack.levels;
  const cubbyWidth = rack.bayWidth || 0.65;
  const cubbyHeight = rack.levelHeight || 0.55;
  const depth = rack.depth || 0.55;
  const boardThickness = rack.boardThickness || 0.03;
  const baseHeight = rack.baseHeight || 0;
  const hasBackPanel = rack.hasBackPanel !== false;

  // Alturas por columna (por defecto forma de escalera descendente: 4, 3, 2, 1)
  const stepHeights = rack.stepHeights && rack.stepHeights.length === bays
    ? rack.stepHeights
    : Array.from({ length: bays }, (_, i) => Math.max(1, maxLevels - i));

  const totalWidth = bays * cubbyWidth + (bays + 1) * boardThickness;
  const baseColor = isSelected ? '#38bdf8' : (rack.color || '#ffffff');
  const whiteMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.35, metalness: 0.02 });
  const interiorMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.45, metalness: 0.01 });

  // Base general corrida
  const botPanel = new THREE.Mesh(new THREE.BoxGeometry(totalWidth, boardThickness, depth), whiteMat);
  botPanel.position.set(0, baseHeight + boardThickness / 2, 0);
  group.add(botPanel);

  // Columnas individuales con sus techos y baldas
  for (let b = 1; b <= bays; b++) {
    const colLevels = stepHeights[b - 1];
    const colHeight = colLevels * cubbyHeight + (colLevels + 1) * boardThickness;
    const xCenter = -totalWidth / 2 + boardThickness + (b - 0.5) * cubbyWidth + (b - 1) * boardThickness;

    // Techo escalonado de esta columna
    const colTop = new THREE.Mesh(new THREE.BoxGeometry(cubbyWidth + boardThickness, boardThickness, depth), whiteMat);
    colTop.position.set(xCenter, baseHeight + colHeight - boardThickness / 2, 0);
    group.add(colTop);

    // Fondo escalonado
    if (hasBackPanel) {
      const colBack = new THREE.Mesh(new THREE.BoxGeometry(cubbyWidth, colHeight, 0.012), interiorMat);
      colBack.position.set(xCenter, baseHeight + colHeight / 2, -depth / 2 + 0.006);
      group.add(colBack);
    }

    // Baldas horizontales de esta columna
    for (let l = 1; l < colLevels; l++) {
      const yShelf = baseHeight + boardThickness + l * (cubbyHeight + boardThickness) - boardThickness / 2;
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(cubbyWidth, boardThickness, depth - 0.01), whiteMat);
      shelf.position.set(xCenter, yShelf, 0.005);
      group.add(shelf);
    }

    // Cubículos y cajas de prendas
    for (let l = 1; l <= colLevels; l++) {
      const yCenter = baseHeight + boardThickness + (l - 0.5) * cubbyHeight + (l - 1) * boardThickness;
      const shelfBaseY = yCenter - cubbyHeight / 2;
      const slotKey = `${l}-${b}`;
      const slot = rack.slots[slotKey] || {
        level: l,
        bay: b,
        code: `${rack.name}-N${l}-C${b}`,
        capacity: 150,
        stockUnits: 0,
      };

      const hitBox = new THREE.Mesh(
        new THREE.BoxGeometry(cubbyWidth - 0.01, cubbyHeight - 0.01, depth - 0.02),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: highlightSlotKey === slotKey ? 0.35 : 0.0 })
      );
      hitBox.position.set(xCenter, yCenter, 0.005);
      hitBox.userData = { isSlot: true, rackId: rack.id, slotKey, slot, level: l, bay: b };
      group.add(hitBox);

      if (slot.stockUnits > 0 || slot.productId) {
        addGarmentBoxes(group, rack, slotKey, slot, xCenter, shelfBaseY, cubbyWidth, cubbyHeight, depth, viewMode);
      }
    }
  }

  // Divisores verticales externos e internos
  for (let b = 0; b <= bays; b++) {
    const leftColLevels = b > 0 ? stepHeights[b - 1] : 0;
    const rightColLevels = b < bays ? stepHeights[b] : 0;
    const wallLevels = Math.max(leftColLevels, rightColLevels);
    if (wallLevels <= 0) continue;

    const wallHeight = wallLevels * cubbyHeight + (wallLevels + 1) * boardThickness;
    const xPos = -totalWidth / 2 + b * (cubbyWidth + boardThickness) + boardThickness / 2;

    const wall = new THREE.Mesh(new THREE.BoxGeometry(boardThickness, wallHeight, depth), whiteMat);
    wall.position.set(xPos, baseHeight + wallHeight / 2, 0);
    group.add(wall);
  }

  return group;
}

/**
 * 4. MESÓN DE TRABAJO / EMPAQUE TEXTIL
 */
function buildWorkTableMesh(
  rack: Rack3D,
  viewMode: ViewMode3D,
  isSelected: boolean,
  highlightSlotKey: string | null
): THREE.Group {
  const group = new THREE.Group();

  const width = rack.bayWidth * rack.bays || 2.2;
  const depth = rack.depth || 1.1;
  const height = rack.levelHeight || 0.90; // Altura estándar de mesón de doblado
  const topThickness = 0.06; // Tablero superior grueso macizo
  const legSize = 0.08; // Patas robustas

  const baseColor = isSelected ? '#38bdf8' : (rack.color || '#ffffff');
  const tableMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.3, metalness: 0.02 });

  // Tablero superior
  const top = new THREE.Mesh(new THREE.BoxGeometry(width, topThickness, depth), tableMat);
  top.position.set(0, height - topThickness / 2, 0);
  top.castShadow = true;
  group.add(top);

  // 4 Patas en esquinas
  const legGeo = new THREE.BoxGeometry(legSize, height - topThickness, legSize);
  const legPositions = [
    [-width / 2 + legSize / 2 + 0.04, (height - topThickness) / 2, -depth / 2 + legSize / 2 + 0.04],
    [width / 2 - legSize / 2 - 0.04, (height - topThickness) / 2, -depth / 2 + legSize / 2 + 0.04],
    [-width / 2 + legSize / 2 + 0.04, (height - topThickness) / 2, depth / 2 - legSize / 2 - 0.04],
    [width / 2 - legSize / 2 - 0.04, (height - topThickness) / 2, depth / 2 - legSize / 2 - 0.04],
  ];

  legPositions.forEach(([x, y, z]) => {
    const leg = new THREE.Mesh(legGeo, tableMat);
    leg.position.set(x, y, z);
    leg.castShadow = true;
    group.add(leg);
  });

  // Balda inferior para cajas y rollos de tela
  const lowerShelf = new THREE.Mesh(new THREE.BoxGeometry(width - 0.1, 0.025, depth - 0.1), tableMat);
  lowerShelf.position.set(0, 0.22, 0);
  lowerShelf.castShadow = true;
  group.add(lowerShelf);

  // Slots: Nivel 1 = Balda inferior, Nivel 2 = Superficie de mesa
  for (let b = 1; b <= rack.bays; b++) {
    const xSlot = -width / 2 + (b - 0.5) * (width / rack.bays);

    // Slot mesa (Nivel 2)
    const keyTop = `2-${b}`;
    const slotTop = rack.slots[keyTop] || { level: 2, bay: b, code: `${rack.name}-TOP-C${b}`, capacity: 150, stockUnits: 0 };
    const hitTop = new THREE.Mesh(
      new THREE.BoxGeometry(width / rack.bays - 0.05, 0.3, depth - 0.05),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: highlightSlotKey === keyTop ? 0.35 : 0.0 })
    );
    hitTop.position.set(xSlot, height + 0.15, 0);
    hitTop.userData = { isSlot: true, rackId: rack.id, slotKey: keyTop, slot: slotTop, level: 2, bay: b };
    group.add(hitTop);

    // Slot inferior (Nivel 1)
    const keyBot = `1-${b}`;
    const slotBot = rack.slots[keyBot] || { level: 1, bay: b, code: `${rack.name}-BOT-C${b}`, capacity: 150, stockUnits: 0 };
    const hitBot = new THREE.Mesh(
      new THREE.BoxGeometry(width / rack.bays - 0.05, 0.35, depth - 0.05),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: highlightSlotKey === keyBot ? 0.35 : 0.0 })
    );
    hitBot.position.set(xSlot, 0.42, 0);
    hitBot.userData = { isSlot: true, rackId: rack.id, slotKey: keyBot, slot: slotBot, level: 1, bay: b };
    group.add(hitBot);

    if (slotBot.stockUnits > 0 || slotBot.productId) {
      addGarmentBoxes(group, rack, keyBot, slotBot, xSlot, 0.24, width / rack.bays, 0.4, depth, viewMode);
    }
  }

  return group;
}

/**
 * 5. BURRO / PERCHERO TEXTIL COLGANTE
 */
function buildClothesRackMesh(
  rack: Rack3D,
  viewMode: ViewMode3D,
  isSelected: boolean,
  highlightSlotKey: string | null
): THREE.Group {
  const group = new THREE.Group();

  const width = rack.bayWidth * rack.bays || 1.8;
  const depth = 0.55;
  const height = 1.85;

  const baseColor = isSelected ? '#38bdf8' : (rack.color || '#ffffff');
  const frameMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.3, metalness: 0.2 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.2, metalness: 0.8 });

  // Base inferior con rejilla
  const baseSlab = new THREE.Mesh(new THREE.BoxGeometry(width, 0.04, depth), frameMat);
  baseSlab.position.set(0, 0.08, 0);
  group.add(baseSlab);

  // Postes verticales laterales
  const postLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, height), frameMat);
  postLeft.position.set(-width / 2 + 0.08, height / 2, 0);
  group.add(postLeft);

  const postRight = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, height), frameMat);
  postRight.position.set(width / 2 - 0.08, height / 2, 0);
  group.add(postRight);

  // Barra horizontal superior para perchas
  const topRail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, width - 0.16), chromeMat);
  topRail.rotation.z = Math.PI / 2;
  topRail.position.set(0, height - 0.06, 0);
  group.add(topRail);

  // Perchas y prendas colgantes representativas
  for (let b = 1; b <= rack.bays; b++) {
    const xBay = -width / 2 + (b - 0.5) * (width / rack.bays);
    const slotKey = `1-${b}`;
    const slot = rack.slots[slotKey] || { level: 1, bay: b, code: `${rack.name}-C${b}`, capacity: 100, stockUnits: 0 };

    const hitBox = new THREE.Mesh(
      new THREE.BoxGeometry(width / rack.bays - 0.05, height * 0.7, depth),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: highlightSlotKey === slotKey ? 0.35 : 0.0 })
    );
    hitBox.position.set(xBay, height * 0.55, 0);
    hitBox.userData = { isSlot: true, rackId: rack.id, slotKey, slot, level: 1, bay: b };
    group.add(hitBox);

    // Si tiene producto, colgar prendas textiles en perchas
    if (slot.stockUnits > 0 || slot.productId) {
      const garmentColor = getBoxColor(slot, viewMode);
      const hangerCount = Math.min(8, Math.max(3, Math.ceil(slot.stockUnits / 15)));
      const spacing = (width / rack.bays - 0.15) / hangerCount;

      for (let h = 0; h < hangerCount; h++) {
        const hx = xBay - (width / rack.bays - 0.15) / 2 + (h + 0.5) * spacing;
        const garment = new THREE.Mesh(
          new THREE.BoxGeometry(0.03, 0.65, 0.38),
          new THREE.MeshStandardMaterial({ color: garmentColor, roughness: 0.6 })
        );
        garment.position.set(hx, height - 0.52, 0);
        garment.castShadow = true;
        group.add(garment);
      }
    }
  }

  return group;
}

/**
 * Helper común: Añadir cajas apiladas en un casillero
 */
function addGarmentBoxes(
  group: THREE.Group,
  rack: Rack3D,
  slotKey: string,
  slot: RackSlot3D,
  xCenter: number,
  shelfBaseY: number,
  cubbyWidth: number,
  cubbyHeight: number,
  depth: number,
  viewMode: ViewMode3D
) {
  const boxCount = slot.stockUnits > 0 ? Math.min(4, Math.max(1, Math.ceil(slot.stockUnits / 30))) : 1;
  const boxColor = getBoxColor(slot, viewMode);
  const boxMaterial = new THREE.MeshStandardMaterial({ color: boxColor, roughness: 0.5, metalness: 0.08 });

  const boxWidth = (cubbyWidth - 0.08) / (boxCount > 1 ? 2 : 1);
  const boxDepth = (depth - 0.1) / (boxCount > 2 ? 2 : 1);
  const boxHeight = cubbyHeight * 0.42;

  for (let idx = 0; idx < boxCount; idx++) {
    const colIdx = idx % 2;
    const rowIdx = Math.floor(idx / 2);
    const bx = xCenter - (cubbyWidth - 0.08) / 2 + (colIdx + 0.5) * boxWidth;
    const bz = -(depth - 0.1) / 2 + (rowIdx + 0.5) * boxDepth + 0.03;
    const by = shelfBaseY + boxHeight / 2 + 0.002;

    const boxMesh = new THREE.Mesh(new THREE.BoxGeometry(boxWidth * 0.9, boxHeight, boxDepth * 0.9), boxMaterial);
    boxMesh.position.set(bx, by, bz);
    boxMesh.castShadow = true;
    boxMesh.receiveShadow = true;
    boxMesh.userData = { isSlot: true, rackId: rack.id, slotKey, slot, level: slot.level, bay: slot.bay };
    group.add(boxMesh);
  }
}

/**
 * Función Principal para Construir la Malla del Mueble según su Tipo
 */
export function buildRackMesh(
  rack: Rack3D,
  viewMode: ViewMode3D,
  isSelected: boolean = false,
  highlightSlotKey: string | null = null
): THREE.Group {
  const group = new THREE.Group();
  group.name = `rack-${rack.id}`;
  group.userData = { isRack: true, rackId: rack.id, rack };

  const furnitureType = rack.furnitureType || 'CUBBY';
  let innerMesh: THREE.Group;

  switch (furnitureType) {
    case 'CORNER_L':
      innerMesh = buildCornerLRack(rack, viewMode, isSelected, highlightSlotKey);
      break;
    case 'STEPPED':
      innerMesh = buildSteppedRack(rack, viewMode, isSelected, highlightSlotKey);
      break;
    case 'WORK_TABLE':
      innerMesh = buildWorkTableMesh(rack, viewMode, isSelected, highlightSlotKey);
      break;
    case 'CLOTHES_RACK':
      innerMesh = buildClothesRackMesh(rack, viewMode, isSelected, highlightSlotKey);
      break;
    case 'CUBBY':
    default:
      innerMesh = buildCubbyRack(rack, viewMode, isSelected, highlightSlotKey);
      break;
  }

  group.add(innerMesh);

  // Base iluminada de selección
  if (isSelected) {
    const ringGeo = new THREE.RingGeometry(0.7, 1.1, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(0, 0.02, 0);
    group.add(ringMesh);

    const outlineBox = new THREE.BoxHelper(group, 0x38bdf8);
    group.add(outlineBox);
  }

  // Rótulo superior flotante
  const labelSprite = createRackLabelSprite(rack.name, rack.aisle);
  const totalH = (rack.levels * (rack.levelHeight || 0.55)) + (rack.baseHeight || 0) + 0.6;
  labelSprite.position.set(0, totalH, 0);
  group.add(labelSprite);

  // Posición y orientación
  group.position.set(rack.position[0], rack.position[1], rack.position[2]);
  group.rotation.y = rack.rotationY;

  return group;
}

// -------------------------------------------------------------------------------------
// CONSTRUCTOR DEL PLANO DEL ALMACÉN (RECTANGULAR, EN "L", EN "U", ZONAS Y COLUMNAS)
// -------------------------------------------------------------------------------------

export function buildWarehouseFloor(
  width: number,
  length: number,
  roomShape: RoomShape | string = 'RECTANGULAR',
  roomConfig?: RoomConfig,
  zones: FunctionalZone[] = [],
  obstacles: ArchitecturalObstacle[] = []
): THREE.Group {
  const floorGroup = new THREE.Group();

  const floorMat = new THREE.MeshStandardMaterial({
    color: '#0f172a', // Concreto pulido industrial oscuro
    roughness: 0.85,
    metalness: 0.05,
  });

  const borderThickness = 0.35;
  const borderMat = new THREE.MeshBasicMaterial({ color: '#f59e0b' }); // Amarillo señalética

  if (roomShape === 'CUSTOM_GRID' && roomConfig?.customGrid) {
    // ------------------------------------------------------------------
    // PLANO DIBUJADO POR CUADROS (CUSTOM_GRID)
    // ------------------------------------------------------------------
    const { cellSize, cols, rows, cells } = roomConfig.customGrid;
    const gridW = cols * cellSize;
    const gridL = rows * cellSize;
    const startX = -gridW / 2;
    const startZ = -gridL / 2;

    // 1. Suelo para cada tramo activo
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
          const panelMesh = new THREE.Mesh(panelGeo, floorMat);
          panelMesh.rotation.x = -Math.PI / 2;
          panelMesh.position.set(centerX, 0, centerZ);
          panelMesh.receiveShadow = true;
          floorGroup.add(panelMesh);

          cStart = -1;
        }
      }
    }

    // 2. Franjas perimetrales amarillas siguiendo las aristas exteriores del dibujo
    const { segments } = getCustomGridWallSegments(roomConfig.customGrid);
    for (const seg of segments) {
      const dx = seg.p2.x - seg.p1.x;
      const dz = seg.p2.z - seg.p1.z;
      const segLen = Math.hypot(dx, dz);
      const mx = (seg.p1.x + seg.p2.x) / 2;
      const mz = (seg.p1.z + seg.p2.z) / 2;
      const angle = Math.atan2(dz, dx);

      const borderSeg = new THREE.Mesh(
        new THREE.BoxGeometry(segLen, 0.02, borderThickness),
        borderMat
      );
      borderSeg.position.set(mx, 0.012, mz);
      borderSeg.rotation.y = -angle;
      floorGroup.add(borderSeg);
    }
  } else if (roomShape === 'L_SHAPE') {
    // ------------------------------------------------------------------
    // PLANO EN "L": Ala Principal + Recodo según Orientación
    // ------------------------------------------------------------------
    const totalW = width;
    const totalL = length;
    const wingW = Math.min(roomConfig?.wingWidth || Math.round(totalW * 0.45), totalW - 2);
    const wingL = Math.min(roomConfig?.wingLength || Math.round(totalL * 0.45), totalL - 2);
    const orientation = roomConfig?.orientation || 'BOTTOM_LEFT';

    // Vértices 2D en plano mundial (X, Z) centrados en (0,0) con orden CCW en coordenadas cartesianas (X, -Z)
    interface Point2D { x: number; z: number }
    let vertices: Point2D[] = [];

    switch (orientation) {
      case 'BOTTOM_RIGHT':
        vertices = [
          { x: totalW / 2, z: -totalL / 2 },
          { x: totalW / 2 - wingW, z: -totalL / 2 },
          { x: totalW / 2 - wingW, z: totalL / 2 - wingL },
          { x: -totalW / 2, z: totalL / 2 - wingL },
          { x: -totalW / 2, z: totalL / 2 },
          { x: totalW / 2, z: totalL / 2 },
        ];
        break;
      case 'TOP_LEFT':
        vertices = [
          { x: -totalW / 2, z: totalL / 2 },
          { x: -totalW / 2 + wingW, z: totalL / 2 },
          { x: -totalW / 2 + wingW, z: -totalL / 2 + wingL },
          { x: totalW / 2, z: -totalL / 2 + wingL },
          { x: totalW / 2, z: -totalL / 2 },
          { x: -totalW / 2, z: -totalL / 2 },
        ];
        break;
      case 'TOP_RIGHT':
        vertices = [
          { x: totalW / 2, z: totalL / 2 },
          { x: totalW / 2, z: -totalL / 2 },
          { x: -totalW / 2, z: -totalL / 2 },
          { x: -totalW / 2, z: -totalL / 2 + wingL },
          { x: totalW / 2 - wingW, z: -totalL / 2 + wingL },
          { x: totalW / 2 - wingW, z: totalL / 2 },
        ];
        break;
      case 'BOTTOM_LEFT':
      default:
        vertices = [
          { x: -totalW / 2, z: totalL / 2 },
          { x: totalW / 2, z: totalL / 2 },
          { x: totalW / 2, z: totalL / 2 - wingL },
          { x: -totalW / 2 + wingW, z: totalL / 2 - wingL },
          { x: -totalW / 2 + wingW, z: -totalL / 2 },
          { x: -totalW / 2, z: -totalL / 2 },
        ];
        break;
    }

    // Losa única continua mediante THREE.Shape (sin costuras ni solapamientos)
    const floorShape = new THREE.Shape();
    vertices.forEach((v, idx) => {
      // En cartesianas (X, Y) con normal apuntando hacia arriba (+Y en 3D), Y = -Z
      if (idx === 0) {
        floorShape.moveTo(v.x, -v.z);
      } else {
        floorShape.lineTo(v.x, -v.z);
      }
    });
    floorShape.closePath();

    const floorGeo = new THREE.ShapeGeometry(floorShape);
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    floorGroup.add(floorMesh);

    // Cuadrícula métrica sobre el área total
    const maxDim = Math.max(totalW, totalL);
    const grid = new THREE.GridHelper(maxDim, maxDim, 0x38bdf8, 0x1e293b);
    grid.position.y = 0.01;
    floorGroup.add(grid);

    // Franjas perimetrales amarillas siguiendo las 6 aristas del polígono exacto
    for (let i = 0; i < vertices.length; i++) {
      const p1 = vertices[i];
      const p2 = vertices[(i + 1) % vertices.length];
      const dx = p2.x - p1.x;
      const dz = p2.z - p1.z;
      const segLen = Math.sqrt(dx * dx + dz * dz);
      const mx = (p1.x + p2.x) / 2;
      const mz = (p1.z + p2.z) / 2;
      const angle = Math.atan2(dz, dx);

      const borderSeg = new THREE.Mesh(
        new THREE.BoxGeometry(segLen, 0.02, borderThickness),
        borderMat
      );
      borderSeg.position.set(mx, 0.012, mz);
      borderSeg.rotation.y = -angle;
      floorGroup.add(borderSeg);
    }
  } else if (roomShape === 'U_SHAPE') {
    // ------------------------------------------------------------------
    // PLANO EN "U": Showroom con Patio/Corredor Central
    // ------------------------------------------------------------------
    const spineW = width;
    const spineL = length * 0.4;
    const wingW = width * 0.35;
    const wingL = length * 0.6;

    // Espina norte
    const spineGeo = new THREE.PlaneGeometry(spineW, spineL);
    const spineMesh = new THREE.Mesh(spineGeo, floorMat);
    spineMesh.rotation.x = -Math.PI / 2;
    spineMesh.position.set(0, 0, -length / 2 + spineL / 2);
    spineMesh.receiveShadow = true;
    floorGroup.add(spineMesh);

    // Ala izquierda
    const leftGeo = new THREE.PlaneGeometry(wingW, wingL);
    const leftMesh = new THREE.Mesh(leftGeo, floorMat);
    leftMesh.rotation.x = -Math.PI / 2;
    leftMesh.position.set(-width / 2 + wingW / 2, 0, length / 2 - wingL / 2);
    leftMesh.receiveShadow = true;
    floorGroup.add(leftMesh);

    // Ala derecha
    const rightGeo = new THREE.PlaneGeometry(wingW, wingL);
    const rightMesh = new THREE.Mesh(rightGeo, floorMat);
    rightMesh.rotation.x = -Math.PI / 2;
    rightMesh.position.set(width / 2 - wingW / 2, 0, length / 2 - wingL / 2);
    rightMesh.receiveShadow = true;
    floorGroup.add(rightMesh);

    const grid = new THREE.GridHelper(Math.max(width, length), Math.max(width, length), 0x38bdf8, 0x1e293b);
    grid.position.y = 0.01;
    floorGroup.add(grid);

  } else {
    // ------------------------------------------------------------------
    // PLANO RECTANGULAR ESTÁNDAR
    // ------------------------------------------------------------------
    const floorGeo = new THREE.PlaneGeometry(width, length);
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    floorGroup.add(floorMesh);

    const gridHelper = new THREE.GridHelper(Math.max(width, length), Math.max(width, length), 0x38bdf8, 0x334155);
    gridHelper.position.y = 0.01;
    floorGroup.add(gridHelper);

    // Borde Norte y Sur
    const bNorth = new THREE.Mesh(new THREE.BoxGeometry(width, 0.02, borderThickness), borderMat);
    bNorth.position.set(0, 0.01, -length / 2 + borderThickness / 2);
    floorGroup.add(bNorth);

    const bSouth = new THREE.Mesh(new THREE.BoxGeometry(width, 0.02, borderThickness), borderMat);
    bSouth.position.set(0, 0.01, length / 2 - borderThickness / 2);
    floorGroup.add(bSouth);

    // Borde Este y Oeste
    const bEast = new THREE.Mesh(new THREE.BoxGeometry(borderThickness, 0.02, length), borderMat);
    bEast.position.set(width / 2 - borderThickness / 2, 0.01, 0);
    floorGroup.add(bEast);

    const bWest = new THREE.Mesh(new THREE.BoxGeometry(borderThickness, 0.02, length), borderMat);
    bWest.position.set(-width / 2 + borderThickness / 2, 0.01, 0);
    floorGroup.add(bWest);
  }

  // ------------------------------------------------------------------
  // ZONAS FUNCIONALES DEL SUELO (Pintura epóxica + Rótulos)
  // ------------------------------------------------------------------
  zones.forEach(zone => {
    const zoneGeo = new THREE.PlaneGeometry(zone.width, zone.length);
    const zoneMat = new THREE.MeshStandardMaterial({
      color: zone.color,
      transparent: true,
      opacity: 0.22,
      roughness: 0.9,
    });
    const zoneMesh = new THREE.Mesh(zoneGeo, zoneMat);
    zoneMesh.rotation.x = -Math.PI / 2;
    zoneMesh.position.set(zone.position[0], 0.015, zone.position[2]);
    zoneMesh.receiveShadow = true;
    floorGroup.add(zoneMesh);

    // Contorno de la zona
    const borderGeo = new THREE.BoxGeometry(zone.width, 0.018, 0.08);
    const borderZoneMat = new THREE.MeshBasicMaterial({ color: zone.color });

    const nLine = new THREE.Mesh(borderGeo, borderZoneMat);
    nLine.position.set(zone.position[0], 0.016, zone.position[2] - zone.length / 2);
    floorGroup.add(nLine);

    const sLine = new THREE.Mesh(borderGeo, borderZoneMat);
    sLine.position.set(zone.position[0], 0.016, zone.position[2] + zone.length / 2);
    floorGroup.add(sLine);

    // Rótulo de la zona
    const labelSprite = createZoneFloorSprite(zone.name, zone.color);
    labelSprite.position.set(zone.position[0], 0.08, zone.position[2]);
    floorGroup.add(labelSprite);
  });

  // ------------------------------------------------------------------
  // OBSTÁCULOS ARQUITECTÓNICOS (Columnas, Puertas)
  // ------------------------------------------------------------------
  obstacles.forEach(obs => {
    if (obs.type === 'COLUMN') {
      const colGeo = new THREE.BoxGeometry(obs.width, obs.height, obs.length);
      const colMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.7 });
      const colMesh = new THREE.Mesh(colGeo, colMat);
      colMesh.position.set(obs.position[0], obs.height / 2, obs.position[2]);
      colMesh.castShadow = true;
      colMesh.receiveShadow = true;
      floorGroup.add(colMesh);

      // Franja de precaución en la base de la columna
      const stripeMesh = new THREE.Mesh(
        new THREE.BoxGeometry(obs.width + 0.02, 0.45, obs.length + 0.02),
        new THREE.MeshBasicMaterial({ color: '#f59e0b' })
      );
      stripeMesh.position.set(obs.position[0], 0.25, obs.position[2]);
      floorGroup.add(stripeMesh);
    } else if (obs.type === 'DOOR') {
      // Marco de puerta de acceso
      const doorFrame = new THREE.Mesh(
        new THREE.BoxGeometry(obs.width, obs.height, 0.15),
        new THREE.MeshStandardMaterial({ color: '#0284c7', roughness: 0.5 })
      );
      doorFrame.position.set(obs.position[0], obs.height / 2, obs.position[2]);
      floorGroup.add(doorFrame);

      const doorLabel = createZoneFloorSprite('PUERTA ACCESO', '#0284c7');
      doorLabel.position.set(obs.position[0], obs.height + 0.4, obs.position[2]);
      floorGroup.add(doorLabel);
    }
  });

  return floorGroup;
}
