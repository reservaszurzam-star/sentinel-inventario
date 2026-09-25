import React, { useState, useMemo } from 'react';
import { ScanLine, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { TransactionType } from '../../types';
import { sortSizes } from '../../lib/sizes';
import { LineItem } from './constants';

export interface CascadeProps {
  products: { id: string; name: string; code: string; color?: string; size?: string; category: string }[];
  onAdd: (item: LineItem) => void;
  onScanClick?: () => void;
  stockLevels?: { productId: string; locationId: string; quantity: number }[];
  fromLocation?: string;
  opType?: TransactionType;
}

export const CascadeProductSelector: React.FC<CascadeProps> = ({
  products,
  onAdd,
  onScanClick,
  stockLevels = [],
  fromLocation,
  opType,
}) => {
  const [baseName, setBaseName] = useState('');
  const [color, setColor] = useState('');
  const [sizeQtys, setSizeQtys] = useState<Record<string, string>>({});
  const [qty, setQty] = useState('');

  const uniqueNames = useMemo(() => [...new Set(products.map(p => p.name))].sort(), [products]);
  const byName = useMemo(() => products.filter(p => p.name === baseName), [products, baseName]);
  const colors = useMemo(() => [...new Set(byName.filter(p => p.color).map(p => p.color!))].sort() as string[], [byName]);
  const byColor = useMemo(() => color ? byName.filter(p => p.color === color) : byName, [byName, color]);
  const sizes = useMemo(() => sortSizes([...new Set(byColor.filter(p => p.size).map(p => p.size!))] as string[]), [byColor]);

  const needsColor = colors.length > 0;
  const colorReady = !needsColor || !!color;
  const needsSize = sizes.length > 0;

  const selectedProd = useMemo(() => {
    if (!baseName || !colorReady || needsSize) return null;
    return byColor[0] ?? null;
  }, [byColor, baseName, colorReady, needsSize]);

  const getAvail = (productId: string) => {
    if (!fromLocation || opType === 'RECEPTION') return null;
    return stockLevels
      .filter(sl => sl.productId === productId && sl.locationId === fromLocation)
      .reduce((sum, sl) => sum + sl.quantity, 0);
  };

  const reset = () => { setBaseName(''); setColor(''); setSizeQtys({}); setQty(''); };

  const handleAddSizes = () => {
    let added = false;
    for (const size of sizes) {
      const q = parseInt(sizeQtys[size] ?? '', 10);
      if (!q || q <= 0) continue;
      const prod = byColor.find(p => p.size === size);
      if (!prod) continue;
      onAdd({ key: `${prod.id}_${Date.now()}_${size}`, productId: prod.id, qty: String(q) });
      added = true;
    }
    if (added) reset();
  };

  const handleAdd = () => {
    const q = parseInt(qty, 10);
    if (!selectedProd || !q || q <= 0) return;
    onAdd({ key: `${selectedProd.id}_${Date.now()}`, productId: selectedProd.id, qty: String(q) });
    reset();
  };

  const anySizeQty = sizes.some(s => parseInt(sizeQtys[s] ?? '', 10) > 0);

  return (
    <div className="flex flex-col gap-2.5">
      {/* Modelo */}
      <div className="flex gap-2">
        <select
          value={baseName}
          onChange={e => { setBaseName(e.target.value); setColor(''); setSizeQtys({}); setQty(''); }}
          className="input-technical flex-1 text-[11px] cursor-pointer"
        >
          <option value="">- Seleccione modelo -</option>
          {uniqueNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        {onScanClick && (
          <button
            type="button"
            onClick={onScanClick}
            title="Escanear QR universal o de prenda"
            className="shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all px-3.5 flex items-center justify-center gap-1.5 font-mono text-[10px] font-bold shadow-xs cursor-pointer"
          >
            <ScanLine size={15} />
            <span className="hidden sm:inline">ESCANEAR QR</span>
          </button>
        )}
      </div>

      {/* Color */}
      {baseName && needsColor && (
        <select
          value={color}
          onChange={e => { setColor(e.target.value); setSizeQtys({}); setQty(''); }}
          className="input-technical text-[11px] cursor-pointer"
        >
          <option value="">- Seleccione color -</option>
          {colors.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      )}

      {/* Tallas múltiples con cantidad individual */}
      {baseName && colorReady && needsSize && (
        <div className="flex flex-col gap-2 border border-[var(--border-soft)] rounded-2xl p-3 bg-[var(--surface)] shadow-xs">
          <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-[var(--ink)] opacity-60">Tallas y cantidades</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {sizes.map(size => {
              const prod = byColor.find(p => p.size === size);
              const avail = prod ? getAvail(prod.id) : null;
              const q = parseInt(sizeQtys[size] ?? '', 10);
              const over = avail !== null && q > avail;
              return (
                <div key={size} className="flex items-center gap-2 p-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)]">
                  <span className="font-mono text-[11px] font-black uppercase w-14 shrink-0 text-[var(--ink)] pl-1">{size}</span>
                  {avail !== null && (
                    <span className={cn('font-mono text-[9px] font-bold shrink-0', avail === 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400')}>
                      DISP: {avail}
                    </span>
                  )}
                  <input
                    type="number"
                    min="0"
                    value={sizeQtys[size] ?? ''}
                    onChange={e => setSizeQtys(prev => ({ ...prev, [size]: e.target.value }))}
                    placeholder="0"
                    className={cn('input-technical text-[11px] flex-1 text-center py-1.5', over && 'border-red-600 bg-red-500/10')}
                  />
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={handleAddSizes}
            disabled={!anySizeQty}
            className="mt-1 flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 transition-all px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-wider shadow-xs cursor-pointer"
          >
            <Plus size={13} />
            AGREGAR TALLAS
          </button>
        </div>
      )}

      {/* Cantidad + botón agregar (sin tallas) */}
      {baseName && colorReady && !needsSize && selectedProd && (
        <div className="flex items-center gap-2">
          <div className="flex flex-col flex-1">
            <input
              type="number"
              min="1"
              value={qty}
              onChange={e => setQty(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
              placeholder="Cantidad"
              className={cn('input-technical text-[11px]', getAvail(selectedProd.id) !== null && parseInt(qty, 10) > getAvail(selectedProd.id)! && 'border-red-600 bg-red-500/10')}
              autoFocus
            />
            {getAvail(selectedProd.id) !== null && (
              <span className={cn('font-mono text-[8px] font-bold mt-0.5', getAvail(selectedProd.id) === 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400')}>
                DISP: {getAvail(selectedProd.id)} UND
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!qty || parseInt(qty, 10) <= 0}
            className="shrink-0 flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 transition-all px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-wider shadow-xs cursor-pointer"
          >
            <Plus size={13} />
            AGREGAR
          </button>
        </div>
      )}
    </div>
  );
};
