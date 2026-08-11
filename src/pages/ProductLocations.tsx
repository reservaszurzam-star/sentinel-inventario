import React, { useMemo, useState } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { MapPin, Search, Package, AlertTriangle, Loader2, CheckCircle } from 'lucide-react';
import { cn } from '../lib/utils';

/**
 * DISEÑO DE PRODUCTOS → UBICACIÓN DESIGNADA
 *
 * Define la ubicación a la que cada producto "aterriza" automáticamente
 * cuando llega una recepción a ALMACEN-RESERVA GENERAL. Si un producto
 * NO tiene ubicación designada, su stock se queda en la reserva general
 * hasta que se asigne aquí.
 */
export const ProductLocations: React.FC = () => {
  const { products, locations, productLocations, assignProductLocation, activeBrand } = useAppContext();
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Ubicaciones asignables (todas las de la marca activa)
  const assignableLocations = useMemo(
    () => [...locations].sort((a, b) => a.name.localeCompare(b.name)),
    [locations],
  );

  const filteredProducts = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q)
    );
  }, [products, filter]);

  // Productos con ubicación asignada vs sin asignar
  const assignedCount = useMemo(
    () => products.filter(p => productLocations.some(pl => pl.productId === p.id)).length,
    [products, productLocations],
  );

  const locationName = (id?: string) => locations.find(l => l.id === id)?.name ?? '—';

  const groupedProducts = useMemo(() => {
    const groups: Record<string, { baseName: string, category: string, variants: typeof products }> = {};
    for (const p of filteredProducts) {
      if (!groups[p.name]) {
        groups[p.name] = { baseName: p.name, category: p.category, variants: [] };
      }
      groups[p.name].variants.push(p);
    }
    return Object.values(groups).sort((a, b) => a.baseName.localeCompare(b.baseName));
  }, [filteredProducts]);

  const handleAssignGroup = async (baseName: string, locationId: string) => {
    setBusy(baseName);
    setFeedback(null);
    try {
      const variants = products.filter(p => p.name === baseName);
      await Promise.all(variants.map(v => assignProductLocation(v.id, locationId || null)));
      
      setFeedback(locationId
        ? { type: 'success', message: `Todos los "${baseName}" asignados a ${locationName(locationId)}` }
        : { type: 'success', message: `Se quitó la ubicación designada de "${baseName}"` });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Error al asignar ubicación' });
    } finally {
      setBusy(null);
    }
  };

  const reserveCount = products.filter(p => {
    const pl = productLocations.find(x => x.productId === p.id);
    return !pl;
  }).length;

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6 pb-8">
      <ModuleInfo
        number="17"
        title="Diseño de Productos"
        description="Asigna a cada producto su ubicación designada. Cuando una recepción aterriza en ALMACEN-RESERVA GENERAL, el stock se distribuye automáticamente hacia la ubicación aquí definida."
      />

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-widest opacity-50">Productos</span>
          <span className="font-mono font-black text-2xl">{products.length}</span>
        </div>
        <div className="border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-widest opacity-50">Con ubicación designada</span>
          <span className="font-mono font-black text-2xl">{assignedCount}</span>
        </div>
        <div className="border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-1">
          <span className="font-mono text-[9px] uppercase tracking-widest opacity-50">Pendientes (quedan en reserva)</span>
          <span className="font-mono font-black text-2xl">{reserveCount}</span>
        </div>
      </div>

      {feedback && (
        <div className={cn(
          'fixed bottom-6 right-6 z-50 p-4 border font-bold font-mono text-xs uppercase tracking-widest flex items-center gap-3 shadow-2xl bg-[var(--surface)] animate-in slide-in-from-bottom-5',
          feedback.type === 'success' ? 'border-green-500 text-green-600' : 'border-red-500 text-red-600'
        )}>
          {feedback.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          {feedback.message}
        </div>
      )}

      {/* Filtro */}
      <div className="flex items-center gap-2 border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <Search size={14} className="opacity-50 shrink-0" />
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Buscar producto por nombre, código o categoría..."
          className="flex-1 bg-transparent outline-none font-mono text-[11px] uppercase tracking-widest"
        />
        {filter && (
          <button onClick={() => setFilter('')} className="font-mono text-[9px] uppercase opacity-50 hover:opacity-100">
            Limpiar
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <div className="bg-[var(--ink)] text-[var(--ink-inv)] px-4 py-2 flex items-center justify-between">
          <span className="font-mono text-[9px] font-bold uppercase tracking-widest">
            {groupedProducts.length} producto{groupedProducts.length !== 1 ? 's' : ''} base
          </span>
          <span className="font-mono text-[9px] uppercase tracking-widest opacity-60">Marca: {activeBrand.replace('_', ' ')}</span>
        </div>

        {groupedProducts.length === 0 ? (
          <div className="p-10 text-center font-mono text-[10px] uppercase tracking-widest opacity-40">
            <Package size={20} className="mx-auto mb-2 opacity-30" />
            No hay productos que coincidan
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]/10 max-h-[60vh] overflow-y-auto">
            {groupedProducts.map((group) => {
              const variantIds = group.variants.map(v => v.id);
              const assignedLocations = productLocations.filter(pl => variantIds.includes(pl.productId));
              const locIds = Array.from(new Set(assignedLocations.map(pl => pl.locationId)));
              // Is there a unified location for all variants?
              const currentLocId = locIds.length === 1 && assignedLocations.length === group.variants.length ? locIds[0] : '';
              
              const isBusy = busy === group.baseName;
              return (
                <div key={group.baseName} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3 hover:bg-[var(--bg-card)]">
                  {/* Producto */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold uppercase truncate">{group.baseName}</span>
                      <span className="font-mono text-[9px] opacity-50 shrink-0">({group.variants.length} variante{group.variants.length !== 1 ? 's' : ''})</span>
                    </div>
                    <div className="font-mono text-[8px] uppercase tracking-widest opacity-40 mt-0.5">{group.category}</div>
                  </div>

                  {/* Ubicación actual */}
                  <div className="flex items-center gap-2 sm:w-72 shrink-0">
                    <MapPin size={13} className={cn('shrink-0', currentLocId ? 'text-green-600' : (locIds.length > 0 ? 'text-orange-500' : 'text-[var(--ink)] opacity-30'))} />
                    <select
                      value={currentLocId}
                      disabled={isBusy}
                      onChange={e => handleAssignGroup(group.baseName, e.target.value)}
                      className={cn(
                        'flex-1 border border-[var(--border)] bg-[var(--bg-input)] px-2 py-1.5 font-mono text-[10px] uppercase outline-none focus:border-[var(--ink)] cursor-pointer',
                        !currentLocId && locIds.length === 0 && 'text-[var(--ink)]/50',
                        !currentLocId && locIds.length > 0 && 'text-orange-600 font-bold'
                      )}
                    >
                      <option value="">{locIds.length > 0 && locIds.length !== 1 ? '— MIXTO (ASIGNAR A TODOS) —' : (locIds.length === 1 && assignedLocations.length !== group.variants.length ? '— PARCIAL (ASIGNAR A TODOS) —' : '— SIN UBICACIÓN —')}</option>
                      {assignableLocations.map(loc => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                    {isBusy && <Loader2 size={13} className="animate-spin shrink-0" />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="font-mono text-[9px] uppercase tracking-widest opacity-40 px-1">
        Consejo: los productos sin ubicación designada quedan en ALMACEN-RESERVA GENERAL tras la recepción. Asígnalos aquí para que se distribuyan automáticamente.
      </p>
    </div>
  );
};
