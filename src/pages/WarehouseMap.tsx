import React, { useState, useMemo } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { 
  MapPin, Package, X, TrendingDown, AlertTriangle, CheckCircle2, Circle,
  Warehouse, Layers, Box, Truck, Filter, ChevronRight, Sparkles 
} from 'lucide-react';
import { TutorialModal, WAREHOUSE_MAP_TUTORIAL_STEPS } from '../components/TutorialModal';
import { cn } from '../lib/utils';

const TYPE_LABEL: Record<string, string> = {
  ZONE: 'Zona',
  RACK: 'Estantería',
  BIN: 'Casillero',
  EXTERNAL: 'Externo',
  WAREHOUSE: 'Almacén',
};

const LocationTypeIcon = ({ type, size = 16 }: { type: string; size?: number }) => {
  if (type === 'ZONE') return <MapPin size={size} />;
  if (type === 'RACK') return <Layers size={size} />;
  if (type === 'BIN') return <Box size={size} />;
  if (type === 'EXTERNAL') return <Truck size={size} />;
  return <Warehouse size={size} />;
};

type FillLevel = 'empty' | 'low' | 'medium' | 'high';

function getFillLevel(stock: number, capacity: number): FillLevel {
  if (stock === 0) return 'empty';
  const ratio = stock / capacity;
  if (ratio < 0.25) return 'low';
  if (ratio < 0.7) return 'medium';
  return 'high';
}

