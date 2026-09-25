import React, { useState, useMemo } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronDown, ChevronUp, Search, Download, RefreshCw, Calendar, Database, ShieldAlert } from 'lucide-react';
import type { AuditAction, AuditLogEntry } from '../types';
import { TutorialModal, OPERATION_HISTORY_TUTORIAL_STEPS } from '../components/TutorialModal';

// ─── Friendly labels ───────────────────────────────────────────────────────────

const TABLE_LABEL: Record<string, string> = {
  products: 'Productos',
  locations: 'Ubicaciones',
  contacts: 'Contactos',
  stock_levels: 'Stock',
  transactions: 'Operaciones',
  purchase_orders: 'Órdenes de Compra',
  purchase_order_items: 'Items OC',
  inventory_adjustments: 'Ajustes',
  profiles: 'Usuarios',
  role_permissions: 'Permisos',
  notification_subscribers: 'Notificaciones',
};

const ACTION_LABEL: Record<AuditAction, string> = {
  INSERT: 'CREÓ',
  UPDATE: 'EDITÓ',
  DELETE: 'ELIMINÓ',
};

const ACTION_COLOR: Record<AuditAction, string> = {
  INSERT: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
  UPDATE: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
  DELETE: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function summarize(entry: AuditLogEntry): string {
  const row = entry.newData ?? entry.oldData ?? {};
  const name = (row.name as string) || (row.username as string) || (row.code as string) || (row.reference as string);
  if (name) return name;
  if (entry.tableName === 'stock_levels' && entry.newData) {
    const qty = entry.newData.quantity;
    const prev = entry.oldData?.quantity;
    if (prev !== undefined) return `cantidad ${prev} → ${qty}`;
    return `cantidad ${qty}`;
  }
  if (entry.tableName === 'transactions') {
    const t = entry.newData ?? entry.oldData ?? {};
    if (entry.action === 'UPDATE' && entry.oldData?.date !== entry.newData?.date && entry.oldData?.date && entry.newData?.date) {
      const from = (entry.oldData.date as string).slice(0, 10);
      const to = (entry.newData.date as string).slice(0, 10);
      return `${t.reference ?? ''} · fecha ${from} → ${to}`;
    }
    return `${t.type} · ${t.quantity}u · ${t.reference}`;
  }
  if (entry.tableName === 'inventory_adjustments' && entry.newData) {
    const a = entry.newData;
    return `${a.previous_quantity} → ${a.new_quantity} (${a.reason})`;
  }
  return entry.recordId?.slice(0, 8) ?? '—';
}

function changedFields(entry: AuditLogEntry): Array<{ key: string; from: unknown; to: unknown }> {
  if (entry.action !== 'UPDATE' || !entry.oldData || !entry.newData) return [];
  const keys = new Set([...Object.keys(entry.oldData), ...Object.keys(entry.newData)]);
  const out: Array<{ key: string; from: unknown; to: unknown }> = [];
  for (const k of keys) {
    if (k === 'updated_at' || k === 'created_at') continue;
    const before = entry.oldData[k];
    const after = entry.newData[k];
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      out.push({ key: k, from: before, to: after });
    }
  }
  return out;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string' && v.length > 80) return v.slice(0, 80) + '…';
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 120);
  return String(v);
}

