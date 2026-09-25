import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  ShieldOff, Trash2, ArrowRightLeft, MoreVertical, Mail, Pencil,
  Search, X, AlertTriangle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { TransactionType, Transaction } from '../../types';
import { useAppContext } from '../../store/AppContext';
import { BulletinModal, BulletinData } from './BulletinModal';
import { TX_BADGE } from './constants';

const PAGE_SIZE = 50;

export type LogFilter = { type?: string; dateFrom?: string; dateTo?: string } | null;

export const TransactionLog: React.FC<{ initialFilter?: LogFilter }> = ({ initialFilter }) => {
  const {
    transactions, products, contacts, locations, activeBrand,
    deleteTransaction, hardDeleteTransaction, hardDeleteTransactions,
    updateTransaction, clearAllTransactions, currentUser,
  } = useAppContext();
  const isAdmin = currentUser.role === 'ADMIN_GENERAL';

  // Filters
  const [filterType, setFilterType] = useState<'ALL' | TransactionType>(
    (initialFilter?.type as TransactionType) || 'ALL'
  );
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'CANCELLED'>('ALL');
  const [filterDateFrom, setFilterDateFrom] = useState<string>(initialFilter?.dateFrom || '');
  const [filterDateTo,   setFilterDateTo]   = useState<string>(initialFilter?.dateTo   || '');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Clear sessionStorage after reading once
  useEffect(() => {
    if (initialFilter) sessionStorage.removeItem('operationsLogFilter');
  }, [initialFilter]);

  // Editing
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [editRef, setEditRef] = useState('');
  const [editContact, setEditContact] = useState('');
  const [editDate, setEditDate] = useState('');

  // Action state
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [toastErr, setToastErr] = useState(false);

  // Single action modals
  const [cancelTx, setCancelTx] = useState<Transaction | null>(null);   // anular (all roles)
  const [purgeTx, setPurgeTx]   = useState<Transaction | null>(null);   // borrar registro (admin only)
  const [showPurgeAll, setShowPurgeAll] = useState(false);
  const [bulletinData, setBulletinData] = useState<BulletinData | null>(null);

  // Multi-select (all roles for cancel; admin only for purge)
  const [selected, setSelected]           = useState<Set<string>>(new Set());
  const [showBulkCancel, setShowBulkCancel] = useState(false);
  const [showBulkPurge, setShowBulkPurge]   = useState(false);
  const lastSelectedRef = useRef<string | null>(null);

  // 3-dot menu per row
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  useEffect(() => {
    if (!openMenuId) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-txmenu]')) setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenuId]);

  const showToast = (msg: string, err = false) => {
    setToast(msg); setToastErr(err);
    setTimeout(() => setToast(''), 3000);
  };

  // Derived lists
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = filterDateFrom ? new Date(filterDateFrom + 'T00:00:00') : null;
    const to   = filterDateTo   ? new Date(filterDateTo   + 'T23:59:59') : null;
    return transactions.filter(tx => {
      if (filterType !== 'ALL' && tx.type !== filterType) return false;
      if (filterStatus === 'ACTIVE'    && tx.status === 'CANCELLED') return false;
      if (filterStatus === 'CANCELLED' && tx.status !== 'CANCELLED') return false;
      if (from || to) {
        const d = new Date(tx.date);
        if (from && d < from) return false;
        if (to   && d > to)   return false;
      }
      if (q) {
        const prod = products.find(p => p.id === tx.productId);
        const txt = [prod?.name, prod?.code, tx.reference,
          locations.find(l => l.id === tx.fromLocationId)?.name,
          locations.find(l => l.id === tx.toLocationId)?.name,
          contacts.find(c => c.id === tx.contactId)?.name,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!txt.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, filterType, filterStatus, filterDateFrom, filterDateTo, search, products, locations, contacts]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectableRows = pageRows.filter(tx => tx.status !== 'CANCELLED');

  // Reset page when filters change
  const setFilter = (fn: () => void) => { fn(); setPage(1); setSelected(new Set()); lastSelectedRef.current = null; };

  // Multi-select helpers
  const toggleSelect = (id: string, shiftKey = false) => {
    if (shiftKey && lastSelectedRef.current && lastSelectedRef.current !== id) {
      const ids = selectableRows.map(tx => tx.id);
      const a = ids.indexOf(lastSelectedRef.current);
      const b = ids.indexOf(id);
      if (a !== -1 && b !== -1) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        const range = ids.slice(lo, hi + 1);
        setSelected(prev => { const n = new Set(prev); range.forEach(r => n.add(r)); return n; });
        lastSelectedRef.current = id;
        return;
      }
    }
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    lastSelectedRef.current = id;
  };

  const toggleSelectAll = () => {
    const ids = selectableRows.map(tx => tx.id);
    const allSel = ids.length > 0 && ids.every(id => selected.has(id));
    setSelected(allSel ? new Set() : new Set(ids));
  };

  // Action handlers
  const handleCancel = async () => {
    if (!cancelTx) return;
    setBusy(true);
    try {
      await deleteTransaction(cancelTx.id);
      setCancelTx(null);
      showToast('Operación anulada. Stock revertido.');
    } catch (e: any) { showToast(e.message || 'Error al anular', true); }
    finally { setBusy(false); }
  };

  const handlePurge = async () => {
    if (!purgeTx) return;
    setBusy(true);
    try {
      await hardDeleteTransaction(purgeTx.id);
      setPurgeTx(null);
      showToast('Registro eliminado.');
    } catch (e: any) { showToast(e.message || 'Error al eliminar', true); }
    finally { setBusy(false); }
  };

  const handleBulkCancel = async () => {
    setBusy(true); setShowBulkCancel(false);
    const ids = Array.from(selected); let failed = 0;
    for (const id of ids) { try { await deleteTransaction(id); } catch { failed++; } }
    setSelected(new Set());
    setBusy(false);
    showToast(failed ? `${failed} no pudieron anularse.` : `${ids.length} operaciones anuladas.`, !!failed);
  };

  const handleBulkPurge = async () => {
    setBusy(true); setShowBulkPurge(false);
    const ids = Array.from(selected);
    try {
      await hardDeleteTransactions(ids);
      setSelected(new Set());
      showToast(`${ids.length} registros eliminados.`);
    } catch (e: any) { showToast(e.message || 'Error al eliminar', true); }
    finally { setBusy(false); }
  };

  const handlePurgeAll = async () => {
    setBusy(true); setShowPurgeAll(false);
    try {
      await clearAllTransactions();
      showToast('Todos los registros eliminados. Stock reiniciado a cero.');
    } catch (e: any) { showToast(e.message || 'Error', true); }
    finally { setBusy(false); }
  };

  const handleEditSave = async () => {
    if (!editTx || !editRef.trim()) return;
    setBusy(true);
    try {
      await updateTransaction(editTx.id, {
        reference: editRef.trim(),
        contactId: editContact || null,
        ...(editTx.type === 'RECEPTION' && editDate ? { date: editDate + 'T12:00:00Z' } : {}),
      });
      setEditTx(null);
      showToast('Operación actualizada.');
    } catch (e: any) { showToast(e.message || 'Error al actualizar', true); }
    finally { setBusy(false); }
  };

  const allPageSelected = selectableRows.length > 0 && selectableRows.every(tx => selected.has(tx.id));

  return (
    <div className="flex flex-col gap-4">

      {/* Bulletin modal */}
      {bulletinData && <BulletinModal data={bulletinData} onClose={() => setBulletinData(null)} />}

      {/* Toast */}
      {toast && (
        <div className={cn(
          'border px-3 py-2 font-mono text-[10px] font-bold uppercase flex items-center justify-between',
          toastErr ? 'border-red-600 bg-red-500/10 text-red-700' : 'border-green-600 bg-green-500/10 text-green-700'
        )}>
          {toast}
          <button onClick={() => setToast('')} className="ml-3 opacity-60 hover:opacity-100"><X size={12} /></button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Type filter */}
        <div className="flex items-center border border-[var(--border)]/20 bg-[var(--bg-card)] shrink-0">
          {(['ALL', 'RECEPTION', 'DISPATCH', 'TRANSFER'] as const).map(t => (
            <button key={t}
              onClick={() => setFilter(() => setFilterType(t))}
              className={cn('px-2.5 py-1.5 font-mono text-[8px] font-black tracking-widest uppercase border-r border-[var(--border)]/20 last:border-r-0 transition-all',
                filterType === t ? 'bg-[var(--ink)] text-[var(--ink-inv)]' : 'hover:bg-[var(--ink)]/5')}
            >
              {t === 'ALL' ? 'TODO' : t === 'RECEPTION' ? 'RX' : t === 'DISPATCH' ? 'TX' : 'MV'}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex items-center border border-[var(--border)]/20 bg-[var(--bg-card)] shrink-0">
          {(['ALL', 'ACTIVE', 'CANCELLED'] as const).map(s => (
            <button key={s}
              onClick={() => setFilter(() => setFilterStatus(s))}
              className={cn('px-2.5 py-1.5 font-mono text-[8px] font-black tracking-widest uppercase border-r border-[var(--border)]/20 last:border-r-0 transition-all',
                filterStatus === s ? 'bg-[var(--ink)] text-[var(--ink-inv)]' : 'hover:bg-[var(--ink)]/5')}
            >
              {s === 'ALL' ? 'TODOS' : s === 'ACTIVE' ? 'ACTIVOS' : 'ANULADOS'}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center border border-[var(--border)]/20 bg-[var(--bg-card)] px-2 gap-1.5 flex-1 min-w-[160px]">
          <Search size={11} className="opacity-40 shrink-0" />
          <input
            value={search}
            onChange={e => setFilter(() => setSearch(e.target.value))}
            placeholder="Buscar producto, ref., ubicación..."
            className="bg-transparent font-mono text-[9px] py-1.5 outline-none w-full placeholder:opacity-40"
          />
          {search && <button onClick={() => setFilter(() => setSearch(''))} className="opacity-40 hover:opacity-100"><X size={10} /></button>}
        </div>

        {/* Date range filter */}
        <div className="flex items-center gap-1 border border-[var(--border)]/20 bg-[var(--bg-card)] px-2 py-1 shrink-0">
          <span className="font-mono text-[8px] opacity-40 uppercase">Desde</span>
          <input type="date" value={filterDateFrom}
            onChange={e => setFilter(() => setFilterDateFrom(e.target.value))}
            className="bg-transparent font-mono text-[8px] outline-none cursor-pointer" />
          <span className="font-mono text-[8px] opacity-40 uppercase mx-1">-</span>
          <span className="font-mono text-[8px] opacity-40 uppercase">Hasta</span>
          <input type="date" value={filterDateTo}
            onChange={e => setFilter(() => setFilterDateTo(e.target.value))}
            className="bg-transparent font-mono text-[8px] outline-none cursor-pointer" />
          {(filterDateFrom || filterDateTo) && (
            <button onClick={() => setFilter(() => { setFilterDateFrom(''); setFilterDateTo(''); })}
              className="ml-1 opacity-40 hover:opacity-100"><X size={10} /></button>
          )}
        </div>

        <div className="flex-1 h-px bg-[var(--ink)]/10 hidden sm:block min-w-[10px]" />

        {/* Bulk cancel · all roles when selected */}
        {selected.size > 0 && (
          <button onClick={() => setShowBulkCancel(true)} disabled={busy}
            className="flex items-center gap-1.5 font-mono text-[8px] font-bold uppercase border border-orange-500 text-orange-600 px-2.5 py-1.5 hover:bg-orange-500 hover:text-white transition-all shrink-0 disabled:opacity-50">
            <ShieldOff size={10} /> ANULAR {selected.size}
          </button>
        )}
        {/* Bulk hard-delete · admin only */}
        {isAdmin && selected.size > 0 && (
          <button onClick={() => setShowBulkPurge(true)} disabled={busy}
            className="flex items-center gap-1.5 font-mono text-[8px] font-bold uppercase border border-red-600 bg-red-600 text-white px-2.5 py-1.5 hover:bg-red-700 transition-all shrink-0 disabled:opacity-50">
            <Trash2 size={10} /> BORRAR {selected.size}
          </button>
        )}

        {/* Purge all · admin only */}
        {isAdmin && (
          <button onClick={() => setShowPurgeAll(true)}
            className="flex items-center gap-1.5 font-mono text-[8px] font-bold uppercase border border-red-400 text-red-600 px-2.5 py-1.5 hover:bg-red-600 hover:text-white transition-all shrink-0">
            <Trash2 size={10} /> BORRAR TODO
          </button>
        )}
      </div>

      {/* Count + pagination info */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[8px] opacity-40 uppercase tracking-widest">
          {filtered.length} registro{filtered.length !== 1 ? 's' : ''}{search || filterType !== 'ALL' || filterStatus !== 'ALL' || filterDateFrom || filterDateTo ? ' (filtrado)' : ''}
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="font-mono text-[8px] px-2 py-1 border border-[var(--border)]/20 hover:bg-[var(--ink)]/5 disabled:opacity-30 transition-all">-</button>
            <span className="font-mono text-[8px] opacity-50 px-1">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="font-mono text-[8px] px-2 py-1 border border-[var(--border)]/20 hover:bg-[var(--ink)]/5 disabled:opacity-30 transition-all">-</button>
          </div>
        )}
      </div>

      {/* Table */}
      {pageRows.length === 0 ? (
        <div className="border border-[var(--border)]/20 bg-[var(--surface-alt)] p-8 text-center font-mono text-[10px] opacity-40 uppercase tracking-widest">
          SIN REGISTROS
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {/* Select-all row · all roles */}
          {selectableRows.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--ink)]/5 border border-[var(--border)]/10">
              <input type="checkbox" checked={allPageSelected} onChange={toggleSelectAll}
                className="w-3.5 h-3.5 accent-[#141414] cursor-pointer" />
              <span className="font-mono text-[8px] opacity-50 uppercase tracking-widest">
                {selected.size > 0 ? `${selected.size} seleccionado${selected.size > 1 ? 's' : ''}` : 'Seleccionar página'}
              </span>
            </div>
          )}

          {pageRows.map(tx => {
            const product  = products.find(p => p.id === tx.productId);
            const contact  = contacts.find(c => c.id === tx.contactId);
            const fromLoc  = locations.find(l => l.id === tx.fromLocationId);
            const toLoc    = locations.find(l => l.id === tx.toLocationId);
            const isCancelled = tx.status === 'CANCELLED';
            const badge    = TX_BADGE[tx.type];
            const isSel    = selected.has(tx.id);

            const txVariant = [product?.color, product?.size].filter(Boolean).join(' · ') || undefined;
            const openBulletin = () => setBulletinData({
              type: tx.type,
              reference: tx.reference,
              date: new Date(tx.date).toLocaleString('es-PE', { timeZone: 'America/Lima', dateStyle: 'long', timeStyle: 'short' }),
              rawDate: tx.date.slice(0, 10),
              operator: tx.user,
              brand: activeBrand,
              txIds: [tx.id],
              items: [{ productName: product?.name ?? tx.productId, productCode: product?.code ?? '', quantity: tx.quantity, variant: txVariant, serialNumber: tx.serialNumber }],
              fromLocation: fromLoc?.name,
              toLocation: toLoc?.name,
              contact: contact?.name,
              signature: tx.signature,
            });

            return (
              <div key={tx.id} className={cn(
                'border bg-[var(--surface)] flex items-center gap-2 md:gap-3 px-3 py-2.5 text-[11px] font-mono transition-all',
                isCancelled ? 'border-[var(--border)]/10 opacity-40' : 'border-[var(--border)]/15 hover:border-[var(--border)]/30',
                isSel && !isCancelled && 'bg-orange-500/10 border-orange-500/40'
              )}>
                {/* Checkbox · all roles, non-cancelled */}
                {isCancelled
                  ? <div className="w-3.5 h-3.5 shrink-0" />
                  : <input type="checkbox" checked={isSel} onChange={() => {}}
                      className="w-3.5 h-3.5 shrink-0 accent-[var(--ink)] cursor-pointer"
                      onClick={e => { e.stopPropagation(); toggleSelect(tx.id, e.shiftKey); }} />
                }

                <div className={cn('shrink-0 w-7 text-center text-[8px] font-black py-1 border', badge.cls)}>{badge.label}</div>
                <div className="shrink-0 text-[9px] opacity-40 w-24 hidden sm:block leading-tight">
                  {new Date(tx.date).toLocaleString('es-PE', { timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short' })}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{product?.name ?? tx.productId}</div>
                  <div className="text-[9px] opacity-50 truncate">
                    {product?.code}
                    {(product?.color || product?.size) && <span className="opacity-70"> · {[product?.color, product?.size].filter(Boolean).join(' / ')}</span>}
                    {contact ? ` · ${contact.name}` : ''}
                  </div>
                </div>
                <div className="shrink-0 bg-[var(--ink)] text-[var(--ink-inv)] px-2 py-0.5 text-[10px] font-black">{tx.quantity}</div>
                <div className="hidden md:flex items-center gap-1 shrink-0 text-[9px] opacity-50 max-w-[180px]">
                  {fromLoc && <span className="truncate">{fromLoc.name}</span>}
                  {fromLoc && toLoc && <ArrowRightLeft size={8} className="opacity-40 shrink-0" />}
                  {toLoc && <span className="truncate">{toLoc.name}</span>}
                </div>
                <div className="shrink-0 font-mono text-[9px] opacity-40 hidden lg:block truncate max-w-[100px]">{tx.reference}</div>

                {/* 3-dot menu */}
                <div className="relative shrink-0" data-txmenu>
                  {isCancelled && (
                    <span className="text-[8px] font-black text-red-500 border border-red-500/50 px-1.5 py-0.5 bg-red-500/10 mr-1">ANULADO</span>
                  )}
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === tx.id ? null : tx.id); }}
                    className="p-1.5 border border-transparent hover:border-[var(--border)] hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-all"
                    title="Opciones"
                  >
                    <MoreVertical size={13} />
                  </button>
                  {openMenuId === tx.id && (
                    <div className="absolute right-0 top-full mt-0.5 z-50 bg-[var(--bg)] border-2 border-[var(--border)] shadow-[4px_4px_0_var(--border)] min-w-[160px] flex flex-col">
                      {/* Ver comprobante */}
                      <button
                        type="button"
                        onClick={() => { setOpenMenuId(null); openBulletin(); }}
                        className="flex items-center gap-2 px-3 py-2.5 font-mono text-[9px] font-bold uppercase tracking-widest hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-all text-left"
                      >
                        <Mail size={11} /> Ver comprobante
                      </button>
                      {/* Editar */}
                      {!isCancelled && (
                        <button
                          type="button"
                          onClick={() => { setOpenMenuId(null); setEditTx(tx); setEditRef(tx.reference); setEditContact(tx.contactId ?? ''); setEditDate(tx.date.slice(0, 10)); }}
                          className="flex items-center gap-2 px-3 py-2.5 font-mono text-[9px] font-bold uppercase tracking-widest hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-all text-left"
                        >
                          <Pencil size={11} /> Editar
                        </button>
                      )}
                      {/* Anular */}
                      {!isCancelled && (
                        <button
                          type="button"
                          onClick={() => { setOpenMenuId(null); setCancelTx(tx); }}
                          className="flex items-center gap-2 px-3 py-2.5 font-mono text-[9px] font-bold uppercase tracking-widest text-orange-600 hover:bg-orange-500 hover:text-white transition-all text-left border-t border-[var(--border)]/20"
                        >
                          <ShieldOff size={11} /> Anular operación
                        </button>
                      )}
                      {/* Eliminar registro · admin only */}
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => { setOpenMenuId(null); setPurgeTx(tx); }}
                          className="flex items-center gap-2 px-3 py-2.5 font-mono text-[9px] font-bold uppercase tracking-widest text-red-600 hover:bg-red-600 hover:text-white transition-all text-left border-t border-[var(--border)]/20"
                        >
                          <Trash2 size={11} /> Eliminar registro
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 pt-1">
          <button onClick={() => setPage(1)} disabled={page === 1}
            className="font-mono text-[8px] px-2 py-1 border border-[var(--border)]/20 hover:bg-[var(--ink)]/5 disabled:opacity-30 transition-all">«</button>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="font-mono text-[8px] px-2 py-1 border border-[var(--border)]/20 hover:bg-[var(--ink)]/5 disabled:opacity-30 transition-all">‹</button>
          <span className="font-mono text-[8px] opacity-50 px-2">{page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="font-mono text-[8px] px-2 py-1 border border-[var(--border)]/20 hover:bg-[var(--ink)]/5 disabled:opacity-30 transition-all">›</button>
          <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
            className="font-mono text-[8px] px-2 py-1 border border-[var(--border)]/20 hover:bg-[var(--ink)]/5 disabled:opacity-30 transition-all">»</button>
        </div>
      )}

      {/* -- Modals ----------------------------------------------------------- */}

      {/* Edit modal */}
      {editTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[var(--bg)] border-2 border-[var(--border)] shadow-[8px_8px_0_var(--border)] w-full max-w-sm">
            <div className="border-b-2 border-[var(--border)] bg-[var(--ink)] text-[var(--ink-inv)] px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2"><Pencil size={13} /><span className="font-mono text-[10px] font-bold tracking-widest uppercase">EDITAR OPERACIÓN</span></div>
              <button onClick={() => setEditTx(null)} className="opacity-60 hover:opacity-100"><X size={14} /></button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div className="font-mono text-[9px] opacity-50 uppercase tracking-widest border-b border-[var(--border)]/10 pb-2">
                {editTx.type} · {products.find(p => p.id === editTx.productId)?.name} · {editTx.quantity} UND
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] uppercase opacity-70">REFERENCIA / GUÍA</label>
                <input type="text" value={editRef} onChange={e => setEditRef(e.target.value)}
                  className="w-full border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 font-mono text-xs font-bold uppercase outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all" />
              </div>
              {(editTx.type === 'RECEPTION' || editTx.type === 'DISPATCH') && (
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[9px] font-bold tracking-[0.2em] uppercase opacity-70">{editTx.type === 'RECEPTION' ? 'PROVEEDOR' : 'CLIENTE'}</label>
                  <select value={editContact} onChange={e => setEditContact(e.target.value)}
                    className="w-full border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 font-mono text-xs font-bold uppercase outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all">
                    <option value="">-- Sin contacto --</option>
                    {contacts.filter(c => editTx.type === 'RECEPTION' ? c.type === 'SUPPLIER' : c.type === 'CLIENT').map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {editTx.type === 'RECEPTION' && (
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[9px] font-bold tracking-[0.2em] uppercase opacity-70">FECHA DE RECEPCIÓN</label>
                  <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                    className="w-full border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 font-mono text-xs font-bold outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all" />
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={handleEditSave} disabled={busy || !editRef.trim()}
                  className="flex-1 bg-[var(--ink)] text-[var(--ink-inv)] py-2.5 font-mono text-[10px] font-bold tracking-widest uppercase hover:opacity-80 disabled:opacity-50 transition-all">
                  {busy ? 'GUARDANDO...' : 'GUARDAR'}
                </button>
                <button onClick={() => setEditTx(null)}
                  className="flex-1 border border-[var(--border)] py-2.5 font-mono text-[10px] font-bold tracking-widest uppercase hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-all">
                  CANCELAR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel (anular) single */}
      {cancelTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[var(--bg)] border-4 border-orange-500 shadow-[8px_8px_0_var(--border)] w-full max-w-sm">
            <div className="border-b border-orange-500 bg-orange-500 px-4 py-3 flex items-center gap-2">
              <ShieldOff size={15} className="text-white" />
              <span className="font-mono text-[10px] font-bold tracking-widest uppercase text-white">ANULAR OPERACIÓN</span>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <p className="font-mono text-xs font-bold uppercase text-center leading-relaxed">
                ¿Anular <span className="text-orange-600">{cancelTx.reference}</span>?<br />
                <span className="text-[9px] opacity-50 normal-case font-normal block mt-1">El stock será revertido. El registro permanece como ANULADO.</span>
              </p>
              <div className="flex gap-2">
                <button onClick={handleCancel} disabled={busy}
                  className="flex-1 bg-orange-500 border border-orange-500 text-white py-2.5 font-mono text-[10px] font-bold tracking-widest uppercase hover:bg-orange-600 disabled:opacity-50 transition-all">
                  {busy ? 'ANULANDO...' : 'CONFIRMAR'}
                </button>
                <button onClick={() => setCancelTx(null)}
                  className="flex-1 border border-[var(--border)] py-2.5 font-mono text-[10px] font-bold tracking-widest uppercase hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-all">
                  CANCELAR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hard-delete single */}
      {purgeTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[var(--bg)] border-4 border-red-600 shadow-[8px_8px_0_var(--border)] w-full max-w-sm">
            <div className="border-b border-red-600 bg-red-600 px-4 py-3 flex items-center gap-2">
              <Trash2 size={15} className="text-white" />
              <span className="font-mono text-[10px] font-bold tracking-widest uppercase text-white">ELIMINAR REGISTRO</span>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <p className="font-mono text-xs font-bold uppercase text-center leading-relaxed">
                ¿Eliminar el registro <span className="text-red-600">{purgeTx.reference}</span>?<br />
                <span className="text-[9px] opacity-50 normal-case font-normal block mt-1">
                  {purgeTx.status !== 'CANCELLED'
                    ? 'El registro se borrará sin revertir stock. Usa "Anular" si quieres revertir primero.'
                    : 'El registro ANULADO se borrará permanentemente de la base de datos.'}
                </span>
              </p>
              <div className="flex gap-2">
                <button onClick={handlePurge} disabled={busy}
                  className="flex-1 bg-red-600 border border-red-600 text-white py-2.5 font-mono text-[10px] font-bold tracking-widest uppercase hover:bg-red-700 disabled:opacity-50 transition-all">
                  {busy ? 'ELIMINANDO...' : 'SÍ, ELIMINAR'}
                </button>
                <button onClick={() => setPurgeTx(null)}
                  className="flex-1 border border-[var(--border)] py-2.5 font-mono text-[10px] font-bold tracking-widest uppercase hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-all">
                  CANCELAR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk cancel */}
      {showBulkCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[var(--bg)] border-4 border-orange-500 shadow-[8px_8px_0_var(--border)] w-full max-w-sm">
            <div className="border-b border-orange-500 bg-orange-500 px-4 py-3 flex items-center gap-2">
              <ShieldOff size={15} className="text-white" />
              <span className="font-mono text-[10px] font-bold tracking-widest uppercase text-white">ANULAR {selected.size} OPERACIONES</span>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <p className="font-mono text-xs font-bold uppercase text-center leading-relaxed">
                ¿Anular <span className="text-orange-600">{selected.size}</span> operaciones?<br />
                <span className="text-[9px] opacity-50 normal-case font-normal block mt-1">El stock de cada una será revertido. Los registros permanecen como ANULADOS.</span>
              </p>
              <div className="flex gap-2">
                <button onClick={handleBulkCancel} disabled={busy}
                  className="flex-1 bg-orange-500 border border-orange-500 text-white py-2.5 font-mono text-[10px] font-bold tracking-widest uppercase hover:bg-orange-600 disabled:opacity-50 transition-all">
                  {busy ? 'ANULANDO...' : 'CONFIRMAR'}
                </button>
                <button onClick={() => setShowBulkCancel(false)}
                  className="flex-1 border border-[var(--border)] py-2.5 font-mono text-[10px] font-bold tracking-widest uppercase hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-all">
                  CANCELAR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk hard-delete */}
      {showBulkPurge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[var(--bg)] border-4 border-red-600 shadow-[8px_8px_0_var(--border)] w-full max-w-sm">
            <div className="border-b border-red-600 bg-red-600 px-4 py-3 flex items-center gap-2">
              <Trash2 size={15} className="text-white" />
              <span className="font-mono text-[10px] font-bold tracking-widest uppercase text-white">ELIMINAR {selected.size} REGISTROS</span>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <p className="font-mono text-xs font-bold uppercase text-center leading-relaxed">
                ¿Eliminar <span className="text-red-600">{selected.size}</span> registros de la base de datos?<br />
                <span className="text-[9px] opacity-50 normal-case font-normal block mt-1">Esta acción es irreversible. El stock NO será revertido.</span>
              </p>
              <div className="flex gap-2">
                <button onClick={handleBulkPurge} disabled={busy}
                  className="flex-1 bg-red-600 border border-red-600 text-white py-2.5 font-mono text-[10px] font-bold tracking-widest uppercase hover:bg-red-700 disabled:opacity-50 transition-all">
                  {busy ? 'ELIMINANDO...' : 'SÍ, ELIMINAR'}
                </button>
                <button onClick={() => setShowBulkPurge(false)}
                  className="flex-1 border border-[var(--border)] py-2.5 font-mono text-[10px] font-bold tracking-widest uppercase hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-all">
                  CANCELAR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Purge all */}
      {showPurgeAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[var(--bg)] border-4 border-red-600 shadow-[8px_8px_0_var(--border)] w-full max-w-sm">
            <div className="border-b border-red-600 bg-red-600 px-4 py-3 flex items-center gap-2">
              <AlertTriangle size={15} className="text-white" />
              <span className="font-mono text-[10px] font-bold tracking-widest uppercase text-white">BORRAR TODAS LAS OPERACIONES</span>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <p className="font-mono text-xs font-bold uppercase text-center leading-relaxed">
                ¿Confirmas eliminar <span className="text-red-600">TODOS</span> los registros?<br />
                <span className="text-[10px] text-red-500 font-black block mt-1">ATENCIÓN: El stock se reiniciará a cero.</span>
                <span className="text-[9px] opacity-50 normal-case font-normal block mt-1">Esta acción es irreversible.</span>
              </p>
              <div className="flex gap-2">
                <button onClick={handlePurgeAll} disabled={busy}
                  className="flex-1 bg-red-600 border border-red-600 text-white py-2.5 font-mono text-[10px] font-bold tracking-widest uppercase hover:bg-red-700 disabled:opacity-50 transition-all">
                  {busy ? 'BORRANDO...' : 'SÍ, BORRAR TODO'}
                </button>
                <button onClick={() => setShowPurgeAll(false)}
                  className="flex-1 border border-[var(--border)] py-2.5 font-mono text-[10px] font-bold tracking-widest uppercase hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-all">
                  CANCELAR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
