import React, { useState, useMemo } from 'react';
import { Mail, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { TransactionType } from '../../types';
import { useAppContext } from '../../store/AppContext';
import { Confirmations } from '../../pages/Confirmations';
import { BulletinModal, BulletinData } from './BulletinModal';
import { TX_BADGE } from './constants';

export type BulletinGroup = {
  reference: string;
  type: TransactionType;
  date: Date;
  operator: string;
  contact?: string;
  fromLocation?: string;
  toLocation?: string;
  signature?: string;
  txIds: string[];
  items: { productName: string; productCode: string; quantity: number; variant?: string; serialNumber?: string }[];
};

// mode 'ops'  → RECEPCIÓN + BAJA/MERMA (DISPATCH con [BAJA])
// mode 'dispatch' → DESPACHO (DISPATCH sin [BAJA]) + TRASLADO
// mode 'requerimientos' → TRANSFER (movimientos internos de requerimientos)
export const BulletinsTab: React.FC<{ mode?: 'ops' | 'dispatch' | 'despacho' | 'requerimientos' }> = ({ mode }) => {
  const { transactions, products, contacts, locations, activeBrand } = useAppContext();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [bulletinData, setBulletinData] = useState<BulletinData | null>(null);

  // Aggregate transactions by reference → one bulletin per operation
  const bulletinGroups = useMemo(() => {
    const from = dateFrom ? new Date(dateFrom + 'T00:00:00') : null;
    const to   = dateTo   ? new Date(dateTo   + 'T23:59:59') : null;

    const active = transactions.filter(tx => {
      if (tx.status === 'CANCELLED' || !(tx.type in TX_BADGE)) return false;
      if (!mode) return true;
      const isWriteoff = tx.reference?.startsWith('[BAJA');
      if (mode === 'ops')            return tx.type === 'RECEPTION' || (tx.type === 'DISPATCH' && isWriteoff);
      if (mode === 'dispatch')       return tx.type === 'TRANSFER'  || (tx.type === 'DISPATCH' && !isWriteoff);
      if (mode === 'despacho')       return tx.type === 'DISPATCH' && !isWriteoff;
      if (mode === 'requerimientos') return tx.type === 'TRANSFER';
      return true;
    });

    const map = new Map<string, BulletinGroup>();

    for (const tx of active) {
      const d = new Date(tx.date);
      if (from && d < from) continue;
      if (to   && d > to)   continue;

      // Key: reference + calendar day — same reference on different days = different bulletins
      const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const key = (tx.reference?.trim() ? `${tx.reference.trim()}__${dayKey}` : tx.id);

      const product  = products.find(p => p.id === tx.productId);
      const contact  = contacts.find(c => c.id === tx.contactId);
      const fromLoc  = locations.find(l => l.id === tx.fromLocationId);
      const toLoc    = locations.find(l => l.id === tx.toLocationId);

      const variant = [product?.color, product?.size].filter(Boolean).join(' · ') || undefined;

      if (map.has(key)) {
        const g = map.get(key)!;
        g.txIds.push(tx.id);
        g.items.push({
          productName: product?.name ?? tx.productId,
          productCode: product?.code ?? '',
          quantity: tx.quantity,
          variant,
          serialNumber: tx.serialNumber,
        });
      } else {
        map.set(key, {
          reference: tx.reference,
          type: tx.type,
          date: d,
          operator: tx.user,
          contact: contact?.name,
          fromLocation: fromLoc?.name,
          toLocation: toLoc?.name,
          signature: tx.signature,
          txIds: [tx.id],
          items: [{ productName: product?.name ?? tx.productId, productCode: product?.code ?? '', quantity: tx.quantity, variant, serialNumber: tx.serialNumber }],
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [transactions, products, contacts, locations, dateFrom, dateTo, mode]);

  // Group bulletin groups by calendar day
  const dayGroups = useMemo(() => {
    const map = new Map<string, BulletinGroup[]>();
    for (const g of bulletinGroups) {
      const raw = g.date.toLocaleDateString('es-PE', { timeZone: 'America/Lima', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const key = raw.charAt(0).toUpperCase() + raw.slice(1);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(g);
    }
    return Array.from(map.entries());
  }, [bulletinGroups]);

  const [confirmBulletinData, setConfirmBulletinData] = useState<BulletinGroup | null>(null);

  const openBulletin = (g: BulletinGroup) => {
    if (g.type === 'RECEPTION' && mode === 'ops') {
      setConfirmBulletinData(g);
      return;
    }

    const isReq = mode === 'requerimientos';
    setBulletinData({
      type: g.type,
      reference: g.reference,
      date: g.date.toLocaleString('es-PE', { timeZone: 'America/Lima', dateStyle: 'long', timeStyle: 'short' }),
      rawDate: g.date.toISOString().slice(0, 10),
      operator: g.operator,
      brand: activeBrand,
      txIds: g.txIds,
      items: g.items,
      fromLocation: g.fromLocation,
      toLocation: g.toLocation,
      contact: g.contact,
      signature: g.signature,
      ...(isReq && { labelOverride: 'REQUERIMIENTO', colorOverride: '#7c3aed' }),
    });
  };

  const TYPE_COLOR: Record<TransactionType, string> = {
    RECEPTION: 'text-green-600 bg-green-500/10 border-green-500/30',
    DISPATCH:  'text-red-600 bg-red-500/10 border-red-500/30',
    TRANSFER:  mode === 'requerimientos' ? 'text-violet-600 bg-violet-500/10 border-violet-500/30' : 'text-blue-600 bg-blue-500/10 border-blue-500/30',
  };
  const TYPE_LABEL: Record<TransactionType, string> = {
    RECEPTION: 'RECEPCIÓN', DISPATCH: 'DESPACHO', TRANSFER: mode === 'requerimientos' ? 'REQUERIMIENTO' : 'TRASLADO',
  };

  return (
    <div className="flex flex-col gap-4">
      {bulletinData && <BulletinModal data={bulletinData} onClose={() => setBulletinData(null)} />}
      
      {confirmBulletinData && (
        <Confirmations 
          txIds={confirmBulletinData.txIds} 
          reference={confirmBulletinData.reference} 
          onClose={() => setConfirmBulletinData(null)} 
        />
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <Mail size={13} className="text-[var(--ink)] opacity-50 shrink-0" />
        <span className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-50">Filtrar por fecha</span>
        <div className="flex items-center gap-2 ml-auto">
          <span className="font-mono text-[9px] uppercase opacity-40">Desde</span>
          <input
            type="date" value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="border border-[var(--border)] bg-[var(--bg-card)] font-mono text-[10px] px-2 py-1 outline-none focus:border-[var(--ink)] cursor-pointer"
          />
          <span className="font-mono text-[9px] uppercase opacity-40">Hasta</span>
          <input
            type="date" value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="border border-[var(--border)] bg-[var(--bg-card)] font-mono text-[10px] px-2 py-1 outline-none focus:border-[var(--ink)] cursor-pointer"
          />
          {(dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="font-mono text-[9px] uppercase opacity-40 hover:opacity-100 flex items-center gap-1 transition-opacity"
            >
              <X size={10} /> Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Count */}
      <div className="font-mono text-[9px] uppercase tracking-widest opacity-40 px-1">
        {bulletinGroups.length} comprobante{bulletinGroups.length !== 1 ? 's' : ''}{(dateFrom || dateTo) ? ' (filtrado)' : ''}
      </div>

      {/* Day groups */}
      {dayGroups.length === 0 ? (
        <div className="border border-[var(--border)] bg-[var(--surface)] p-8 text-center font-mono text-[10px] opacity-40 uppercase tracking-widest">
          No hay comprobantes para el rango seleccionado
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {dayGroups.map(([dateLabel, groups]) => (
            <div key={dateLabel}>
              {/* Day header */}
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-[9px] font-black uppercase tracking-widest opacity-60">{dateLabel}</span>
                <div className="flex-1 h-px bg-[var(--border)] opacity-30" />
                <span className="font-mono text-[8px] opacity-30">{groups.length} comprobante{groups.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Bulletin rows */}
              <div className="flex flex-col gap-px">
                {groups.map((g, i) => {
                  const badge = TYPE_COLOR[g.type];
                  const label = TYPE_LABEL[g.type];
                  const totalQty = g.items.reduce((s, it) => s + it.quantity, 0);
                  return (
                    <button
                      type="button"
                      key={g.reference || i}
                      onClick={() => openBulletin(g)}
                      className="flex items-center gap-3 border border-[var(--border)]/20 bg-[var(--surface)] hover:bg-[var(--bg-card)] hover:border-[var(--border)]/50 px-4 py-3 text-left transition-all group"
                    >
                      {/* Type badge */}
                      <span className={cn('shrink-0 font-mono text-[8px] font-black px-2 py-0.5 border', badge)}>{label}</span>

                      {/* Reference */}
                      <span className="shrink-0 font-mono text-[10px] font-bold opacity-70 w-28 truncate">{g.reference || '—'}</span>

                      {/* Products summary */}
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-[10px] font-bold truncate">
                          {g.items.length === 1
                            ? g.items[0].productName
                            : `${g.items.length} productos`}
                        </div>
                        <div className="font-mono text-[9px] opacity-40 truncate">
                          {g.contact ? g.contact : g.items.length > 1 ? g.items.map(it => it.productName).join(', ') : ''}
                        </div>
                      </div>

                      {/* Total qty */}
                      <span className="shrink-0 font-mono text-[11px] font-black bg-[var(--ink)] text-[var(--ink-inv)] px-2 py-0.5">{totalQty}</span>

                      {/* Time */}
                      <span className="shrink-0 font-mono text-[9px] opacity-40 hidden sm:block w-16 text-right">
                        {g.date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                      </span>

                      <Mail size={11} className="shrink-0 opacity-30 group-hover:opacity-70 transition-opacity" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
