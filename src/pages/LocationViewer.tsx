import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Package, MapPin, Layers, Check } from 'lucide-react';

type LocationStock = {
  productId: string;
  name: string;
  color: string;
  size: string;
  quantity: number;
};

// Common color names → hex for the chips.
const COLOR_HEX: Record<string, string> = {
  BLACK: '#141414', NEGRO: '#141414',
  WHITE: '#ffffff', BLANCO: '#ffffff',
  RED: '#dc2626', ROJO: '#dc2626',
  BLUE: '#2563eb', AZUL: '#2563eb',
  GREEN: '#16a34a', VERDE: '#16a34a',
  YELLOW: '#eab308', AMARILLO: '#eab308',
  ORANGE: '#ea580c', NARANJA: '#ea580c',
  PINK: '#ec4899', ROSA: '#ec4899',
  PURPLE: '#9333ea', MORADO: '#9333ea',
  GRAY: '#9ca3af', GRIS: '#9ca3af',
  BEIGE: '#d6c6a2', BEGE: '#d6c6a2',
  BROWN: '#78350f', MARRON: '#78350f', CAFE: '#78350f',
  SILVER: '#cbd5e1', PLATA: '#cbd5e1',
  GOLD: '#ca8a04', DORADO: '#ca8a04',
};

function colorToHex(color: string): string {
  const key = color.trim().toUpperCase().replace(/[ _-]/g, '');
  return COLOR_HEX[key] ?? '#9ca3af';
}

function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '');
  if (c.length !== 6) return true;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

export function LocationViewer() {
  const { locationId } = useParams();
  const [searchParams] = useSearchParams();
  const brand = searchParams.get('b') || '';
  
  const [loading, setLoading] = useState(true);
  const [locationData, setLocationData] = useState<{name: string, type: string} | null>(null);
  const [items, setItems] = useState<LocationStock[]>([]);
  const [totalStock, setTotalStock] = useState(0);

  useEffect(() => {
    if (!locationId || !brand) return;

    const fetchLocationData = async () => {
      setLoading(true);
      try {
        const { data: loc } = await supabase
          .from('locations')
          .select('name, type')
          .eq('id', locationId)
          .single();

        if (loc) {
          setLocationData(loc);
        } else {
          setLoading(false);
          return;
        }

        const { data: sData, error: sError } = await supabase
          .from('stock_levels')
          .select('product_id, quantity')
          .eq('brand', brand)
          .eq('location_id', locationId)
          .gt('quantity', 0);
          
        if (sError) throw sError;

        if (!sData || sData.length === 0) {
          setItems([]);
          setTotalStock(0);
          setLoading(false);
          return;
        }

        const productIds = [...new Set(sData.map(s => s.product_id))];

        const { data: pData, error: pError } = await supabase
          .from('products')
          .select('id, name, color, size')
          .in('id', productIds);
          
        if (pError || !pData) throw pError;

        const stockByProduct: Record<string, number> = {};
        sData.forEach(s => {
          stockByProduct[s.product_id] = (stockByProduct[s.product_id] || 0) + s.quantity;
        });

        let total = 0;
        const mergedItems = pData.map(p => {
          const qty = stockByProduct[p.id] || 0;
          total += qty;
          return {
            productId: p.id,
            name: p.name,
            color: p.color || 'N/A',
            size: p.size || 'N/A',
            quantity: qty,
          };
        }).filter(i => i.quantity > 0)
          .sort((a, b) => a.name.localeCompare(b.name) || a.color.localeCompare(b.color) || a.size.localeCompare(b.size));

        setItems(mergedItems);
        setTotalStock(total);
      } catch (error) {
        console.error('Error fetching location stock:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLocationData();
  }, [locationId, brand]);

  // Agrupar por modelo (name)
  const models = useMemo(() => {
    const map = new Map<string, LocationStock[]>();
    items.forEach(i => {
      if (!map.has(i.name)) map.set(i.name, []);
      map.get(i.name)!.push(i);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  if (!locationId || !brand) {
    return <div className="p-8 text-center font-mono text-red-500 uppercase font-bold text-xs">Error: QR Inválido</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] font-mono flex flex-col selection:bg-[var(--accent)] selection:text-[var(--bg)]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[var(--surface)] border-b border-[var(--border)] shadow-sm">
        <div className="flex items-center gap-3 px-4 py-4 max-w-lg mx-auto">
          <div className="w-11 h-11 rounded-full border border-[var(--border)] flex items-center justify-center bg-[var(--bg)] shrink-0 shadow-[2px_2px_0_var(--border)]">
            <MapPin className="text-[var(--accent)]" size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-lg font-black tracking-widest truncate">{locationData?.name || 'UBICACIÓN'}</h1>
            <p className="text-[10px] opacity-60 tracking-widest uppercase mt-0.5">{locationData?.type || '...'} • {brand}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full max-w-lg mx-auto px-4 py-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-50">
            <div className="w-8 h-8 border-2 border-[var(--ink)] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs tracking-widest uppercase font-bold">Inspeccionando Gaveta...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 opacity-50">
            <Package size={36} />
            <span className="text-xs tracking-widest uppercase text-center font-bold">Ubicación Vacía</span>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Summary card */}
            <div className="bg-[var(--surface)] border-2 border-[var(--border)] rounded-xl p-5 mb-6 flex items-center justify-between shadow-[4px_4px_0_var(--border)]">
              <div>
                <p className="text-[10px] tracking-widest opacity-60 uppercase mb-1 font-bold">Prendas Totales</p>
                <p className="text-4xl font-black tracking-tighter">{totalStock}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] tracking-widest opacity-60 uppercase mb-1 font-bold flex items-center justify-end gap-1">
                  <Layers size={12} /> Modelos
                </p>
                <p className="text-2xl font-black">{models.length}</p>
              </div>
            </div>

            {/* Models list */}
            <h2 className="text-[10px] font-bold tracking-widest opacity-50 uppercase mb-3 ml-1">
              Contenido de la ubicación
            </h2>

            <div className="flex flex-col gap-4">
              {models.map(([modelName, variants]) => {
                const modelTotal = variants.reduce((acc, v) => acc + v.quantity, 0);
                return (
                  <div key={modelName} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden shadow-sm">
                    {/* Model Header */}
                    <div className="bg-[var(--bg-sidebar)] border-b border-[var(--border)] p-3 flex justify-between items-center">
                      <h3 className="text-xs font-black tracking-wide uppercase truncate pr-4">{modelName}</h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-[var(--ink)] text-[var(--bg)] rounded tabular-nums">
                        {modelTotal} unds
                      </span>
                    </div>
                    {/* Variants list */}
                    <div className="p-3 flex flex-col gap-2">
                      {variants.map(v => {
                        const hex = colorToHex(v.color);
                        const light = isLightColor(hex);
                        return (
                          <div key={v.productId} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span 
                                className="w-3 h-3 rounded-full border border-[var(--border)]"
                                style={{ background: hex }}
                              />
                              <span className="font-bold opacity-80">{v.color}</span>
                              <span className="opacity-40">•</span>
                              <span className="font-bold">{v.size}</span>
                            </div>
                            <span className="font-bold tabular-nums">{v.quantity}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
