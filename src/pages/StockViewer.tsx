import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Package, MapPin, ArrowRight, Layers, ArrowLeft } from 'lucide-react';

type VariantStock = {
  id: string;
  color: string;
  size: string;
  totalQuantity: number;
};

export function StockViewer({ session }: { session: any }) {
  const { model } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const brand = searchParams.get('b') || '';
  
  const [loading, setLoading] = useState(true);
  const [variants, setVariants] = useState<VariantStock[]>([]);
  const [totalStock, setTotalStock] = useState(0);
  const [binId, setBinId] = useState<string | null>(null);

  const modelName = model ? decodeURIComponent(model) : '';

  useEffect(() => {
    if (!modelName || !brand) return;

    const fetchStock = async () => {
      setLoading(true);
      
      try {
        // 1. Obtener los productos que coinciden con el modelo
        const { data: products, error: pError } = await supabase
          .from('products')
          .select('id, color, size')
          .eq('brand', brand)
          .eq('name', modelName);

        if (pError || !products) throw pError;

        const productIds = products.map(p => p.id);

        // 2. Obtener el stock de estos productos
        const { data: stockData, error: sError } = await supabase
          .from('stock_levels')
          .select('product_id, quantity')
          .in('product_id', productIds)
          .eq('brand', brand);

        if (sError) throw sError;

        // 3. Buscar el BIN correspondiente
        const { data: binData } = await supabase
          .from('locations')
          .select('id')
          .eq('brand', brand)
          .eq('type', 'BIN')
          .eq('name', modelName)
          .limit(1)
          .single();
          
        if (binData) setBinId(binData.id);

        // Agrupar stock por producto
        const stockByProduct: Record<string, number> = {};
        stockData?.forEach(s => {
          stockByProduct[s.product_id] = (stockByProduct[s.product_id] || 0) + s.quantity;
        });

        // Mapear variantes con su stock
        let total = 0;
        const variantsWithStock = products.map(p => {
          const qty = stockByProduct[p.id] || 0;
          total += qty;
          return {
            id: p.id,
            color: p.color || 'N/A',
            size: p.size || 'N/A',
            totalQuantity: qty,
          };
        }).filter(v => v.totalQuantity > 0)
          .sort((a, b) => a.color.localeCompare(b.color) || a.size.localeCompare(b.size));

        setVariants(variantsWithStock);
        setTotalStock(total);
      } catch (error) {
        console.error('Error fetching stock:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStock();
  }, [modelName, brand]);

  const handleAction = () => {
    if (session) {
      navigate('/');
    } else {
      window.location.href = '/'; // Fuerza recarga para ir al login normal
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] font-mono selection:bg-[var(--accent)] selection:text-[var(--bg)]">
      {/* Header tipo tarjeta móvil */}
      <div className="sticky top-0 bg-[var(--surface)] border-b border-[var(--border)] p-4 shadow-sm z-10 flex flex-col items-center">
        <div className="w-12 h-12 rounded-full border border-[var(--border)]/20 flex items-center justify-center mb-2 bg-[var(--bg)]">
          <Package className="text-[var(--accent)]" size={24} />
        </div>
        <h1 className="text-xl font-black tracking-widest text-center">{modelName}</h1>
        <p className="text-xs opacity-50 tracking-widest uppercase mt-1">{brand}</p>
      </div>

      <div className="p-4 max-w-lg mx-auto pb-24">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
            <div className="w-8 h-8 border-2 border-[var(--ink)] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs tracking-widest uppercase">Consultando Inventario...</span>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Tarjeta de Resumen */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4 mb-6 flex items-center justify-between">
              <div>
                <p className="text-[10px] tracking-widest opacity-50 uppercase mb-1">Stock Total</p>
                <p className="text-3xl font-black tracking-tighter">{totalStock}</p>
              </div>
              
              {binId && (
                <div className="text-right">
                  <p className="text-[10px] tracking-widest opacity-50 uppercase mb-1 flex items-center justify-end gap-1">
                    <MapPin size={10} /> Ubicación
                  </p>
                  <p className="text-sm font-bold bg-[var(--bg)] px-2 py-1 border border-[var(--border)] rounded">{binId}</p>
                </div>
              )}
            </div>

            {/* Desglose */}
            <h2 className="text-xs font-bold tracking-widest opacity-50 uppercase mb-4 flex items-center gap-2">
              <Layers size={14} /> Desglose por Variante
            </h2>

            {variants.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-[var(--border)] rounded-lg">
                <p className="opacity-50 text-sm tracking-widest uppercase">Sin stock disponible</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {variants.map(v => (
                  <div key={v.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3 flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold tracking-wide">{v.color}</span>
                      <span className="text-[10px] tracking-widest opacity-50 uppercase mt-0.5">Talla: {v.size}</span>
                    </div>
                    <div className="bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-1">
                      <span className="font-bold text-lg">{v.totalQuantity}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Botón Flotante Inferior */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent pointer-events-none">
        <div className="max-w-lg mx-auto pointer-events-auto">
          <button 
            onClick={handleAction}
            className="w-full flex items-center justify-center gap-3 bg-[var(--ink)] text-[var(--bg)] p-4 rounded-xl font-bold tracking-widest uppercase hover:brightness-110 transition-all active:scale-95 shadow-xl"
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
