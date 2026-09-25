import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  Rack3D,
  RoomShape,
  RoomConfig,
  Warehouse3DLayout,
} from '../../types/warehouse3d';
import {
  getRoomBoundingBox,
  getRoomCutoutBoxes,
  isRackInsideRoom,
  clampRackPosition,
  getRackHalfExtents,
} from '../../lib/warehouseBounds';
import { getCustomGridWallSegments } from './architecturalBuilder';
import {
  RotateCw,
  Copy,
  Trash2,
  Plus,
  Compass,
  Sparkles,
  Maximize2,
  Grid,
  Box,
  CornerDownRight,
  Info,
  Check,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';

interface WarehouseBlueprintEditorProps {
  layout: Warehouse3DLayout;
  selectedRackId: string | null;
  onSelectRack: (rackId: string | null) => void;
  onMoveRack: (rackId: string, newPosition: [number, number, number]) => void;
  onUpdateRack: (updatedRack: Rack3D) => void;
  onDuplicateRack: (rack: Rack3D) => void;
  onDeleteRack: (rackId: string) => void;
  onUpdateRoomConfig: (updatedFields: Partial<Warehouse3DLayout>) => void;
  onOpenAddModal: () => void;
  onSwitchTo3D: () => void;
}

const L_PRESETS = [
  { name: 'Taller con Recodo', w: 24, l: 20, ww: 12, wl: 10, ori: 'BOTTOM_LEFT' as const },
  { name: 'Local Esquinero', w: 20, l: 20, ww: 10, wl: 10, ori: 'BOTTOM_LEFT' as const },
  { name: 'Nave Textil Alargada', w: 30, l: 18, ww: 14, wl: 10, ori: 'BOTTOM_RIGHT' as const },
  { name: 'Gran Almacén L', w: 36, l: 28, ww: 18, wl: 14, ori: 'TOP_LEFT' as const },
];

export const WarehouseBlueprintEditor: React.FC<WarehouseBlueprintEditorProps> = ({
  layout,
  selectedRackId,
  onSelectRack,
  onMoveRack,
  onUpdateRack,
  onDuplicateRack,
  onDeleteRack,
  onUpdateRoomConfig,
  onOpenAddModal,
  onSwitchTo3D,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const width = layout.warehouseWidth || 26;
  const length = layout.warehouseLength || 30;
  const shape = layout.roomShape || 'RECTANGULAR';
  const config = layout.roomConfig;
  const racks = layout.racks;

  const wingWidth = config?.wingWidth || Math.round(width * 0.45);
  const wingLength = config?.wingLength || Math.round(length * 0.45);
  const orientation = config?.orientation || 'BOTTOM_LEFT';

  // Estado para arrastre interactivo en 2D
  const [draggingRackId, setDraggingRackId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; z: number }>({ x: 0, z: 0 });
  const [livePos, setLivePos] = useState<{ x: number; z: number } | null>(null);
  const [isHoveringInvalid, setIsHoveringInvalid] = useState(false);

  // Zoom y paneo en la planilla
  const [zoom, setZoom] = useState(1.0);

  // Configuración de visualización de medidas del almacén
  const padMeters = 3.5;
  const totalViewW = width + padMeters * 2;
  const totalViewL = length + padMeters * 2;

  // Conversión entre metros mundiales y coordenadas SVG
  // En SVG: (0,0) en la esquina superior izquierda
  // Origen mundial (0,0) está en el centro del almacén
  const svgWidth = 850;
  const svgHeight = 650;
  const scale = Math.min((svgWidth - 60) / totalViewW, (svgHeight - 60) / totalViewL) * zoom;

  const originSvgX = svgWidth / 2;
  const originSvgZ = svgHeight / 2;

  const worldToSvg = useCallback(
    (wx: number, wz: number) => {
      return {
        x: originSvgX + wx * scale,
        y: originSvgZ + wz * scale,
      };
    },
    [originSvgX, originSvgZ, scale]
  );

  const svgToWorld = useCallback(
    (sx: number, sy: number) => {
      return {
        x: (sx - originSvgX) / scale,
        z: (sy - originSvgZ) / scale,
      };
    },
    [originSvgX, originSvgZ, scale]
  );

  // Vértices del polígono del suelo para dibujar en la planilla
  const floorPolygonPoints = useMemo(() => {
    const minX = -width / 2;
    const maxX = width / 2;
    const minZ = -length / 2;
    const maxZ = length / 2;

    const safeWW = Math.min(Math.max(wingWidth, 4), width - 3);
    const safeWL = Math.min(Math.max(wingLength, 4), length - 3);

    let worldPts: { x: number; z: number }[] = [];

    if (shape === 'RECTANGULAR') {
      worldPts = [
        { x: minX, z: minZ },
        { x: maxX, z: minZ },
        { x: maxX, z: maxZ },
        { x: minX, z: maxZ },
      ];
    } else if (shape === 'L_SHAPE') {
      switch (orientation) {
        case 'BOTTOM_RIGHT':
          worldPts = [
            { x: maxX - safeWW, z: minZ },
            { x: maxX, z: minZ },
            { x: maxX, z: maxZ },
            { x: minX, z: maxZ },
            { x: minX, z: maxZ - safeWL },
            { x: maxX - safeWW, z: maxZ - safeWL },
          ];
          break;
        case 'TOP_LEFT':
          worldPts = [
            { x: minX, z: minZ },
            { x: maxX, z: minZ },
            { x: maxX, z: minZ + safeWL },
            { x: minX + safeWW, z: minZ + safeWL },
            { x: minX + safeWW, z: maxZ },
            { x: minX, z: maxZ },
          ];
          break;
        case 'TOP_RIGHT':
          worldPts = [
            { x: minX, z: minZ },
            { x: maxX, z: minZ },
            { x: maxX, z: maxZ },
            { x: maxX - safeWW, z: maxZ },
            { x: maxX - safeWW, z: minZ + safeWL },
            { x: minX, z: minZ + safeWL },
          ];
          break;
        case 'BOTTOM_LEFT':
        default:
          worldPts = [
            { x: minX, z: minZ },
            { x: minX + safeWW, z: minZ },
            { x: minX + safeWW, z: maxZ - safeWL },
            { x: maxX, z: maxZ - safeWL },
            { x: maxX, z: maxZ },
            { x: minX, z: maxZ },
          ];
          break;
      }
    } else {
      // U_SHAPE
      const spineL = length * 0.4;
      const wingW = width * 0.35;
      worldPts = [
        { x: minX, z: minZ },
        { x: maxX, z: minZ },
        { x: maxX, z: maxZ },
        { x: maxX - wingW, z: maxZ },
        { x: maxX - wingW, z: minZ + spineL },
        { x: minX + wingW, z: minZ + spineL },
        { x: minX + wingW, z: maxZ },
        { x: minX, z: maxZ },
      ];
    }

    return worldPts.map(pt => {
      const s = worldToSvg(pt.x, pt.z);
      return `${Math.round(s.x)},${Math.round(s.y)}`;
    }).join(' ');
  }, [width, length, shape, wingWidth, wingLength, orientation, worldToSvg]);

  // Recortes prohibidos en pantalla
  const cutouts = useMemo(() => {
    return getRoomCutoutBoxes(width, length, shape, config);
  }, [width, length, shape, config]);

  // Celdas activas para planos CUSTOM_GRID dibujados por el usuario
  const customGridCells = useMemo(() => {
    if (shape !== 'CUSTOM_GRID' || !config?.customGrid) return [];
    const { cellSize, cols, rows, cells } = config.customGrid;
    const gridW = cols * cellSize;
    const gridL = rows * cellSize;
    const minX = -gridW / 2;
    const minZ = -gridL / 2;
    const tiles: { id: string; x: number; y: number; w: number; h: number }[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (cells[r] && cells[r][c] === 1) {
          const wx = minX + c * cellSize;
          const wz = minZ + r * cellSize;
          const s = worldToSvg(wx, wz);
          const w = cellSize * scale;
          const h = cellSize * scale;
          tiles.push({ id: `${r}-${c}`, x: s.x, y: s.y, w, h });
        }
      }
    }
    return tiles;
  }, [shape, config?.customGrid, worldToSvg, scale]);

  // Líneas perimetrales amarillas para planos CUSTOM_GRID
  const customGridWallLines = useMemo(() => {
    if (shape !== 'CUSTOM_GRID' || !config?.customGrid) return [];
    const { segments } = getCustomGridWallSegments(config.customGrid);
    return segments.map(s => {
      const p1Svg = worldToSvg(s.p1.x, s.p1.z);
      const p2Svg = worldToSvg(s.p2.x, s.p2.z);
      return {
        p1: p1Svg,
        p2: p2Svg,
        isEntrance: !!s.isEntranceWall,
      };
    });
  }, [shape, config?.customGrid, worldToSvg]);

  // Rack actualmente seleccionado
  const selectedRack = useMemo(() => {
    return racks.find(r => r.id === selectedRackId) || null;
  }, [racks, selectedRackId]);

  // Manejo de inicio de arrastre de un estante en 2D
  const handleRackPointerDown = (e: React.PointerEvent, rack: Rack3D) => {
    e.stopPropagation();
    onSelectRack(rack.id);

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickSvgX = (e.clientX - rect.left) * (svgWidth / rect.width);
    const clickSvgY = (e.clientY - rect.top) * (svgHeight / rect.height);
    const clickWorld = svgToWorld(clickSvgX, clickSvgY);

    setDraggingRackId(rack.id);
    setDragOffset({
      x: rack.position[0] - clickWorld.x,
      z: rack.position[2] - clickWorld.z,
    });
    setLivePos({ x: rack.position[0], z: rack.position[2] });
    setIsHoveringInvalid(false);
  };

  // Mover el estante con el ratón sobre la planilla
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRackId || !containerRef.current) return;

    const rObj = racks.find(r => r.id === draggingRackId);
    if (!rObj) return;

    const rect = containerRef.current.getBoundingClientRect();
    const currSvgX = (e.clientX - rect.left) * (svgWidth / rect.width);
    const currSvgY = (e.clientY - rect.top) * (svgHeight / rect.height);
    const currWorld = svgToWorld(currSvgX, currSvgY);

    const targetX = currWorld.x + dragOffset.x;
    const targetZ = currWorld.z + dragOffset.z;

    // Verificar si el usuario intenta salirse de las líneas amarillas
    const isValid = isRackInsideRoom(targetX, targetZ, rObj, width, length, shape, config);
    setIsHoveringInvalid(!isValid);

    // Ajuste y confinamiento estricto: NUNCA se sale de las líneas amarillas
    const [clampedX, clampedZ] = clampRackPosition(
      targetX,
      targetZ,
      rObj,
      width,
      length,
      shape,
      config
    );

    setLivePos({ x: clampedX, z: clampedZ });
  };

  // Soltar estante y guardar su posición definitiva
  const handlePointerUp = () => {
    if (draggingRackId && livePos) {
      onMoveRack(draggingRackId, [livePos.x, 0, livePos.z]);
    }
    setDraggingRackId(null);
    setLivePos(null);
    setIsHoveringInvalid(false);
  };

  // Clic en el fondo de la planilla para deseleccionar
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'svg') {
      onSelectRack(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050811] text-slate-100 select-none overflow-hidden relative">
      {/* Barra de Herramientas de la Planilla Arquitectónica */}
      <div
        className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 z-20"
        style={{ backgroundColor: '#090e1c', borderColor: '#1e293b' }}
      >
        {/* Lado Izquierdo: Identificación y Controles de Forma Rápidos */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 pr-2 border-r border-slate-700/60">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-mono text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Grid size={15} /> Planilla 2D · Distribución en Vivo
            </span>
          </div>

          {/* Selector de Forma */}
          <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-700/80">
            <button
              type="button"
              onClick={() => onUpdateRoomConfig({ roomShape: 'RECTANGULAR' })}
              className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold transition-all cursor-pointer ${
                shape === 'RECTANGULAR' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Rectangular
            </button>
            <button
              type="button"
              onClick={() => onUpdateRoomConfig({ roomShape: 'L_SHAPE' })}
              className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold transition-all cursor-pointer ${
                shape === 'L_SHAPE' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Plano en "L" ⭐
            </button>
            <button
              type="button"
              onClick={() => onUpdateRoomConfig({ roomShape: 'U_SHAPE' })}
              className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold transition-all cursor-pointer ${
                shape === 'U_SHAPE' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Plano en "U"
            </button>
          </div>

          {/* Si es L, selector directo de orientación con 1 clic */}
          {shape === 'L_SHAPE' && (
            <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-amber-500/40">
              <span className="font-mono text-[10px] text-amber-400 font-bold px-1.5 flex items-center gap-1">
                <CornerDownRight size={12} /> Recodo:
              </span>
              {[
                { id: 'BOTTOM_LEFT', symbol: '⮠', label: 'Abajo-Izq' },
                { id: 'BOTTOM_RIGHT', symbol: '⮡', label: 'Abajo-Der' },
                { id: 'TOP_LEFT', symbol: '⮢', label: 'Arriba-Izq' },
                { id: 'TOP_RIGHT', symbol: '⮣', label: 'Arriba-Der' },
              ].map(o => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() =>
                    onUpdateRoomConfig({
                      roomConfig: {
                        mainWidth: width,
                        mainLength: length,
                        wingWidth,
                        wingLength,
                        orientation: o.id as any,
                      },
                    })
                  }
                  className={`px-2 py-0.5 rounded-lg font-mono text-xs font-black transition-all cursor-pointer ${
                    orientation === o.id
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title={o.label}
                >
                  {o.symbol}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Lado Derecho: Acciones y Botón a 3D */}
        <div className="flex items-center gap-2">
          {/* Zoom */}
          <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-700/60 font-mono text-[11px]">
            <button
              onClick={() => setZoom(z => Math.max(0.7, z - 0.15))}
              className="w-6 h-6 rounded flex items-center justify-center hover:bg-slate-800 text-slate-300 cursor-pointer"
            >
              -
            </button>
            <span className="px-1.5 text-slate-400">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom(z => Math.min(1.8, z + 0.15))}
              className="w-6 h-6 rounded flex items-center justify-center hover:bg-slate-800 text-slate-300 cursor-pointer"
            >
              +
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenAddModal}
            className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-mono text-xs font-black flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
          >
            <Plus size={14} /> + Diseñar Estante
          </button>

          <button
            type="button"
            onClick={onSwitchTo3D}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-400 hover:text-white font-mono text-xs font-black flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
          >
            <Eye size={14} /> Ver en 3D
          </button>
        </div>
      </div>

      {/* Barra de Acciones Flotante del Estante Seleccionado */}
      {selectedRack && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-2xl bg-slate-900/95 border border-slate-700 shadow-2xl backdrop-blur-md flex items-center gap-3 font-mono text-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2 pr-1">
            <div className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
            <strong className="text-white uppercase">{selectedRack.name}</strong>
            <span className="text-[10px] text-slate-400">({selectedRack.aisle})</span>
          </div>
          <span className="text-slate-600">|</span>
          <button
            type="button"
            onClick={() =>
              onUpdateRack({
                ...selectedRack,
                rotationY: (selectedRack.rotationY + Math.PI / 2) % (Math.PI * 2),
              })
            }
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCw size={13} className="text-sky-400" /> Girar 90°
          </button>
          <button
            type="button"
            onClick={() => onDuplicateRack(selectedRack)}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Copy size={13} className="text-sky-400" /> Duplicar
          </button>
          <button
            type="button"
            onClick={() => onDeleteRack(selectedRack.id)}
            className="px-2.5 py-1 rounded-lg bg-red-600/30 hover:bg-red-600 text-red-300 hover:text-white text-[11px] font-black flex items-center gap-1.5 border border-red-500/40 cursor-pointer"
          >
            <Trash2 size={13} /> Eliminar
          </button>
        </div>
      )}

      {/* Alerta de Colisión / Fuera de Límites */}
      {isHoveringInvalid && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-2xl bg-red-950/95 border border-red-600 text-red-200 shadow-2xl backdrop-blur-md flex items-center gap-2 font-mono text-xs animate-bounce">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
          <strong>¡LÍMITE ALCANZADO!</strong> No puedes colocar estantes fuera de las líneas amarillas.
        </div>
      )}

      {/* Tablero Gráfico Interactivo (Lienzo SVG de la Planilla) */}
      <div
        ref={containerRef}
        onClick={handleCanvasClick}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="flex-1 w-full h-full flex items-center justify-center p-2 relative overflow-hidden cursor-default"
      >
        <svg
          className="w-full h-full max-w-full max-h-full drop-shadow-2xl select-none"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        >
          <defs>
            {/* Cuadrícula métrica milimetrada (1m x 1m) */}
            <pattern id="grid1m" width={scale} height={scale} patternUnits="userSpaceOnUse">
              <path d={`M ${scale} 0 L 0 0 0 ${scale}`} fill="none" stroke="#131b2e" strokeWidth="0.6" />
            </pattern>
            {/* Cuadrícula mayor cada 5m */}
            <pattern id="grid5m" width={scale * 5} height={scale * 5} patternUnits="userSpaceOnUse">
              <rect width={scale * 5} height={scale * 5} fill="url(#grid1m)" />
              <path d={`M ${scale * 5} 0 L 0 0 0 ${scale * 5}`} fill="none" stroke="#1e2c4a" strokeWidth="1.2" />
            </pattern>
            {/* Trama de peligro para vacíos fuera del perímetro */}
            <pattern id="dangerHatch" width="16" height="16" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="16" stroke="#ef4444" strokeWidth="3" opacity="0.15" />
            </pattern>
          </defs>

          {/* Fondo técnico del tablero */}
          <rect width={svgWidth} height={svgHeight} fill="#04060c" />

          {/* Zona de peligro fuera del edificio */}
          <rect width={svgWidth} height={svgHeight} fill="url(#dangerHatch)" />

          {shape === 'CUSTOM_GRID' && config?.customGrid ? (
            <g id="customGridFloor">
              {/* Celdas de suelo activas pintadas por el usuario */}
              {customGridCells.map(tile => (
                <rect
                  key={tile.id}
                  x={tile.x}
                  y={tile.y}
                  width={tile.w}
                  height={tile.h}
                  fill="#090f1d"
                  stroke="#1e2c4a"
                  strokeWidth={0.8}
                />
              ))}

              {/* Trama de cuadrícula técnica sobre las celdas */}
              {customGridCells.map(tile => (
                <rect
                  key={`hatch-${tile.id}`}
                  x={tile.x}
                  y={tile.y}
                  width={tile.w}
                  height={tile.h}
                  fill="url(#grid5m)"
                  opacity={0.7}
                />
              ))}

              {/* Muros perimetrales amarillos y portón de acceso */}
              {customGridWallLines.map((line, idx) => (
                <g key={`wall-${idx}`}>
                  <line
                    x1={line.p1.x}
                    y1={line.p1.y}
                    x2={line.p2.x}
                    y2={line.p2.y}
                    stroke={line.isEntrance ? '#38bdf8' : '#f59e0b'}
                    strokeWidth={3.5}
                    strokeLinecap="round"
                  />
                  {line.isEntrance && (
                    <text
                      x={(line.p1.x + line.p2.x) / 2}
                      y={(line.p1.y + line.p2.y) / 2 + 14}
                      fill="#38bdf8"
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      ACCESO PRINCIPAL
                    </text>
                  )}
                </g>
              ))}
            </g>
          ) : (
            <>
              {/* PISO VÁLIDO DEL ALMACÉN (Polígono iluminado delimitado por las líneas amarillas) */}
              <polygon
                points={floorPolygonPoints}
                fill="#090f1d"
                stroke="#f59e0b"
                strokeWidth={3.5}
                strokeLinejoin="round"
              />

              {/* Cuadrícula métrica únicamente sobre el piso del almacén */}
              <g>
                <polygon points={floorPolygonPoints} fill="url(#grid5m)" opacity={0.85} />
              </g>

              {/* Indicadores de recortes prohibidos (dentro de la L o U) */}
              {cutouts.map((cut, ci) => {
                const tl = worldToSvg(cut.minX, cut.minZ);
                const br = worldToSvg(cut.maxX, cut.maxZ);
                const w = br.x - tl.x;
                const h = br.y - tl.y;
                return (
                  <g key={`cutout-${ci}`}>
                    <rect x={tl.x} y={tl.y} width={w} height={h} fill="url(#dangerHatch)" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 3" />
                    <text
                      x={tl.x + w / 2}
                      y={tl.y + h / 2}
                      fill="#ef4444"
                      fontSize="11"
                      fontFamily="monospace"
                      textAnchor="middle"
                      fontWeight="bold"
                      opacity={0.6}
                    >
                      VACÍO / FUERA DEL LOCAL
                    </text>
                  </g>
                );
              })}
            </>
          )}

          {/* Ejes y marcas métricas */}
          <g opacity={0.6}>
            <line x1={originSvgX} y1={20} x2={originSvgX} y2={svgHeight - 20} stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="3 3" />
            <line x1={20} y1={originSvgZ} x2={svgWidth - 20} y2={originSvgZ} stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="3 3" />
            <circle cx={originSvgX} cy={originSvgZ} r="3" fill="#38bdf8" />
            <text x={originSvgX + 6} y={originSvgZ - 6} fill="#38bdf8" fontSize="9" fontFamily="monospace">
              (0,0)
            </text>
          </g>

          {/* Zonas funcionales demarcadas en el suelo */}
          {(layout.zones || []).map(z => {
            const pos = worldToSvg(z.position[0] - z.width / 2, z.position[2] - z.length / 2);
            const zw = z.width * scale;
            const zl = z.length * scale;
            return (
              <g key={z.id}>
                <rect
                  x={pos.x}
                  y={pos.y}
                  width={zw}
                  height={zl}
                  fill={z.color}
                  opacity={0.2}
                  stroke={z.color}
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  rx="4"
                />
                <text
                  x={pos.x + zw / 2}
                  y={pos.y + zl / 2}
                  fill={z.color}
                  fontSize="10"
                  fontFamily="monospace"
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  {z.name.toUpperCase()}
                </text>
              </g>
            );
          })}

          {/* DIBUJO CENITAL DE CADA ESTANTE / MUEBLE */}
          {racks.map(rack => {
            const isSelected = rack.id === selectedRackId;
            const isDragging = rack.id === draggingRackId;

            // Coordenadas mundiales (en vivo si se está arrastrando)
            const curX = isDragging && livePos ? livePos.x : rack.position[0];
            const curZ = isDragging && livePos ? livePos.z : rack.position[2];

            const { hx, hz } = getRackHalfExtents(rack);
            const centerSvg = worldToSvg(curX, curZ);
            const wSvg = hx * 2 * scale;
            const hSvg = hz * 2 * scale;
            const rackTopLeftX = centerSvg.x - wSvg / 2;
            const rackTopLeftY = centerSvg.y - hSvg / 2;

            // Determinar color de relleno
            const rackColor = isDragging && isHoveringInvalid
              ? '#ef4444'
              : isSelected
              ? '#0284c7'
              : rack.color || '#ffffff';

            const strokeColor = isDragging && isHoveringInvalid
              ? '#f87171'
              : isSelected
              ? '#38bdf8'
              : '#94a3b8';

            return (
              <g
                key={rack.id}
                onPointerDown={e => handleRackPointerDown(e, rack)}
                className="cursor-move group"
              >
                {/* Halo de selección o arrastre */}
                {isSelected && (
                  <rect
                    x={rackTopLeftX - 4}
                    y={rackTopLeftY - 4}
                    width={wSvg + 8}
                    height={hSvg + 8}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                    rx="4"
                  />
                )}

                {/* Si es mueble esquinero en L */}
                {rack.furnitureType === 'CORNER_L' ? (
                  <g>
                    {/* Ala A y B dibujadas en L */}
                    <path
                      d={`M ${rackTopLeftX} ${rackTopLeftY} 
                          h ${wSvg} 
                          v ${hSvg * 0.4} 
                          h -${wSvg * 0.6} 
                          v ${hSvg * 0.6} 
                          h -${wSvg * 0.4} 
                          Z`}
                      fill={rackColor}
                      stroke={strokeColor}
                      strokeWidth={2}
                    />
                    <text
                      x={rackTopLeftX + wSvg * 0.25}
                      y={rackTopLeftY + hSvg * 0.25}
                      fill="#090d16"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {rack.name}
                    </text>
                  </g>
                ) : (
                  /* Estante Estándar Rectangular */
                  <g>
                    <rect
                      x={rackTopLeftX}
                      y={rackTopLeftY}
                      width={wSvg}
                      height={hSvg}
                      fill={rackColor}
                      stroke={strokeColor}
                      strokeWidth={2}
                      rx="3"
                    />

                    {/* Subdivisiones de cuerpos/columnas */}
                    {Array.from({ length: Math.max(1, rack.bays - 1) }).map((_, bi) => {
                      const divStep = wSvg / rack.bays;
                      return (
                        <line
                          key={bi}
                          x1={rackTopLeftX + (bi + 1) * divStep}
                          y1={rackTopLeftY}
                          x2={rackTopLeftX + (bi + 1) * divStep}
                          y2={rackTopLeftY + hSvg}
                          stroke="#475569"
                          strokeWidth="1"
                        />
                      );
                    })}

                    {/* Rótulo del Estante */}
                    <text
                      x={centerSvg.x}
                      y={centerSvg.y + 3.5}
                      fill="#090d16"
                      fontSize={Math.max(8, Math.min(11, scale * 0.45))}
                      fontFamily="monospace"
                      fontWeight="900"
                      textAnchor="middle"
                    >
                      {rack.name}
                    </text>
                  </g>
                )}

                {/* Cotas de distancia a estantes vecinos cuando está seleccionado */}
                {isSelected && (
                  <g>
                    {/* Cota métrica de ancho */}
                    <text
                      x={centerSvg.x}
                      y={rackTopLeftY - 8}
                      fill="#38bdf8"
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      {(hx * 2).toFixed(1)}m × {(hz * 2).toFixed(1)}m
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Ficha Flotante Informativa en Esquina Inferior Izquierda */}
        <div
          className="absolute bottom-4 left-4 p-3 rounded-2xl border shadow-xl flex flex-col gap-1.5 font-mono text-xs z-10"
          style={{ backgroundColor: '#090e1c', borderColor: '#1e293b' }}
        >
          <div className="flex items-center justify-between gap-3 text-slate-300">
            <span>Perímetro del Local:</span>
            <strong className="text-amber-400">{width}m × {length}m</strong>
          </div>
          <div className="flex items-center justify-between gap-3 text-slate-400 text-[11px]">
            <span>Estantes Activos:</span>
            <strong className="text-white">{racks.length} unidades</strong>
          </div>
          <div className="text-[10px] text-sky-400 pt-1 border-t border-slate-800 flex items-center gap-1">
            <Info size={12} /> Arrastra los estantes con el ratón sobre la cuadrícula
          </div>
        </div>

        {/* Plantillas Rápidas del Local en Esquina Inferior Derecha */}
        <div
          className="absolute bottom-4 right-4 p-2.5 rounded-2xl border shadow-xl flex items-center gap-2 font-mono text-xs z-10"
          style={{ backgroundColor: '#090e1c', borderColor: '#1e293b' }}
        >
          <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
            <Sparkles size={12} /> Plantillas Rápidas:
          </span>
          {L_PRESETS.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() =>
                onUpdateRoomConfig({
                  warehouseWidth: p.w,
                  warehouseLength: p.l,
                  roomShape: 'L_SHAPE',
                  roomConfig: {
                    mainWidth: p.w,
                    mainLength: p.l,
                    wingWidth: p.ww,
                    wingLength: p.wl,
                    orientation: p.ori,
                  },
                })
              }
              className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-amber-400 text-slate-300 hover:text-white text-[10px] transition-colors cursor-pointer"
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
