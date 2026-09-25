import React, { useState } from 'react';
import { Rack3D, FurnitureType } from '../../types/warehouse3d';
import {
  X,
  Layers,
  Plus,
  Check,
  Sparkles,
  SlidersHorizontal,
  Box,
  Ruler,
  Maximize2,
  Paintbrush,
  ShieldCheck,
  Grid3X3,
  HelpCircle,
  Table,
  Shirt,
  CornerDownRight,
  TrendingDown,
} from 'lucide-react';

interface RackModalBuilderProps {
  brand: string;
  existingRacksCount: number;
  onClose: () => void;
  onCreate: (newRack: Rack3D) => void;
}

// Estilos de madera seleccionables (con Madera Blanca como protagonista principal)
const WOOD_FINISHES = [
  {
    id: 'WHITE_WOOD',
    label: 'Madera Blanca Satinada',
    desc: 'Laca blanca satinada con suave veta (Como la foto)',
    color: '#ffffff',
    borderColor: '#e2e8f0',
    badge: 'FOTO ORIGINAL ⭐',
  },
  {
    id: 'MINIMAL_WHITE',
    label: 'Blanco Nieve Puro',
    desc: 'Melamina blanca mate ultra limpia y minimalista',
    color: '#f8fafc',
    borderColor: '#cbd5e1',
    badge: 'MINIMAL',
  },
  {
    id: 'RUSTIC_WHITE',
    label: 'Blanco Decapé Rústico',
    desc: 'Tono marfil desgastado cálido boutique',
    color: '#f1f5f9',
    borderColor: '#cbd5e1',
    badge: 'BOUTIQUE',
  },
  {
    id: 'NATURAL_WOOD',
    label: 'Pino Natural Nórdico',
    desc: 'Madera clara natural escandinava',
    color: '#d9c8af',
    borderColor: '#b8a68d',
    badge: 'NATURAL',
  },
];

const THICKNESS_OPTIONS = [
  { value: 0.018, label: '1.8 cm', desc: 'Melamina estándar liviana' },
  { value: 0.025, label: '2.5 cm', desc: 'Tablero intermedio reforzado' },
  { value: 0.030, label: '3.0 cm', desc: 'Tablero robusto (foto del estante) ⭐' },
  { value: 0.040, label: '4.0 cm', desc: 'Madera maciza extra gruesa' },
];

const BASE_OPTIONS = [
  { value: 0.0, label: 'Al ras del piso (0 cm)', desc: 'Apoyo directo en el suelo' },
  { value: 0.06, label: 'Con Zócalo empotrado (6 cm)', desc: 'Zócalo de mueble contemporáneo' },
  { value: 0.10, label: 'Con Patas / Tacos (10 cm)', desc: 'Elevado para limpieza y ventilación' },
];

