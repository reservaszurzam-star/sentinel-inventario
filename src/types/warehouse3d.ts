export interface RackSlot3D {
  level: number; // 1 = nivel inferior, 2 = nivel medio, etc.
  bay: number;   // 1 = cuerpo izquierdo, 2 = cuerpo central, etc.
  code: string;  // e.g. "RACK-A01-N1-C1"
  locationId?: string; // ID en tabla 'locations'
  productId?: string;  // ID en tabla 'products' (asignación de producto)
  productName?: string;
  productColor?: string;
  productCategory?: string;
  stockUnits: number;
  capacity: number;
}

export type FurnitureType =
  | 'CUBBY'         // Estantería de cubos clásica (como en la foto)
  | 'CORNER_L'      // Estante esquinero en ángulo de 90°
  | 'STEPPED'       // Estante escalonado (escalera / pirámide)
  | 'WORK_TABLE'    // Mesón central de corte y empaque
  | 'CLOTHES_RACK'; // Burro / perchero para prendas en percha

export interface Rack3D {
  id: string;
  brand: string;
  name: string;        // e.g. "RACK A-01"
  aisle: string;       // e.g. "Pasillo 1"
  zone?: string;       // e.g. "Zona Central"
  position: [number, number, number]; // [x, y, z] en metros
  rotationY: number;   // Rotación en radianes (0, Math.PI/2, Math.PI, 3*Math.PI/2)
  bays: number;        // Cuerpos / columnas horizontales (1 a 8)
  levels: number;      // Pisos / baldas de altura (1 a 6)
  bayWidth: number;    // Ancho por cuerpo en metros (default: 0.65m)
  depth: number;       // Profundidad en metros (default: 0.55m)
  levelHeight: number; // Altura entre baldas en metros (default: 0.55m)
  color?: string;      // Color del bastidor (blanco puro, madera blanca, etc.)
  materialType?: 'WHITE_WOOD' | 'NATURAL_WOOD' | 'RUSTIC_WHITE' | 'INDUSTRIAL'; // Tipo de acabado
  boardThickness?: number; // Grosor de las tablas de madera (default: 0.03m)
  hasBackPanel?: boolean;  // Fondo de madera
  baseHeight?: number;    // Altura de zócalo base en metros (ej. 0 o 0.06m)
  furnitureType?: FurnitureType; // Tipo de mueble (default: 'CUBBY')
  secondaryBays?: number; // Cuerpos en el ala secundaria (para CORNER_L)
  stepHeights?: number[]; // Altura de cada columna en niveles (para STEPPED)
  slots: Record<string, RackSlot3D>; // Key: `${level}-${bay}` (ej: "1-1")
  updatedAt: string;
}

export type RoomShape = 'RECTANGULAR' | 'L_SHAPE' | 'U_SHAPE' | 'CUSTOM_GRID';

export interface CustomGridConfig {
  cellSize: number;  // Tamaño en metros de cada cuadro (ej: 1m o 2m)
  cols: number;      // Columnas en X
  rows: number;      // Filas en Z
  cells: number[][]; // [row][col] 1 = suelo activo, 0 = vacío
}

export interface RoomConfig {
  mainWidth?: number;      // Ancho nave principal (m)
  mainLength?: number;     // Largo nave principal (m)
  wingWidth?: number;     // Ancho ala secundaria (m)
  wingLength?: number;    // Largo ala secundaria (m)
  wingSide?: 'LEFT' | 'RIGHT'; // Lado del ala
  orientation?: 'BOTTOM_LEFT' | 'BOTTOM_RIGHT' | 'TOP_LEFT' | 'TOP_RIGHT'; // Orientación del recodo en L
  customGrid?: CustomGridConfig; // Configuración de plano dibujado por cuadros
}

export interface FunctionalZone {
  id: string;
  name: string; // e.g. "Zona Recepción", "Mesa de Packing", "Pasillo Central"
  type: 'RECEIVING' | 'DISPATCH' | 'AISLE' | 'STORAGE' | 'CUSTOM';
  position: [number, number, number]; // [x, y, z] en metros
  width: number;  // en metros
  length: number; // en metros
  color: string;
}

export interface ArchitecturalObstacle {
  id: string;
  type: 'COLUMN' | 'DOOR' | 'WALL';
  position: [number, number, number];
  width: number;
  length: number;
  height: number;
  rotationY?: number;
  label?: string;
}

export interface Warehouse3DLayout {
  brand: string;
  name: string;
  warehouseWidth: number;  // Ancho en metros (e.g. 26m)
  warehouseLength: number; // Largo en metros (e.g. 30m)
  roomShape?: RoomShape;   // 'RECTANGULAR' | 'L_SHAPE' | 'U_SHAPE'
  roomConfig?: RoomConfig;
  zones?: FunctionalZone[];
  obstacles?: ArchitecturalObstacle[];
  racks: Rack3D[];
  updatedAt: string;
}

export type ViewMode3D = 'PRODUCTS' | 'HEATMAP' | 'CATEGORIES';
export type Tool3D = 'SELECT' | 'MOVE' | 'ROTATE' | 'ADD';
export type CameraPreset = 'ISOMETRIC' | 'TOP_DOWN' | 'FRONT' | 'RESET';
