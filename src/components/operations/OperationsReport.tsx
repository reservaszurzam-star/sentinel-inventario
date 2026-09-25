import React, { useState, useMemo } from 'react';
import {
  BarChart2, ArrowDownLeft, ArrowUpRight, ArrowRightLeft, ShieldOff,
  FileSpreadsheet, FileText, ChevronUp, ChevronDown, Search, X, MapPin,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../../lib/utils';
import { useAppContext } from '../../store/AppContext';

export interface OperationsReportProps {
  mode?: 'ops' | 'dispatch' | 'despacho' | 'requerimientos';
}

export const OperationsReport: React.FC<OperationsReportProps> = ({ mode }) => {
  const { transactions, products, locations, activeBrand } = useAppContext();
  const [reportTab, setReportTab] = useState<'resumen' | 'movimientos' | 'bajas' | 'historial'>('resumen');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [sortCol, setSortCol] = useState<'date' | 'qty' | 'type'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [histPage, setHistPage] = useState(1);
  const HIST_PAGE_SIZE = 15;

  const active = useMemo(() => transactions.filter(tx => {
    if (tx.status === 'CANCELLED') return false;
    const isWriteoff = tx.reference?.startsWith('[BAJA');
    if (mode === 'ops')           return tx.type === 'RECEPTION' || (tx.type === 'DISPATCH' && isWriteoff);
    if (mode === 'dispatch')      return tx.type === 'TRANSFER'  || (tx.type === 'DISPATCH' && !isWriteoff);
    if (mode === 'despacho')      return tx.type === 'DISPATCH' && !isWriteoff;
    if (mode === 'requerimientos') return tx.type === 'TRANSFER';
    return true;
  }), [transactions, mode]);

  const filtered = useMemo(() => active.filter(tx => {
    if (dateFrom && new Date(tx.date) < new Date(dateFrom + 'T00:00:00')) return false;
    if (dateTo   && new Date(tx.date) > new Date(dateTo   + 'T23:59:59')) return false;
    return true;
  }), [active, dateFrom, dateTo]);

  const writeoffs = useMemo(() => filtered.filter(tx => tx.reference?.startsWith('[BAJA')), [filtered]);
  const regular   = useMemo(() => filtered.filter(tx => !tx.reference?.startsWith('[BAJA')), [filtered]);

  const byType = useMemo(() => {
    const map: Record<string, { count: number; units: number }> = {
      RECEPTION: { count: 0, units: 0 },
      DISPATCH:  { count: 0, units: 0 },
      TRANSFER:  { count: 0, units: 0 },
    };
    regular.forEach(tx => { if (map[tx.type]) { map[tx.type].count++; map[tx.type].units += tx.quantity; } });
    return map;
  }, [regular]);

  const byDestination = useMemo(() => {
    const map = new Map<string, { name: string; count: number; units: number }>();
    regular.forEach(tx => {
      if (!tx.toLocationId) return;
      const name = locations.find(l => l.id === tx.toLocationId)?.name ?? tx.toLocationId;
      if (!map.has(tx.toLocationId)) map.set(tx.toLocationId, { name, count: 0, units: 0 });
      const e = map.get(tx.toLocationId)!; e.count++; e.units += tx.quantity;
    });
    return [...map.values()].sort((a, b) => b.units - a.units);
  }, [regular, locations]);

  const byProduct = useMemo(() => {
    const map = new Map<string, { name: string; code: string; in: number; out: number; transfer: number; writeoff: number }>();
    filtered.forEach(tx => {
      const prod = products.find(p => p.id === tx.productId);
      const name = prod?.name ?? tx.productId;
      const code = prod?.code ?? '';
      if (!map.has(name)) map.set(name, { name, code, in: 0, out: 0, transfer: 0, writeoff: 0 });
      const e = map.get(name)!;
      const isWriteoff = tx.reference?.startsWith('[BAJA');
      if (tx.type === 'RECEPTION') e.in += tx.quantity;
      else if (tx.type === 'DISPATCH') { if (isWriteoff) e.writeoff += tx.quantity; else e.out += tx.quantity; }
      else e.transfer += tx.quantity;
    });
    return [...map.values()].sort((a, b) => (b.in + b.out + b.transfer + b.writeoff) - (a.in + a.out + a.transfer + a.writeoff)).slice(0, 25);
  }, [filtered, products]);

  const byWriteoffReason = useMemo(() => {
    const map = new Map<string, { count: number; units: number }>();
    writeoffs.forEach(tx => {
      const reason = tx.reference?.replace('[BAJA] ', '').split(' · ')[0] ?? 'Sin motivo';
      if (!map.has(reason)) map.set(reason, { count: 0, units: 0 });
      const e = map.get(reason)!; e.count++; e.units += tx.quantity;
    });
    return [...map.entries()].map(([reason, v]) => ({ reason, ...v })).sort((a, b) => b.units - a.units);
  }, [writeoffs]);

  const totalUnits  = regular.reduce((s, tx) => s + tx.quantity, 0);
  const totalOps    = regular.length;
  const writeoffUnits = writeoffs.reduce((s, tx) => s + tx.quantity, 0);

  // History with search + sort + pagination
  const histFiltered = useMemo(() => {
    let rows = [...filtered];
    if (searchQ.trim()) {
      const q = searchQ.trim().toLowerCase();
      rows = rows.filter(tx => {
        const prod = products.find(p => p.id === tx.productId);
        return (
          (prod?.name ?? '').toLowerCase().includes(q) ||
          (prod?.code ?? '').toLowerCase().includes(q) ||
          (tx.reference ?? '').toLowerCase().includes(q) ||
          (tx.user ?? '').toLowerCase().includes(q)
        );
      });
    }
    rows.sort((a, b) => {
      let va: number | string, vb: number | string;
      if (sortCol === 'date') { va = a.date; vb = b.date; }
      else if (sortCol === 'qty') { va = a.quantity; vb = b.quantity; }
      else { va = a.type; vb = b.type; }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [filtered, searchQ, sortCol, sortDir, products]);

  const histPages = Math.max(1, Math.ceil(histFiltered.length / HIST_PAGE_SIZE));
  const histRows  = histFiltered.slice((histPage - 1) * HIST_PAGE_SIZE, histPage * HIST_PAGE_SIZE);

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  // -- Exports --
  const exportExcel = () => {
    const rows = histFiltered.map(tx => {
      const prod = products.find(p => p.id === tx.productId);
      const isWO = tx.reference?.startsWith('[BAJA');
      return {
        Fecha: new Date(tx.date).toLocaleString('es-PE', { timeZone: 'America/Lima' }),
        Tipo: isWO ? 'BAJA/MERMA' : tx.type === 'RECEPTION' ? 'RECEPCIÓN' : tx.type === 'DISPATCH' ? 'DESPACHO' : 'TRASLADO',
        Código: prod?.code ?? '',
        Producto: prod?.name ?? tx.productId,
        Color: prod?.color ?? '',
        Talla: prod?.size ?? '',
        Cantidad: tx.quantity,
        Origen: locations.find(l => l.id === tx.fromLocationId)?.name ?? '',
        Destino: locations.find(l => l.id === tx.toLocationId)?.name ?? '',
        Referencia: tx.reference ?? '',
        Operador: tx.user ?? '',
      };
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 30 }, { wch: 12 }, { wch: 8 }, { wch: 9 }, { wch: 18 }, { wch: 18 }, { wch: 30 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Operaciones');
    XLSX.writeFile(wb, `operaciones_${activeBrand}_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const exportPDF = async () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const logoB64 = await fetch('/Zazu/inv/zazu-inv-light.png')
      .then(r => r.blob())
      .then(b => new Promise<string>(res => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(b); }))
      .catch(() => '');
    const dateLabel = dateFrom || dateTo
      ? `Del ${dateFrom || '-'} al ${dateTo || '-'}`
      : 'Todos los períodos';
    const rowsHTML = histFiltered.map((tx, i) => {
      const prod = products.find(p => p.id === tx.productId);
      const isWO = tx.reference?.startsWith('[BAJA');
      const typeLabel = isWO ? 'BAJA' : tx.type === 'RECEPTION' ? 'RECEPCION' : tx.type === 'DISPATCH' ? 'DESPACHO' : 'TRASLADO';
      const typeColor = isWO ? '#991b1b' : tx.type === 'RECEPTION' ? '#15803d' : tx.type === 'DISPATCH' ? '#b91c1c' : '#0369a1';
      return `<tr style="background:${i%2===0?'#f9f9f9':'#fff'}">
        <td>${new Date(tx.date).toLocaleString('es-PE', { timeZone:'America/Lima', dateStyle:'short', timeStyle:'short' })}</td>
        <td><span style="color:${typeColor};font-weight:700">${typeLabel}</span></td>
        <td>${prod?.code ?? ''}</td>
        <td>${prod?.name ?? tx.productId}${prod?.size ? ' ' + prod.size : ''}</td>
        <td style="text-align:right;font-weight:700">${tx.quantity}</td>
        <td>${locations.find(l=>l.id===tx.fromLocationId)?.name ?? '-'}</td>
        <td>${locations.find(l=>l.id===tx.toLocationId)?.name ?? '-'}</td>
        <td>${tx.reference ?? ''}</td>
        <td>${tx.user ?? ''}</td>
      </tr>`;
    }).join('');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Reporte Operaciones · ${activeBrand}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Inter,sans-serif;font-size:10px;color:#141414;padding:24px 32px;background:#fff}
      .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #141414;padding-bottom:12px;margin-bottom:16px}
      .logo{width:48px;height:48px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
      .company{margin-left:12px}
      .company h1{font-size:13px;font-weight:900;text-transform:uppercase}
      .company p{font-size:9px;opacity:.5;margin-top:2px}
      .meta{text-align:right;font-size:9px;opacity:.6}
      .kpi-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:16px}
      .kpi{border:1px solid #e5e5e5;padding:10px 12px;background:#fafafa}
      .kpi-label{font-size:8px;text-transform:uppercase;letter-spacing:.1em;opacity:.5;margin-bottom:4px}
      .kpi-val{font-size:18px;font-weight:900}
      .kpi-sub{font-size:8px;opacity:.4;margin-top:2px}
      .kpi.green{border-color:#bbf7d0;background:#f0fdf4}.kpi.green .kpi-val{color:#15803d}
      .kpi.red{border-color:#fecaca;background:#fef2f2}.kpi.red .kpi-val{color:#b91c1c}
      .kpi.dark{border-color:#141414;background:#141414}.kpi.dark .kpi-label,.kpi.dark .kpi-sub{color:#fff;opacity:.6}.kpi.dark .kpi-val{color:#fff}
      .section-title{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.15em;opacity:.4;margin:12px 0 6px}
      table{width:100%;border-collapse:collapse;font-size:9px}
      thead th{background:#141414;color:#fff;padding:5px 8px;text-align:left;font-size:8px;text-transform:uppercase;letter-spacing:.1em}
      tbody td{padding:4px 8px;border-bottom:1px solid #f0f0f0}
      tfoot td{background:#f5f4f1;font-weight:700;padding:5px 8px;border-top:2px solid #141414}
      @media print{body{padding:12px 16px}@page{size:A4 landscape;margin:1cm}}
    </style></head><body>
    <div class="header">
      <div style="display:flex;align-items:center">
        ${logoB64 ? `<div class="logo"><img src="${logoB64}" style="width:48px;height:48px;object-fit:contain" /></div>` : `<div class="logo" style="background:#6B21A8;color:#fff;font-weight:900;font-size:11px;letter-spacing:1px;flex-direction:column">zazu<span style="font-size:6px;letter-spacing:2px;opacity:.8">express</span></div>`}
        <div class="company">
          <h1>Reporte de Operaciones</h1>
          <p>Tecnología y Distribución Logística del Perú S.A.C. · RUC 20614699842</p>
          <p>Marca: ${activeBrand} · Período: ${dateLabel}</p>
        </div>
      </div>
      <div class="meta">Generado: ${new Date().toLocaleString('es-PE', { timeZone:'America/Lima', dateStyle:'short', timeStyle:'short' })}</div>
    </div>
    <div class="kpi-grid">
      <div class="kpi dark"><div class="kpi-label">Total Ops</div><div class="kpi-val">${totalOps}</div><div class="kpi-sub">operaciones</div></div>
      <div class="kpi dark"><div class="kpi-label">Unidades Mov.</div><div class="kpi-val">${totalUnits.toLocaleString('es-PE')}</div><div class="kpi-sub">unidades</div></div>
      <div class="kpi green"><div class="kpi-label">Recepciones</div><div class="kpi-val">${byType.RECEPTION.units.toLocaleString('es-PE')}</div><div class="kpi-sub">${byType.RECEPTION.count} ops</div></div>
      <div class="kpi red"><div class="kpi-label">Despachos</div><div class="kpi-val">${byType.DISPATCH.units.toLocaleString('es-PE')}</div><div class="kpi-sub">${byType.DISPATCH.count} ops</div></div>
      <div class="kpi red"><div class="kpi-label">Bajas / Merma</div><div class="kpi-val">${writeoffUnits.toLocaleString('es-PE')}</div><div class="kpi-sub">${writeoffs.length} ops</div></div>
    </div>
    <div class="section-title">Historial de operaciones (${histFiltered.length} registros)</div>
    <table><thead><tr>
      <th>Fecha</th><th>Tipo</th><th>Código</th><th>Producto</th><th style="text-align:right">Cant.</th>
      <th>Origen</th><th>Destino</th><th>Referencia</th><th>Operador</th>
    </tr></thead><tbody>${rowsHTML}</tbody>
    <tfoot><tr><td colspan="4">TOTAL</td><td style="text-align:right">${histFiltered.reduce((s,tx)=>s+tx.quantity,0).toLocaleString('es-PE')}</td><td colspan="4"></td></tr></tfoot>
    </table>
    <script>window.onload=()=>window.print()</script></body></html>`);
    win.document.close();
  };

  const TYPE_CFG = {
    RECEPTION: { label: 'Recepciones', icon: ArrowDownLeft, color: 'text-green-700', bg: 'bg-green-500/10 border-green-500/50', bar: 'bg-green-500' },
    DISPATCH:  { label: 'Despachos',   icon: ArrowUpRight,  color: 'text-red-700',   bg: 'bg-red-500/10 border-red-500/50',     bar: 'bg-red-500'   },
    TRANSFER:  { label: 'Traslados',   icon: ArrowRightLeft,color: 'text-blue-700',  bg: 'bg-blue-500/10 border-blue-500/50',   bar: 'bg-blue-400'  },
  };

  const SortIcon = ({ col }: { col: typeof sortCol }) => sortCol !== col ? null : sortDir === 'asc' ? <ChevronUp size={9} /> : <ChevronDown size={9} />;

  return (
    <div className="flex flex-col gap-5">

      {/* -- Header -- */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 size={14} className="opacity-50" />
          <h2 className="font-mono text-[10px] font-bold tracking-widest uppercase opacity-70">
            {mode === 'ops' ? 'REPORTE · RECEPCIONES & BAJAS' : mode === 'dispatch' ? 'REPORTE · DESPACHOS & TRASLADOS' : mode === 'requerimientos' ? 'REPORTE · REQUERIMIENTOS' : 'REPORTE DE OPERACIONES'}
          </h2>
          <span className="font-mono text-[8px] border border-[var(--border)]/20 px-1.5 py-0.5 bg-[var(--surface)] uppercase tracking-wider">{activeBrand}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[8px] uppercase tracking-widest opacity-40 hidden sm:inline">Período:</span>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setHistPage(1); }}
            className="border border-[var(--border)]/30 px-2 py-1.5 font-mono text-[9px] bg-[var(--surface)] outline-none focus:border-[var(--border)] w-full sm:w-auto" />
          <span className="font-mono text-[9px] opacity-30">→</span>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setHistPage(1); }}
            className="border border-[var(--border)]/30 px-2 py-1.5 font-mono text-[9px] bg-[var(--surface)] outline-none focus:border-[var(--border)] w-full sm:w-auto" />
          {(dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="font-mono text-[8px] border border-[var(--border)]/30 px-2 py-1.5 hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-colors whitespace-nowrap"
            >
              ✕ LIMPIAR
            </button>
          )}
        </div>
      </div>

      {/* -- KPI Cards -- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        {/* Total ops */}
        <div className="border border-[var(--border)] bg-[var(--ink)] text-[var(--ink-inv)] p-3 shadow-[3px_3px_0_var(--border)] col-span-2 sm:col-span-1">
          <div className="font-mono text-[8px] opacity-50 uppercase tracking-widest mb-1">Total Ops</div>
          <div className="font-mono font-black text-2xl">{totalOps}</div>
          <div className="font-mono text-[8px] opacity-40 mt-0.5">operaciones</div>
        </div>
        {/* Unidades */}
        <div className="border border-[var(--border)] bg-[var(--bg-card-alt)] p-3 shadow-[3px_3px_0_var(--border)]">
          <div className="font-mono text-[8px] opacity-40 uppercase tracking-widest mb-1">Unidades</div>
          <div className="font-mono font-black text-2xl text-[var(--ink)]">{totalUnits.toLocaleString('es-PE')}</div>
          <div className="font-mono text-[8px] opacity-40 mt-0.5">movidas</div>
        </div>
        {/* Recepciones — solo en ops o sin modo */}
        {(mode === 'ops' || !mode) && (
          <div className="border border-green-400 bg-green-500/10 p-3">
            <div className="flex items-center gap-1 mb-1"><ArrowDownLeft size={10} className="text-green-700" /><span className="font-mono text-[8px] font-bold text-green-700 uppercase tracking-wide">Recepciones</span></div>
            <div className="font-mono font-black text-xl text-green-600">{byType.RECEPTION.units.toLocaleString('es-PE')}</div>
            <div className="font-mono text-[8px] text-green-700 opacity-60 mt-0.5">{byType.RECEPTION.count} operaciones</div>
          </div>
        )}
        {/* Despachos — solo en dispatch o sin modo */}
        {(mode === 'dispatch' || mode === 'despacho' || !mode) && (
          <div className="border border-red-500/50 bg-red-500/10 p-3">
            <div className="flex items-center gap-1 mb-1"><ArrowUpRight size={10} className="text-red-700" /><span className="font-mono text-[8px] font-bold text-red-700 uppercase tracking-wide">Despachos</span></div>
            <div className="font-mono font-black text-xl text-red-600">{byType.DISPATCH.units.toLocaleString('es-PE')}</div>
            <div className="font-mono text-[8px] text-red-700 opacity-60 mt-0.5">{byType.DISPATCH.count} operaciones</div>
          </div>
        )}
        {/* Traslados — en dispatch, requerimientos o sin modo */}
        {(mode === 'dispatch' || mode === 'requerimientos' || !mode) && (
          <div className="border border-blue-400/50 bg-blue-500/10 p-3">
            <div className="flex items-center gap-1 mb-1"><ArrowRightLeft size={10} className="text-blue-700" /><span className="font-mono text-[8px] font-bold text-blue-700 uppercase tracking-wide">{mode === 'requerimientos' ? 'Requerimientos' : 'Traslados'}</span></div>
            <div className="font-mono font-black text-xl text-blue-600">{byType.TRANSFER.units.toLocaleString('es-PE')}</div>
            <div className="font-mono text-[8px] text-blue-700 opacity-60 mt-0.5">{byType.TRANSFER.count} operaciones</div>
          </div>
        )}
        {/* Bajas — solo en ops o sin modo */}
        {(mode === 'ops' || !mode) && (
          <div className="border border-orange-400 bg-orange-500/10 p-3">
            <div className="flex items-center gap-1 mb-1"><ShieldOff size={10} className="text-orange-700" /><span className="font-mono text-[8px] font-bold text-orange-700 uppercase tracking-wide">Bajas/Merma</span></div>
            <div className="font-mono font-black text-xl text-orange-600">{writeoffUnits.toLocaleString('es-PE')}</div>
            <div className="font-mono text-[8px] text-orange-700 opacity-60 mt-0.5">{writeoffs.length} operaciones</div>
          </div>
        )}
      </div>

      {/* -- Distribution bar -- */}
      {totalUnits > 0 && (
        <div className="border border-[var(--border)]/20 bg-[var(--bg-card)] px-4 py-3">
          <div className="font-mono text-[8px] opacity-40 uppercase tracking-widest mb-2">Distribución por tipo (unidades)</div>
          <div className="flex h-4 overflow-hidden border border-[var(--border)]/10">
            {(['RECEPTION', 'DISPATCH', 'TRANSFER'] as const).map(t => {
              const pct = (byType[t].units / totalUnits) * 100;
              return pct > 0 ? (
                <div key={t} className={`${TYPE_CFG[t].bar} h-full transition-all`} style={{ width: `${pct}%` }}
                  title={`${TYPE_CFG[t].label}: ${byType[t].units} uds (${pct.toFixed(1)}%)`} />
              ) : null;
            })}
            {writeoffUnits > 0 && (
              <div className="bg-orange-500 h-full" style={{ width: `${(writeoffUnits / (totalUnits + writeoffUnits)) * 100}%` }}
                title={`Bajas: ${writeoffUnits} uds`} />
            )}
          </div>
          <div className="flex gap-4 mt-1.5 flex-wrap">
            {(['RECEPTION', 'DISPATCH', 'TRANSFER'] as const).map(t => {
              const pct = totalUnits > 0 ? ((byType[t].units / totalUnits) * 100).toFixed(1) : '0.0';
              const dotColors = { RECEPTION: 'bg-green-500', DISPATCH: 'bg-red-500', TRANSFER: 'bg-blue-400' };
              return (
                <div key={t} className="flex items-center gap-1">
                  <span className={`w-2 h-2 shrink-0 ${dotColors[t]}`} />
                  <span className="font-mono text-[8px] opacity-60 uppercase">{TYPE_CFG[t].label}</span>
                  <span className="font-mono text-[8px] font-bold">{pct}%</span>
                </div>
              );
            })}
            {writeoffUnits > 0 && (
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-orange-500 shrink-0" />
                <span className="font-mono text-[8px] opacity-60 uppercase">Bajas</span>
                <span className="font-mono text-[8px] font-bold">{((writeoffUnits / (totalUnits + writeoffUnits)) * 100).toFixed(1)}%</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* -- Tab bar + export buttons -- */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--border)]/20">
        <div className="flex overflow-x-auto scrollbar-none">
          {([
            { id: 'resumen',     label: 'Resumen',   show: true },
            { id: 'movimientos', label: 'Productos',  show: true },
            { id: 'bajas',       label: `Bajas${writeoffs.length > 0 ? ` (${writeoffs.length})` : ''}`, show: mode !== 'dispatch' },
            { id: 'historial',   label: 'Historial',  show: true },
          ] as { id: typeof reportTab; label: string; show: boolean }[]).filter(t => t.show).map(tab => (
            <button key={tab.id} onClick={() => setReportTab(tab.id)}
              className={cn('px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap',
                reportTab === tab.id ? 'border-[var(--border)] text-[var(--ink)]' : 'border-transparent opacity-40 hover:opacity-70'
              )}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 pb-1 self-end sm:self-auto">
          <button onClick={exportExcel} title="Exportar Excel"
            className="flex items-center gap-1 border border-[var(--border)]/30 px-2.5 py-1.5 hover:bg-green-700 hover:text-white hover:border-green-700 transition-all font-mono text-[8px] font-bold uppercase">
            <FileSpreadsheet size={11} /> XLS
          </button>
          <button onClick={exportPDF} title="Exportar PDF"
            className="flex items-center gap-1 border border-[var(--border)]/30 px-2.5 py-1.5 hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-all font-mono text-[8px] font-bold uppercase">
            <FileText size={11} /> PDF
          </button>
        </div>
      </div>

      {/* -- RESUMEN -- */}
      {reportTab === 'resumen' && (
        <div className="flex flex-col gap-4">
          {/* Por tipo */}
          <div className="border border-[var(--border)] shadow-[3px_3px_0_var(--border)] overflow-hidden">
            <div className="bg-[var(--ink)] text-[var(--ink-inv)] px-4 py-2 font-mono text-[8px] font-bold uppercase tracking-widest">Operaciones por tipo</div>
            <div className="grid grid-cols-4 px-4 py-1.5 font-mono text-[8px] opacity-40 uppercase tracking-widest border-b border-[var(--border)]/10">
              <div>Tipo</div><div className="text-right">Ops.</div><div className="text-right">Unidades</div><div className="text-right">% Total</div>
            </div>
            {(['RECEPTION', 'DISPATCH', 'TRANSFER'] as const).map(t => {
              const cfg = TYPE_CFG[t]; const Icon = cfg.icon;
              const pct = totalUnits > 0 ? ((byType[t].units / totalUnits) * 100).toFixed(1) : '0.0';
              return (
                <div key={t} className="grid grid-cols-4 px-4 py-3 border-b border-[var(--border)]/10 last:border-0 hover:bg-[var(--surface)] items-center">
                  <div className="flex items-center gap-2"><Icon size={12} className={cfg.color} /><span className={`font-mono text-[10px] font-bold uppercase ${cfg.color}`}>{cfg.label}</span></div>
                  <div className="font-mono text-[11px] font-bold text-right">{byType[t].count}</div>
                  <div className="font-mono text-[12px] font-black text-right">{byType[t].units.toLocaleString('es-PE')}</div>
                  <div className="text-right"><span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 border ${cfg.bg} ${cfg.color}`}>{pct}%</span></div>
                </div>
              );
            })}
            {writeoffs.length > 0 && (
              <div className="grid grid-cols-4 px-4 py-3 border-b border-[var(--border)]/10 hover:bg-[var(--surface)] items-center">
                <div className="flex items-center gap-2"><ShieldOff size={12} className="text-orange-700" /><span className="font-mono text-[10px] font-bold uppercase text-orange-700">Bajas/Merma</span></div>
                <div className="font-mono text-[11px] font-bold text-right">{writeoffs.length}</div>
                <div className="font-mono text-[12px] font-black text-right">{writeoffUnits.toLocaleString('es-PE')}</div>
                <div className="text-right"><span className="font-mono text-[10px] font-bold px-1.5 py-0.5 border bg-orange-500/10 border-orange-400 text-orange-700">{totalUnits > 0 ? ((writeoffUnits / (totalUnits + writeoffUnits)) * 100).toFixed(1) : '0.0'}%</span></div>
              </div>
            )}
            <div className="grid grid-cols-4 px-4 py-2.5 bg-[var(--bg-modal)] border-t border-[var(--border)]/20 font-mono text-[10px] font-black uppercase">
              <div className="opacity-40 text-[8px]">TOTAL</div>
              <div className="text-right">{totalOps}</div>
              <div className="text-right">{(totalUnits + writeoffUnits).toLocaleString('es-PE')}</div>
              <div className="text-right opacity-40">100%</div>
            </div>
          </div>

          {/* Por destino */}
          {byDestination.length > 0 && (
            <div className="border border-[var(--border)] shadow-[3px_3px_0_var(--border)] overflow-hidden">
              <div className="bg-[var(--ink)] text-[var(--ink-inv)] px-4 py-2 font-mono text-[8px] font-bold uppercase tracking-widest">Entradas por almacén destino</div>
              {byDestination.map((row, i) => {
                const barPct = byDestination[0].units > 0 ? (row.units / byDestination[0].units) * 100 : 0;
                return (
                  <div key={i} className="px-4 py-3 border-b border-[var(--border)]/10 last:border-0 hover:bg-[var(--surface)]">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <MapPin size={10} className="opacity-40 shrink-0" />
                        <span className="font-mono text-[10px] font-bold truncate uppercase">{row.name}</span>
                        <span className="font-mono text-[8px] opacity-40">{row.count} ops</span>
                      </div>
                      <span className="font-mono text-[12px] font-black text-green-700 shrink-0 ml-4">{row.units.toLocaleString('es-PE')} uds</span>
                    </div>
                    <div className="h-1.5 bg-[var(--ink)]/5 overflow-hidden">
                      <div className="h-full bg-green-500/60 transition-all" style={{ width: `${barPct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* -- POR PRODUCTO -- */}
      {reportTab === 'movimientos' && (
        <div className="border border-[var(--border)] shadow-[3px_3px_0_var(--border)] overflow-hidden">
          {/* Header · hidden on mobile, shown on sm+ */}
          <div className="hidden sm:grid sm:grid-cols-[1fr_56px_56px_56px_56px] bg-[var(--ink)] text-[var(--ink-inv)] px-4 py-2 font-mono text-[8px] font-bold uppercase tracking-widest gap-2">
            <div>Producto</div>
            <div className="text-right text-green-300">Entr.</div>
            <div className="text-right text-red-300">Sal.</div>
            <div className="text-right text-blue-300">Trasl.</div>
            <div className="text-right text-orange-300">Baja</div>
          </div>
          <div className="sm:hidden bg-[var(--ink)] text-[var(--ink-inv)] px-4 py-2 font-mono text-[8px] font-bold uppercase tracking-widest">
            Movimientos por producto
          </div>
          {byProduct.length === 0 ? (
            <div className="px-4 py-10 text-center font-mono text-[10px] opacity-40 uppercase">Sin operaciones en el período</div>
          ) : byProduct.map((row, i) => {
            const total = row.in + row.out + row.transfer + row.writeoff;
            const maxTotal = byProduct[0] ? byProduct[0].in + byProduct[0].out + byProduct[0].transfer + byProduct[0].writeoff : 1;
            const barPct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
            return (
              <div key={i} className={cn('px-4 py-2.5 border-b border-[var(--border)]/10 last:border-0 hover:bg-[var(--surface)]', i % 2 !== 0 && 'bg-[var(--surface-alt)]')}>
                {/* Desktop row */}
                <div className="hidden sm:grid sm:grid-cols-[1fr_56px_56px_56px_56px] items-center gap-2 mb-1">
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] font-bold truncate uppercase">{row.name}</div>
                    {row.code && <div className="font-mono text-[8px] opacity-40">{row.code}</div>}
                  </div>
                  <div className="font-mono text-[10px] font-bold text-right text-green-700">{row.in > 0 ? row.in.toLocaleString('es-PE') : <span className="opacity-20">-</span>}</div>
                  <div className="font-mono text-[10px] font-bold text-right text-red-600">{row.out > 0 ? row.out.toLocaleString('es-PE') : <span className="opacity-20">-</span>}</div>
                  <div className="font-mono text-[10px] font-bold text-right text-blue-600">{row.transfer > 0 ? row.transfer.toLocaleString('es-PE') : <span className="opacity-20">-</span>}</div>
                  <div className="font-mono text-[10px] font-bold text-right text-orange-600">{row.writeoff > 0 ? row.writeoff.toLocaleString('es-PE') : <span className="opacity-20">-</span>}</div>
                </div>
                {/* Mobile card row */}
                <div className="sm:hidden">
                  <div className="font-mono text-[10px] font-bold truncate uppercase mb-1">{row.name}</div>
                  <div className="grid grid-cols-4 gap-1 mb-1">
                    {[
                      { label: 'Entr', val: row.in, cls: 'text-green-700' },
                      { label: 'Sal',  val: row.out, cls: 'text-red-600' },
                      { label: 'Tras', val: row.transfer, cls: 'text-blue-600' },
                      { label: 'Baja', val: row.writeoff, cls: 'text-orange-600' },
                    ].map(({ label, val, cls }) => (
                      <div key={label} className="flex flex-col items-center border border-[var(--border)]/10 py-1 px-0.5 bg-[var(--surface)]">
                        <span className="font-mono text-[7px] opacity-40 uppercase">{label}</span>
                        <span className={cn('font-mono text-[11px] font-black', val > 0 ? cls : 'opacity-20')}>{val > 0 ? val : '-'}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="h-1 bg-[var(--ink)]/5 overflow-hidden">
                  <div className="h-full bg-[var(--ink)]/20 transition-all" style={{ width: `${barPct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* -- BAJAS / MERMA -- */}
      {reportTab === 'bajas' && (
        <div className="flex flex-col gap-4">
          {writeoffs.length === 0 ? (
            <div className="border border-[var(--border)]/20 px-4 py-12 text-center font-mono text-[10px] opacity-40 uppercase">
              No hay bajas registradas en este período
            </div>
          ) : (
            <>
              {/* Por motivo */}
              <div className="border border-orange-400/50 shadow-[3px_3px_0_#c2410c30] overflow-hidden">
                <div className="bg-orange-800 text-white px-4 py-2 font-mono text-[8px] font-bold uppercase tracking-widest">Bajas por motivo</div>
                {byWriteoffReason.map((row, i) => {
                  const barPct = byWriteoffReason[0].units > 0 ? (row.units / byWriteoffReason[0].units) * 100 : 0;
                  return (
                    <div key={i} className="px-4 py-3 border-b border-orange-800/10 last:border-0 hover:bg-orange-500/10">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <ShieldOff size={10} className="text-orange-600 shrink-0 opacity-60" />
                          <span className="font-mono text-[10px] font-bold truncate">{row.reason}</span>
                          <span className="font-mono text-[8px] opacity-40 shrink-0">{row.count} ops</span>
                        </div>
                        <span className="font-mono text-[12px] font-black text-orange-700 shrink-0 ml-4">{row.units.toLocaleString('es-PE')} uds</span>
                      </div>
                      <div className="h-1.5 bg-orange-800/5 overflow-hidden">
                        <div className="h-full bg-orange-500/50 transition-all" style={{ width: `${barPct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Detalle de bajas */}
              <div className="border border-[var(--border)]/20 shadow-[2px_2px_0_var(--border-soft)] overflow-hidden">
                <div className="bg-[var(--ink)] text-[var(--ink-inv)] px-4 py-2 font-mono text-[8px] font-bold uppercase tracking-widest">Detalle de bajas ({writeoffs.length})</div>
                <div className="grid grid-cols-[auto_1fr_auto_auto] px-4 py-1.5 font-mono text-[8px] opacity-40 uppercase tracking-widest border-b border-[var(--border)]/10 gap-3">
                  <div>Fecha</div><div>Producto / Motivo</div><div className="text-right">Almacén</div><div className="text-right w-12">Cant.</div>
                </div>
                {writeoffs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((tx, i) => {
                  const prod = products.find(p => p.id === tx.productId);
                  const reason = tx.reference?.replace('[BAJA] ', '').split(' · ')[0] ?? '';
                  const notes  = tx.reference?.includes(' · ') ? tx.reference.split(' · ').slice(1).join(' · ') : '';
                  const fromLoc = locations.find(l => l.id === tx.fromLocationId);
                  return (
                    <div key={tx.id} className={cn('grid grid-cols-[auto_1fr_auto_auto] px-4 py-2.5 border-b border-[var(--border)]/8 last:border-0 hover:bg-orange-500/10 items-start gap-3', i % 2 !== 0 && 'bg-[var(--surface-alt)]')}>
                      <div className="font-mono text-[9px] opacity-50 shrink-0 whitespace-nowrap">
                        {new Date(tx.date).toLocaleDateString('es-PE', { timeZone:'America/Lima', day:'2-digit', month:'2-digit', year:'2-digit' })}
                      </div>
                      <div className="min-w-0">
                        <div className="font-mono text-[10px] font-bold truncate uppercase">{prod?.name ?? '-'}{prod?.size ? ` · ${prod.size}` : ''}</div>
                        <div className="font-mono text-[8px] text-orange-700 font-bold">{reason}</div>
                        {notes && <div className="font-mono text-[8px] opacity-40">{notes}</div>}
                        <div className="font-mono text-[8px] opacity-30">{tx.user}</div>
                      </div>
                      <div className="font-mono text-[9px] opacity-50 text-right shrink-0 whitespace-nowrap">{fromLoc?.name ?? '-'}</div>
                      <div className="font-mono text-[12px] font-black text-orange-700 text-right w-12 shrink-0">{tx.quantity}</div>
                    </div>
                  );
                })}
                <div className="flex justify-between px-4 py-2.5 bg-orange-500/10 border-t border-orange-800/20 font-mono text-[10px] font-black">
                  <span className="opacity-50 text-[8px]">TOTAL DADO DE BAJA</span>
                  <span className="text-orange-700">{writeoffUnits.toLocaleString('es-PE')} uds</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* -- HISTORIAL -- */}
      {reportTab === 'historial' && (
        <div className="flex flex-col gap-3">
          {/* Search */}
          <div className="flex items-center gap-2 border border-[var(--border)]/20 bg-[var(--surface)] px-3 py-1.5">
            <Search size={11} className="opacity-30 shrink-0" />
            <input
              type="text"
              value={searchQ}
              onChange={e => { setSearchQ(e.target.value); setHistPage(1); }}
              placeholder="Buscar producto, código, referencia, operador..."
              className="flex-1 bg-transparent outline-none font-mono text-[10px] placeholder:opacity-30"
            />
            {searchQ && <button onClick={() => setSearchQ('')} className="text-[var(--ink)]/40 hover:text-[var(--ink)]"><X size={11} /></button>}
          </div>

          <div className="border border-[var(--border)] shadow-[3px_3px_0_var(--border)] overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[60px_56px_1fr_auto] sm:grid-cols-[auto_80px_auto_1fr_auto_auto_auto] bg-[var(--ink)] text-[var(--ink-inv)] px-3 py-2 font-mono text-[8px] font-bold uppercase tracking-widest gap-2 items-center">
              <button onClick={() => toggleSort('date')} className="flex items-center gap-0.5 hover:opacity-70 transition-opacity whitespace-nowrap">
                Fecha <SortIcon col="date" />
              </button>
              <button onClick={() => toggleSort('type')} className="flex items-center gap-0.5 hover:opacity-70 transition-opacity">
                Tipo <SortIcon col="type" />
              </button>
              <div className="hidden sm:block">Código</div>
              <div>Producto</div>
              <div className="hidden md:block">Almacén</div>
              <button onClick={() => toggleSort('qty')} className="flex items-center gap-0.5 hover:opacity-70 transition-opacity justify-end">
                <SortIcon col="qty" /> Cant.
              </button>
              <div className="hidden md:block">Operador</div>
            </div>

            {histRows.length === 0 ? (
              <div className="px-4 py-10 text-center font-mono text-[10px] opacity-40 uppercase">Sin resultados</div>
            ) : histRows.map((tx, i) => {
              const prod = products.find(p => p.id === tx.productId);
              const isWO = tx.reference?.startsWith('[BAJA');
              const typeLabel = isWO ? 'BAJA' : tx.type === 'RECEPTION' ? 'RX' : tx.type === 'DISPATCH' ? 'TX' : 'MV';
              const typeColor = isWO ? 'text-orange-700 bg-orange-500/10 border-orange-400' : tx.type === 'RECEPTION' ? 'text-green-700 bg-green-500/10 border-green-400' : tx.type === 'DISPATCH' ? 'text-red-700 bg-red-500/10 border-red-400' : 'text-blue-700 bg-blue-500/10 border-blue-400';
              const locName = tx.type === 'RECEPTION'
                ? locations.find(l => l.id === tx.toLocationId)?.name
                : locations.find(l => l.id === tx.fromLocationId)?.name;
              return (
                <div key={tx.id} className={cn(
                  'grid grid-cols-[60px_56px_1fr_auto] sm:grid-cols-[auto_80px_auto_1fr_auto_auto_auto] px-3 py-2 border-b border-[var(--border)]/8 last:border-0 hover:bg-[var(--surface)] items-center gap-2',
                  i % 2 !== 0 ? 'bg-[var(--surface-alt)]' : '',
                  isWO && 'bg-orange-500/10'
                )}>
                  <div className="font-mono text-[9px] opacity-50 whitespace-nowrap">
                    {new Date(tx.date).toLocaleDateString('es-PE', { timeZone:'America/Lima', day:'2-digit', month:'2-digit', year:'2-digit' })}
                  </div>
                  <div><span className={cn('font-mono text-[8px] font-bold border px-1 py-0.5 uppercase', typeColor)}>{typeLabel}</span></div>
                  <div className="hidden sm:block font-mono text-[9px] opacity-50">{prod?.code ?? '-'}</div>
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] font-bold truncate uppercase">{prod?.name ?? tx.productId}</div>
                    {(prod?.color || prod?.size) && <div className="font-mono text-[8px] opacity-40">{[prod?.color, prod?.size].filter(Boolean).join(' · ')}</div>}
                    {isWO && tx.reference && <div className="font-mono text-[8px] text-orange-700">{tx.reference.replace('[BAJA] ', '').split(' · ')[0]}</div>}
                  </div>
                  <div className="hidden md:block font-mono text-[9px] opacity-40 text-right whitespace-nowrap">{locName ?? '-'}</div>
                  <div className={cn('font-mono text-[11px] font-black text-right', tx.type === 'RECEPTION' ? 'text-green-700' : isWO ? 'text-orange-700' : 'text-red-700')}>{tx.quantity}</div>
                  <div className="hidden md:block font-mono text-[8px] opacity-30 text-right truncate max-w-[80px]">{tx.user}</div>
                </div>
              );
            })}

            {/* Footer totals */}
            <div className="flex justify-between items-center px-3 py-2 bg-[var(--bg-modal)] border-t border-[var(--border)]/20 font-mono text-[9px]">
              <span className="opacity-40 uppercase tracking-widest text-[8px]">{histFiltered.length} registros · {histFiltered.reduce((s,tx)=>s+tx.quantity,0).toLocaleString('es-PE')} uds</span>
              {histPages > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => setHistPage(p => Math.max(1, p-1))} disabled={histPage === 1}
                    className="border border-[var(--border)]/30 px-2 py-0.5 disabled:opacity-30 hover:bg-[var(--surface)] font-bold">‹</button>
                  <span className="px-2 opacity-60">{histPage} / {histPages}</span>
                  <button onClick={() => setHistPage(p => Math.min(histPages, p+1))} disabled={histPage === histPages}
                    className="border border-[var(--border)]/30 px-2 py-0.5 disabled:opacity-30 hover:bg-[var(--surface)] font-bold">›</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