export const RackModalBuilder: React.FC<RackModalBuilderProps> = ({
  brand,
  existingRacksCount,
  onClose,
  onCreate,
}) => {
  const nextLetter = String.fromCharCode(65 + (existingRacksCount % 26));
  const nextNum = Math.floor(existingRacksCount / 26) + 1;
  const defaultName = `ESTANTE BLANCO ${nextLetter}-0${nextNum}`;

  const [name, setName] = useState(defaultName);
  const [aisle, setAisle] = useState(`Pasillo ${Math.floor(existingRacksCount / 2) + 1}`);
  const [furnitureType, setFurnitureType] = useState<FurnitureType>('CUBBY');
  const [finish, setFinish] = useState<'WHITE_WOOD' | 'MINIMAL_WHITE' | 'RUSTIC_WHITE' | 'NATURAL_WOOD'>('WHITE_WOOD');
  const [customColor, setCustomColor] = useState<string>('#ffffff');
  const [useCustomColor, setUseCustomColor] = useState(false);

  // Cuadrícula y Cuerpos
  const [bays, setBays] = useState(2); // Columnas de cubos
  const [secondaryBays, setSecondaryBays] = useState(2); // Para esquina L
  const [levels, setLevels] = useState(4); // Pisos de altura

  // Medidas internas en cm
  const [cubbyWidthCm, setCubbyWidthCm] = useState(65);
  const [levelHeightCm, setLevelHeightCm] = useState(55);
  const [depthCm, setDepthCm] = useState(55);

  // Detalles constructivos
  const [boardThicknessM, setBoardThicknessM] = useState(0.03);
  const [baseHeightM, setBaseHeightM] = useState(0.0);
  const [hasBackPanel, setHasBackPanel] = useState(true);
  const [capacityPerSlot, setCapacityPerSlot] = useState(150);

  // Para mueble escalonado: alturas decrecientes
  const [stepHeights, setStepHeights] = useState<number[]>([4, 3, 2, 1]);

  // Plantillas Rápidas con 1 solo clic
  const applyPreset = (type: 'PHOTO_2X4' | 'CORNER_L' | 'STEPPED_4' | 'WORK_TABLE' | 'CLOTHES_RACK' | 'CUBBY_4X4') => {
    switch (type) {
      case 'PHOTO_2X4':
        setFurnitureType('CUBBY');
        setName(`ESTANTE BLANCO ${nextLetter}-0${nextNum}`);
        setBays(2);
        setLevels(4);
        setCubbyWidthCm(65);
        setLevelHeightCm(55);
        setDepthCm(55);
        setBoardThicknessM(0.03);
        setBaseHeightM(0.0);
        setHasBackPanel(true);
        break;
      case 'CORNER_L':
        setFurnitureType('CORNER_L');
        setName(`ESQUINERO EN L ${nextLetter}-0${nextNum}`);
        setBays(2);
        setSecondaryBays(2);
        setLevels(4);
        setCubbyWidthCm(65);
        setLevelHeightCm(55);
        setDepthCm(55);
        setHasBackPanel(true);
        break;
      case 'STEPPED_4':
        setFurnitureType('STEPPED');
        setName(`ESTANTE ESCALERA ${nextLetter}-0${nextNum}`);
        setBays(4);
        setLevels(4);
        setStepHeights([4, 3, 2, 1]);
        setCubbyWidthCm(60);
        setLevelHeightCm(50);
        setDepthCm(55);
        setHasBackPanel(true);
        break;
      case 'WORK_TABLE':
        setFurnitureType('WORK_TABLE');
        setName(`MESÓN CORTE & PACKING ${nextLetter}`);
        setBays(2);
        setLevels(2);
        setCubbyWidthCm(110);
        setLevelHeightCm(90);
        setDepthCm(110);
        setHasBackPanel(false);
        break;
      case 'CLOTHES_RACK':
        setFurnitureType('CLOTHES_RACK');
        setName(`BURRO TEXTIL ${nextLetter}-0${nextNum}`);
        setBays(2);
        setLevels(1);
        setCubbyWidthCm(90);
        setLevelHeightCm(180);
        setDepthCm(55);
        setHasBackPanel(false);
        break;
      case 'CUBBY_4X4':
        setFurnitureType('CUBBY');
        setName(`GRAN MURO ${nextLetter}-0${nextNum}`);
        setBays(4);
        setLevels(4);
        setCubbyWidthCm(60);
        setLevelHeightCm(50);
        setDepthCm(55);
        setHasBackPanel(true);
        break;
    }
  };

  const bayWidthM = cubbyWidthCm / 100;
  const levelHeightM = levelHeightCm / 100;
  const depthM = depthCm / 100;

  const totalWidthCm = Math.round(bays * cubbyWidthCm + (bays + 1) * (boardThicknessM * 100));
  const totalHeightCm = Math.round(
    levels * levelHeightCm + (levels + 1) * (boardThicknessM * 100) + baseHeightM * 100
  );
  const totalWidthM = (totalWidthCm / 100).toFixed(2);
  const totalHeightM = (totalHeightCm / 100).toFixed(2);
  const cornerLengthXM = (bays * bayWidthM + depthM).toFixed(2);
  const cornerLengthZM = (secondaryBays * bayWidthM + depthM).toFixed(2);

  // Cálculo de total de slots
  let totalSlots = bays * levels;
  if (furnitureType === 'CORNER_L') {
    totalSlots = (bays + secondaryBays) * levels;
  } else if (furnitureType === 'STEPPED') {
    totalSlots = stepHeights.slice(0, bays).reduce((acc, h) => acc + h, 0);
  } else if (furnitureType === 'WORK_TABLE') {
    totalSlots = bays * 2;
  } else if (furnitureType === 'CLOTHES_RACK') {
    totalSlots = bays;
  }

  const estimatedCapacity = totalSlots * capacityPerSlot;
  const selectedFinishObj = WOOD_FINISHES.find(w => w.id === finish) || WOOD_FINISHES[0];
  const activeColorHex = useCustomColor ? customColor : selectedFinishObj.color;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const offsetX = ((existingRacksCount % 3) - 1) * 7;
    const offsetZ = Math.floor(existingRacksCount / 3) * 6 - 5;

    const newRackId = `rack-${brand.toLowerCase()}-${Date.now().toString(36)}`;
    const newRack: Rack3D = {
      id: newRackId,
      brand,
      name: name.trim().toUpperCase(),
      aisle: aisle.trim(),
      zone: 'Zona General',
      position: [offsetX, 0, offsetZ],
      rotationY: 0,
      bays,
      levels,
      bayWidth: bayWidthM,
      depth: depthM,
      levelHeight: levelHeightM,
      boardThickness: boardThicknessM,
      baseHeight: baseHeightM,
      hasBackPanel,
      furnitureType,
      secondaryBays: furnitureType === 'CORNER_L' ? secondaryBays : undefined,
      stepHeights: furnitureType === 'STEPPED' ? stepHeights.slice(0, bays) : undefined,
      color: activeColorHex,
      materialType: finish === 'MINIMAL_WHITE' ? 'WHITE_WOOD' : finish,
      slots: {},
      updatedAt: new Date().toISOString(),
    };

    // Inicializar slots según el tipo de mueble
    if (furnitureType === 'CORNER_L') {
      for (let l = 1; l <= levels; l++) {
        for (let b = 1; b <= bays; b++) {
          const key = `${l}-${b}`;
          newRack.slots[key] = {
            level: l,
            bay: b,
            code: `${newRack.name}-X${b}-N${l}`,
            capacity: capacityPerSlot,
            stockUnits: 0,
          };
        }
        for (let bz = 1; bz <= secondaryBays; bz++) {
          const key = `${l}-${bays + bz}`;
          newRack.slots[key] = {
            level: l,
            bay: bays + bz,
            code: `${newRack.name}-Z${bz}-N${l}`,
            capacity: capacityPerSlot,
            stockUnits: 0,
          };
        }
      }
    } else if (furnitureType === 'STEPPED') {
      const activeSteps = stepHeights.slice(0, bays);
      for (let b = 1; b <= bays; b++) {
        const colHeight = activeSteps[b - 1] || levels;
        for (let l = 1; l <= colHeight; l++) {
          const key = `${l}-${b}`;
          newRack.slots[key] = {
            level: l,
            bay: b,
            code: `${newRack.name}-C${b}-N${l}`,
            capacity: capacityPerSlot,
            stockUnits: 0,
          };
        }
      }
    } else if (furnitureType === 'WORK_TABLE') {
      for (let l = 1; l <= 2; l++) {
        for (let b = 1; b <= bays; b++) {
          const key = `${l}-${b}`;
          newRack.slots[key] = {
            level: l,
            bay: b,
            code: `${newRack.name}-${l === 2 ? 'TOP' : 'BOT'}-C${b}`,
            capacity: capacityPerSlot,
            stockUnits: 0,
          };
        }
      }
    } else if (furnitureType === 'CLOTHES_RACK') {
      for (let b = 1; b <= bays; b++) {
        const key = `1-${b}`;
        newRack.slots[key] = {
          level: 1,
          bay: b,
          code: `${newRack.name}-PERCHA-C${b}`,
          capacity: capacityPerSlot,
          stockUnits: 0,
        };
      }
    } else {
      for (let l = 1; l <= levels; l++) {
        for (let b = 1; b <= bays; b++) {
          const key = `${l}-${b}`;
          newRack.slots[key] = {
            level: l,
            bay: b,
            code: `${newRack.name.replace(/\s+/g, '-')}-N${l}-C${b}`,
            capacity: capacityPerSlot,
            stockUnits: 0,
          };
        }
      }
    }

    onCreate(newRack);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div
        className="w-full max-w-4xl rounded-3xl border shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-150 my-auto text-slate-100"
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
              <Layers size={24} />
            </div>
            <div>
              <h2 className="font-mono font-black text-base uppercase tracking-tight text-white flex items-center gap-2">
                Diseñador de Mobiliario 3D a Medida
              </h2>
              <span className="font-mono text-xs text-slate-400">
                Crea estantes clásicos, esquineros en "L", muebles escalonados, mesones de empaque o percheros
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

        <form onSubmit={handleSubmit} className="flex flex-col p-5 gap-5 max-h-[80vh] overflow-y-auto">
          {/* SELECTOR DE TIPO DE MUEBLE */}
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
              <Box size={14} /> Seleccionar Tipo de Mueble
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <button
                type="button"
                onClick={() => applyPreset('PHOTO_2X4')}
                className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                  furnitureType === 'CUBBY'
                    ? 'bg-sky-500/20 border-sky-400 ring-1 ring-sky-400'
                    : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black text-white">Estante Cubos</span>
                  {furnitureType === 'CUBBY' && <Check size={14} className="text-sky-400" />}
                </div>
                <span className="font-mono text-[9px] text-slate-400">Estilo foto original</span>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('CORNER_L')}
                className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                  furnitureType === 'CORNER_L'
                    ? 'bg-sky-500/20 border-sky-400 ring-1 ring-sky-400'
                    : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black text-white">Esquinero en "L" ⭐</span>
                  {furnitureType === 'CORNER_L' && <Check size={14} className="text-sky-400" />}
                </div>
                <span className="font-mono text-[9px] text-slate-400">Gira 90° en esquinas</span>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('STEPPED_4')}
                className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                  furnitureType === 'STEPPED'
                    ? 'bg-sky-500/20 border-sky-400 ring-1 ring-sky-400'
                    : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black text-white">Escalonado ⭐</span>
                  {furnitureType === 'STEPPED' && <Check size={14} className="text-sky-400" />}
                </div>
                <span className="font-mono text-[9px] text-slate-400">Forma escalera / asimétrico</span>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('WORK_TABLE')}
                className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                  furnitureType === 'WORK_TABLE'
                    ? 'bg-sky-500/20 border-sky-400 ring-1 ring-sky-400'
                    : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black text-white">Mesón Packing</span>
                  {furnitureType === 'WORK_TABLE' && <Check size={14} className="text-sky-400" />}
                </div>
                <span className="font-mono text-[9px] text-slate-400">Mesa doblado textil</span>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('CLOTHES_RACK')}
                className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                  furnitureType === 'CLOTHES_RACK'
                    ? 'bg-sky-500/20 border-sky-400 ring-1 ring-sky-400'
                    : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black text-white">Burro / Perchero</span>
                  {furnitureType === 'CLOTHES_RACK' && <Check size={14} className="text-sky-400" />}
                </div>
                <span className="font-mono text-[9px] text-slate-400">Ropa en colgador</span>
              </button>
            </div>
          </div>

          {/* Panel Principal Dividido */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Columna Izquierda: Live 2D Blueprint adaptativo */}
            <div
              className="lg:col-span-5 rounded-2xl border p-4 flex flex-col justify-between"
              style={{ backgroundColor: '#131e36', borderColor: '#334155' }}
            >
              <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: '#1e293b' }}>
                <span className="font-mono text-xs font-black uppercase text-sky-400 flex items-center gap-1.5">
                  <Ruler size={15} /> Plano Esquemático 2D
                </span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-sky-950 text-sky-300 border border-sky-800">
                  {totalSlots} Ubicaciones
                </span>
              </div>

              {/* Dibujo SVG Adaptativo según el Tipo de Mueble */}
              <div className="relative my-3 flex items-center justify-center p-3 rounded-xl bg-slate-950 border border-slate-800 min-h-[220px]">
                {furnitureType === 'CORNER_L' ? (
                  <svg
                    className="w-full max-w-[260px] h-auto drop-shadow-md select-none"
                    viewBox={`0 0 ${Math.max(220, 50 + (bays + 1) * 32 + 20)} ${Math.max(220, 50 + (secondaryBays + 1) * 32 + 20)}`}
                  >
                    {/* Fondo técnico de plano */}
                    <rect width="100%" height="100%" fill="#0a0f1d" rx="8" />

                    {/* Esquina 90° Común */}
                    <rect
                      x="40"
                      y="40"
                      width="32"
                      height="32"
                      fill={activeColorHex}
                      stroke="#38bdf8"
                      strokeWidth="2"
                    />
                    <line x1="40" y1="40" x2="72" y2="72" stroke="#38bdf8" strokeWidth="1.2" strokeDasharray="3 2" />
                    <text x="56" y="59" fill="#0f172a" fontSize="8" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                      ESQ
                    </text>

                    {/* Cubículos Ala A (Horizontal hacia la derecha) */}
                    {Array.from({ length: bays }).map((_, bi) => {
                      const bx = 72 + bi * 32;
                      return (
                        <g key={`wingA-${bi}`}>
                          <rect
                            x={bx}
                            y="40"
                            width="32"
                            height="32"
                            fill={activeColorHex}
                            stroke="#94a3b8"
                            strokeWidth="1.5"
                          />
                          <text x={bx + 16} y="59" fill="#0f172a" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                            A{bi + 1}
                          </text>
                        </g>
                      );
                    })}

                    {/* Cubículos Ala B (Vertical hacia abajo) */}
                    {Array.from({ length: secondaryBays }).map((_, bzi) => {
                      const by = 72 + bzi * 32;
                      return (
                        <g key={`wingB-${bzi}`}>
                          <rect
                            x="40"
                            y={by}
                            width="32"
                            height="32"
                            fill={activeColorHex}
                            stroke="#94a3b8"
                            strokeWidth="1.5"
                          />
                          <text x="56" y={by + 19} fill="#0f172a" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                            B{bzi + 1}
                          </text>
                        </g>
                      );
                    })}

                    {/* Cota métrica superior Ala A */}
                    <line x1="40" y1="26" x2={72 + bays * 32} y2="26" stroke="#38bdf8" strokeWidth="1.5" />
                    <line x1="40" y1="22" x2="40" y2="30" stroke="#38bdf8" strokeWidth="1.5" />
                    <line x1={72 + bays * 32} y1="22" x2={72 + bays * 32} y2="30" stroke="#38bdf8" strokeWidth="1.5" />
                    <text
                      x={40 + (32 + bays * 32) / 2}
                      y="18"
                      fill="#38bdf8"
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      Ala A: {cornerLengthXM} m
                    </text>

                    {/* Cota métrica izquierda Ala B */}
                    <line x1="24" y1="40" x2="24" y2={72 + secondaryBays * 32} stroke="#f59e0b" strokeWidth="1.5" />
                    <line x1="20" y1="40" x2="28" y2="40" stroke="#f59e0b" strokeWidth="1.5" />
                    <line x1="20" y1={72 + secondaryBays * 32} x2="28" y2={72 + secondaryBays * 32} stroke="#f59e0b" strokeWidth="1.5" />
                    <text
                      x="16"
                      y={40 + (32 + secondaryBays * 32) / 2}
                      fill="#f59e0b"
                      fontSize="8"
                      fontFamily="monospace"
                      textAnchor="middle"
                      fontWeight="bold"
                      transform={`rotate(-90 16 ${40 + (32 + secondaryBays * 32) / 2})`}
                    >
                      Ala B: {cornerLengthZM} m
                    </text>

                    {/* Resumen de altura */}
                    <text
                      x={80}
                      y={85 + Math.min(secondaryBays * 25, 60)}
                      fill="#38bdf8"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      ↕ {levels} Pisos · {totalHeightM}m alto
                    </text>
                  </svg>
                ) : furnitureType === 'STEPPED' ? (
                  <svg className="w-full max-w-[260px] h-auto drop-shadow-md" viewBox="0 0 240 160">
                    {/* Silueta escalonada */}
                    {stepHeights.slice(0, bays).map((h, i) => {
                      const colW = 180 / bays;
                      const colH = (h / levels) * 110;
                      return (
                        <g key={`step-${i}`}>
                          <rect
                            x={30 + i * colW}
                            y={140 - colH}
                            width={colW}
                            height={colH}
                            fill={activeColorHex}
                            stroke="#94a3b8"
                            strokeWidth="2"
                          />
                          <text x={30 + i * colW + colW / 2} y={135 - colH / 2} fill="#0f172a" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                            {h} Pisos
                          </text>
                        </g>
                      );
                    })}
                    <line x1="30" y1="145" x2="210" y2="145" stroke="#38bdf8" strokeWidth="1.5" />
                    <text x="120" y="155" fill="#38bdf8" fontSize="9" fontFamily="monospace" textAnchor="middle">Silueta Escalera</text>
                  </svg>
                ) : furnitureType === 'WORK_TABLE' ? (
                  <svg className="w-full max-w-[250px] h-auto drop-shadow-md" viewBox="0 0 220 140">
                    {/* Tablero superior */}
                    <rect x="20" y="30" width="180" height="15" fill={activeColorHex} stroke="#94a3b8" strokeWidth="2" />
                    {/* Patas */}
                    <rect x="25" y="45" width="12" height="75" fill={activeColorHex} stroke="#94a3b8" />
                    <rect x="183" y="45" width="12" height="75" fill={activeColorHex} stroke="#94a3b8" />
                    {/* Balda inferior */}
                    <rect x="37" y="95" width="146" height="10" fill={activeColorHex} stroke="#94a3b8" />
                    <text x="110" y="42" fill="#0f172a" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle">Superficie de Corte</text>
                    <text x="110" y="103" fill="#0f172a" fontSize="8" fontFamily="monospace" textAnchor="middle">Balda para Cajas</text>
                  </svg>
                ) : furnitureType === 'CLOTHES_RACK' ? (
                  <svg className="w-full max-w-[220px] h-auto drop-shadow-md" viewBox="0 0 200 170">
                    {/* Base */}
                    <rect x="30" y="140" width="140" height="12" fill={activeColorHex} stroke="#94a3b8" />
                    {/* Postes */}
                    <rect x="35" y="30" width="8" height="110" fill={activeColorHex} stroke="#94a3b8" />
                    <rect x="157" y="30" width="8" height="110" fill={activeColorHex} stroke="#94a3b8" />
                    {/* Barra */}
                    <line x1="35" y1="35" x2="165" y2="35" stroke="#cbd5e1" strokeWidth="4" />
                    {/* Perchas */}
                    <text x="100" y="80" fill="#38bdf8" fontSize="10" fontFamily="monospace" textAnchor="middle">Barra para Perchas</text>
                    <text x="100" y="150" fill="#0f172a" fontSize="8" fontFamily="monospace" textAnchor="middle">Base para Calzado</text>
                  </svg>
                ) : (
                  <svg
                    className="w-full max-w-[260px] h-auto drop-shadow-lg"
                    viewBox={`0 0 ${bays * 70 + 40} ${levels * 60 + 50}`}
                  >
                    <rect x={20} y={20} width={bays * 70} height={levels * 60} fill={hasBackPanel ? activeColorHex : '#0b1120'} stroke="#94a3b8" strokeWidth={3} />
                    {Array.from({ length: levels - 1 }).map((_, li) => (
                      <line key={li} x1={20} y1={20 + (li + 1) * 60} x2={20 + bays * 70} y2={20 + (li + 1) * 60} stroke="#94a3b8" strokeWidth={2.5} />
                    ))}
                    {Array.from({ length: bays - 1 }).map((_, bi) => (
                      <line key={bi} x1={20 + (bi + 1) * 70} y1={20} x2={20 + (bi + 1) * 70} y2={20 + levels * 60} stroke="#94a3b8" strokeWidth={2.5} />
                    ))}
                  </svg>
                )}
              </div>

              {/* Ficha técnica rápida */}
              <div className="flex flex-col gap-1.5 text-xs font-mono pt-2 border-t" style={{ borderColor: '#1e293b' }}>
                <div className="flex justify-between text-slate-300">
                  <span>Dimensiones:</span>
                  <strong className="text-white">
                    {furnitureType === 'CORNER_L'
                      ? `Ala A: ${cornerLengthXM}m · Ala B: ${cornerLengthZM}m · Alto: ${totalHeightM}m`
                      : `${totalWidthM}m × ${totalHeightM}m × ${depthM}m`}
                  </strong>
                </div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Tipo de Mueble:</span>
                  <span className="text-sky-300 font-bold uppercase">{furnitureType.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Capacidad Estimada:</span>
                  <span className="text-emerald-400">~{estimatedCapacity.toLocaleString()} prendas</span>
                </div>
              </div>
            </div>

            {/* Columna Derecha: Parámetros */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              {/* Nombre y Pasillo */}
              <div className="p-3.5 rounded-2xl border flex flex-col gap-3" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
                <span className="font-mono text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Box size={14} className="text-sky-400" /> Identificación del Mueble
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-[10px] font-bold text-slate-400 uppercase">Nombre</label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-xl border text-xs font-mono font-bold outline-none focus:border-sky-500"
                      style={{ backgroundColor: '#090d16', borderColor: '#334155', color: '#ffffff' }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-[10px] font-bold text-slate-400 uppercase">Pasillo / Ubicación</label>
                    <input
                      type="text"
                      value={aisle}
                      onChange={e => setAisle(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-xl border text-xs font-mono outline-none focus:border-sky-500"
                      style={{ backgroundColor: '#090d16', borderColor: '#334155', color: '#ffffff' }}
                    />
                  </div>
                </div>
              </div>

              {/* Cuadrícula / Medidas específicas según mueble */}
              <div className="p-3.5 rounded-2xl border flex flex-col gap-3" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
                <span className="font-mono text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                  <SlidersHorizontal size={14} /> Dimensiones y Cuerpos
                </span>

                {furnitureType === 'CORNER_L' && (
                  <div className="flex flex-wrap items-center gap-2 pb-1 border-b border-slate-700/60">
                    <span className="font-mono text-[10px] text-amber-400 font-bold uppercase flex items-center gap-1">
                      <Sparkles size={12} /> Plantillas Esquinero:
                    </span>
                    <button
                      type="button"
                      onClick={() => { setBays(2); setSecondaryBays(2); setLevels(4); }}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-amber-400 text-slate-300 hover:text-white font-mono text-[10px] cursor-pointer transition-colors"
                    >
                      Estándar 2x2 (4 pisos)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setBays(1); setSecondaryBays(1); setLevels(3); }}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-amber-400 text-slate-300 hover:text-white font-mono text-[10px] cursor-pointer transition-colors"
                    >
                      Compacto 1x1 (3 pisos)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setBays(3); setSecondaryBays(3); setLevels(5); }}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-amber-400 text-slate-300 hover:text-white font-mono text-[10px] cursor-pointer transition-colors"
                    >
                      Gran Muro 3x3 (5 pisos)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setBays(3); setSecondaryBays(1); setLevels(4); }}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-amber-400 text-slate-300 hover:text-white font-mono text-[10px] cursor-pointer transition-colors"
                    >
                      Asimétrico 3x1 (4 pisos)
                    </button>
                  </div>
                )}

                {furnitureType === 'CORNER_L' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1 bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/60">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-300">Ala A (Pared X):</span>
                        <strong className="text-sky-400 text-sm font-black">{bays} cols</strong>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={6}
                        value={bays}
                        onChange={e => setBays(Number(e.target.value))}
                        className="accent-sky-400 cursor-pointer"
                      />
                      <span className="font-mono text-[9px] text-slate-400">~{cornerLengthXM} m largo</span>
                    </div>

                    <div className="flex flex-col gap-1 bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/60">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-300">Ala B (Pared Z):</span>
                        <strong className="text-amber-400 text-sm font-black">{secondaryBays} cols</strong>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={6}
                        value={secondaryBays}
                        onChange={e => setSecondaryBays(Number(e.target.value))}
                        className="accent-amber-400 cursor-pointer"
                      />
                      <span className="font-mono text-[9px] text-slate-400">~{cornerLengthZM} m largo</span>
                    </div>

                    <div className="flex flex-col gap-1 bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/60">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-300">Pisos / Baldas:</span>
                        <strong className="text-emerald-400 text-sm font-black">{levels} pisos</strong>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={6}
                        value={levels}
                        onChange={e => setLevels(Number(e.target.value))}
                        className="accent-emerald-400 cursor-pointer"
                      />
                      <span className="font-mono text-[9px] text-slate-400">~{totalHeightM} m altura</span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1 bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/60">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-300">Columnas / Cuerpos:</span>
                        <strong className="text-sky-400 text-sm font-black">{bays}</strong>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={6}
                        value={bays}
                        onChange={e => setBays(Number(e.target.value))}
                        className="accent-sky-400 cursor-pointer"
                      />
                    </div>

                    <div className="flex flex-col gap-1 bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/60">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-300">Pisos / Baldas de Altura:</span>
                        <strong className="text-sky-400 text-sm font-black">{levels}</strong>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={6}
                        value={levels}
                        onChange={e => setLevels(Number(e.target.value))}
                        className="accent-sky-400 cursor-pointer"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3 pt-1 border-t border-slate-700/60">
                  <div className="flex flex-col gap-1 bg-slate-900/60 p-2 rounded-xl">
                    <span className="text-[10px] font-mono text-slate-400">Ancho Módulo:</span>
                    <strong className="text-xs font-mono text-sky-300">{cubbyWidthCm} cm</strong>
                    <input
                      type="range"
                      min={40}
                      max={120}
                      step={5}
                      value={cubbyWidthCm}
                      onChange={e => setCubbyWidthCm(Number(e.target.value))}
                      className="accent-sky-400"
                    />
                  </div>

                  <div className="flex flex-col gap-1 bg-slate-900/60 p-2 rounded-xl">
                    <span className="text-[10px] font-mono text-slate-400">Alto Módulo:</span>
                    <strong className="text-xs font-mono text-sky-300">{levelHeightCm} cm</strong>
                    <input
                      type="range"
                      min={30}
                      max={100}
                      step={5}
                      value={levelHeightCm}
                      onChange={e => setLevelHeightCm(Number(e.target.value))}
                      className="accent-sky-400"
                    />
                  </div>

                  <div className="flex flex-col gap-1 bg-slate-900/60 p-2 rounded-xl">
                    <span className="text-[10px] font-mono text-slate-400">Profundidad:</span>
                    <strong className="text-xs font-mono text-sky-300">{depthCm} cm</strong>
                    <input
                      type="range"
                      min={35}
                      max={90}
                      step={5}
                      value={depthCm}
                      onChange={e => setDepthCm(Number(e.target.value))}
                      className="accent-sky-400"
                    />
                  </div>
                </div>
              </div>

              {/* Acabado de Madera Blanca */}
              <div className="p-3.5 rounded-2xl border flex flex-col gap-3" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
                <span className="font-mono text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Paintbrush size={14} className="text-sky-400" /> Acabado de Madera Blanca
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {WOOD_FINISHES.map(w => {
                    const isSelected = !useCustomColor && finish === w.id;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => {
                          setFinish(w.id as any);
                          setUseCustomColor(false);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'border-sky-400 bg-sky-500/20 ring-1 ring-sky-400'
                            : 'bg-slate-900/60 border-slate-700 hover:border-slate-500'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-6 h-6 rounded-lg border shadow-sm shrink-0" style={{ backgroundColor: w.color, borderColor: w.borderColor }} />
                          <span className="font-mono text-xs font-bold truncate text-slate-200">{w.label}</span>
                        </div>
                        {isSelected && <Check size={16} className="text-sky-400 shrink-0 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Botones */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t" style={{ borderColor: '#1e293b' }}>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border text-xs font-mono font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              style={{ borderColor: '#334155' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-mono font-black flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-sky-600/30"
            >
              <Plus size={16} /> Crear Mueble en 3D
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
