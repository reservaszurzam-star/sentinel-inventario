import React, { useMemo, useState } from 'react';
import { Package, Truck, MapPin, Calendar, Search, ClipboardList, List, ChevronLeft, ChevronRight, X, Hash, Building2, Radio } from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { TutorialModal, TutorialStep } from '../components/TutorialModal';
import { Product, Location, Transaction } from '../types';
import { cn } from '../lib/utils';
import type { Brand } from '../store/AppContext';

const BRAND_LABEL: Record<Brand, string> = { OVERSHARK: 'OVERSHARK', BRAVOS: 'BRAVOS URBAN', BOX_PRIME: 'BOX PRIME' };
const BRANDS: Brand[] = ['OVERSHARK', 'BRAVOS', 'BOX_PRIME'];

// ── Tutorial ───────────────────────────────────────────────────────────────────

const LivexIllustrationFeed = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    <rect x="14" y="18" width="172" height="104" rx="8" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1.5" />
    {[0, 1, 2, 3].map(i => (
      <g key={i} opacity={1 - i * 0.18}>
        <rect x="24" y={30 + i * 24} width="152" height="18" rx="6" fill="var(--surface)" stroke="var(--border)" strokeWidth="1" />
        <rect x="30" y={35 + i * 24} width="6" height="8" rx="2" fill="#dcfce7" stroke="#86efac" strokeWidth="1" />
        <rect x="42" y={37 + i * 24} width="60" height="4" rx="2" fill="var(--border)" />
        <rect x="150" y={37 + i * 24} width="18" height="4" rx="2" fill="#86efac" />
      </g>
    ))}
  </svg>
);

const LivexIllustrationCalendar = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    <rect x="30" y="20" width="140" height="100" rx="8" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1.5" />
    <rect x="30" y="20" width="140" height="20" rx="8" fill="var(--ink)" />
    <text x="100" y="33" textAnchor="middle" fontSize="8" fill="var(--ink-inv)" fontWeight="700" fontFamily="monospace">JULIO 2026</text>
    {Array.from({ length: 4 }, (_, row) => (
      <g key={row}>
        {Array.from({ length: 6 }, (_, col) => {
          const has = (row * 6 + col) % 3 === 0;
          return (
            <g key={col} className={has ? 'tut-fade-up' : ''} style={has ? { animationDelay: `${(row * 6 + col) * 0.05}s` } : undefined}>
              <rect x={38 + col * 22} y={46 + row * 18} width="18" height="14" rx="4" fill={has ? '#dcfce7' : 'var(--surface)'} stroke={has ? '#86efac' : 'var(--border)'} strokeWidth="1" />
              {has && <circle cx={38 + col * 22 + 14} cy={46 + row * 18 + 4} r="2" fill="#15803d" />}
            </g>
          );
        })}
      </g>
    ))}
  </svg>
);

const LivexIllustrationDetail = () => (
  <svg viewBox="0 0 200 140" className="w-full h-full" fill="none">
    <rect x="24" y="14" width="152" height="112" rx="8" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="1.5" />
    <rect x="24" y="14" width="152" height="22" rx="8" fill="var(--surface)" />
    <text x="100" y="27" textAnchor="middle" fontSize="7" fill="var(--ink)" fontWeight="700" fontFamily="monospace">08 DE JULIO, 2026</text>
    <rect x="34" y="42" width="42" height="24" rx="6" fill="var(--surface)" stroke="var(--border)" strokeWidth="1" />
    <text x="55" y="52" textAnchor="middle" fontSize="10" fill="var(--ink)" fontWeight="900" fontFamily="monospace">3</text>
    <text x="55" y="61" textAnchor="middle" fontSize="5" fill="var(--ink-50)" fontFamily="monospace">COMPROB.</text>
    <rect x="79" y="42" width="42" height="24" rx="6" fill="#dcfce7" stroke="#86efac" strokeWidth="1" />
    <text x="100" y="52" textAnchor="middle" fontSize="10" fill="#15803d" fontWeight="900" fontFamily="monospace">+84</text>
    <text x="100" y="61" textAnchor="middle" fontSize="5" fill="#15803d" fontFamily="monospace">UNIDADES</text>
    <rect x="124" y="42" width="42" height="24" rx="6" fill="var(--surface)" stroke="var(--border)" strokeWidth="1" />
    <text x="145" y="52" textAnchor="middle" fontSize="10" fill="var(--ink)" fontWeight="900" fontFamily="monospace">2</text>
    <text x="145" y="61" textAnchor="middle" fontSize="5" fill="var(--ink-50)" fontFamily="monospace">PROVEED.</text>
  </svg>
);

