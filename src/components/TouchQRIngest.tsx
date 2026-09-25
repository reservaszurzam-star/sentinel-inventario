import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Package, Check, Plus, Minus, ArrowLeft, ArrowRight,
  Layers, MapPin, Sparkles, CheckCircle2, AlertCircle, RefreshCw, X
} from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import { StockViewer } from '../pages/StockViewer';
import { cn } from '../lib/utils';
import { getColorStyle, getColorHex, isLightColor } from '../lib/colors';
import { sortSizes } from '../lib/sizes';

interface TouchQRIngestProps {
  session?: any;
  isCategory?: boolean;
  initialCategory?: string;
  initialModel?: string;
  onClose?: () => void;
}

export const TouchQRIngest: React.FC<TouchQRIngestProps> = ({
  session,
  isCategory,
  initialCategory,
  initialModel,
  onClose,
}) => {
  const { category, model } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const brandParam = searchParams.get('b');
  const { products, locations, addTransaction, currentUser, activeBrand } = useAppContext();

  // Mode: Ingestion vs Viewer
  const [viewMode, setViewMode] = useState<'INGEST' | 'VIEW'>('INGEST');

  // Targeted target query (Category name or Model name)
  const targetCategory = (initialCategory || (isCategory ? decodeURIComponent(category || '').trim() : '')).trim();
  const targetModel = (initialModel || (!isCategory ? decodeURIComponent(model || '').trim() : '')).trim();

  // Filter products belonging to this category or model
  const familyProducts = useMemo(() => {
    return products.filter(p => {
      // Check brand if specified
      if (brandParam && p.brand && p.brand.toUpperCase() !== brandParam.toUpperCase()) {
        return false;
      }
      if (isCategory && targetCategory) {
        return (p.category || '').trim().toUpperCase() === targetCategory.toUpperCase();
      }
      if (!isCategory && targetModel) {
        return (p.name || '').trim().toUpperCase() === targetModel.toUpperCase();
      }
      return false;
    });
  }, [products, isCategory, targetCategory, targetModel, brandParam]);

  // Distinct models in this family
  const distinctModels = useMemo(() => {
    return [...new Set(familyProducts.map(p => p.name.trim()))].sort();
  }, [familyProducts]);

  const [activeModel, setActiveModel] = useState<string>('');

  useEffect(() => {
    if (distinctModels.length > 0 && (!activeModel || !distinctModels.includes(activeModel))) {
      setActiveModel(distinctModels[0]);
    }
  }, [distinctModels, activeModel]);

  // Active Model's products
  const activeModelProducts = useMemo(() => {
    if (!activeModel) return [];
    return familyProducts.filter(p => p.name.trim() === activeModel);
  }, [familyProducts, activeModel]);

  // Distinct colors for active model
  const colors = useMemo(() => {
    const raw = [...new Set(activeModelProducts.filter(p => p.color).map(p => p.color!))];
    return raw.sort();
  }, [activeModelProducts]);

  const [selectedColor, setSelectedColor] = useState<string>('');

  useEffect(() => {
    if (colors.length > 0 && (!selectedColor || !colors.includes(selectedColor))) {
      setSelectedColor(colors[0]);
    } else if (colors.length === 0) {
      setSelectedColor('');
    }
  }, [colors, selectedColor]);

  // Distinct sizes for active model & selected color
  const currentVariants = useMemo(() => {
    if (selectedColor) {
      return activeModelProducts.filter(p => p.color === selectedColor);
    }
    return activeModelProducts;
  }, [activeModelProducts, selectedColor]);

  const sizes = useMemo(() => {
    const rawSizes = ([...new Set(currentVariants.filter(p => p.size).map(p => p.size!))] as string[]);
    return sortSizes(rawSizes);
  }, [currentVariants]);

  // Quantities: { [productId]: number }
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Destination Location
  const [destLocationId, setDestLocationId] = useState<string>('');
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  useEffect(() => {
    if (!destLocationId && locations.length > 0) {
      const defaultLoc = locations.find(l => l.name.toUpperCase().includes('RESERVA')) || locations[0];
      setDestLocationId(defaultLoc.id);
    }
  }, [locations, destLocationId]);

  const activeLocation = locations.find(l => l.id === destLocationId) || locations[0];

  // Helper to adjust quantity
  const setProductQty = (productId: string, qty: number) => {
    const safeQty = Math.max(0, isNaN(qty) ? 0 : qty);
    setQuantities(prev => ({
      ...prev,
      [productId]: safeQty,
    }));
  };

  const addQty = (productId: string, delta: number) => {
    setQuantities(prev => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [productId]: next };
    });
  };

  // Grand total calculation across all models & colors
  const totalUnits = useMemo(() => {
    return (Object.values(quantities) as number[]).reduce((acc: number, q: number) => acc + (q > 0 ? q : 0), 0);
  }, [quantities]);

  const totalLines = useMemo(() => {
    return (Object.values(quantities) as number[]).filter((q: number) => q > 0).length;
  }, [quantities]);

  // Color count summary
  const getColorTotal = (colorName: string) => {
    const colorProds = activeModelProducts.filter(p => p.color === colorName);
    return colorProds.reduce((sum, p) => sum + (quantities[p.id] || 0), 0);
  };

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<{ count: number; locName: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleConfirmIngest = async () => {
    if (totalUnits <= 0 || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const targetLoc = destLocationId || locations[0]?.id;
      const entries = (Object.entries(quantities) as [string, number][]).filter(([_, qty]) => qty > 0);

      const referenceName = isCategory ? targetCategory : (activeModel || 'QR');

      for (const [productId, qty] of entries) {
        await addTransaction({
          type: 'RECEPTION',
          productId,
          quantity: qty,
          toLocationId: targetLoc,
          reference: `ING-QR-TACTIL-${referenceName}`,
          user: currentUser?.username || 'OPERARIO_MOVIL',
        });
      }

      setSubmitSuccess({
        count: totalUnits,
        locName: activeLocation?.name || 'Ubicación seleccionada',
      });
      setQuantities({});
    } catch (err: any) {
      console.error('Error al ingresar stock táctil:', err);
      setErrorMsg(err?.message || 'Ocurrió un error al registrar las prendas.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (onClose) return onClose();
    if (session) return navigate('/operations');
    navigate('/');
  };

  // If user switched to View mode or is not logged in and wants to see stock
  if (viewMode === 'VIEW') {
    return (
      <div className="relative">
        <div className="fixed top-3 right-3 z-50">
          <button
            onClick={() => setViewMode('INGEST')}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-mono font-bold shadow-lg uppercase active:scale-95 transition-all"
          >
            <Sparkles size={14} />
            <span>Volver al Modo Ingreso</span>
          </button>
        </div>
        <StockViewer session={session} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117] text-white font-sans flex flex-col selection:bg-emerald-500 selection:text-black">
      {/* ── TOP APP BAR ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-[#161b22]/90 backdrop-blur-md border-b border-white/10 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={handleBack}
              className="w-9 h-9 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 flex items-center justify-center shrink-0 active:scale-95 transition-all"
              title="Volver"
            >
              <ArrowLeft size={16} />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  INGRESO RÁPIDO
                </span>
                <span className="text-[10px] font-mono opacity-50 uppercase truncate">
                  {brandParam || activeBrand}
                </span>
              </div>
              <h1 className="text-base font-black tracking-tight truncate uppercase mt-0.5">
                {isCategory ? targetCategory : (targetModel || 'Prendas')}
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setViewMode('VIEW')}
            className="shrink-0 flex items-center gap-1 border border-white/15 bg-white/5 hover:bg-white/10 text-white/80 px-2.5 py-1.5 rounded-xl font-mono text-[10px] font-bold uppercase transition-all"
          >
            <Package size={13} className="text-emerald-400" />
            <span className="hidden sm:inline">Ver Stock</span>
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT AREA ─────────────────────────────────────────────────── */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-5 pb-36 flex flex-col gap-6">

        {/* Error notification banner */}
        {errorMsg && (
          <div className="p-3 bg-red-500/15 border border-red-500/50 text-red-400 font-mono text-xs rounded-xl flex items-center gap-2.5">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Empty state if category/model has no products */}
        {familyProducts.length === 0 && (
          <div className="text-center py-16 flex flex-col items-center gap-3 opacity-60">
            <Package size={40} className="stroke-1 text-white/40" />
            <p className="font-mono text-xs uppercase tracking-wider">
              No se encontraron prendas para "{isCategory ? targetCategory : targetModel}"
            </p>
            <button
              onClick={handleBack}
              className="mt-2 text-xs font-mono font-bold text-emerald-400 underline uppercase"
            >
              Volver a Operaciones
            </button>
          </div>
        )}

        {/* ── 1. MODEL CAROUSEL (If Category has multiple models) ─────────────── */}
        {distinctModels.length > 1 && (
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="font-mono text-[11px] font-bold uppercase tracking-wider text-white/60 flex items-center gap-1.5">
                <Layers size={13} className="text-emerald-400" /> Modelos disponibles ({distinctModels.length})
              </label>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x">
              {distinctModels.map(mName => {
                const isSelected = activeModel === mName;
                const mProds = familyProducts.filter(p => p.name.trim() === mName);
                const countActive = mProds.reduce((sum, p) => sum + (quantities[p.id] || 0), 0);

                return (
                  <button
                    key={mName}
                    type="button"
                    onClick={() => setActiveModel(mName)}
                    className={cn(
                      'snap-start shrink-0 px-4 py-3 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col gap-1 min-w-[140px]',
                      isSelected
                        ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500'
                        : 'bg-[#161b22] border-white/10 text-white/70 hover:border-white/20'
                    )}
                  >
                    <span className="font-mono text-xs font-black uppercase tracking-tight truncate max-w-[160px]">
                      {mName}
                    </span>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <span className="font-mono text-[9px] text-white/40 uppercase">
                        {mProds.length} var.
                      </span>
                      {countActive > 0 && (
                        <span className="font-mono text-[9px] font-black bg-emerald-500 text-black px-1.5 py-0.2 rounded-full">
                          +{countActive}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ── 2. COLOR SWATCH SELECTOR (CALIBRATED & WRAP) ─────────────────── */}
        {colors.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <label className="font-mono text-[11px] font-bold uppercase tracking-wider text-white/60">
                Selecciona Color ({colors.length})
              </label>
              {selectedColor && (
                <span className="font-mono text-xs font-black uppercase text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  ACTIVO: {selectedColor}
                </span>
              )}
            </div>

            {/* Flex Wrap: Sin scroll horizontal forzado, todos los colores visibles */}
            <div className="flex flex-wrap gap-2 sm:gap-2.5">
              {colors.map(colorName => {
                const styleInfo = getColorStyle(colorName);
                const isSelected = selectedColor === colorName;
                const colorTotal = getColorTotal(colorName);

                return (
                  <button
                    key={colorName}
                    type="button"
                    onClick={() => setSelectedColor(colorName)}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all active:scale-95 group',
                      isSelected
                        ? 'bg-white/10 border-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500'
                        : 'bg-[#161b22] border-white/10 text-white/70 hover:border-white/20 hover:text-white'
                    )}
                  >
                    {/* Círculo de color textil real o textura jaspeada */}
                    <div className="relative shrink-0">
                      <div
                        className={cn(
                          'w-6 h-6 rounded-full border shadow-inner transition-transform',
                          isSelected ? 'scale-110 border-white ring-2 ring-emerald-500/50' : 'border-black/30'
                        )}
                        style={{
                          backgroundColor: styleInfo.hex,
                          backgroundImage: styleInfo.bg || undefined,
                        }}
                      />
                      {colorTotal > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-black font-mono text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-[#0d1117]">
                          {colorTotal}
                        </span>
                      )}
                    </div>

                    <span className="font-mono text-xs font-bold uppercase tracking-tight">
                      {colorName}
                    </span>

                    {isSelected && (
                      <Check size={14} className="text-emerald-400 stroke-[3] ml-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ── 3. SIZES TILES GRID (SIEMPRE 1 SOLA FILA HORIZONTAL) ────────────── */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="font-mono text-[11px] font-bold uppercase tracking-wider text-white/60">
              Tallas y Cantidades (1 sola fila)
            </label>
            <span className="font-mono text-[10px] opacity-40 uppercase">
              Escribe el número o pulsa los botones
            </span>
          </div>

          <div
            className="grid gap-2 sm:gap-3 w-full"
            style={{
              gridTemplateColumns: sizes.length > 0 ? `repeat(${sizes.length}, minmax(0, 1fr))` : 'repeat(4, minmax(0, 1fr))',
            }}
          >
            {sizes.map(sizeName => {
              const variant = currentVariants.find(p => p.size === sizeName);
              if (!variant) return null;

              const qty = quantities[variant.id] || 0;
              const hasQty = qty > 0;

              return (
                <div
                  key={sizeName}
                  className={cn(
                    'border rounded-2xl p-3 sm:p-4 flex flex-col justify-between gap-2.5 transition-all relative overflow-hidden',
                    hasQty
                      ? 'bg-emerald-950/20 border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.1)]'
                      : 'bg-[#161b22] border-white/10 hover:border-white/20'
                  )}
                >
                  {/* Top: Size Letter & Current Badge */}
                  <div className="flex items-center justify-between">
                    <span className="text-xl sm:text-2xl font-black font-mono tracking-tight uppercase text-white">
                      {sizeName}
                    </span>

                    {hasQty && (
                      <span className="font-mono text-[10px] sm:text-xs font-black text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded-full border border-emerald-500/30">
                        {qty}
                      </span>
                    )}
                  </div>

                  {/* Direct Editable Numeric Input */}
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={qty === 0 ? '' : qty}
                      placeholder="0"
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setProductQty(variant.id, isNaN(val) ? 0 : val);
                      }}
                      className={cn(
                        'w-full text-center text-2xl sm:text-3xl font-black font-mono rounded-xl py-2 px-1 outline-none transition-all',
                        'border-2 focus:ring-4 focus:ring-emerald-500/20',
                        hasQty
                          ? 'bg-black/50 border-emerald-500 text-emerald-300'
                          : 'bg-black/30 border-white/15 text-white focus:border-emerald-500'
                      )}
                    />
                  </div>

                  {/* Stepper Buttons (-1, +1, +5, +10) */}
                  <div className="grid grid-cols-2 gap-1 pt-0.5">
                    <button
                      type="button"
                      onClick={() => addQty(variant.id, -1)}
                      disabled={qty <= 0}
                      className="py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-20 text-white/70 font-mono text-[11px] font-bold rounded-lg active:scale-95 transition-all"
                      title="Restar 1"
                    >
                      -1
                    </button>
                    <button
                      type="button"
                      onClick={() => addQty(variant.id, 1)}
                      className="py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-mono text-[11px] font-black rounded-lg active:scale-95 transition-all"
                    >
                      +1
                    </button>
                    <button
                      type="button"
                      onClick={() => addQty(variant.id, 5)}
                      className="py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-mono text-[11px] font-black rounded-lg active:scale-95 transition-all"
                    >
                      +5
                    </button>
                    <button
                      type="button"
                      onClick={() => addQty(variant.id, 10)}
                      className="py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-mono text-[11px] font-black rounded-lg active:scale-95 transition-all"
                    >
                      +10
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* ── 4. FIXED FLOATING BOTTOM DOCK ────────────────────────────────────── */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-[#161b22]/95 backdrop-blur-xl border-t border-white/10 p-4 shadow-2xl">
        <div className="max-w-2xl mx-auto flex flex-col gap-3">
          {/* Summary Details Row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black font-mono text-white">
                {totalUnits}
              </span>
              <span className="font-mono text-xs font-bold text-white/50 uppercase">
                {totalUnits === 1 ? 'prenda' : 'prendas'} ({totalLines} {totalLines === 1 ? 'variante' : 'variantes'})
              </span>
            </div>

            {/* Target Location Chip Selector */}
            <button
              type="button"
              onClick={() => setShowLocationPicker(true)}
              className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/15 px-3 py-1.5 rounded-xl font-mono text-xs font-bold text-white/80 active:scale-95 transition-all"
            >
              <MapPin size={12} className="text-emerald-400 shrink-0" />
              <span className="truncate max-w-[130px] sm:max-w-[180px] uppercase">
                {activeLocation?.name || 'Ubicación'}
              </span>
            </button>
          </div>

          {/* Action Confirm Button */}
          <button
            type="button"
            disabled={totalUnits <= 0 || isSubmitting}
            onClick={handleConfirmIngest}
            className={cn(
              'w-full py-4 rounded-2xl font-mono text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all shadow-xl active:scale-98',
              totalUnits > 0 && !isSubmitting
                ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_0_30px_rgba(16,185,129,0.3)] cursor-pointer'
                : 'bg-white/10 text-white/30 cursor-not-allowed'
            )}
          >
            {isSubmitting ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                <span>REGISTRANDO EN EL SISTEMA...</span>
              </>
            ) : (
              <>
                <Sparkles size={18} />
                <span>CONFIRMAR INGRESO AL SISTEMA</span>
              </>
            )}
          </button>
        </div>
      </footer>

      {/* ── 5. LOCATION PICKER BOTTOM SHEET MODAL ────────────────────────────── */}
      {showLocationPicker && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-[#161b22] border border-white/15 rounded-t-3xl sm:rounded-3xl p-5 flex flex-col gap-4 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-sm font-black uppercase flex items-center gap-2">
                <MapPin size={16} className="text-emerald-400" />
                Selecciona Ubicación Destino
              </h3>
              <button
                onClick={() => setShowLocationPicker(false)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-1">
              {locations.map(loc => {
                const isSelected = destLocationId === loc.id;
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => {
                      setDestLocationId(loc.id);
                      setShowLocationPicker(false);
                    }}
                    className={cn(
                      'flex items-center justify-between p-3.5 rounded-xl border text-left font-mono text-xs font-bold uppercase transition-all',
                      isSelected
                        ? 'bg-emerald-500/15 border-emerald-500 text-white'
                        : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                    )}
                  >
                    <span>{loc.name}</span>
                    {isSelected && <Check size={16} className="text-emerald-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── 6. SUCCESS CONFIRMATION OVERLAY ──────────────────────────────────── */}
      {submitSuccess && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-[#161b22] border-2 border-emerald-500 rounded-3xl p-6 flex flex-col items-center text-center gap-4 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center text-emerald-400">
              <CheckCircle2 size={36} />
            </div>

            <div className="flex flex-col gap-1">
              <h3 className="text-xl font-black uppercase font-mono text-white">
                ¡Ingreso Registrado!
              </h3>
              <p className="font-mono text-xs text-white/60">
                Se ingresaron <strong className="text-emerald-400">{submitSuccess.count} prendas</strong> en la ubicación <strong className="text-white">{submitSuccess.locName}</strong> correctamente.
              </p>
            </div>

            <div className="w-full flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSubmitSuccess(null)}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-mono text-xs font-black uppercase rounded-xl transition-all"
              >
                Seguir Ingresando
              </button>

              <button
                type="button"
                onClick={() => navigate('/operations')}
                className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/15 text-white font-mono text-xs font-bold uppercase rounded-xl transition-all"
              >
                Ir a Operaciones
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
