import React, { useState, useMemo } from 'react';
import {
  RoomShape,
  RoomConfig,
  FunctionalZone,
  ArchitecturalObstacle,
  Warehouse3DLayout,
} from '../../types/warehouse3d';
import {
  X,
  Compass,
  Check,
  Sparkles,
  Layers,
  Box,
  Save,
  Maximize2,
  Grid,
  ShieldAlert,
  DoorOpen,
  CornerDownRight,
  SlidersHorizontal,
  Paintbrush,
  Eraser,
  RotateCcw,
  PenTool,
  Square,
  Trash2,
  Minus,
  Plus,
  Ruler,
  Crosshair,
  Undo2,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface RoomConfigModalProps {
  layout: Warehouse3DLayout;
  onClose: () => void;
  onSave: (updatedLayout: Partial<Warehouse3DLayout>) => void;
}

const L_SHAPE_PRESETS = [
  {
    name: 'Taller con Recodo',
    desc: '24m × 20m (Ala 12×10m)',
    width: 24,
    length: 20,
    wingWidth: 12,
    wingLength: 10,
    orientation: 'BOTTOM_LEFT' as const,
  },
  {
    name: 'Local Esquinero',
    desc: '20m × 20m (Ala 10×10m)',
    width: 20,
    length: 20,
    wingWidth: 10,
    wingLength: 10,
    orientation: 'BOTTOM_LEFT' as const,
  },
  {
    name: 'Nave Textil Alargada',
    desc: '30m × 18m (Ala 14×10m)',
    width: 30,
    length: 18,
    wingWidth: 14,
    wingLength: 10,
    orientation: 'BOTTOM_RIGHT' as const,
  },
  {
    name: 'Gran Almacén L',
    desc: '36m × 28m (Ala 18×14m)',
    width: 36,
    length: 28,
    wingWidth: 18,
    wingLength: 14,
    orientation: 'TOP_LEFT' as const,
  },
];

const ORIENTATIONS: {
  id: 'BOTTOM_LEFT' | 'BOTTOM_RIGHT' | 'TOP_LEFT' | 'TOP_RIGHT';
  label: string;
  sub: string;
  iconSymbol: string;
}[] = [
  {
    id: 'BOTTOM_LEFT',
    label: 'Abajo-Izquierda',
    sub: 'Ala al fondo e izquierda',
    iconSymbol: '⮠',
  },
  {
    id: 'BOTTOM_RIGHT',
    label: 'Abajo-Derecha',
    sub: 'Ala al fondo y derecha',
    iconSymbol: '⮡',
  },
  {
    id: 'TOP_LEFT',
    label: 'Arriba-Izquierda',
    sub: 'Ala al frente e izquierda',
    iconSymbol: '⮢',
  },
  {
    id: 'TOP_RIGHT',
    label: 'Arriba-Derecha',
    sub: 'Ala al frente y derecha',
    iconSymbol: '⮣',
  },
];

export const RoomConfigModal: React.FC<RoomConfigModalProps> = ({
  layout,
  onClose,
  onSave,
}) => {
  const [shape, setShape] = useState<RoomShape>(layout.roomShape || 'RECTANGULAR');
  const [width, setWidth] = useState<number>(layout.warehouseWidth || 26);
  const [length, setLength] = useState<number>(layout.warehouseLength || 30);

  // Configuración de alas (para forma en L o U)
  const [wingWidth, setWingWidth] = useState<number>(layout.roomConfig?.wingWidth || 12);
  const [wingLength, setWingLength] = useState<number>(layout.roomConfig?.wingLength || 10);
  const [orientation, setOrientation] = useState<
    'BOTTOM_LEFT' | 'BOTTOM_RIGHT' | 'TOP_LEFT' | 'TOP_RIGHT'
  >(layout.roomConfig?.orientation || 'BOTTOM_LEFT');

  // Zonas funcionales
  const [enableReceiving, setEnableReceiving] = useState<boolean>(
    layout.zones?.some(z => z.type === 'RECEIVING') ?? true
  );
  const [enableDispatch, setEnableDispatch] = useState<boolean>(
    layout.zones?.some(z => z.type === 'DISPATCH') ?? true
  );
  const [enableAisle, setEnableAisle] = useState<boolean>(
    layout.zones?.some(z => z.type === 'AISLE') ?? true
  );

  // Obstáculos
  const [enableColumns, setEnableColumns] = useState<boolean>(
    layout.obstacles?.some(o => o.type === 'COLUMN') ?? false
  );
  const [enableDoor, setEnableDoor] = useState<boolean>(
    layout.obstacles?.some(o => o.type === 'DOOR') ?? true
  );

  // Dimensiones seguras del ala en L
  const safeWingWidth = Math.min(Math.max(wingWidth, 4), width - 3);
  const safeWingLength = Math.min(Math.max(wingLength, 4), length - 3);

  // Configuración de Cuadrícula / Dibujo Libre
  const defaultCellSize = layout.roomConfig?.customGrid?.cellSize || 2;
  const initialCols = layout.roomConfig?.customGrid?.cols || Math.max(8, Math.min(24, Math.round(width / defaultCellSize)));
  const initialRows = layout.roomConfig?.customGrid?.rows || Math.max(8, Math.min(24, Math.round(length / defaultCellSize)));

  const [gridCellSize, setGridCellSize] = useState<number>(defaultCellSize);
  const [gridCols, setGridCols] = useState<number>(initialCols);
  const [gridRows, setGridRows] = useState<number>(initialRows);

  const [cells, setCells] = useState<number[][]>(() => {
    if (layout.roomConfig?.customGrid?.cells) {
      return layout.roomConfig.customGrid.cells;
    }
    const arr: number[][] = [];
    for (let r = 0; r < initialRows; r++) {
      const row: number[] = [];
      for (let c = 0; c < initialCols; c++) {
        row.push(1);
      }
      arr.push(row);
    }
    return arr;
  });

  const [drawTool, setDrawTool] = useState<'PAINT' | 'ERASE'>('PAINT');
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [hoveredCell, setHoveredCell] = useState<{ r: number; c: number } | null>(null);

  const resizeGrid = (newCols: number, newRows: number) => {
    setGridCols(newCols);
    setGridRows(newRows);
    setCells(prev => {
      const next: number[][] = [];
      for (let r = 0; r < newRows; r++) {
        const row: number[] = [];
        for (let c = 0; c < newCols; c++) {
          row.push(prev[r] && prev[r][c] !== undefined ? prev[r][c] : 1);
        }
        next.push(row);
      }
      return next;
    });
  };

  const setCellState = (r: number, c: number, state: number) => {
    setCells(prev => {
      if (prev[r] && prev[r][c] === state) return prev;
      const copy = prev.map(row => [...row]);
      if (copy[r]) {
        copy[r][c] = state;
      }
      return copy;
    });
  };

  const handleCellPointerDown = (r: number, c: number) => {
    setIsDrawing(true);
    const targetState = drawTool === 'PAINT' ? 1 : 0;
    setCellState(r, c, targetState);
  };

  const handleCellPointerEnter = (r: number, c: number) => {
    setHoveredCell({ r, c });
    if (!isDrawing) return;
    const targetState = drawTool === 'PAINT' ? 1 : 0;
    setCellState(r, c, targetState);
  };

  const fillAllCells = () => {
    setCells(Array.from({ length: gridRows }, () => Array(gridCols).fill(1)));
  };

  const clearAllCells = () => {
    setCells(Array.from({ length: gridRows }, () => Array(gridCols).fill(0)));
  };

  const invertAllCells = () => {
    setCells(prev => prev.map(row => row.map(c => (c === 1 ? 0 : 1))));
  };

  const applyCustomLPreset = () => {
    const cutoffRow = Math.round(gridRows * 0.45);
    const cutoffCol = Math.round(gridCols * 0.45);
    setCells(
      Array.from({ length: gridRows }, (_, r) =>
        Array.from({ length: gridCols }, (_, c) => {
          if (r < cutoffRow && c >= cutoffCol) return 0;
          return 1;
        })
      )
    );
  };

  const applyCustomUPreset = () => {
    const spineRow = Math.round(gridRows * 0.4);
    const leftCol = Math.round(gridCols * 0.35);
    const rightCol = gridCols - leftCol;
    setCells(
      Array.from({ length: gridRows }, (_, r) =>
        Array.from({ length: gridCols }, (_, c) => {
          if (r >= spineRow && c >= leftCol && c < rightCol) return 0;
          return 1;
        })
      )
    );
  };

  const applyCustomTPreset = () => {
    const topRows = Math.round(gridRows * 0.35);
    const stemLeft = Math.round(gridCols * 0.3);
    const stemRight = gridCols - stemLeft;
    setCells(
      Array.from({ length: gridRows }, (_, r) =>
        Array.from({ length: gridCols }, (_, c) => {
          if (r >= topRows && (c < stemLeft || c >= stemRight)) return 0;
          return 1;
        })
      )
    );
  };

  const activeCellCount = useMemo(() => {
    return cells.reduce((acc, row) => acc + row.filter(c => c === 1).length, 0);
  }, [cells]);

  const customGridAreaM2 = useMemo(() => {
    return activeCellCount * gridCellSize * gridCellSize;
  }, [activeCellCount, gridCellSize]);

  const perimeterLinearMeters = useMemo(() => {
    let edges = 0;
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        if (cells[r]?.[c] === 1) {
          if (!cells[r - 1] || cells[r - 1][c] !== 1) edges++;
          if (!cells[r + 1] || cells[r + 1][c] !== 1) edges++;
          if (cells[r][c - 1] !== 1) edges++;
          if (cells[r][c + 1] !== 1) edges++;
        }
      }
    }
    return edges * gridCellSize;
  }, [cells, gridRows, gridCols, gridCellSize]);

  // Cálculo dinámico de la superficie útil (m²)
  const totalAreaM2 = useMemo(() => {
    if (shape === 'CUSTOM_GRID') {
      return customGridAreaM2;
    }
    if (shape === 'L_SHAPE') {
      return width * length - (width - safeWingWidth) * (length - safeWingLength);
    }
    if (shape === 'U_SHAPE') {
      return Math.round(width * (length * 0.4) + 2 * (width * 0.35) * (length * 0.6));
    }
    return width * length;
  }, [shape, width, length, safeWingWidth, safeWingLength, customGridAreaM2]);

  const applyLPreset = (p: (typeof L_SHAPE_PRESETS)[0]) => {
    setWidth(p.width);
    setLength(p.length);
    setWingWidth(p.wingWidth);
    setWingLength(p.wingLength);
    setOrientation(p.orientation);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const zones: FunctionalZone[] = [];
    if (enableReceiving) {
      zones.push({
        id: 'zone-recv',
        name: 'Recepción de Mercadería',
        type: 'RECEIVING',
        position: [-width / 3, 0, -length / 3],
        width: 8,
        length: 5,
        color: '#0284c7',
      });
    }
    if (enableDispatch) {
      zones.push({
        id: 'zone-disp',
        name: 'Despacho & Packing',
        type: 'DISPATCH',
        position: [width / 3, 0, -length / 3],
        width: 8,
        length: 5,
        color: '#f97316',
      });
    }
    if (enableAisle) {
      zones.push({
        id: 'zone-aisle',
        name: 'Pasillo Central',
        type: 'AISLE',
        position: [0, 0, 0],
        width: 3.5,
        length: length - 4,
        color: '#10b981',
      });
    }

    const obstacles: ArchitecturalObstacle[] = [];
    if (enableColumns) {
      obstacles.push(
        {
          id: 'col-1',
          type: 'COLUMN',
          position: [-width / 4, 0, 0],
          width: 0.6,
          length: 0.6,
          height: 4.5,
          label: 'Pilar C-1',
        },
        {
          id: 'col-2',
          type: 'COLUMN',
          position: [width / 4, 0, 0],
          width: 0.6,
          length: 0.6,
          height: 4.5,
          label: 'Pilar C-2',
        }
      );
    }
    if (enableDoor) {
      obstacles.push({
        id: 'door-main',
        type: 'DOOR',
        position: [0, 0, -length / 2 + 0.1],
        width: 3.0,
        length: 0.2,
        height: 2.8,
        label: 'Acceso Principal',
      });
    }

    const finalWidth = shape === 'CUSTOM_GRID' ? gridCols * gridCellSize : width;
    const finalLength = shape === 'CUSTOM_GRID' ? gridRows * gridCellSize : length;

    const roomConfig: RoomConfig = {
      mainWidth: finalWidth,
      mainLength: finalLength,
      wingWidth: safeWingWidth,
      wingLength: safeWingLength,
      wingSide: 'LEFT',
      orientation,
      customGrid:
        shape === 'CUSTOM_GRID'
          ? {
              cellSize: gridCellSize,
              cols: gridCols,
              rows: gridRows,
              cells,
            }
          : undefined,
    };

    onSave({
      warehouseWidth: finalWidth,
      warehouseLength: finalLength,
      roomShape: shape,
      roomConfig,
      zones,
      obstacles,
    });

    onClose();
  };

  // Renderizador SVG reactivo del plano en L con las 6 paredes y cotas numéricas
  const renderLBlueprint = () => {
    const padX = 40;
    const padY = 32;
    const availW = 260;
    const availH = 150;
    const scale = Math.min(availW / width, availH / length);
    const drawW = width * scale;
    const drawL = length * scale;
    const startX = padX + (availW - drawW) / 2;
    const startY = padY + (availH - drawL) / 2;
    const drawWingW = safeWingWidth * scale;
    const drawWingL = safeWingLength * scale;

    interface SvgWall {
      lengthM: number;
      labelPos: { x: number; y: number };
    }

    let points: [number, number][] = [];
    let walls: SvgWall[] = [];

    switch (orientation) {
      case 'BOTTOM_RIGHT':
        points = [
          [startX + drawW - drawWingW, startY],
          [startX + drawW, startY],
          [startX + drawW, startY + drawL],
          [startX, startY + drawL],
          [startX, startY + drawL - drawWingL],
          [startX + drawW - drawWingW, startY + drawL - drawWingL],
        ];
        walls = [
          { lengthM: safeWingWidth, labelPos: { x: (points[0][0] + points[1][0]) / 2, y: startY - 12 } },
          { lengthM: length, labelPos: { x: startX + drawW + 18, y: startY + drawL / 2 } },
          { lengthM: width, labelPos: { x: startX + drawW / 2, y: startY + drawL + 15 } },
          { lengthM: safeWingLength, labelPos: { x: startX - 18, y: startY + drawL - drawWingL / 2 } },
          { lengthM: width - safeWingWidth, labelPos: { x: (points[4][0] + points[5][0]) / 2, y: points[4][1] - 10 } },
          { lengthM: length - safeWingLength, labelPos: { x: points[5][0] - 18, y: (points[5][1] + points[0][1]) / 2 } },
        ];
        break;
      case 'TOP_LEFT':
        points = [
          [startX, startY],
          [startX + drawW, startY],
          [startX + drawW, startY + drawWingL],
          [startX + drawWingW, startY + drawWingL],
          [startX + drawWingW, startY + drawL],
          [startX, startY + drawL],
        ];
        walls = [
          { lengthM: width, labelPos: { x: startX + drawW / 2, y: startY - 12 } },
          { lengthM: safeWingLength, labelPos: { x: startX + drawW + 18, y: startY + drawWingL / 2 } },
          { lengthM: width - safeWingWidth, labelPos: { x: (points[2][0] + points[3][0]) / 2, y: points[2][1] + 14 } },
          { lengthM: length - safeWingLength, labelPos: { x: points[3][0] + 18, y: (points[3][1] + points[4][1]) / 2 } },
          { lengthM: safeWingWidth, labelPos: { x: (points[4][0] + points[5][0]) / 2, y: startY + drawL + 15 } },
          { lengthM: length, labelPos: { x: startX - 18, y: startY + drawL / 2 } },
        ];
        break;
      case 'TOP_RIGHT':
        points = [
          [startX, startY],
          [startX + drawW, startY],
          [startX + drawW, startY + drawL],
          [startX + drawW - drawWingW, startY + drawL],
          [startX + drawW - drawWingW, startY + drawWingL],
          [startX, startY + drawWingL],
        ];
        walls = [
          { lengthM: width, labelPos: { x: startX + drawW / 2, y: startY - 12 } },
          { lengthM: length, labelPos: { x: startX + drawW + 18, y: startY + drawL / 2 } },
          { lengthM: safeWingWidth, labelPos: { x: (points[2][0] + points[3][0]) / 2, y: startY + drawL + 15 } },
          { lengthM: length - safeWingLength, labelPos: { x: points[3][0] - 18, y: (points[3][1] + points[4][1]) / 2 } },
          { lengthM: width - safeWingWidth, labelPos: { x: (points[4][0] + points[5][0]) / 2, y: points[4][1] + 14 } },
          { lengthM: safeWingLength, labelPos: { x: startX - 18, y: startY + drawWingL / 2 } },
        ];
        break;
      case 'BOTTOM_LEFT':
      default:
        points = [
          [startX, startY],
          [startX + drawWingW, startY],
          [startX + drawWingW, startY + drawL - drawWingL],
          [startX + drawW, startY + drawL - drawWingL],
          [startX + drawW, startY + drawL],
          [startX, startY + drawL],
        ];
        walls = [
          { lengthM: safeWingWidth, labelPos: { x: (points[0][0] + points[1][0]) / 2, y: startY - 12 } },
          { lengthM: length - safeWingLength, labelPos: { x: points[1][0] + 18, y: (points[1][1] + points[2][1]) / 2 } },
          { lengthM: width - safeWingWidth, labelPos: { x: (points[2][0] + points[3][0]) / 2, y: points[2][1] - 10 } },
          { lengthM: safeWingLength, labelPos: { x: startX + drawW + 18, y: startY + drawL - drawWingL / 2 } },
          { lengthM: width, labelPos: { x: startX + drawW / 2, y: startY + drawL + 15 } },
          { lengthM: length, labelPos: { x: startX - 18, y: startY + drawL / 2 } },
        ];
        break;
    }

    const polygonPointsStr = points.map(p => `${Math.round(p[0])},${Math.round(p[1])}`).join(' ');

    return (
      <g>
        {/* Polígono relleno con reborde perimetral ambar */}
        <polygon
          points={polygonPointsStr}
          fill="#0a0f1d"
          stroke="#f59e0b"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Vértices destacados */}
        {points.map((p, i) => (
          <circle key={`pt-${i}`} cx={p[0]} cy={p[1]} r="3" fill="#f59e0b" />
        ))}

        {/* Rótulos con medidas métricas en cada pared */}
        {walls.map((w, i) => (
          <g key={`w-${i}`}>
            <rect
              x={w.labelPos.x - 14}
              y={w.labelPos.y - 7}
              width="28"
              height="14"
              rx="3"
              fill="#090d16"
              stroke="#334155"
              strokeWidth="0.8"
            />
            <text
              x={w.labelPos.x}
              y={w.labelPos.y + 3.5}
              fill="#38bdf8"
              fontSize="9"
              fontFamily="monospace"
              textAnchor="middle"
              fontWeight="bold"
            >
              {w.lengthM}m
            </text>
          </g>
        ))}
      </g>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div
        className="w-full max-w-5xl rounded-3xl border shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-150 my-auto text-slate-100"
        style={{
          backgroundColor: '#0f172a',
          borderColor: '#334155',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-5 border-b"
          style={{ borderColor: '#1e293b', backgroundColor: '#111c33' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/40 flex items-center justify-center shadow-md">
              <Compass size={24} />
            </div>
            <div>
              <h2 className="font-mono font-black text-base uppercase tracking-tight text-white flex items-center gap-2">
                Configurar Plano Arquitectónico del Almacén
              </h2>
              <span className="font-mono text-xs text-slate-400">
                Personaliza la forma física del local (L, U, Rectángulo), orientación, medidas métricas y áreas
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="flex flex-col p-5 gap-5 max-h-[80vh] overflow-y-auto">
          {/* 1. Selector de Forma del Plano */}
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
              <Grid size={15} /> 1. Forma Física de la Habitación / Local
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => setShape('RECTANGULAR')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                  shape === 'RECTANGULAR'
                    ? 'bg-sky-500/20 border-sky-400 ring-1 ring-sky-400'
                    : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black text-white">Plano Rectangular</span>
                  {shape === 'RECTANGULAR' && <Check size={16} className="text-sky-400" />}
                </div>
                <span className="font-mono text-[10px] text-slate-400">
                  Formato estándar limpio para almacén continuo o nave industrial abierta.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShape('L_SHAPE')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                  shape === 'L_SHAPE'
                    ? 'bg-sky-500/20 border-sky-400 ring-1 ring-sky-400'
                    : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black text-white">Plano en Forma "L"</span>
                  {shape === 'L_SHAPE' && <Check size={16} className="text-sky-400" />}
                </div>
                <span className="font-mono text-[10px] text-slate-400">
                  Nave con recodo o ala lateral para talleres textiles, rincones o recepción anexa.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShape('U_SHAPE')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                  shape === 'U_SHAPE'
                    ? 'bg-sky-500/20 border-sky-400 ring-1 ring-sky-400'
                    : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black text-white">Plano en Forma "U"</span>
                  {shape === 'U_SHAPE' && <Check size={16} className="text-sky-400" />}
                </div>
                <span className="font-mono text-[10px] text-slate-400">
                  Dos alas perimetrales conectadas con patio o pasillo central abierto tipo showroom.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShape('CUSTOM_GRID')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                  shape === 'CUSTOM_GRID'
                    ? 'bg-amber-500/20 border-amber-400 ring-1 ring-amber-400'
                    : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black text-amber-400 flex items-center gap-1">
                    <PenTool size={14} /> Dibujo por Cuadros ⭐
                  </span>
                  {shape === 'CUSTOM_GRID' && <Check size={16} className="text-amber-400" />}
                </div>
                <span className="font-mono text-[10px] text-slate-400">
                  ¡Dibuja libremente presionando o arrastrando sobre los cuadros del suelo!
                </span>
              </button>
            </div>
          </div>

          {/* Plantillas Rápidas para Plano en L */}
          {shape === 'L_SHAPE' && (
            <div
              className="p-3.5 rounded-2xl border flex flex-col gap-2.5"
              style={{ backgroundColor: '#131e36', borderColor: '#334155' }}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={14} /> Plantillas Rápidas en "L" (1 Clic)
                </span>
                <span className="font-mono text-[10px] text-slate-400">Carga medidas recomendadas</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {L_SHAPE_PRESETS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => applyLPreset(p)}
                    className="p-2.5 rounded-xl border border-slate-700/80 bg-slate-900/80 hover:bg-sky-950/50 hover:border-sky-500/60 transition-all text-left cursor-pointer flex flex-col gap-0.5"
                  >
                    <span className="font-mono text-[11px] font-bold text-white leading-tight">{p.name}</span>
                    <span className="font-mono text-[9px] text-sky-400">{p.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* LIENZO INTERACTIVO: DIBUJO ARQUITECTÓNICO POR CUADRÍCULA (CAD 2D) */}
          {shape === 'CUSTOM_GRID' && (
            <div
              className="p-4 rounded-2xl border flex flex-col gap-4 animate-in fade-in duration-200"
              style={{ backgroundColor: '#0d1527', borderColor: '#1e293b' }}
              onPointerUp={() => setIsDrawing(false)}
              onPointerLeave={() => {
                setIsDrawing(false);
                setHoveredCell(null);
              }}
            >
              {/* Encabezado y Métricas Técnicas */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold shadow-sm">
                    <PenTool size={18} />
                  </div>
                  <div>
                    <h3 className="font-mono text-xs font-black text-white uppercase tracking-tight flex items-center gap-2">
                      <span>Diseñador Técnico de Planta</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 font-bold border border-amber-500/30">
                        CAD 2D
                      </span>
                    </h3>
                    <p className="font-mono text-[10px] text-slate-400">
                      Arrastra o haz clic sobre los cuadros para modelar la forma perimetral del almacén
                    </p>
                  </div>
                </div>

                {/* Métricas en vivo del plano */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-950/80 border border-slate-800 font-mono text-xs shadow-xs">
                    <span className="text-slate-400 text-[11px]">Superficie:</span>
                    <strong className="text-emerald-400 font-black">{customGridAreaM2} m²</strong>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-950/80 border border-slate-800 font-mono text-xs shadow-xs">
                    <span className="text-slate-400 text-[11px]">Muros Perímetro:</span>
                    <strong className="text-amber-400 font-black">{perimeterLinearMeters} m</strong>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-950/80 border border-slate-800 font-mono text-xs shadow-xs">
                    <span className="text-slate-400 text-[11px]">Dimensiones:</span>
                    <strong className="text-sky-400 font-black">{gridCols * gridCellSize}m × {gridRows * gridCellSize}m</strong>
                  </div>
                </div>
              </div>

              {/* Barra de Herramientas: Pincel, Borrador, Presets y Ajuste de Resolución */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/90 p-2.5 rounded-xl border border-slate-800/80 shadow-md">
                {/* Herramientas de Dibujo (Pintar vs Borrar) */}
                <div className="flex items-center p-0.5 rounded-lg bg-slate-900 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setDrawTool('PAINT')}
                    className={cn(
                      'px-3 py-1.5 rounded-md font-mono text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer',
                      drawTool === 'PAINT'
                        ? 'bg-sky-600 text-white shadow-md ring-1 ring-sky-400'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    )}
                  >
                    <Paintbrush size={14} className={drawTool === 'PAINT' ? 'text-white' : 'text-sky-400'} />
                    <span>Pintar Suelo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawTool('ERASE')}
                    className={cn(
                      'px-3 py-1.5 rounded-md font-mono text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer',
                      drawTool === 'ERASE'
                        ? 'bg-amber-600 text-white shadow-md ring-1 ring-amber-400'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    )}
                  >
                    <Eraser size={14} className={drawTool === 'ERASE' ? 'text-white' : 'text-amber-400'} />
                    <span>Borrador (Vaciar)</span>
                  </button>
                </div>

                {/* Plantillas Rápidas */}
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="font-mono text-[10px] text-slate-500 uppercase mr-1 hidden sm:inline">Plantillas:</span>
                  <button
                    type="button"
                    onClick={fillAllCells}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 font-mono text-[11px] font-bold cursor-pointer transition-colors shadow-xs"
                    title="Llenar toda la cuadrícula"
                  >
                    Todo Suelo
                  </button>
                  <button
                    type="button"
                    onClick={applyCustomLPreset}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 font-mono text-[11px] font-bold cursor-pointer transition-colors shadow-xs"
                    title="Cargar forma en L"
                  >
                    Forma L
                  </button>
                  <button
                    type="button"
                    onClick={applyCustomUPreset}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 font-mono text-[11px] font-bold cursor-pointer transition-colors shadow-xs"
                    title="Cargar forma en U"
                  >
                    Forma U
                  </button>
                  <button
                    type="button"
                    onClick={applyCustomTPreset}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 font-mono text-[11px] font-bold cursor-pointer transition-colors shadow-xs"
                    title="Cargar forma en T"
                  >
                    Forma T
                  </button>
                  <button
                    type="button"
                    onClick={invertAllCells}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 font-mono text-[11px] font-bold cursor-pointer transition-colors shadow-xs"
                    title="Invertir suelo y vacío"
                  >
                    Invertir
                  </button>
                  <button
                    type="button"
                    onClick={clearAllCells}
                    className="px-2.5 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 text-red-300 hover:text-white font-mono text-[11px] font-bold cursor-pointer transition-colors flex items-center gap-1 shadow-xs"
                    title="Vaciar tablero para empezar de cero"
                  >
                    <Trash2 size={12} /> Limpiar
                  </button>
                </div>

                {/* Tamaño de Celda */}
                <div className="flex items-center gap-1.5 p-0.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono">
                  <span className="px-2 text-slate-500 font-bold text-[10px]">CELDA:</span>
                  <button
                    type="button"
                    onClick={() => setGridCellSize(1)}
                    className={cn(
                      'px-2 py-1 rounded cursor-pointer font-bold transition-all',
                      gridCellSize === 1 ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                    )}
                  >
                    1m × 1m
                  </button>
                  <button
                    type="button"
                    onClick={() => setGridCellSize(2)}
                    className={cn(
                      'px-2 py-1 rounded cursor-pointer font-bold transition-all',
                      gridCellSize === 2 ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                    )}
                  >
                    2m × 2m
                  </button>
                </div>
              </div>

              {/* Controles de Dimensiones (Columnas X y Filas Z con Steppers) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-slate-300 font-bold">Ancho del Galpón (Eje X):</span>
                    <span className="text-sky-400 font-black px-2 py-0.5 rounded bg-sky-950/80 border border-sky-800/80">
                      {gridCols * gridCellSize}m <span className="text-slate-400 font-normal">({gridCols} cuadros)</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => resizeGrid(Math.max(8, gridCols - 1), gridRows)}
                      disabled={gridCols <= 8}
                      className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-30 border border-slate-700 flex items-center justify-center font-mono font-bold text-slate-200 cursor-pointer shadow-xs"
                      title="Reducir 1 columna"
                    >
                      <Minus size={13} />
                    </button>
                    <input
                      type="range"
                      min={8}
                      max={26}
                      step={1}
                      value={gridCols}
                      onChange={e => resizeGrid(Number(e.target.value), gridRows)}
                      className="flex-1 accent-sky-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => resizeGrid(Math.min(26, gridCols + 1), gridRows)}
                      disabled={gridCols >= 26}
                      className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-30 border border-slate-700 flex items-center justify-center font-mono font-bold text-slate-200 cursor-pointer shadow-xs"
                      title="Aumentar 1 columna"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-slate-300 font-bold">Largo del Galpón (Eje Z):</span>
                    <span className="text-sky-400 font-black px-2 py-0.5 rounded bg-sky-950/80 border border-sky-800/80">
                      {gridRows * gridCellSize}m <span className="text-slate-400 font-normal">({gridRows} cuadros)</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => resizeGrid(gridCols, Math.max(8, gridRows - 1))}
                      disabled={gridRows <= 8}
                      className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-30 border border-slate-700 flex items-center justify-center font-mono font-bold text-slate-200 cursor-pointer shadow-xs"
                      title="Reducir 1 fila"
                    >
                      <Minus size={13} />
                    </button>
                    <input
                      type="range"
                      min={8}
                      max={26}
                      step={1}
                      value={gridRows}
                      onChange={e => resizeGrid(gridCols, Number(e.target.value))}
                      className="flex-1 accent-sky-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => resizeGrid(gridCols, Math.min(26, gridRows + 1))}
                      disabled={gridRows >= 26}
                      className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-30 border border-slate-700 flex items-center justify-center font-mono font-bold text-slate-200 cursor-pointer shadow-xs"
                      title="Aumentar 1 fila"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              </div>

              {/* El Tablero Gráfico Técnico de Celdas (CAD Floorplan Canvas) */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col items-center select-none shadow-2xl relative overflow-x-auto">
                {/* Regla Métrica Superior (X) */}
                <div
                  className="flex font-mono text-[9px] text-slate-500 mb-1 select-none pl-6"
                  style={{ width: 'fit-content' }}
                >
                  {Array.from({ length: gridCols }, (_, c) => (
                    <div
                      key={`ruler-col-${c}`}
                      className="w-6 sm:w-7 md:w-8 text-center truncate"
                      title={`Columna ${c + 1} (${c * gridCellSize}m)`}
                    >
                      {c === 0 ? '0' : c % 2 === 0 ? `${c * gridCellSize}m` : '·'}
                    </div>
                  ))}
                </div>

                <div className="flex select-none">
                  {/* Regla Métrica Lateral (Z) */}
                  <div className="flex flex-col font-mono text-[9px] text-slate-500 mr-1.5 select-none pr-1">
                    {Array.from({ length: gridRows }, (_, r) => (
                      <div
                        key={`ruler-row-${r}`}
                        className="h-6 sm:h-7 md:h-8 flex items-center justify-end"
                        title={`Fila ${r + 1} (${r * gridCellSize}m)`}
                      >
                        {r === 0 ? '0' : r % 2 === 0 ? `${r * gridCellSize}m` : '·'}
                      </div>
                    ))}
                  </div>

                  {/* Cuadrícula Arquitectónica */}
                  <div
                    className="grid gap-[1px] p-2 bg-slate-900/90 rounded-xl shadow-2xl border border-slate-800/90"
                    style={{
                      gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
                      width: 'fit-content',
                    }}
                  >
                    {cells.map((row, r) =>
                      row.map((cell, c) => {
                        const isActive = cell === 1;
                        const isTopWall = isActive && (r === 0 || cells[r - 1]?.[c] !== 1);
                        const isBottomWall = isActive && (r === gridRows - 1 || cells[r + 1]?.[c] !== 1);
                        const isLeftWall = isActive && (c === 0 || cells[r]?.[c - 1] !== 1);
                        const isRightWall = isActive && (c === gridCols - 1 || cells[r]?.[c + 1] !== 1);
                        const isPerimeter = isTopWall || isBottomWall || isLeftWall || isRightWall;

                        return (
                          <div
                            key={`${r}-${c}`}
                            onPointerDown={e => {
                              e.preventDefault();
                              handleCellPointerDown(r, c);
                            }}
                            onPointerEnter={() => handleCellPointerEnter(r, c)}
                            className={cn(
                              'w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-sm cursor-pointer transition-all duration-75 flex items-center justify-center font-mono text-[10px] relative',
                              isActive
                                ? 'bg-gradient-to-br from-sky-950/80 via-slate-900 to-slate-900/95 text-sky-400 hover:brightness-125'
                                : 'bg-slate-950/90 text-slate-800 hover:bg-slate-900/60',
                              // Muros perimetrales destacados en ámbar dorado
                              isTopWall && 'border-t-2 border-t-amber-400',
                              isBottomWall && 'border-b-2 border-b-amber-400',
                              isLeftWall && 'border-l-2 border-l-amber-400',
                              isRightWall && 'border-r-2 border-r-amber-400',
                              // Bordes interiores suaves
                              !isTopWall && isActive && 'border-t border-t-sky-900/30',
                              !isBottomWall && isActive && 'border-b border-b-sky-900/30',
                              !isLeftWall && isActive && 'border-l border-l-sky-900/30',
                              !isRightWall && isActive && 'border-r border-r-sky-900/30',
                              !isActive && 'border border-slate-900/80'
                            )}
                            title={`Cuadro [${c + 1}, ${r + 1}] • X: ${c * gridCellSize}m, Z: ${r * gridCellSize}m • ${
                              isActive ? (isPerimeter ? 'Muro Perimetral Exterior' : 'Piso Interior Activo') : 'Vacío (Espacio Exterior)'
                            }`}
                          >
                            {isActive ? (
                              <span className="opacity-30 text-[8px] font-sans font-black select-none pointer-events-none">
                                +
                              </span>
                            ) : (
                              <span className="opacity-15 text-[7px] font-mono select-none pointer-events-none">
                                ·
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Leyenda y Coordenadas en Vivo */}
                <div className="flex flex-wrap items-center justify-between gap-3 w-full mt-3 pt-2.5 border-t border-slate-900 text-[11px] font-mono">
                  <div className="flex items-center gap-4 flex-wrap text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3.5 h-3.5 rounded bg-sky-950 border-2 border-amber-400" />
                      <span className="text-amber-300 font-bold">Línea Ámbar = Muro Perimetral 3D</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3.5 h-3.5 rounded bg-slate-900 border border-sky-900/40" />
                      <span>Azul Obscuro = Piso Interior</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3.5 h-3.5 rounded bg-slate-950 border border-slate-800" />
                      <span>Negro = Exterior / Vacío</span>
                    </div>
                  </div>

                  {/* Coordenada bajo cursor */}
                  <div className="text-slate-400 font-mono text-[10px] bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
                    {hoveredCell ? (
                      <span>
                        🎯 Cursor: Col <strong className="text-sky-300">{hoveredCell.c + 1}</strong> (X: {hoveredCell.c * gridCellSize}m), Fila <strong className="text-sky-300">{hoveredCell.r + 1}</strong> (Z: {hoveredCell.r * gridCellSize}m) •{' '}
                        <strong className={cells[hoveredCell.r]?.[hoveredCell.c] === 1 ? 'text-emerald-400' : 'text-slate-500'}>
                          {cells[hoveredCell.r]?.[hoveredCell.c] === 1 ? 'Piso Activo' : 'Exterior'}
                        </strong>
                      </span>
                    ) : (
                      <span>Pasa el cursor sobre la cuadrícula para ver cotas en metros</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {shape !== 'CUSTOM_GRID' && (
            <>
              {/* 2. Visualizador Esquemático 2D del Plano en Vivo */}
              <div
                className="p-4 rounded-2xl border flex flex-col gap-2"
                style={{ backgroundColor: '#131e36', borderColor: '#334155' }}
              >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Compass size={14} className="text-sky-400" /> Esquema Arquitectónico 2D (Cotas en Metros)
              </span>
              <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold">
                Área Útil: ~{totalAreaM2} m²
              </span>
            </div>

            <div className="relative flex items-center justify-center p-3 rounded-xl bg-slate-950 border border-slate-800 min-h-[190px]">
              <svg className="w-full max-w-[340px] h-auto drop-shadow-md select-none" viewBox="0 0 340 215">
                {/* Cuadrícula técnica de fondo */}
                <defs>
                  <pattern id="roomGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="340" height="215" fill="url(#roomGrid)" />

                {shape === 'RECTANGULAR' && (
                  <g>
                    <rect x="40" y="30" width="260" height="150" fill="#0a0f1d" stroke="#f59e0b" strokeWidth="2.5" rx="2" />
                    {/* Dimensiones */}
                    <text x="170" y="20" fill="#38bdf8" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                      {width} m (Frente)
                    </text>
                    <text x="315" y="105" fill="#38bdf8" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold" transform="rotate(90 315 105)">
                      {length} m (Fondo)
                    </text>
                    <text x="170" y="110" fill="#94a3b8" fontSize="11" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                      {width}m × {length}m
                    </text>
                  </g>
                )}

                {shape === 'L_SHAPE' && renderLBlueprint()}

                {shape === 'U_SHAPE' && (
                  <g>
                    <polygon
                      points="40,30 300,30 300,185 220,185 220,95 120,95 120,185 40,185"
                      fill="#0a0f1d"
                      stroke="#f59e0b"
                      strokeWidth="2.5"
                    />
                    <text x="170" y="20" fill="#38bdf8" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                      Espina: {width}m
                    </text>
                    <text x="170" y="145" fill="#10b981" fontSize="9" fontFamily="monospace" textAnchor="middle">
                      Patio / Corredor Central
                    </text>
                  </g>
                )}

                {/* Zonas representativas */}
                {enableReceiving && (
                  <rect x="50" y="40" width="45" height="28" fill="#0284c7" opacity="0.45" stroke="#0284c7" rx="2" />
                )}
                {enableDispatch && (
                  <rect x="245" y="40" width="45" height="28" fill="#f97316" opacity="0.45" stroke="#f97316" rx="2" />
                )}
                {enableColumns && (
                  <g>
                    <rect x="90" y="80" width="7" height="7" fill="#f59e0b" />
                    <rect x="230" y="80" width="7" height="7" fill="#f59e0b" />
                  </g>
                )}
              </svg>
            </div>
          </div>

          {/* 3. Selector de Orientación del Recodo (exclusivo para L_SHAPE) */}
          {shape === 'L_SHAPE' && (
            <div
              className="p-4 rounded-2xl border flex flex-col gap-3"
              style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <CornerDownRight size={15} /> 2. Orientación del Recodo en "L"
                </span>
                <span className="font-mono text-[10px] text-slate-400">¿Hacia dónde gira el local?</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {ORIENTATIONS.map(ori => {
                  const isSelected = orientation === ori.id;
                  return (
                    <button
                      key={ori.id}
                      type="button"
                      onClick={() => setOrientation(ori.id)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                        isSelected
                          ? 'bg-amber-500/20 border-amber-400 ring-1 ring-amber-400 text-white'
                          : 'bg-slate-900/60 border-slate-700/80 hover:border-slate-500 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-lg leading-none font-bold text-amber-400">{ori.iconSymbol}</span>
                        {isSelected && <Check size={14} className="text-amber-400" />}
                      </div>
                      <span className="font-mono text-xs font-bold">{ori.label}</span>
                      <span className="font-mono text-[9px] text-slate-400 leading-tight">{ori.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Dimensiones Reales en Metros */}
          <div
            className="p-4 rounded-2xl border flex flex-col gap-3"
            style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
          >
            <span className="font-mono text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
              <Maximize2 size={14} /> {shape === 'L_SHAPE' ? '3.' : '2.'} Dimensiones Métricas de la Sala
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5 bg-slate-900/60 p-3 rounded-xl border border-slate-700/60">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-300">Ancho Total de la Sala (X):</span>
                  <strong className="text-sky-400 text-sm font-black">{width} m</strong>
                </div>
                <input
                  type="range"
                  min={12}
                  max={50}
                  step={2}
                  value={width}
                  onChange={e => setWidth(Number(e.target.value))}
                  className="accent-sky-400 cursor-pointer"
                />
                <span className="font-mono text-[9px] text-slate-500">Mínimo 12m · Máximo 50m</span>
              </div>

              <div className="flex flex-col gap-1.5 bg-slate-900/60 p-3 rounded-xl border border-slate-700/60">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-300">Largo Total de la Sala (Z):</span>
                  <strong className="text-sky-400 text-sm font-black">{length} m</strong>
                </div>
                <input
                  type="range"
                  min={12}
                  max={60}
                  step={2}
                  value={length}
                  onChange={e => setLength(Number(e.target.value))}
                  className="accent-sky-400 cursor-pointer"
                />
                <span className="font-mono text-[9px] text-slate-500">Mínimo 12m · Máximo 60m</span>
              </div>
            </div>

            {shape === 'L_SHAPE' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-700/60">
                <div className="flex flex-col gap-1.5 bg-slate-900/60 p-3 rounded-xl border border-slate-700/60">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-300">Ancho del Ala / Brazo en "L":</span>
                    <strong className="text-amber-400 text-sm font-black">{safeWingWidth} m</strong>
                  </div>
                  <input
                    type="range"
                    min={4}
                    max={Math.max(6, width - 4)}
                    step={1}
                    value={safeWingWidth}
                    onChange={e => setWingWidth(Number(e.target.value))}
                    className="accent-amber-400 cursor-pointer"
                  />
                  <span className="font-mono text-[9px] text-slate-500">
                    Recorte lateral: {(width - safeWingWidth).toFixed(0)}m libres
                  </span>
                </div>

                <div className="flex flex-col gap-1.5 bg-slate-900/60 p-3 rounded-xl border border-slate-700/60">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-300">Largo del Ala / Brazo en "L":</span>
                    <strong className="text-amber-400 text-sm font-black">{safeWingLength} m</strong>
                  </div>
                  <input
                    type="range"
                    min={4}
                    max={Math.max(6, length - 4)}
                    step={1}
                    value={safeWingLength}
                    onChange={e => setWingLength(Number(e.target.value))}
                    className="accent-amber-400 cursor-pointer"
                  />
                  <span className="font-mono text-[9px] text-slate-500">
                    Recorte frontal: {(length - safeWingLength).toFixed(0)}m libres
                  </span>
                </div>
              </div>
            )}
          </div>
        </>
      )}

          {/* 5. Zonas Funcionales Demarcadas en el Piso */}
          <div
            className="p-4 rounded-2xl border flex flex-col gap-3"
            style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
          >
            <span className="font-mono text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Layers size={14} className="text-sky-400" /> {shape === 'L_SHAPE' ? '4.' : '3.'} Zonas Demarcadas en el Suelo
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  enableReceiving ? 'bg-sky-500/15 border-sky-400' : 'bg-slate-900/60 border-slate-700'
                }`}
              >
                <div className="flex flex-col">
                  <span className="font-mono text-xs font-bold text-white">Zona Recepción</span>
                  <span className="font-mono text-[9px] text-sky-400">Entrada de telas/ropa</span>
                </div>
                <input
                  type="checkbox"
                  checked={enableReceiving}
                  onChange={e => setEnableReceiving(e.target.checked)}
                  className="w-4 h-4 rounded accent-sky-400"
                />
              </label>

              <label
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  enableDispatch ? 'bg-orange-500/15 border-orange-400' : 'bg-slate-900/60 border-slate-700'
                }`}
              >
                <div className="flex flex-col">
                  <span className="font-mono text-xs font-bold text-white">Zona Despacho</span>
                  <span className="font-mono text-[9px] text-orange-400">Packing y pedidos</span>
                </div>
                <input
                  type="checkbox"
                  checked={enableDispatch}
                  onChange={e => setEnableDispatch(e.target.checked)}
                  className="w-4 h-4 rounded accent-orange-400"
                />
              </label>

              <label
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  enableAisle ? 'bg-emerald-500/15 border-emerald-400' : 'bg-slate-900/60 border-slate-700'
                }`}
              >
                <div className="flex flex-col">
                  <span className="font-mono text-xs font-bold text-white">Pasillo Central</span>
                  <span className="font-mono text-[9px] text-emerald-400">Franja de tránsito</span>
                </div>
                <input
                  type="checkbox"
                  checked={enableAisle}
                  onChange={e => setEnableAisle(e.target.checked)}
                  className="w-4 h-4 rounded accent-emerald-400"
                />
              </label>
            </div>
          </div>

          {/* 6. Obstáculos Arquitectónicos (Columnas, Puertas) */}
          <div
            className="p-4 rounded-2xl border flex flex-col gap-3"
            style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
          >
            <span className="font-mono text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-amber-400" /> {shape === 'L_SHAPE' ? '5.' : '4.'} Elementos Estructurales
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  enableColumns ? 'bg-amber-500/15 border-amber-400' : 'bg-slate-900/60 border-slate-700'
                }`}
              >
                <div className="flex flex-col">
                  <span className="font-mono text-xs font-bold text-white flex items-center gap-1.5">
                    <Box size={14} className="text-amber-400" /> Pilares / Columnas
                  </span>
                  <span className="font-mono text-[9px] text-slate-400">Columnas de concreto con franjas</span>
                </div>
                <input
                  type="checkbox"
                  checked={enableColumns}
                  onChange={e => setEnableColumns(e.target.checked)}
                  className="w-4 h-4 rounded accent-amber-400"
                />
              </label>

              <label
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  enableDoor ? 'bg-sky-500/15 border-sky-400' : 'bg-slate-900/60 border-slate-700'
                }`}
              >
                <div className="flex flex-col">
                  <span className="font-mono text-xs font-bold text-white flex items-center gap-1.5">
                    <DoorOpen size={14} className="text-sky-400" /> Puerta Principal
                  </span>
                  <span className="font-mono text-[9px] text-slate-400">Acceso rotulado de entrada</span>
                </div>
                <input
                  type="checkbox"
                  checked={enableDoor}
                  onChange={e => setEnableDoor(e.target.checked)}
                  className="w-4 h-4 rounded accent-sky-400"
                />
              </label>
            </div>
          </div>

          {/* Botones */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t" style={{ borderColor: '#1e293b' }}>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border font-mono text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              style={{ borderColor: '#334155' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-mono text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-sky-600/30"
            >
              <Save size={16} /> Aplicar Plano al Almacén 3D
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
