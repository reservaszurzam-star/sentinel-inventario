import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Package, MapPin, ArrowRight, Layers, ChevronDown, Check } from 'lucide-react';

type VariantStock = {
  id: string;
  name: string;
  color: string;
  size: string;
  totalQuantity: number;
};

// Common color names → hex for the chips. Falls back to a neutral tone.
import { getColorStyle } from '../lib/colors';

export function StockViewer({ session }: { session: any }) {
  const { model } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const brand = searchParams.get('b') || '';
  
  const [loading, setLoading] = useState(true);
  const [variants, setVariants] = useState<VariantStock[]>([]);
  const [totalStock, setTotalStock] = useState(0);
  const [binId, setBinId] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  const modelName = model || '';
  const variantId = searchParams.get('v');

  useEffect(() => {
    if (!modelName || !brand) return;

    const fetchStock = async () => {
      setLoading(true);
      setSelectedColor(null);

      try {
        let stockData: any[] = [];
        let productIds: string[] = [];

        // Normalize the model name (trim + collapse spaces) and use a
        // case-insensitive match so the name from the QR always resolves.
        const normalizedName = modelName.trim().replace(/\s+/g, ' ');

        const { data: pData, error: pError } = await supabase
          .from('products')
          .select('id')
          .eq('brand', brand)
          .ilike('name', normalizedName);
        if (pError) throw pError;

        // Fallback: relaxed search that ignores spaces/case in case the
        // stored name differs slightly from the QR label.
        let productsById = pData || [];
        if (productsById.length === 0 && modelName.trim()) {
          const compact = normalizedName.replace(/[^a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑ]/gi, '').toLowerCase();
          const { data: all } = await supabase
            .from('products')
            .select('id, name')
            .eq('brand', brand);
          if (all) {
            productsById = all.filter(p =>
              !!p.name &&
              p.name.trim().replace(/\s+/g, ' ').replace(/[^a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑ]/gi, '').toLowerCase() === compact
            ).map(p => ({ id: p.id, name: p.name }));
          }
        }

        if (productsById && productsById.length > 0) {
          productIds = productsById.map(p => p.id);
          const { data: sData, error: sError } = await supabase
            .from('stock_levels')
            .select('product_id, quantity')
            .in('product_id', productIds)
            .eq('brand', brand)
            .gt('quantity', 0);
          if (sError) throw sError;
          stockData = sData || [];
        }

        if (productIds.length === 0) {
          setVariants([]);
          setTotalStock(0);
          return;
        }

        const { data: products, error: prodError } = await supabase
          .from('products')
          .select('id, name, color, size')
          .in('id', productIds);
        if (prodError || !products) throw prodError;

        const stockByProduct: Record<string, number> = {};
        stockData.forEach(s => {
          stockByProduct[s.product_id] = (stockByProduct[s.product_id] || 0) + s.quantity;
        });

        let total = 0;
        const variantsWithStock = products.map(p => {
          const qty = stockByProduct[p.id] || 0;
          return {
            id: p.id,
            name: p.name,
            color: p.color || 'N/A',
            size: p.size || 'N/A',
            totalQuantity: qty,
          };
        }).filter(v => v.totalQuantity > 0);

        variantsWithStock.sort((a, b) => a.color.localeCompare(b.color) || a.size.localeCompare(b.size));
        
        variantsWithStock.forEach(v => {
          total += v.totalQuantity;
        });

        setVariants(variantsWithStock as any);
        setTotalStock(total);

        // Auto-select color if a variant ID was passed
        if (variantId) {
          const targetVariant = variantsWithStock.find(v => v.id === variantId);
          if (targetVariant) {
            setSelectedColor(targetVariant.color);
          }
        }
      } catch (error) {
        console.error('Error fetching stock:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStock();
  }, [modelName, brand]);

  // Group variants by color (colors with most total stock first)
  const colors = useMemo(() => {
    const map = new Map<string, VariantStock[]>();
    variants.forEach(v => {
      if (!map.has(v.color)) map.set(v.color, []);
      map.get(v.color)!.push(v);
    });
    return [...map.entries()]
      .map(([color, list]) => ({
        color,
        list,
        total: list.reduce((s, v) => s + v.totalQuantity, 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [variants]);

  const selectedList = useMemo(
    () => colors.find(c => c.color === selectedColor)?.list ?? [],
    [colors, selectedColor]
  );

  const handleSelectColor = (color: string) => {
    setSelectedColor(prev => (prev === color ? null : color));
  };

  const handleAction = () => {
    if (session) return navigate('/');
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] font-mono flex flex-col selection:bg-[var(--accent)] selection:text-[var(--bg)]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--surface)] border-b border-[var(--border)]">
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="w-11 h-11 rounded-full border border-[var(--border)]/20 flex items-center justify-center bg-[var(--bg)] shrink-0">
            <Package className="text-[var(--accent)]" size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-lg font-black tracking-widest truncate">{modelName}</h1>
            <p className="text-[10px] opacity-50 tracking-widest uppercase mt-0.5">{brand}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full max-w-lg mx-auto px-4 py-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-50">
            <div className="w-8 h-8 border-2 border-[var(--ink)] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs tracking-widest uppercase">Consultando Inventario...</span>
          </div>
        ) : variants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-50">
            <Package size={36} />
            <span className="text-xs tracking-widest uppercase text-center">Sin stock disponible</span>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Summary card */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 mb-6 flex items-center justify-between">
              <div>
                <p className="text-[10px] tracking-widest opacity-50 uppercase mb-1">Stock Total</p>
                <p className="text-4xl font-black tracking-tighter">{totalStock}</p>
              </div>
              {binId ? (
                <div className="text-right">
                  <p className="text-[10px] tracking-widest opacity-50 uppercase mb-1 flex items-center justify-end gap-1">
                    <MapPin size={10} /> Ubicación
                  </p>
                  <p className="text-sm font-bold bg-[var(--bg)] px-2 py-1 border border-[var(--border)] rounded">{binId}</p>
                </div>
              ) : (
                <div className="text-right">
                  <p className="text-[10px] tracking-widest opacity-50 uppercase mb-1">Variantes</p>
                  <p className="text-sm font-bold">{variants.length}</p>
                </div>
              )}
            </div>

            {/* Color selector */}
            <h2 className="text-xs font-bold tracking-widest opacity-50 uppercase mb-3 flex items-center gap-2">
              <Layers size={14} /> Colores disponibles
            </h2>

            <div className="flex flex-wrap gap-2 mb-6">
              {colors.map(({ color, total }) => {
                const style = getColorStyle(color);
                const light = style.isLight;
                const selected = selectedColor === color;
                return (
                  <button
                    key={color}
                    onClick={() => handleSelectColor(color)}
                    className={[
                      "flex items-center gap-2 px-3 py-2 rounded-full border transition-all active:scale-95",
                      selected ? "border-[var(--accent)]" : "border-[var(--border)]",
                    ].join(' ')}
                    style={{
                      background: style.background,
                      boxShadow: selected
                        ? `0 0 0 2px var(--bg), 0 0 0 4px var(--accent)`
                        : `0 2px 4px var(--border-soft)`,
                    }}
                  >
                    <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wide" style={{ color: style.isLight ? '#141414' : '#ffffff' }}>
                      {color}
                    </span>
                    <span
                      className="text-[10px] font-black tabular-nums px-1.5 py-0.5 rounded-full"
                      style={{ background: light ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.22)', color: light ? '#141414' : '#ffffff' }}
                    >
                      {total}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Sizes / variants for the selected color */}
            {selectedColor ? (
              <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
                <h2 className="text-xs font-bold tracking-widest opacity-50 uppercase mb-3 flex items-center gap-2">
                  <Check size={14} className="text-[var(--accent)]" /> {selectedColor} — tallas disponibles
                </h2>

                {selectedList.length === 0 ? (
                  <div className="text-center border border-dashed border-[var(--border)] rounded-xl py-6 opacity-60">
                    <p className="text-[10px] tracking-widest uppercase">Sin tallas con stock</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {selectedList.map(v => (
                      <div
                        key={v.id}
                        className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 flex items-center justify-between shadow-sm"
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-black tracking-wide">
                            Talla {v.size === 'N/A' ? 'Única' : v.size}
                          </span>
                          <span className="text-[10px] tracking-widest opacity-50 uppercase mt-0.5 truncate max-w-[180px] sm:max-w-[240px]">
                            {v.name}
                          </span>
                        </div>
                        <div className="bg-[var(--bg)] border border-[var(--border)] rounded-lg px-4 py-1.5 text-center shrink-0">
                          <div className="text-lg font-black leading-none">{v.totalQuantity}</div>
                          <div className="text-[8px] opacity-50 tracking-widest uppercase mt-0.5">uds</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center border border-dashed border-[var(--border)] rounded-xl py-6 px-4 opacity-60">
                <ChevronDown size={20} className="mx-auto mb-2" />
                <p className="text-[10px] tracking-widest uppercase">Toca un color para ver sus tallas</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating CTA */}
      <div className="sticky bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent pointer-events-none">
        <div className="max-w-lg mx-auto pointer-events-auto">
          <button 
            onClick={handleAction}
            className="w-full flex items-center justify-center gap-3 bg-[var(--ink)] text-[var(--bg)] p-4 rounded-xl font-bold tracking-widest uppercase active:scale-95 transition-all shadow-xl"
          >
            {session ? (
              <>Ir al Sistema <ArrowRight size={18} /></>
            ) : (
              <>Iniciar Sesión <ArrowRight size={18} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