const FILL_BADGE_STYLE: Record<FillLevel, { text: string; bg: string; dot: string; label: string }> = {
  empty: { text: 'text-[var(--ink)]/50', bg: 'bg-[var(--surface-alt)] border-[var(--border-soft)]', dot: 'bg-slate-400', label: 'Vacío' },
  low: { text: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-500', label: 'Bajo' },
  medium: { text: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', dot: 'bg-blue-500', label: 'Normal' },
  high: { text: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-500', label: 'Óptimo' },
};

const FILL_BAR: Record<FillLevel, string> = {
  empty: 'bg-slate-300 dark:bg-slate-700',
  low: 'bg-amber-500',
  medium: 'bg-blue-500',
  high: 'bg-emerald-500',
};

export const WarehouseMap: React.FC = () => {
  const { locations, products, stockLevels } = useAppContext();
  const [selected, setSelected] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterFill, setFilterFill] = useState<FillLevel | 'ALL'>('ALL');
  const [showTutorial, setShowTutorial] = useState(false);

  const locationStats = useMemo(() => {
    return locations.map(loc => {
      const stocks = stockLevels.filter(s => s.locationId === loc.id);
      const totalUnits = stocks.reduce((sum, s) => sum + s.quantity, 0);
      const skuCount = stocks.filter(s => s.quantity > 0).length;
      const capacity = loc.type === 'ZONE' ? 500 : loc.type === 'WAREHOUSE' ? 1000 : loc.type === 'RACK' ? 200 : 100;
      const fill = getFillLevel(totalUnits, capacity);
      const lowStockItems = stocks.filter(s => {
        const product = products.find(p => p.id === s.productId);
        return product?.lowStockThreshold && s.quantity <= product.lowStockThreshold;
      });
      return { loc, totalUnits, skuCount, capacity, fill, lowStockItems, stocks };
    });
  }, [locations, stockLevels, products]);

  const filtered = locationStats.filter(ls =>
    (filterType === 'ALL' || ls.loc.type === filterType) &&
    (filterFill === 'ALL' || ls.fill === filterFill)
  );

  const selectedStat = locationStats.find(ls => ls.loc.id === selected);

  const summary = useMemo(() => ({
    empty: locationStats.filter(ls => ls.fill === 'empty').length,
    low: locationStats.filter(ls => ls.fill === 'low').length,
    medium: locationStats.filter(ls => ls.fill === 'medium').length,
    high: locationStats.filter(ls => ls.fill === 'high').length,
  }), [locationStats]);

  const types = [...new Set(locations.map(l => l.type))];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-12 animate-fade-in">
      <TutorialModal open={showTutorial} onClose={() => setShowTutorial(false)} steps={WAREHOUSE_MAP_TUTORIAL_STEPS} title="Mapa del Almacén" />

      {/* Header */}
      <ModuleInfo
        number="16"
        title="Mapa Visual del Almacén"
        description="Monitor espacial de capacidad y ocupación en tiempo real. Analiza estantes vacíos, niveles críticos de inventario y saturación de zonas."
        onTutorial={() => setShowTutorial(true)}
      />

      {/* Summary Filter Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          { key: 'empty', label: 'Vacío (0%)', icon: Circle, count: summary.empty, style: 'hover:border-slate-400', activeRing: 'ring-2 ring-slate-400' },
          { key: 'low', label: 'Bajo (<25%)', icon: AlertTriangle, count: summary.low, style: 'hover:border-amber-400', activeRing: 'ring-2 ring-amber-500' },
          { key: 'medium', label: 'Normal (25-70%)', icon: TrendingDown, count: summary.medium, style: 'hover:border-blue-400', activeRing: 'ring-2 ring-blue-500' },
          { key: 'high', label: 'Óptimo / Alto (>70%)', icon: CheckCircle2, count: summary.high, style: 'hover:border-emerald-400', activeRing: 'ring-2 ring-emerald-500' },
        ] as const).map(({ key, label, icon: Icon, count, style, activeRing }) => {
          const isActive = filterFill === key;
          return (
            <button
              key={key}
              onClick={() => setFilterFill(isActive ? 'ALL' : key)}
              className={cn(
                "modern-card p-4 rounded-2xl flex flex-col items-start gap-1 text-left transition-all duration-150 cursor-pointer shadow-xs",
                style,
                isActive ? `${activeRing} bg-[var(--surface-alt)] shadow-sm` : ''
              )}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-mono text-[10px] uppercase font-bold text-[var(--ink)]/50 tracking-wider">
                  {label}
                </span>
                <Icon size={15} className={isActive ? 'text-[var(--ink)]' : 'text-[var(--ink)]/40'} />
              </div>
              <div className="font-mono font-black text-2xl text-[var(--ink)] mt-1">
                {count}
              </div>
              <span className="font-mono text-[10px] text-[var(--ink)]/40">ubicaciones</span>
            </button>
          );
        })}
      </div>

      {/* Filter Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap bg-[var(--surface)] border border-[var(--border-soft)] p-3 rounded-2xl shadow-xs">
        <div className="flex items-center gap-2">
          <Filter size={15} className="text-[var(--ink)]/50 ml-1" />
          <span className="font-mono text-xs font-bold text-[var(--ink)] uppercase">Filtros:</span>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="input-technical rounded-xl text-xs py-2 px-3 cursor-pointer"
          >
            <option value="ALL">Todos los tipos</option>
            {types.map(t => (
              <option key={String(t)} value={String(t)}>
                {TYPE_LABEL[String(t)] || String(t)}
              </option>
            ))}
          </select>

          <select
            value={filterFill}
            onChange={e => setFilterFill(e.target.value as any)}
            className="input-technical rounded-xl text-xs py-2 px-3 cursor-pointer"
          >
            <option value="ALL">Todos los niveles de llenado</option>
            <option value="empty">Vacío</option>
            <option value="low">Bajo</option>
            <option value="medium">Normal</option>
            <option value="high">Óptimo / Alto</option>
          </select>

          {(filterType !== 'ALL' || filterFill !== 'ALL') && (
            <button
              onClick={() => { setFilterType('ALL'); setFilterFill('ALL'); }}
              className="px-3 py-2 rounded-xl text-xs font-mono font-bold text-[var(--ink)]/60 hover:text-[var(--ink)] hover:bg-[var(--surface-alt)] transition-colors"
            >
              Restablecer
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area (Grid + Optional Drawer) */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* Map Grid */}
        <div className="flex-1 w-full">
          {filtered.length === 0 ? (
            <div className="modern-card p-16 rounded-3xl text-center font-mono text-xs uppercase tracking-wider text-[var(--ink)]/40 shadow-xs">
              <Package size={32} className="mx-auto mb-3 opacity-30" />
              No hay ubicaciones que coincidan con los filtros seleccionados
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(({ loc, totalUnits, skuCount, capacity, fill, lowStockItems }) => {
                const barWidth = Math.min(100, Math.round((totalUnits / capacity) * 100));
                const isSelected = selected === loc.id;
                const badge = FILL_BADGE_STYLE[fill];

                return (
                  <button
                    key={loc.id}
                    onClick={() => setSelected(isSelected ? null : loc.id)}
                    className={cn(
                      "modern-card p-4 rounded-2xl flex flex-col justify-between text-left transition-all duration-200 cursor-pointer relative shadow-xs",
                      isSelected
                        ? "ring-2 ring-[var(--ink)] bg-[var(--surface-alt)]/60 shadow-md"
                        : "hover:border-[var(--ink)]/30 hover:shadow-sm"
                    )}
                  >
                    {lowStockItems.length > 0 && (
                      <div className="absolute top-3.5 right-3.5 flex items-center gap-1 bg-rose-500/10 text-rose-600 px-2 py-0.5 rounded-full border border-rose-500/20 font-mono text-[9px] font-bold">
                        <AlertTriangle size={11} />
                        <span>Alerta</span>
                      </div>
                    )}

                    <div>
                      <div className="flex items-center gap-2.5 mb-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[var(--surface-alt)] flex items-center justify-center text-[var(--ink)]/70 shrink-0">
                          <LocationTypeIcon type={loc.type} size={15} />
                        </div>
                        <div className="min-w-0 pr-12">
                          <h4 className="font-mono font-bold text-xs text-[var(--ink)] truncate">
                            {loc.name}
                          </h4>
                          <span className="font-mono text-[10px] text-[var(--ink)]/40 uppercase tracking-wider block">
                            {TYPE_LABEL[loc.type] || loc.type}
                          </span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-1 my-3">
                        <div className="flex justify-between items-center font-mono text-[10px] text-[var(--ink)]/50">
                          <span>Ocupación</span>
                          <span className="font-bold">{barWidth}%</span>
                        </div>
                        <div className="w-full h-2 bg-[var(--surface-alt)] rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-300 rounded-full ${FILL_BAR[fill]}`} 
                            style={{ width: `${barWidth}%` }} 
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[var(--border-soft)]">
                      <div>
                        <span className="font-mono font-bold text-base text-[var(--ink)] block leading-none">
                          {totalUnits}
                        </span>
                        <span className="font-mono text-[9px] text-[var(--ink)]/40 uppercase">Prendas</span>
                      </div>

                      <div className="text-right">
                        <span className="font-mono font-bold text-xs text-[var(--ink)]/80 block leading-none">
                          {skuCount}
                        </span>
                        <span className="font-mono text-[9px] text-[var(--ink)]/40 uppercase">Modelos/SKUs</span>
                      </div>

                      <div className={cn(
                        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-mono text-[9px] font-semibold border",
                        badge.bg, badge.text
                      )}>
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                        <span>{badge.label}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Location Details Drawer */}
        {selectedStat && (
          <div className="w-full lg:w-80 shrink-0 modern-card rounded-3xl p-5 shadow-lg space-y-4 animate-scale-in">
            <div className="flex justify-between items-start pb-3 border-b border-[var(--border-soft)]">
              <div>
                <span className="font-mono text-[9px] text-[var(--ink)]/40 uppercase tracking-wider block">
                  {TYPE_LABEL[selectedStat.loc.type]}
                </span>
                <h3 className="font-mono font-bold text-base text-[var(--ink)]">
                  {selectedStat.loc.name}
                </h3>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-1.5 text-[var(--ink)]/40 hover:text-[var(--ink)] hover:bg-[var(--surface-alt)] rounded-xl transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Micro Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[var(--surface-alt)]/50 p-2.5 rounded-xl text-center border border-[var(--border-soft)]">
                <div className="font-mono font-black text-lg text-[var(--ink)]">{selectedStat.totalUnits}</div>
                <div className="font-mono text-[8px] uppercase tracking-wider text-[var(--ink)]/40">Unidades</div>
              </div>
              <div className="bg-[var(--surface-alt)]/50 p-2.5 rounded-xl text-center border border-[var(--border-soft)]">
                <div className="font-mono font-black text-lg text-[var(--ink)]">{selectedStat.skuCount}</div>
                <div className="font-mono text-[8px] uppercase tracking-wider text-[var(--ink)]/40">SKUs</div>
              </div>
              <div className="bg-[var(--surface-alt)]/50 p-2.5 rounded-xl text-center border border-[var(--border-soft)]">
                <div className={cn("font-mono font-black text-lg", selectedStat.lowStockItems.length > 0 ? "text-rose-600" : "text-emerald-600")}>
                  {selectedStat.lowStockItems.length}
                </div>
                <div className="font-mono text-[8px] uppercase tracking-wider text-[var(--ink)]/40">Alertas</div>
              </div>
            </div>

            {/* SKU Breakdown */}
            <div className="space-y-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]/50 block">
                Prendas en esta ubicación
              </span>

              <div className="max-h-[380px] overflow-y-auto space-y-1.5 pr-1">
                {selectedStat.stocks.filter(s => s.quantity > 0).length === 0 ? (
                  <div className="py-8 text-center font-mono text-xs text-[var(--ink)]/40 uppercase">
                    Ubicación vacía
                  </div>
                ) : (
                  selectedStat.stocks
                    .filter(s => s.quantity > 0)
                    .sort((a, b) => b.quantity - a.quantity)
                    .map(s => {
                      const prod = products.find(p => p.id === s.productId);
                      if (!prod) return null;
                      const isLow = prod.lowStockThreshold != null && s.quantity <= prod.lowStockThreshold;

                      return (
                        <div
                          key={s.id}
                          className={cn(
                            "p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-colors",
                            isLow 
                              ? "bg-rose-500/10 border-rose-500/20" 
                              : "bg-[var(--surface-alt)]/30 border-[var(--border-soft)]"
                          )}
                        >
                          <div className="min-w-0">
                            <div className="font-mono font-bold text-xs text-[var(--ink)] truncate flex items-center gap-1.5">
                              {isLow && <AlertTriangle size={12} className="text-rose-500 shrink-0" />}
                              <span>{prod.code}</span>
                            </div>
                            <div className="font-mono text-[10px] text-[var(--ink)]/50 truncate">
                              {prod.name} {prod.color || ''} {prod.size || ''}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className={cn(
                              "font-mono font-bold text-sm block",
                              isLow ? "text-rose-600 dark:text-rose-400" : "text-[var(--ink)]"
                            )}>
                              {s.quantity}
                            </span>
                            {prod.lowStockThreshold && (
                              <span className="font-mono text-[9px] text-[var(--ink)]/40 block">
                                mín {prod.lowStockThreshold}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
