import React, { useEffect, useRef, useState, useMemo } from 'react';
import { X, ScanLine, Package, Plus, Minus, Check, AlertTriangle, Layers, Search, Sparkles, Trash2, ArrowDown, ArrowRight, CornerDownLeft, RotateCcw } from 'lucide-react';
import { BrowserQRCodeReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import { cn } from '../lib/utils';
import { getColorHex } from '../lib/colors';
import { sortSizes } from '../lib/sizes';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ProductVariant = {
  id: string;
  name: string;
  code: string;
  color?: string;
  size?: string;
  category: string;
};

type StockLevelEntry = {
  productId: string;
  locationId: string;
  quantity: number;
};

type LineItem = { key: string; productId: string; qty: string };

interface FamilyQRModalProps {
  /** Pre-cargar una categoría o modelo sin abrir la cámara */
  initialQuery?: string;
  /** Lista completa de productos de la marca activa */
  products: ProductVariant[];
  /** Stock levels para mostrar disponibilidad en despachos */
  stockLevels?: StockLevelEntry[];
  /** ID de ubicación origen (para despachos — muestra disponibilidad) */
  fromLocation?: string;
  /** Tipo de operación — si es RECEPTION no mostramos stock disponible */
  opType?: 'RECEPTION' | 'DISPATCH' | 'TRANSFER';
  /** Callback al confirmar: devuelve los lineItems a agregar */
  onAdd: (items: LineItem[]) => void;
  /** Cierra el modal sin agregar nada */
  onClose: () => void;
}


function parseModelFromQR(raw: string): string | null {
  try {
    if (raw.includes('#/q/category/')) {
      const after = raw.split('#/q/category/')[1];
      const catEncoded = after.split('?')[0];
      return decodeURIComponent(catEncoded).trim().toUpperCase();
    }
    if (raw.includes('#/q/')) {
      const after = raw.split('#/q/')[1];
      const modelEncoded = after.split('?')[0];
      return decodeURIComponent(modelEncoded).trim().toUpperCase();
    }
    if (raw.trim().startsWith('{')) {
      const data = JSON.parse(raw);
      const name = data.category || data.name || data.code || '';
      return name.trim().toUpperCase() || null;
    }
    return raw.trim().toUpperCase() || null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FamilyQRModal — Excel Matrix Edition
// ─────────────────────────────────────────────────────────────────────────────

export const FamilyQRModal: React.FC<FamilyQRModalProps> = ({
  initialQuery,
  products,
  stockLevels = [],
  fromLocation,
  opType,
  onAdd,
  onClose,
}) => {
  // ── Scanner & Query State ────────────────────────────────────────────────
  const [scanning, setScanning] = useState(!initialQuery);
  const [scannedQuery, setScannedQuery] = useState<string | null>(initialQuery || null);
  const [scanError, setScanError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  // ── Active Model Sub-Tab ─────────────────────────────────────────────────
  const [activeModel, setActiveModel] = useState<string>('');

  // ── Search & Filter State ────────────────────────────────────────────────
  const [searchFilter, setSearchFilter] = useState('');

  // ── Matrix Quantities: { [productId]: number } ───────────────────────────
  const [qtys, setQtys] = useState<Record<string, number>>({});

  // ── 2D Inputs Ref Matrix for Excel Navigation ────────────────────────────
  // gridRefs.current[`${rowIndex}_${colIndex}`]
  const cellRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // ── Matched Products in the Family ───────────────────────────────────────
  const matchedProducts = useMemo(() => {
    if (!scannedQuery) return [];
    const query = scannedQuery.trim().toUpperCase();
    const cleanQuery = query.replace(/^CAT:/, '').replace(/^CATEGORY\//, '').trim();

    // 1. Direct Category Match (Master Category QR)
    const categoryMatches = products.filter(p => (p.category || '').trim().toUpperCase() === cleanQuery);
    if (categoryMatches.length > 0) {
      return categoryMatches;
    }

    // 2. Exact matches by Model Name
    const exact = products.filter(p => p.name.trim().toUpperCase() === query);
    if (exact.length > 0) {
      const broader = products.filter(p => {
        const n = p.name.trim().toUpperCase();
        return n !== query && (n.includes(query) || query.includes(n));
      });
      return [...exact, ...broader];
    }

    // 3. Contains query
    const contains = products.filter(p => {
      const n = p.name.trim().toUpperCase();
      const cat = (p.category || '').trim().toUpperCase();
      return n.includes(query) || query.includes(n) || cat.includes(query);
    });
    if (contains.length > 0) return contains;

    // 4. Word tokens
    const words = query.split(/\s+/).filter(w => w.length > 2);
    if (words.length > 0) {
      return products.filter(p => {
        const n = p.name.trim().toUpperCase();
        return words.every(w => n.includes(w));
      });
    }

    return [];
  }, [products, scannedQuery]);

  // Distinct sub-types / models in this family
  const distinctModels = useMemo(() => {
    return [...new Set(matchedProducts.map(p => p.name.trim()))].sort();
  }, [matchedProducts]);

  // Auto-select first model when query changes
  useEffect(() => {
    if (distinctModels.length > 0) {
      if (!activeModel || !distinctModels.includes(activeModel)) {
        setActiveModel(distinctModels[0]);
      }
    }
  }, [distinctModels, activeModel]);

  // Active Model's Products
  const currentModelProducts = useMemo(() => {
    if (!activeModel) return [];
    return matchedProducts.filter(p => p.name.trim() === activeModel);
  }, [matchedProducts, activeModel]);

  // Colors & Sizes for the Active Model
  const modelColors = useMemo(() => {
    const raw = ([...new Set(currentModelProducts.filter(p => p.color).map(p => p.color!))] as string[]);
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      return raw.filter(c => c.toLowerCase().includes(q)).sort();
    }
    return raw.sort();
  }, [currentModelProducts, searchFilter]);

  const modelSizes = useMemo(() => {
    return sortSizes([...new Set(currentModelProducts.filter(p => p.size).map(p => p.size!))] as string[]);
  }, [currentModelProducts]);

  // Map of (color, size) -> ProductVariant
  const variantMatrix = useMemo(() => {
    const map = new Map<string, ProductVariant>();
    currentModelProducts.forEach(p => {
      const key = `${p.color || 'S/C'}__${p.size || 'S/T'}`;
      map.set(key, p);
    });
    return map;
  }, [currentModelProducts]);

  // ── Total calculations ───────────────────────────────────────────────────
  const totalUnits = useMemo(() => {
    return (Object.values(qtys) as number[]).reduce((sum: number, q: number) => sum + (q > 0 ? q : 0), 0);
  }, [qtys]);

  const totalLinesSelected = useMemo(() => {
    return (Object.values(qtys) as number[]).filter((q: number) => q > 0).length;
  }, [qtys]);

  // Row total for a color
  const getRowTotal = (color: string) => {
    return modelSizes.reduce((sum, size) => {
      const v = variantMatrix.get(`${color}__${size}`);
      return sum + (v ? (qtys[v.id] || 0) : 0);
    }, 0);
  };

  // Column total for a size
  const getColTotal = (size: string) => {
    return modelColors.reduce((sum, color) => {
      const v = variantMatrix.get(`${color}__${size}`);
      return sum + (v ? (qtys[v.id] || 0) : 0);
    }, 0);
  };

  // Total for the current active model
  const currentModelTotal = useMemo(() => {
    return currentModelProducts.reduce((sum, p) => sum + (qtys[p.id] || 0), 0);
  }, [currentModelProducts, qtys]);

  // ── Stock availability helper ────────────────────────────────────────────
  const getAvail = (productId: string): number | null => {
    if (!fromLocation || opType === 'RECEPTION') return null;
    return stockLevels
      .filter(sl => sl.productId === productId && sl.locationId === fromLocation)
      .reduce((sum, sl) => sum + sl.quantity, 0);
  };

  // ── Camera Scanner Lifecycle ─────────────────────────────────────────────
  useEffect(() => {
    if (!scanning || !videoRef.current) return;

    const reader = new BrowserQRCodeReader();
    let active = true;

    reader.decodeFromVideoDevice(undefined, videoRef.current, (result, err, controls) => {
      if (!active) return;
      controlsRef.current = controls;
      if (result) {
        const query = parseModelFromQR(result.getText());
        if (query) {
          controls.stop();
          setScannedQuery(query);
          setScanning(false);
          setScanError(null);
        } else {
          setScanError('Código QR no reconocido. Prueba con un QR de prenda o modelo.');
        }
      }
    }).catch((e) => {
      if (active) setScanError(`Cámara no disponible: ${e?.message ?? 'Permiso denegado'}`);
    });

    return () => {
      active = false;
      controlsRef.current?.stop();
    };
  }, [scanning]);

  useEffect(() => {
    return () => { controlsRef.current?.stop(); };
  }, []);

  // ── Focus first input when matrix loads ──────────────────────────────────
  useEffect(() => {
    if (!scanning && modelColors.length > 0 && modelSizes.length > 0) {
      setTimeout(() => {
        const first = cellRefs.current.get('0_0');
        first?.focus();
        first?.select();
      }, 80);
    }
  }, [scanning, activeModel]);

  // ── Keyboard Navigation (Excel-like) ─────────────────────────────────────
  const handleCellKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
    const numRows = modelColors.length;
    const numCols = modelSizes.length;

    let targetR = r;
    let targetC = c;
    let handled = false;

    if (e.key === 'ArrowRight') {
      if (c < numCols - 1) {
        targetC = c + 1;
      } else if (r < numRows - 1) {
        targetR = r + 1;
        targetC = 0;
      }
      handled = true;
    } else if (e.key === 'ArrowLeft') {
      if (c > 0) {
        targetC = c - 1;
      } else if (r > 0) {
        targetR = r - 1;
        targetC = numCols - 1;
      }
      handled = true;
    } else if (e.key === 'ArrowDown' || (e.key === 'Enter' && !e.shiftKey)) {
      if (r < numRows - 1) {
        targetR = r + 1;
      } else if (c < numCols - 1) {
        targetR = 0;
        targetC = c + 1;
      }
      handled = true;
    } else if (e.key === 'ArrowUp' || (e.key === 'Enter' && e.shiftKey)) {
      if (r > 0) {
        targetR = r - 1;
      } else if (c > 0) {
        targetR = numRows - 1;
        targetC = c - 1;
      }
      handled = true;
    }

    if (handled) {
      e.preventDefault();
      const targetEl = cellRefs.current.get(`${targetR}_${targetC}`);
      if (targetEl) {
        targetEl.focus();
        targetEl.select();
      }
    }
  };

  // ── Helper Actions ───────────────────────────────────────────────────────
  const setQty = (productId: string, val: number) => {
    setQtys(prev => ({ ...prev, [productId]: Math.max(0, val) }));
  };

  const handleRowFill = (color: string, delta: number) => {
    setQtys(prev => {
      const next = { ...prev };
      modelSizes.forEach(size => {
        const v = variantMatrix.get(`${color}__${size}`);
        if (v) {
          const curr = next[v.id] || 0;
          next[v.id] = Math.max(0, curr + delta);
        }
      });
      return next;
    });
  };

  const handleRowClear = (color: string) => {
    setQtys(prev => {
      const next = { ...prev };
      modelSizes.forEach(size => {
        const v = variantMatrix.get(`${color}__${size}`);
        if (v) next[v.id] = 0;
      });
      return next;
    });
  };

  const handleModelClear = () => {
    setQtys(prev => {
      const next = { ...prev };
      currentModelProducts.forEach(p => { next[p.id] = 0; });
      return next;
    });
  };

  const handleConfirm = () => {
    const items: LineItem[] = (Object.entries(qtys) as [string, number][])
      .filter(([, q]) => Number(q) > 0)
      .map(([productId, q]) => ({
        key: `qr_${productId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        productId,
        qty: String(q),
      }));

    if (items.length === 0) return;
    onAdd(items);
    onClose();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Scanner Camera Screen
  // ─────────────────────────────────────────────────────────────────────────
  if (scanning) {
    return (
      <div className="fixed inset-0 z-[200] bg-black/90 flex flex-col items-center justify-center p-4" onClick={onClose}>
        <div
          className="w-full max-w-sm bg-[var(--bg)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-2xl flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)] bg-[var(--surface)]">
            <div className="flex items-center gap-2">
              <ScanLine size={16} className="text-emerald-500" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider">Escanear QR de Prenda / Familia</span>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full hover:bg-[var(--bg-input)] flex items-center justify-center opacity-60 hover:opacity-100 transition-all"
            >
              <X size={15} />
            </button>
          </div>

          {/* Camera Viewport */}
          <div className="relative bg-black aspect-square overflow-hidden flex items-center justify-center">
            <video ref={videoRef} className="w-full h-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-52 h-52">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-sm" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-sm" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-sm" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-sm" />
                <div className="absolute left-2 right-2 h-0.5 bg-emerald-400/90 animate-[scanline_2s_ease-in-out_infinite]" style={{ top: '50%' }} />
              </div>
            </div>
            <style>{`
              @keyframes scanline {
                0%, 100% { transform: translateY(-45px); opacity: 0.2; }
                50% { transform: translateY(45px); opacity: 1; }
              }
            `}</style>
          </div>

          {/* Instructions */}
          <div className="px-5 py-3 text-center bg-[var(--surface)]">
            <p className="text-xs font-semibold">Apunta al QR universal o de modelo</p>
            <p className="text-[11px] opacity-50 mt-0.5 font-mono">Ej: QR de Manga Larga, Camisa Waffle, etc.</p>
            {scanError && (
              <div className="mt-2.5 flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-500 text-left">
                <AlertTriangle size={12} className="shrink-0" />
                <span>{scanError}</span>
              </div>
            )}
          </div>

          {/* Manual Select Fallback */}
          <div className="px-5 pb-4 pt-1 bg-[var(--surface)] border-t border-[var(--border)]/30">
            <div className="text-[9px] font-mono opacity-40 text-center uppercase tracking-widest mb-1.5">O elige la prenda manualmente</div>
            <select
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs font-mono font-bold focus:outline-none"
              defaultValue=""
              onChange={e => {
                if (e.target.value) {
                  controlsRef.current?.stop();
                  setScannedQuery(e.target.value);
                  setScanning(false);
                }
              }}
            >
              <option value="">— Seleccionar modelo o familia —</option>
              {[...new Set(products.map(p => p.name.trim().toUpperCase()))].sort().map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: High-Productivity Excel Matrix View
  // ─────────────────────────────────────────────────────────────────────────
  const notFound = matchedProducts.length === 0;

  return (
    <div className="fixed inset-0 z-[200] bg-black/85 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-4xl max-h-[95vh] bg-[var(--bg)] border border-[var(--border)] rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)] bg-[var(--surface)] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-emerald-500/15 text-emerald-500 rounded-xl flex items-center justify-center shrink-0">
              <Sparkles size={17} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base tracking-tight truncate uppercase">{scannedQuery}</h2>
                {distinctModels.length > 1 && (
                  <span className="font-mono text-[10px] bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                    Familia ({distinctModels.length} tipos)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] opacity-50 font-mono">
                <span>{currentModelProducts.length} variantes en este tipo</span>
                <span>•</span>
                <span className="text-emerald-600 font-bold opacity-100 flex items-center gap-1">
                  ⌨️ Navega con Enter / Flechas
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { setScanning(true); setScannedQuery(null); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-mono font-bold hover:bg-[var(--bg-input)] transition-colors"
            >
              <ScanLine size={13} />
              <span className="hidden sm:inline">RESCANEAR</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-[var(--bg-input)] flex items-center justify-center opacity-60 hover:opacity-100 transition-all"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Sub-model Tabs (Clásico, Waffle, Piqué, etc.) */}
        {distinctModels.length > 1 && (
          <div className="flex items-center gap-1.5 px-5 py-2.5 border-b border-[var(--border)] bg-[var(--bg-sidebar)] overflow-x-auto shrink-0">
            <span className="text-[10px] font-mono font-bold uppercase opacity-40 shrink-0 mr-1 flex items-center gap-1">
              <Layers size={12} /> TIPO:
            </span>
            {distinctModels.map(m => {
              const count = matchedProducts
                .filter(p => p.name.trim() === m)
                .reduce((s, p) => s + (qtys[p.id] || 0), 0);
              const isSelected = activeModel === m;
              return (
                <button
                  key={m}
                  onClick={() => setActiveModel(m)}
                  className={cn(
                    'px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold uppercase whitespace-nowrap transition-all flex items-center gap-2 border',
                    isSelected
                      ? 'bg-[var(--ink)] text-[var(--ink-inv)] border-[var(--ink)] shadow-sm'
                      : 'bg-[var(--surface)] border-[var(--border)]/70 opacity-70 hover:opacity-100 hover:border-[var(--ink)]/50'
                  )}
                >
                  <span>{m}</span>
                  {count > 0 && (
                    <span className={cn(
                      'text-[9px] px-1.5 py-0.2 rounded-full font-black',
                      isSelected ? 'bg-emerald-400 text-black' : 'bg-emerald-500 text-white'
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Filter bar & Quick global controls */}
        {!notFound && (
          <div className="px-5 py-2 border-b border-[var(--border)]/40 bg-[var(--surface)] flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 flex-1 max-w-xs">
              <Search size={13} className="opacity-40 shrink-0" />
              <input
                type="text"
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                placeholder="Buscar color..."
                className="w-full bg-transparent text-xs font-mono outline-none placeholder:opacity-40"
              />
              {searchFilter && (
                <button onClick={() => setSearchFilter('')} className="opacity-40 hover:opacity-80">
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs font-mono">
              {currentModelTotal > 0 && (
                <button
                  onClick={handleModelClear}
                  className="flex items-center gap-1 text-[11px] text-red-500 hover:bg-red-500/10 px-2 py-1 rounded transition-colors"
                >
                  <Trash2 size={11} /> Limpiar {activeModel}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Table Matrix Container ─────────────────────────────────────── */}
        <div className="flex-1 overflow-auto p-4 sm:p-5">
          {notFound ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <AlertTriangle size={36} className="text-orange-400 opacity-60" />
              <div>
                <p className="font-bold text-base">No se encontraron prendas</p>
                <p className="text-xs opacity-50 mt-1 max-w-sm">
                  No hay productos con el nombre o familia <span className="font-mono font-bold">"{scannedQuery}"</span> en el inventario.
                </p>
              </div>
              <button
                onClick={() => { setScanning(true); setScannedQuery(null); }}
                className="mt-2 px-4 py-2 bg-[var(--ink)] text-[var(--ink-inv)] rounded-xl font-mono text-xs font-bold uppercase"
              >
                Escanear otro código
              </button>
            </div>
          ) : (
            <div className="border border-[var(--border)] rounded-xl overflow-hidden shadow-sm bg-[var(--surface)]">
              <table className="w-full text-left border-collapse">
                {/* ── Table Header: Sizes ── */}
                <thead>
                  <tr className="bg-[var(--bg-sidebar)] border-b border-[var(--border)] text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--ink)]">
                    <th className="py-3 px-4 w-44 sticky left-0 bg-[var(--bg-sidebar)] z-10 border-r border-[var(--border)]/60">
                      Color / Talla
                    </th>
                    {modelSizes.map((size) => (
                      <th key={size} className="py-3 px-2 text-center border-r border-[var(--border)]/40 min-w-[76px]">
                        <span className="text-sm font-black">{size}</span>
                      </th>
                    ))}
                    <th className="py-3 px-3 text-center w-20 border-r border-[var(--border)]/60 font-black">
                      Total
                    </th>
                    <th className="py-3 px-3 text-center w-28 opacity-60">
                      Llenado Rápido
                    </th>
                  </tr>
                </thead>

                {/* ── Table Body: Colors ── */}
                <tbody className="divide-y divide-[var(--border)]/40 text-xs font-mono">
                  {modelColors.map((color, rIdx) => {
                    const rowTotal = getRowTotal(color);
                    const colorDot = getColorHex(color);

                    return (
                      <tr key={color} className="hover:bg-[var(--row-hover)] transition-colors group">
                        {/* Color Name + Dot */}
                        <td className="py-2.5 px-4 sticky left-0 bg-[var(--surface)] group-hover:bg-[var(--row-hover)] z-10 border-r border-[var(--border)]/60">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0 shadow-xs"
                              style={{ backgroundColor: colorDot }}
                            />
                            <span className="font-bold text-xs uppercase tracking-tight truncate max-w-[130px]">
                              {color}
                            </span>
                          </div>
                        </td>

                        {/* Size Cells */}
                        {modelSizes.map((size, cIdx) => {
                          const variant = variantMatrix.get(`${color}__${size}`);
                          const qty = variant ? (qtys[variant.id] || 0) : 0;
                          const avail = variant ? getAvail(variant.id) : null;
                          const isOver = avail !== null && qty > avail;
                          const hasVariant = !!variant;

                          return (
                            <td key={size} className="p-1.5 text-center border-r border-[var(--border)]/40">
                              {hasVariant ? (
                                <div className="flex flex-col items-center gap-0.5">
                                  <input
                                    ref={el => {
                                      if (el) cellRefs.current.set(`${rIdx}_${cIdx}`, el);
                                      else cellRefs.current.delete(`${rIdx}_${cIdx}`);
                                    }}
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={qty === 0 ? '' : qty}
                                    placeholder="0"
                                    onChange={e => {
                                      const val = e.target.value.replace(/\D/g, '');
                                      setQty(variant.id, val === '' ? 0 : parseInt(val, 10));
                                    }}
                                    onFocus={e => e.target.select()}
                                    onKeyDown={e => handleCellKeyDown(e, rIdx, cIdx)}
                                    className={cn(
                                      'w-full h-9 text-center font-mono font-black text-sm rounded-lg border outline-none transition-all',
                                      qty > 0
                                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 shadow-xs ring-1 ring-emerald-500/30'
                                        : 'bg-[var(--bg)] border-[var(--border)]/80 text-[var(--ink)] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white',
                                      isOver && 'bg-red-500/15 border-red-500 text-red-600 ring-1 ring-red-500/30'
                                    )}
                                  />
                                  {avail !== null && (
                                    <span className={cn('text-[8px] font-mono', avail === 0 ? 'text-red-500 font-bold' : 'opacity-40')}>
                                      {avail} disp.
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="h-9 rounded-lg bg-[var(--border)]/10 flex items-center justify-center opacity-20 text-[10px]">
                                  —
                                </div>
                              )}
                            </td>
                          );
                        })}

                        {/* Row Total */}
                        <td className="py-2.5 px-3 text-center border-r border-[var(--border)]/60">
                          <span className={cn(
                            'font-black font-mono text-sm px-2 py-0.5 rounded-lg inline-block min-w-[36px]',
                            rowTotal > 0 ? 'bg-emerald-500/15 text-emerald-600 font-black' : 'opacity-30'
                          )}>
                            {rowTotal}
                          </span>
                        </td>

                        {/* Row Quick Action Presets */}
                        <td className="py-1.5 px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleRowFill(color, 1)}
                              className="px-2 py-1 rounded bg-[var(--bg)] border border-[var(--border)] text-[10px] font-mono font-bold hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-all"
                              title="Sumar +1 a todas las tallas"
                            >
                              +1
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRowFill(color, 6)}
                              className="px-2 py-1 rounded bg-[var(--bg)] border border-[var(--border)] text-[10px] font-mono font-bold hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-all hidden sm:inline-block"
                              title="Sumar +6 a todas las tallas (Media docena)"
                            >
                              +6
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRowFill(color, 12)}
                              className="px-2 py-1 rounded bg-[var(--bg)] border border-[var(--border)] text-[10px] font-mono font-bold hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-all hidden sm:inline-block"
                              title="Sumar +12 a todas las tallas (Docena)"
                            >
                              +12
                            </button>
                            {rowTotal > 0 && (
                              <button
                                type="button"
                                onClick={() => handleRowClear(color)}
                                className="p-1 rounded text-red-500 hover:bg-red-500/10 transition-colors"
                                title="Limpiar fila"
                              >
                                <RotateCcw size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* ── Table Footer: Column Totals ── */}
                <tfoot>
                  <tr className="bg-[var(--bg-sidebar)] border-t-2 border-[var(--border)] font-mono font-black text-xs text-[var(--ink)]">
                    <td className="py-3 px-4 sticky left-0 bg-[var(--bg-sidebar)] z-10 border-r border-[var(--border)]/60 uppercase">
                      Totales por Talla
                    </td>
                    {modelSizes.map((size) => {
                      const colTotal = getColTotal(size);
                      return (
                        <td key={size} className="py-3 px-2 text-center border-r border-[var(--border)]/40">
                          <span className={cn(
                            'text-sm font-black',
                            colTotal > 0 ? 'text-emerald-600' : 'opacity-30'
                          )}>
                            {colTotal}
                          </span>
                        </td>
                      );
                    })}
                    <td className="py-3 px-3 text-center border-r border-[var(--border)]/60 bg-emerald-500/15 text-emerald-700 text-base font-black">
                      {currentModelTotal}
                    </td>
                    <td className="py-3 px-2 text-center opacity-40 text-[10px] uppercase">
                      {activeModel}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* ── Footer CTA Summary ─────────────────────────────────────────── */}
        {!notFound && (
          <div className="shrink-0 border-t border-[var(--border)] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--surface)]">
            <div className="flex items-center gap-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black font-mono text-emerald-600">+{totalUnits}</span>
                <span className="text-xs font-bold uppercase opacity-70">
                  unidades en total ({totalLinesSelected} {totalLinesSelected === 1 ? 'línea' : 'líneas'})
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-[var(--border)] text-xs font-mono font-bold uppercase hover:bg-[var(--bg)] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={totalUnits === 0}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-mono text-xs font-bold uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed shadow-md transition-all active:scale-95"
              >
                <Check size={16} />
                <span>Agregar a Operación ({totalUnits} uds)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
