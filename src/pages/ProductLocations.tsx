import React, { useMemo, useState } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { MapPin, Search, Package, AlertTriangle, Loader2, CheckCircle2, ChevronRight, Sparkles } from 'lucide-react';
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
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-12 animate-fade-in">
      <ModuleInfo
        number="15"
        title="Diseño de Productos & Ubicación Automática"
        description="Configura el destino preferencial de cada producto. Al recepcionar stock en ALMACÉN-RESERVA GENERAL, el sistema lo dirigirá a la ubicación designada."
      />

      {/* Resumen Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="modern-card p-5 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-[var(--ink)]/50">
              Total Productos
            </span>
            <div className="font-mono font-black text-2xl text-[var(--ink)] mt-1">
              {products.length}
            </div>
            <p className="font-mono text-[10px] text-[var(--ink)]/40 mt-0.5">Catálogo registrado</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Package size={22} />
          </div>
        </div>

        <div className="modern-card p-5 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-[var(--ink)]/50">
              Con Ubicación Designada
            </span>
            <div className="font-mono font-black text-2xl text-emerald-600 dark:text-emerald-400 mt-1">
              {assignedCount}
            </div>
            <p className="font-mono text-[10px] text-[var(--ink)]/40 mt-0.5">Enrutamiento automático activo</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <MapPin size={22} />
          </div>
        </div>

        <div className="modern-card p-5 rounded-2xl flex items-center justify-between shadow-xs">
          <div>
            <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-[var(--ink)]/50">
              Pendientes de Asignar
            </span>
            <div className="font-mono font-black text-2xl text-amber-600 dark:text-amber-400 mt-1">
              {reserveCount}
            </div>
            <p className="font-mono text-[10px] text-[var(--ink)]/40 mt-0.5">Permanecen en reserva general</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <AlertTriangle size={22} />
          </div>
        </div>
      </div>

      {/* Floating Feedback Toast */}
      {feedback && (
        <div className={cn(
          'fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl border font-mono text-xs font-bold tracking-wide flex items-center gap-3 shadow-2xl backdrop-blur-md animate-scale-in',
          feedback.type === 'success' 
            ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50' 
            : 'bg-rose-950/90 text-rose-300 border-rose-500/50'
        )}>
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Search & Actions Bar */}
      <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
        <div className="relative flex-1">
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Buscar prenda por nombre, código o categoría..."
            className="input-technical rounded-xl text-xs py-2.5 pl-10 pr-9 w-full"
          />
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink)]/40" />
          {filter && (
            <button
              onClick={() => setFilter('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] font-bold text-[var(--ink)]/40 hover:text-[var(--ink)] uppercase"
            >
              Limpiar
            </button>
          )}
        </div>

        <div className="px-3.5 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border-soft)] font-mono text-[11px] font-bold text-[var(--ink)]/60 flex items-center gap-2 shrink-0">
          <span>Marca:</span>
          <span className="text-[var(--ink)]">{activeBrand.replace('_', ' ')}</span>
        </div>
      </div>

      {/* Table / List Container */}
      <div className="modern-card rounded-3xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 bg-[var(--surface-alt)]/50 border-b border-[var(--border-soft)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
              {groupedProducts.length} Modelo{groupedProducts.length !== 1 ? 's' : ''} Base
            </span>
          </div>
          <span className="font-mono text-[10px] text-[var(--ink)]/40 uppercase tracking-wider hidden sm:block">
            Asignación masiva a variantes
          </span>
        </div>

        {groupedProducts.length === 0 ? (
          <div className="py-20 text-center font-mono text-xs uppercase tracking-widest text-[var(--ink)]/40">
            <Package size={28} className="mx-auto mb-3 opacity-30" />
            No se encontraron productos con ese criterio
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-soft)] max-h-[62vh] overflow-y-auto">
            {groupedProducts.map((group) => {
              const variantIds = group.variants.map(v => v.id);
              const assignedLocations = productLocations.filter(pl => variantIds.includes(pl.productId));
              const locIds = Array.from(new Set(assignedLocations.map(pl => pl.locationId)));
              const currentLocId = locIds.length === 1 && assignedLocations.length === group.variants.length ? locIds[0] : '';
              const isBusy = busy === group.baseName;

              return (
                <div 
                  key={group.baseName} 
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-3.5 hover:bg-[var(--surface-alt)]/40 transition-colors"
                >
                  {/* Producto Details */}
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-bold text-[var(--ink)] truncate">
                        {group.baseName}
                      </span>
                      <span className="font-mono text-[10px] text-[var(--ink)]/40 shrink-0 bg-[var(--surface-alt)] px-2 py-0.5 rounded-md">
                        {group.variants.length} variante{group.variants.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="font-mono text-[10px] uppercase text-[var(--ink)]/40 mt-0.5">
                      {group.category || 'Sin categoría'}
                    </div>
                  </div>

                  {/* Ubicación Dropdown */}
                  <div className="flex items-center gap-2.5 sm:w-80 shrink-0">
                    <div className={cn(
                      'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors',
                      currentLocId 
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                        : (locIds.length > 0 ? 'bg-amber-500/10 text-amber-600' : 'bg-[var(--surface-alt)] text-[var(--ink)]/30')
                    )}>
                      <MapPin size={15} />
                    </div>

                    <select
                      value={currentLocId}
                      disabled={isBusy}
                      onChange={e => handleAssignGroup(group.baseName, e.target.value)}
                      className={cn(
                        'input-technical rounded-xl text-xs py-2 px-3 flex-1 cursor-pointer truncate',
                        !currentLocId && locIds.length === 0 && 'text-[var(--ink)]/50',
                        !currentLocId && locIds.length > 0 && 'text-amber-600 dark:text-amber-400 font-bold'
                      )}
                    >
                      <option value="">
                        {locIds.length > 0 && locIds.length !== 1 
                          ? '— MIXTO (ASIGNAR A TODOS) —' 
                          : (locIds.length === 1 && assignedLocations.length !== group.variants.length 
                              ? '— PARCIAL (ASIGNAR A TODOS) —' 
                              : '— SIN ASIGNAR (RESERVA) —')}
                      </option>
                      {assignableLocations.map(loc => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name} ({loc.type})
                        </option>
                      ))}
                    </select>

                    {isBusy && <Loader2 size={16} className="animate-spin shrink-0 text-blue-500" />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border-soft)] text-[var(--ink)]/60 font-mono text-[11px]">
        <Sparkles size={16} className="text-amber-500 shrink-0" />
        <span>
          <strong>Tip operativo:</strong> Asignar una gaveta o balda aquí ahorra tiempo de estiba, permitiendo que las recepciones desde órdenes de compra o traslados se cataloguen de forma instantánea.
        </span>
      </div>
    </div>
  );
};