const LIVEX_TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: '¿Qué es Livex?',
    description: 'Livex es tu ventana de solo lectura al inventario. Aquí ves cada comprobante de recepción — es decir, todo lo que ha entrado al almacén — sin poder crear, editar ni borrar nada.',
    illustration: <LivexIllustrationFeed />,
    tips: [
      'Solo se muestran recepciones (lo que entra), no despachos ni traslados',
      'Usa el buscador para filtrar por referencia, proveedor o producto',
      'El selector de marca en el sidebar cambia qué inventario ves (OVERSHARK, BRAVOS, BOX PRIME)',
    ],
  },
  {
    title: 'Vista de Calendario',
    description: 'Cambia a la vista de calendario con el ícono junto al buscador. Cada día muestra cuántos comprobantes y unidades se subieron, de un vistazo.',
    illustration: <LivexIllustrationCalendar />,
    tips: [
      'Los días con recepciones se resaltan y muestran el conteo',
      'Usa las flechas para navegar entre meses',
      'El día de hoy siempre aparece marcado',
    ],
  },
  {
    title: 'Detalle por Día',
    description: 'Haz clic en cualquier día del calendario para abrir la ventana con todos los comprobantes que ingresaron esa fecha, organizados por proveedor y producto.',
    illustration: <LivexIllustrationDetail />,
    tips: [
      'Usa los filtros superiores para ver un solo producto a la vez',
      'Cada tarjeta desglosa las variantes con su color, talla y ubicación',
      'Presiona ESC o haz clic fuera para cerrar la ventana',
    ],
  },
];

const MONTH_LABEL = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const WEEKDAY_LABEL = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function limaDayKey(isoString: string): string {
  try {
    const d = new Date(isoString);
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const y = parts.find(p => p.type === 'year')?.value ?? '1970';
    const m = parts.find(p => p.type === 'month')?.value ?? '01';
    const day = parts.find(p => p.type === 'day')?.value ?? '01';
    return `${y}-${m}-${day}`;
  } catch {
    return isoString.slice(0, 10);
  }
}

