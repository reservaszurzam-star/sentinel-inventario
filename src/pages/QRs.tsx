import React, { useState, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, RefreshCw, Package, Search, Layers } from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import type { Product } from '../types';

export function QRs() {
  const { activeBrand, products, stockLevels } = useAppContext();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showOnlyWithStock, setShowOnlyWithStock] = useState(false);

  // Total stock per product
  const productStock = useMemo(() => {
    const map = new Map<string, number>();
    stockLevels.forEach(s => {
      map.set(s.productId, (map.get(s.productId) ?? 0) + s.quantity);
    });
    return map;
  }, [stockLevels]);

  // Products with QR — one QR per unique SKU (code), deduplicated.
  const qrProducts = useMemo(() => {
    // Merge duplicate product rows by code (same SKU) so each SKU gets exactly one QR.
    const byCode = new Map<string, any>();
    products.forEach(p => {
      const key = (p.code || '').toUpperCase() || `${p.name}|${p.color ?? ''}|${p.size ?? ''}`;
      const qty = productStock.get(p.id) ?? 0;
      const existing = byCode.get(key);
      if (existing) {
        existing.qty += qty;
        if (!existing.color && p.color) existing.color = p.color;
        if (!existing.size && p.size) existing.size = p.size;
      } else {
        byCode.set(key, { ...p, qty });
      }
    });
    const merged = Array.from(byCode.values());
    return merged
      .filter(p => { if (showOnlyWithStock) return p.qty > 0; return true; })
      .filter(p => {
        const s = search.toLowerCase();
        if (!s) return true;
        return p.code.toLowerCase().includes(s) || p.name.toLowerCase().includes(s);
      })
      .sort((a, b) => a.name.localeCompare(b.name) || (a.color || '').localeCompare(b.color || ''));
  }, [products, productStock, search, showOnlyWithStock]);

  // Count unique SKUs that have stock (after dedupe by code)
  const totalWithStock = useMemo(() => {
    const byCode = new Map<string, number>();
    products.forEach(p => {
      const key = (p.code || '').toUpperCase() || `${p.name}|${p.color ?? ''}|${p.size ?? ''}`;
      const qty = productStock.get(p.id) ?? 0;
      const prev = byCode.get(key) ?? 0;
      byCode.set(key, prev + qty);
    });
    let count = 0;
    byCode.forEach(qty => { if (qty > 0) count++; });
    return count;
  }, [products, productStock]);

  const getQRValue = (p: { id: string; code: string; name: string; color?: string; size?: string }) => {
    // Same JSON shape used by QRModal so the scanner in Operations reads it correctly
    return JSON.stringify({ id: p.id, code: p.code, name: p.name, color: p.color, size: p.size, brand: activeBrand });
  };

  const handlePrint = () => {
    window.print();
  };

  const doRefresh = () => {
    setRefreshing(true);
    // AppContext uses realtime subscriptions, so data stays fresh automatically.
    // This just gives visual feedback to the user.
    setTimeout(() => setRefreshing(false), 600);
  };

  const labelFor = (p: { color?: string; size?: string }) =>
    [p.color, p.size].filter(Boolean).join(' / ');

  return (
    <div className="flex flex-col h-full bg-[var(--bg)] p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-widest text-[var(--ink)]">CÓDIGOS QR · PRODUCTOS</h1>
          <p className="text-sm text-[var(--ink)]/50 tracking-widest uppercase mt-1">
            QRs por SKU en inventario ({activeBrand})
          </p>
        </div>

        <div className="flex gap-2 no-print flex-wrap">
          <button
            onClick={doRefresh}
            className="flex items-center gap-2 px-3 py-2 border border-[var(--border)] rounded font-mono text-xs tracking-widest hover:bg-[var(--surface)] transition-colors"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            ACTUALIZAR
          </button>
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-2 bg-[var(--accent)] text-[var(--bg)] rounded font-mono text-xs tracking-widest font-bold hover:brightness-110 transition-all"
          >
            <Printer size={14} />
            IMPRIMIR TODOS
          </button>
        </div>
      </div>

      {/* Toolbar: search + stock filter */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4 no-print">
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-40" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="BUSCAR SKU O PRODUCTO..."
            className="w-full bg-[var(--surface)] border border-[var(--border)]/40 rounded-lg pl-8 pr-3 py-2 font-mono text-xs font-bold uppercase focus:outline-none focus:border-[var(--border)] transition-all"
          />
        </div>
        <button
          onClick={() => setShowOnlyWithStock(v => !v)}
          className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-mono text-xs font-bold uppercase transition-all border ${
            showOnlyWithStock
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-[var(--surface)] border-[var(--border)]/40 text-[var(--ink)] hover:bg-[var(--border)]/10'
          }`}
        >
          <Package size={14} />
          SOLO CON STOCK ({totalWithStock})
        </button>
      </div>

      <div className="font-mono text-[10px] uppercase tracking-widest opacity-50 mb-3">
        {qrProducts.length} SKU{qrProducts.length !== 1 ? 's' : ''} {activeBrand}
      </div>

      {qrProducts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--ink)]/40">
          <Layers size={40} />
          <p className="font-mono text-xs uppercase tracking-widest text-center">
            No hay productos en inventario para mostrar
          </p>
          <p className="font-mono text-[10px] uppercase tracking-widest opacity-60">
            Los QRs se generan automáticamente al crear un SKU
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-6 print:grid-cols-3 print:gap-3 print:p-0">
            {qrProducts.map((p) => (
              <div
                key={p.id}
                className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 flex flex-col items-center text-center hover:shadow-md transition-shadow print:break-inside-avoid print:border-black print:bg-white"
              >
                {/* Name */}
                <h3 className="font-mono text-[11px] sm:text-xs font-bold tracking-wide uppercase line-clamp-2 min-h-[32px] mb-1">
                  {p.name}
                </h3>

                {/* QR */}
                <div className="bg-white p-1.5 rounded mb-1.5">
                  <QRCodeSVG
                    value={getQRValue(p)}
                    size={110}
                    level="M"
                    includeMargin={false}
                  />
                </div>

                {/* Code + attrs */}
                <div className="font-mono text-[10px] font-black text-[var(--ink)] break-all">{p.code}</div>
                {(p.color || p.size) && (
                  <div className="font-mono text-[9px] opacity-60 mt-0.5 uppercase tracking-wide">
                    {labelFor(p)}
                  </div>
                )}

                {/* Stock badge */}
                <div className={`mt-auto pt-1.5 font-mono text-[9px] font-bold uppercase tracking-wider ${
                  p.qty > 0 ? 'text-green-600' : 'text-red-500'
                }`}>
                  {p.qty > 0 ? `${p.qty} uds` : 'sin stock'}
                </div>
              </div>
          ))}
          </div>
        </div>
      )}
      
      {/* Estilos para impresión */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .no-print {
            display: none !important;
          }
          .print\\:grid-cols-3 {
            visibility: visible;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print\\:grid-cols-3 * {
            visibility: visible;
          }
        }
      `}</style>
    </div>
  );
}