const exportCSV = (rows: AuditLogEntry[]) => {
  const headers = ['FECHA', 'USUARIO', 'ACCION', 'TABLA', 'REGISTRO', 'MARCA', 'DETALLE'];
  const lines = rows.map(r => [
    format(new Date(r.occurredAt), 'dd/MM/yyyy HH:mm:ss'),
    r.userName ?? '—',
    ACTION_LABEL[r.action],
    TABLE_LABEL[r.tableName] ?? r.tableName,
    r.recordId ?? '—',
    r.brand ?? '—',
    summarize(r),
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `auditoria_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export const OperationHistory: React.FC = () => {
  const { auditLog, refreshAuditLog, currentUser } = useAppContext();
  const [filterTable, setFilterTable] = useState('ALL');
  const [filterAction, setFilterAction] = useState<'ALL' | AuditAction>('ALL');
  const [filterBrand, setFilterBrand] = useState('ALL');
  const [filterDateChanges, setFilterDateChanges] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  if (currentUser.role !== 'ADMIN_GENERAL') {
    return (
      <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 pb-12">
        <ModuleInfo number="14" title="Historial General" description="Registro completo de todas las acciones del sistema." />
        <div className="p-16 text-center text-xs font-semibold text-[var(--ink)]/50 uppercase tracking-wider bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl shadow-sm flex flex-col items-center gap-2">
          <ShieldAlert size={28} className="text-amber-500" />
          <span>Solo ADMIN_GENERAL tiene autorización para auditar el historial completo.</span>
        </div>
      </div>
    );
  }

  const tables = useMemo(() => {
    const set = new Set<string>();
    for (const e of auditLog) set.add(e.tableName);
    return Array.from(set).sort();
  }, [auditLog]);

  const brands = useMemo(() => {
    const set = new Set<string>();
    for (const e of auditLog) if (e.brand) set.add(e.brand);
    return Array.from(set).sort();
  }, [auditLog]);

  const filtered = useMemo(() => auditLog.filter(e => {
    if (filterDateChanges) {
      if (e.tableName !== 'transactions') return false;
      if (e.action !== 'UPDATE') return false;
      const isReception = (e.newData?.type ?? e.oldData?.type) === 'RECEPTION';
      if (!isReception) return false;
      const dateChanged = e.oldData?.date !== undefined && e.newData?.date !== undefined && e.oldData.date !== e.newData.date;
      if (!dateChanged) return false;
    } else {
      if (filterTable !== 'ALL' && e.tableName !== filterTable) return false;
      if (filterAction !== 'ALL' && e.action !== filterAction) return false;
    }
    if (filterBrand !== 'ALL' && e.brand !== filterBrand) return false;
    if (dateFrom || dateTo) {
      const d = new Date(e.occurredAt);
      if (dateFrom && d < startOfDay(parseISO(dateFrom))) return false;
      if (dateTo && d > endOfDay(parseISO(dateTo))) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const haystack = [
        e.userName, e.recordId, e.brand, TABLE_LABEL[e.tableName] ?? e.tableName,
        summarize(e),
        JSON.stringify(e.newData ?? {}),
        JSON.stringify(e.oldData ?? {}),
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    }
    return true;
  }), [auditLog, filterTable, filterAction, filterBrand, filterDateChanges, search, dateFrom, dateTo]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await refreshAuditLog(); } finally { setRefreshing(false); }
  };

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 pb-12">
      <TutorialModal open={showTutorial} onClose={() => setShowTutorial(false)} steps={OPERATION_HISTORY_TUTORIAL_STEPS} title="Historial General" />
      
      {/* Modern Hero Module Header */}
      <ModuleInfo 
        number="14" 
        title="Historial General & Auditoría" 
        description="Registro auditado de todas las acciones del sistema: creaciones, ediciones, borrados y cambios de stock. Traza qué se hizo, quién lo hizo y cuándo." 
        onTutorial={() => setShowTutorial(true)} 
      />

      {/* Modern Filter Toolbar */}
      <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl p-4 shadow-sm flex flex-col gap-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search + Table & Action filter */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="relative w-56">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink)]/40 pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="BUSCAR EN REGISTROS..."
                className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] pl-8 pr-3 py-2 text-xs font-semibold rounded-xl focus:outline-none focus:border-blue-500 uppercase placeholder:normal-case"
              />
            </div>

            <button
              onClick={() => setFilterDateChanges(v => !v)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
                filterDateChanges
                  ? 'bg-blue-600 text-white'
                  : 'bg-[var(--bg-input)] border border-[var(--border-soft)] text-[var(--ink)]/70 hover:bg-[var(--border-soft)]'
              }`}
            >
              Cambios de fecha
            </button>

            {!filterDateChanges && (
              <>
                <select 
                  value={filterTable} 
                  onChange={e => setFilterTable(e.target.value)}
                  className="bg-[var(--bg-input)] border border-[var(--border-soft)] px-3 py-2 text-xs font-bold text-[var(--ink)] rounded-xl focus:outline-none focus:border-blue-500 uppercase cursor-pointer"
                >
                  <option value="ALL">TODAS LAS TABLAS</option>
                  {tables.map(t => <option key={t} value={t}>{(TABLE_LABEL[t] ?? t).toUpperCase()}</option>)}
                </select>

                <select 
                  value={filterAction} 
                  onChange={e => setFilterAction(e.target.value as 'ALL' | AuditAction)}
                  className="bg-[var(--bg-input)] border border-[var(--border-soft)] px-3 py-2 text-xs font-bold text-[var(--ink)] rounded-xl focus:outline-none focus:border-blue-500 uppercase cursor-pointer"
                >
                  <option value="ALL">TODAS ACCIONES</option>
                  <option value="INSERT">CREACIÓN (INSERT)</option>
                  <option value="UPDATE">EDICIÓN (UPDATE)</option>
                  <option value="DELETE">ELIMINACIÓN (DELETE)</option>
                </select>
              </>
            )}

            {brands.length > 1 && (
              <select 
                value={filterBrand} 
                onChange={e => setFilterBrand(e.target.value)}
                className="bg-[var(--bg-input)] border border-[var(--border-soft)] px-3 py-2 text-xs font-bold text-[var(--ink)] rounded-xl focus:outline-none focus:border-blue-500 uppercase cursor-pointer"
              >
                <option value="ALL">TODAS LAS MARCAS</option>
                {brands.map(b => <option key={b} value={b}>{b.replace('_', ' ')}</option>)}
              </select>
            )}
          </div>

          {/* Right action buttons: Refresh & Export */}
          <div className="flex items-center gap-2">
            <button 
              onClick={handleRefresh} 
              disabled={refreshing}
              className="modern-btn px-3.5 py-2 text-xs flex items-center gap-1.5 uppercase disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              <span>Recargar</span>
            </button>
            <button 
              onClick={() => exportCSV(filtered)}
              className="modern-btn-primary px-4 py-2 text-xs flex items-center gap-1.5 uppercase"
            >
              <Download size={14} />
              <span>CSV ({filtered.length})</span>
            </button>
          </div>
        </div>

        {/* Date Filter Bar */}
        <div className="flex items-center gap-2 pt-2.5 border-t border-[var(--border-soft)] flex-wrap text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]/50 mr-1 flex items-center gap-1">
            <Calendar size={12} /> Rango:
          </span>
          <div className="flex items-center gap-2">
            <input 
              type="date" 
              value={dateFrom} 
              onChange={e => setDateFrom(e.target.value)}
              className="bg-[var(--bg-input)] border border-[var(--border-soft)] px-2.5 py-1.5 text-xs font-semibold rounded-xl focus:outline-none focus:border-blue-500" 
            />
            <span className="text-[var(--ink)]/50">—</span>
            <input 
              type="date" 
              value={dateTo} 
              onChange={e => setDateTo(e.target.value)}
              className="bg-[var(--bg-input)] border border-[var(--border-soft)] px-2.5 py-1.5 text-xs font-semibold rounded-xl focus:outline-none focus:border-blue-500" 
            />
          </div>
          {(dateFrom || dateTo) && (
            <button 
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="modern-btn px-2.5 py-1.5 text-[11px] uppercase ml-1"
            >
              Limpiar Fechas
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="p-16 text-center text-xs font-semibold text-[var(--ink)]/50 uppercase tracking-wider bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl shadow-sm">
          Sin registros de auditoría para los criterios seleccionados
        </div>
      )}

      {/* Audit Log Cards */}
      <div className="flex flex-col gap-2.5">
        {filtered.map(ev => {
          const isExp = expanded === ev.id;
          const changes = changedFields(ev);
          return (
            <div key={ev.id} className="border border-[var(--border-soft)] bg-[var(--surface)] rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden">
              <div
                className="flex items-center justify-between gap-4 p-4 cursor-pointer"
                onClick={() => setExpanded(isExp ? null : ev.id)}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0 ${ACTION_COLOR[ev.action]}`}>
                    {ACTION_LABEL[ev.action]}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0 bg-[var(--bg-input)] border border-[var(--border-soft)] text-[var(--ink)]/80">
                    {(TABLE_LABEL[ev.tableName] ?? ev.tableName).toUpperCase()}
                  </span>
                  {ev.brand && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0 bg-[var(--bg-input)] border border-[var(--border-soft)] text-[var(--ink)]/60">
                      {ev.brand.replace('_', ' ')}
                    </span>
                  )}
                  <span className="font-mono font-bold text-xs text-[var(--ink)] truncate">{summarize(ev)}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-bold text-[var(--ink)]/80">{ev.userName ?? '—'}</span>
                  <span className="text-xs font-medium text-[var(--ink)]/50 hidden sm:inline">
                    {format(new Date(ev.occurredAt), 'dd MMM HH:mm', { locale: es })}
                  </span>
                  {isExp ? <ChevronUp size={15} className="text-[var(--ink)]/40" /> : <ChevronDown size={15} className="text-[var(--ink)]/40" />}
                </div>
              </div>

              {isExp && (
                <div className="border-t border-[var(--border-soft)] px-5 py-4 flex flex-col gap-3 bg-[var(--bg-input)]/25 animate-in fade-in duration-150">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[var(--ink)]/40 block">Fecha y Hora</span>
                      <span className="font-mono font-bold text-[var(--ink)]">{format(new Date(ev.occurredAt), 'dd MMM yyyy HH:mm:ss', { locale: es })}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[var(--ink)]/40 block">Usuario</span>
                      <span className="font-bold text-[var(--ink)]">{ev.userName ?? '—'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[var(--ink)]/40 block">Tabla Afectada</span>
                      <span className="font-semibold text-[var(--ink)]">{TABLE_LABEL[ev.tableName] ?? ev.tableName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[var(--ink)]/40 block">ID Registro</span>
                      <span className="font-mono text-[11px] font-bold text-[var(--ink)] bg-[var(--surface)] px-2 py-0.5 rounded-lg border border-[var(--border-soft)]">{ev.recordId?.slice(0, 8) ?? '—'}</span>
                    </div>
                  </div>

                  {ev.action === 'UPDATE' && changes.length > 0 && (
                    <div className="border-t border-[var(--border-soft)] pt-3 mt-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]/40 block mb-2">Campos Modificados</span>
                      <div className="overflow-x-auto rounded-xl border border-[var(--border-soft)] bg-[var(--surface)]">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-[var(--border-soft)] bg-[var(--bg-input)]/50 text-[10px] uppercase text-[var(--ink)]/50">
                              <th className="py-2 px-3 text-left w-36">Campo</th>
                              <th className="py-2 px-3 text-left">Valor Anterior</th>
                              <th className="py-2 px-3 text-left">Nuevo Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {changes.map(c => (
                              <tr key={c.key} className="border-b border-[var(--border-soft)]/50 last:border-none">
                                <td className="py-2 px-3 font-mono font-bold text-[var(--ink)]">{c.key}</td>
                                <td className="py-2 px-3 font-mono text-rose-500">{formatValue(c.from)}</td>
                                <td className="py-2 px-3 font-mono text-emerald-500 font-bold">{formatValue(c.to)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {ev.action === 'INSERT' && ev.newData && (
                    <details className="border-t border-[var(--border-soft)] pt-2 mt-1">
                      <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]/50 hover:text-[var(--ink)]">Datos Creados (JSON)</summary>
                      <pre className="mt-2 text-[11px] font-mono bg-[var(--surface)] border border-[var(--border-soft)] rounded-xl p-3 overflow-x-auto">{JSON.stringify(ev.newData, null, 2)}</pre>
                    </details>
                  )}

                  {ev.action === 'DELETE' && ev.oldData && (
                    <details className="border-t border-[var(--border-soft)] pt-2 mt-1">
                      <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]/50 hover:text-[var(--ink)]">Datos Eliminados (JSON)</summary>
                      <pre className="mt-2 text-[11px] font-mono bg-[var(--surface)] border border-[var(--border-soft)] rounded-xl p-3 overflow-x-auto">{JSON.stringify(ev.oldData, null, 2)}</pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