function fmtDayLong(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${d} de ${MONTH_LABEL[m - 1]}, ${y}`;
}

function fmtDateTime(isoString: string): string {
  try {
    return new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(isoString));
  } catch {
    return isoString.slice(0, 16);
  }
}

interface Row {
  tx: Transaction;
  product: Product | undefined;
  location: Location | undefined;
  supplierName: string | undefined;
}

const ReceptionRow: React.FC<Row> = ({ tx, product, location, supplierName }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 hover:bg-[var(--surface-alt)]/40 transition-colors">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
          <Package size={17} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold text-[var(--ink)] truncate">
              {product?.name ?? tx.productId}
            </span>
            {product?.color && (
              <span className="font-mono text-[10px] text-[var(--ink)]/50 bg-[var(--surface-alt)] px-1.5 py-0.5 rounded-md">
                {product.color}
              </span>
            )}
            {product?.size && (
              <span className="font-mono text-[10px] text-[var(--ink)]/50 bg-[var(--surface-alt)] px-1.5 py-0.5 rounded-md">
                Talla {product.size}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 font-mono text-[10px] text-[var(--ink)]/40 mt-1 flex-wrap">
            <span className="flex items-center gap-1 font-semibold text-[var(--ink)]/60">
              <Hash size={11} /> {tx.reference}
            </span>
            {supplierName && (
              <span className="flex items-center gap-1">
                <Truck size={11} /> {supplierName}
              </span>
            )}
            {location && (
              <span className="flex items-center gap-1">
                <MapPin size={11} /> {location.name}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0 sm:justify-end">
        <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
          +{tx.quantity} uds
        </span>

        <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[9px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
          RECEPCIÓN
        </span>

        <span className="font-mono text-[10px] text-[var(--ink)]/40 whitespace-nowrap hidden sm:block">
          {fmtDateTime(tx.date)}
        </span>
      </div>
    </div>
  );
};

interface SupplierGroup {
  supplierName: string;
  rows: Row[];
  qty: number;
}

function groupBySupplier(rows: Row[]): SupplierGroup[] {
  const map = new Map<string, Row[]>();
  for (const row of rows) {
    const key = row.supplierName ?? 'Sin proveedor';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row);
  }
  return [...map.entries()]
    .map(([supplierName, groupRows]) => ({
      supplierName,
      rows: groupRows,
      qty: groupRows.reduce((sum, r) => sum + r.tx.quantity, 0),
    }))
    .sort((a, b) => b.qty - a.qty);
}

interface ProductGroup {
  productName: string;
  rows: Row[];
  qty: number;
}

/** Agrupa las filas de un proveedor por nombre de producto (no por variante). */
function groupByProduct(rows: Row[]): ProductGroup[] {
  const map = new Map<string, Row[]>();
  for (const row of rows) {
    const key = productGroupKey(row);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row);
  }
  return [...map.entries()]
    .map(([productName, groupRows]) => ({
      productName,
      rows: groupRows,
      qty: groupRows.reduce((sum, r) => sum + r.tx.quantity, 0),
    }))
    .sort((a, b) => b.qty - a.qty);
}

const VariantLine: React.FC<{ row: Row }> = ({ row }) => {
  const { tx, product, location } = row;
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 text-xs flex-wrap sm:flex-nowrap hover:bg-[var(--surface-alt)]/30 transition-colors">
      {(product?.color || product?.size) ? (
        <span className="font-mono text-xs font-bold text-[var(--ink)] shrink-0 sm:w-32 truncate">
          {[product?.color, product?.size].filter(Boolean).join(' · ')}
        </span>
      ) : (
        <span className="font-mono text-xs text-[var(--ink)]/40 shrink-0 sm:w-32">—</span>
      )}
      <span className="font-mono text-[10px] text-[var(--ink)]/60 flex items-center gap-1 shrink-0">
        <Hash size={10} className="shrink-0" />{tx.reference}
      </span>
      {location && (
        <span className="font-mono text-[10px] text-[var(--ink)]/60 flex items-center gap-1 shrink-0 sm:w-28 truncate">
          <MapPin size={10} className="shrink-0" />{location.name}
        </span>
      )}
      <span className="font-mono text-[10px] text-[var(--ink)]/40 shrink-0">{fmtDateTime(tx.date)}</span>
      <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400 shrink-0 ml-auto">+{tx.quantity}</span>
    </div>
  );
};

const ProductGroupCard: React.FC<{ group: ProductGroup }> = ({ group }) => {
  const isSingleVariant = group.rows.length === 1;
  return (
    <div className="border border-[var(--border-soft)] bg-[var(--surface)] rounded-2xl overflow-hidden shadow-xs">
      <div className="flex items-center gap-3 px-4 py-3 bg-[var(--surface-alt)]/30 border-b border-[var(--border-soft)]">
        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
          <Package size={14} className="text-emerald-600" />
        </div>
        <span className="font-mono text-xs font-bold text-[var(--ink)] truncate flex-1 min-w-0">
          {group.productName}
        </span>
        {!isSingleVariant && (
          <span className="font-mono text-[10px] text-[var(--ink)]/40 uppercase tracking-wider shrink-0">
            {group.rows.length} variantes
          </span>
        )}
        <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400 shrink-0">
          +{group.qty}
        </span>
      </div>
      <div className="flex flex-col divide-y divide-[var(--border-soft)]">
        {group.rows.map(row => <VariantLine key={row.tx.id} row={row} />)}
      </div>
    </div>
  );
};

interface ProductFilterOption {
  key: string;
  label: string;
  qty: number;
}

function productGroupKey(row: Row): string {
  return row.product?.name ?? row.tx.productId;
}

function buildProductFilters(rows: Row[]): ProductFilterOption[] {
  const map = new Map<string, ProductFilterOption>();
  for (const row of rows) {
    const key = productGroupKey(row);
    const existing = map.get(key);
    if (existing) existing.qty += row.tx.quantity;
    else map.set(key, { key, label: key, qty: row.tx.quantity });
  }
  return [...map.values()].sort((a, b) => b.qty - a.qty);
}

function DayModal({ dayKey, rows, onClose }: { dayKey: string; rows: Row[]; onClose: () => void }) {
  const [productFilter, setProductFilter] = useState<string | null>(null);
  const totalQty = rows.reduce((sum, r) => sum + r.tx.quantity, 0);
  const totalSuppliers = useMemo(() => new Set(rows.map(r => r.supplierName ?? 'Sin proveedor')).size, [rows]);
  const productFilters = useMemo(() => buildProductFilters(rows), [rows]);
  const filteredRows = useMemo(
    () => productFilter ? rows.filter(r => productGroupKey(r) === productFilter) : rows,
    [rows, productFilter]
  );
  const groups = useMemo(() => groupBySupplier(filteredRows), [filteredRows]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="border-b border-[var(--border-soft)] px-6 py-4 flex justify-between items-center bg-[var(--surface-alt)]/50 shrink-0">
          <div>
            <span className="font-mono text-[10px] text-[var(--ink)]/40 uppercase tracking-wider block">Recepciones del Día</span>
            <h3 className="font-mono font-bold text-base text-[var(--ink)] mt-0.5">{fmtDayLong(dayKey)}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-[var(--ink)]/40 hover:text-[var(--ink)] hover:bg-[var(--surface-alt)] rounded-xl transition-colors shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* KPI summary */}
        {rows.length > 0 && (
          <div className="grid grid-cols-3 border-b border-[var(--border-soft)] shrink-0 bg-[var(--surface-alt)]/20">
            <div className="flex flex-col items-center justify-center py-3 border-r border-[var(--border-soft)]">
              <span className="font-mono font-black text-xl text-[var(--ink)]">{rows.length}</span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--ink)]/40">Comprobantes</span>
            </div>
            <div className="flex flex-col items-center justify-center py-3 border-r border-[var(--border-soft)]">
              <span className="font-mono font-black text-xl text-emerald-600 dark:text-emerald-400">+{totalQty}</span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--ink)]/40">Unidades</span>
            </div>
            <div className="flex flex-col items-center justify-center py-3">
              <span className="font-mono font-black text-xl text-[var(--ink)]">{totalSuppliers}</span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--ink)]/40">Proveedores</span>
            </div>
          </div>
        )}

        {/* Product filter chips */}
        {productFilters.length > 1 && (
          <div className="flex items-center gap-1.5 px-6 py-3 border-b border-[var(--border-soft)] overflow-x-auto shrink-0 bg-[var(--surface)]">
            <button
              onClick={() => setProductFilter(null)}
              className={cn(
                'font-mono text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl border shrink-0 transition-colors',
                productFilter === null ? 'bg-[var(--ink)] text-[var(--ink-inv)] border-transparent' : 'border-[var(--border-soft)] text-[var(--ink)]/60 hover:text-[var(--ink)]'
              )}
            >
              Todos
            </button>
            {productFilters.map(p => (
              <button
                key={p.key}
                onClick={() => setProductFilter(prev => prev === p.key ? null : p.key)}
                className={cn(
                  'font-mono text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl border shrink-0 transition-colors whitespace-nowrap',
                  productFilter === p.key ? 'bg-emerald-600 text-white border-transparent' : 'border-[var(--border-soft)] text-[var(--ink)]/60 hover:text-[var(--ink)]'
                )}
              >
                {p.label} <span className="opacity-80">+{p.qty}</span>
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {rows.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-2 text-[var(--ink)]/30">
              <ClipboardList size={32} />
              <span className="font-mono text-xs uppercase tracking-wider">Sin recepciones este día</span>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="py-12 flex flex-col items-center gap-2 text-[var(--ink)]/30">
              <Package size={32} />
              <span className="font-mono text-xs uppercase tracking-wider">Sin resultados para este producto</span>
            </div>
          ) : (
            groups.map(group => (
              <div key={group.supplierName} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <Building2 size={14} className="text-[var(--ink)]/50 shrink-0" />
                  <span className="font-mono text-xs font-bold text-[var(--ink)] uppercase tracking-wide">{group.supplierName}</span>
                  <span className="h-px flex-1 bg-[var(--border-soft)]" />
                  <span className="font-mono text-[10px] text-[var(--ink)]/50 font-bold shrink-0">
                    {group.rows.length} comprobantes · +{group.qty} uds
                  </span>
                </div>
                <div className="space-y-2">
                  {groupByProduct(group.rows).map(pg => <ProductGroupCard key={pg.productName} group={pg} />)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function CalendarView({ rowsByDay, monthCursor, setMonthCursor, onSelectDay }: {
  rowsByDay: Map<string, Row[]>;
  monthCursor: Date;
  setMonthCursor: (d: Date) => void;
  onSelectDay: (key: string) => void;
}) {
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = new Date().toISOString().slice(0, 10);

  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`),
  ];

  return (
    <div className="modern-card rounded-3xl overflow-hidden shadow-xs border border-[var(--border-soft)]">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-soft)] bg-[var(--surface-alt)]/40">
        <button
          onClick={() => setMonthCursor(new Date(year, month - 1, 1))}
          className="p-2 rounded-xl border border-[var(--border-soft)] hover:bg-[var(--surface)] text-[var(--ink)]/60 hover:text-[var(--ink)] transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="font-mono font-bold text-sm uppercase tracking-wider text-[var(--ink)]">
          {MONTH_LABEL[month]} {year}
        </span>
        <button
          onClick={() => setMonthCursor(new Date(year, month + 1, 1))}
          className="p-2 rounded-xl border border-[var(--border-soft)] hover:bg-[var(--surface)] text-[var(--ink)]/60 hover:text-[var(--ink)] transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 border-b border-[var(--border-soft)] bg-[var(--surface-alt)]/20">
        {WEEKDAY_LABEL.map(w => (
          <div key={w} className="font-mono text-[10px] font-bold uppercase tracking-wider text-center py-2.5 text-[var(--ink)]/50">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 divide-x divide-y divide-[var(--border-soft)]">
        {cells.map((key, i) => {
          if (!key) return <div key={i} className="aspect-square sm:aspect-auto sm:h-24 bg-[var(--surface-alt)]/10" />;
          const dayRows = rowsByDay.get(key) ?? [];
          const qty = dayRows.reduce((sum, r) => sum + r.tx.quantity, 0);
          const isToday = key === todayKey;
          return (
            <button
              key={i}
              onClick={() => onSelectDay(key)}
              className={cn(
                'aspect-square sm:aspect-auto sm:h-24 p-2 sm:p-2.5 flex flex-col items-start justify-between text-left transition-all hover:bg-[var(--surface-alt)]/50',
                dayRows.length === 0 && 'opacity-40 hover:opacity-100'
              )}
            >
              <span className={cn(
                'font-mono text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full shrink-0',
                isToday ? 'bg-[var(--ink)] text-[var(--ink-inv)] shadow-xs' : 'text-[var(--ink)]'
              )}>
                {Number(key.slice(-2))}
              </span>
              {dayRows.length > 0 && (
                <div className="flex flex-col gap-0.5 w-full mt-1">
                  <span className="font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400 truncate">
                    {dayRows.length} rec.
                  </span>
                  <span className="font-mono text-[9px] text-[var(--ink)]/50 truncate hidden sm:block">
                    +{qty} uds
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const LivexFeed: React.FC = () => {
  const { transactions, products, locations, contacts, activeBrand, setActiveBrand } = useAppContext();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'feed' | 'calendar'>('feed');
  const [monthCursor, setMonthCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);

  const receptions = useMemo(
    () => transactions.filter(tx => tx.type === 'RECEPTION' && tx.status !== 'CANCELLED'),
    [transactions]
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return receptions
      .filter(tx => {
        if (!q) return true;
        const prod = products.find(p => p.id === tx.productId);
        const supplier = contacts.find(c => c.id === tx.contactId);
        return (
          tx.reference.toLowerCase().includes(q) ||
          prod?.name.toLowerCase().includes(q) ||
          prod?.code.toLowerCase().includes(q) ||
          supplier?.name.toLowerCase().includes(q)
        );
      })
      .map(tx => ({
        tx,
        product: products.find(p => p.id === tx.productId),
        location: locations.find(l => l.id === tx.toLocationId),
        supplierName: contacts.find(c => c.id === tx.contactId)?.name,
      }));
  }, [receptions, products, locations, contacts, search]);

  const rowsByDay = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const row of rows) {
      const key = limaDayKey(row.tx.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return map;
  }, [rows]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-12 animate-fade-in">
      <TutorialModal
        open={showTutorial}
        onClose={() => setShowTutorial(false)}
        steps={LIVEX_TUTORIAL_STEPS}
        title="Livex"
      />

      {/* Module Header */}
      <ModuleInfo
        number="LX"
        title="Livex — Feed de Recepciones"
        description="Bitácora en vivo de solo lectura: cada comprobante de recepción ingresado a bodega aparece aquí cronológicamente o por vista de calendario."
        onTutorial={() => setShowTutorial(true)}
      />

      {/* Brand Selector Tabs */}
      <div className="flex p-1.5 bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl shadow-xs gap-1.5 overflow-x-auto">
        {BRANDS.map(b => (
          <button
            key={b}
            onClick={() => setActiveBrand(b)}
            className={cn(
              'flex-1 px-4 py-2.5 rounded-xl font-mono text-xs font-bold uppercase tracking-wider transition-all duration-200 whitespace-nowrap',
              activeBrand === b 
                ? 'bg-[var(--ink)] text-[var(--ink-inv)] shadow-sm' 
                : 'text-[var(--ink)]/60 hover:text-[var(--ink)] hover:bg-[var(--surface-alt)]'
            )}
          >
            {BRAND_LABEL[b]}
          </button>
        ))}
      </div>

      {/* Search & View Switcher Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap bg-[var(--surface)] border border-[var(--border-soft)] p-3 rounded-2xl shadow-xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink)]/40" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por referencia, proveedor o producto..."
            className="input-technical rounded-xl text-xs py-2 pl-10 pr-4 w-full"
          />
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="font-mono text-xs text-[var(--ink)]/50">
            <strong>{rows.length}</strong> recepciones
          </span>

          <div className="flex p-1 bg-[var(--surface-alt)] border border-[var(--border-soft)] rounded-xl gap-1">
            <button
              onClick={() => setView('feed')}
              title="Vista de Lista"
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all',
                view === 'feed' 
                  ? 'bg-[var(--ink)] text-[var(--ink-inv)] shadow-xs' 
                  : 'text-[var(--ink)]/60 hover:text-[var(--ink)]'
              )}
            >
              <List size={14} />
              <span className="hidden sm:inline">Lista</span>
            </button>
            <button
              onClick={() => setView('calendar')}
              title="Vista de Calendario"
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs font-bold transition-all',
                view === 'calendar' 
                  ? 'bg-[var(--ink)] text-[var(--ink-inv)] shadow-xs' 
                  : 'text-[var(--ink)]/60 hover:text-[var(--ink)]'
              )}
            >
              <Calendar size={14} />
              <span className="hidden sm:inline">Calendario</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main View Content */}
      {view === 'feed' ? (
        <div className="modern-card rounded-3xl overflow-hidden p-0 divide-y divide-[var(--border-soft)] shadow-sm">
          {rows.length === 0 ? (
            <div className="p-16 flex flex-col items-center justify-center gap-3 text-[var(--ink)]/40 text-center">
              <ClipboardList size={36} className="opacity-30" />
              <h4 className="font-mono text-sm font-bold text-[var(--ink)]">Sin recepciones registradas</h4>
              <p className="font-mono text-xs text-[var(--ink)]/40 max-w-sm">
                No hay movimientos de recepción que coincidan con la búsqueda actual.
              </p>
            </div>
          ) : (
            rows.map(row => (
              <ReceptionRow
                key={row.tx.id}
                tx={row.tx}
                product={row.product}
                location={row.location}
                supplierName={row.supplierName}
              />
            ))
          )}
        </div>
      ) : (
        <CalendarView
          rowsByDay={rowsByDay}
          monthCursor={monthCursor}
          setMonthCursor={setMonthCursor}
          onSelectDay={setSelectedDay}
        />
      )}

      {selectedDay && (
        <DayModal
          dayKey={selectedDay}
          rows={rowsByDay.get(selectedDay) ?? []}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
};
