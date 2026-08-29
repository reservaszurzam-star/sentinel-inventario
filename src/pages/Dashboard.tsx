import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../store/AppContext';
import { useTheme } from '../store/ThemeContext';
import {
  Package, ArrowDownLeft, ArrowUpRight, AlertTriangle, TrendingUp,
  FileText, FileSpreadsheet, Printer, Trash2, DollarSign,
  Activity, ChevronRight, Clock, BarChart2, ArrowRight
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { todayLima } from '../lib/utils';
import { es } from 'date-fns/locale';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LineChart, Line, ReferenceLine, Cell
} from 'recharts';
import * as XLSX from 'xlsx';
import { TutorialModal, DASHBOARD_TUTORIAL_STEPS } from '../components/TutorialModal';

type TabKey = 'resumen' | 'producto' | 'talla';

const TAB_LABELS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'resumen',  label: 'Resumen',      icon: <Activity size={14} /> },
  { key: 'producto', label: 'Por Producto',  icon: <Package size={14} /> },
  { key: 'talla',    label: 'Por Talla',     icon: <BarChart2 size={14} /> },
];

const TYPE_META: Record<string, { label: string; bg: string; text: string }> = {
  RECEPTION: { label: 'REC',  bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  DISPATCH:  { label: 'DSP',  bg: 'bg-red-500/20',     text: 'text-red-400'     },
  TRANSFER:  { label: 'TRF',  bg: 'bg-blue-500/20',    text: 'text-blue-400'    },
  BAJA:      { label: 'BAJA', bg: 'bg-orange-500/20',  text: 'text-orange-400'  },
};

export const Dashboard: React.FC = () => {
  const { products, transactions, stockLevels } = useAppContext();
  const { theme } = useTheme();
  const [showTutorial, setShowTutorial] = useState(false);
  const navigate = useNavigate();

  const isDark = theme === 'dark';
  const gridColor   = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
  const axisColor   = isDark ? 'rgba(255,255,255,0.3)'  : 'rgba(0,0,0,0.4)';
  const tooltipBg   = isDark ? '#1e1e1e' : '#ffffff';
  const tooltipBdr  = isDark ? '#333'    : '#e5e7eb';
  const tooltipStyle = {
    background: tooltipBg,
    border: `1px solid ${tooltipBdr}`,
    borderRadius: '8px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
    fontSize: '12px',
    fontFamily: 'JetBrains Mono, monospace',
  };

  const [days, setDays]       = useState<7 | 14 | 30>(7);
  const [mainTab, setMainTab] = useState<TabKey>('resumen');

  // ── KPI Calculations ──────────────────────────────────────────────────────
  const totalItemsInStock = stockLevels.reduce((acc, curr) => acc + curr.quantity, 0);
  const totalInventoryValue = stockLevels.reduce((acc, curr) => {
    const p = products.find(prod => prod.id === curr.productId);
    return acc + (p?.costPrice || 0) * curr.quantity;
  }, 0);

  const todayStr   = todayLima();
  const todayStart = new Date(todayStr + 'T00:00:00-05:00');
  const todayTxs   = transactions.filter(t => new Date(t.date) >= todayStart);

  const todaysReceptions = todayTxs.filter(t => t.type === 'RECEPTION').reduce((acc, curr) => acc + curr.quantity, 0);
  const todaysDispatches = todayTxs.filter(t => t.type === 'DISPATCH' && !t.reference?.startsWith('[BAJA]')).reduce((acc, curr) => acc + curr.quantity, 0);
  const todaysWriteoffs  = todayTxs.filter(t => t.reference?.startsWith('[BAJA]')).reduce((acc, curr) => acc + curr.quantity, 0);

  // ── Chart Data ────────────────────────────────────────────────────────────
  const chartData = Array.from({ length: days }).map((_, i) => {
    const d        = subDays(new Date(), days - 1 - i);
    const dayStart = startOfDay(d);
    const dayEnd   = endOfDay(d);
    const dayTxs   = transactions.filter(t => {
      const txDate = new Date(t.date);
      return txDate >= dayStart && txDate <= dayEnd;
    });
    return {
      date:        format(d, days <= 14 ? 'dd/MM' : 'dd/MM'),
      recepciones: dayTxs.filter(t => t.type === 'RECEPTION').reduce((acc, curr) => acc + curr.quantity, 0),
      despachos:   dayTxs.filter(t => t.type === 'DISPATCH' && !t.reference?.startsWith('[BAJA]')).reduce((acc, curr) => acc + curr.quantity, 0),
      mermas:      dayTxs.filter(t => t.reference?.startsWith('[BAJA]')).reduce((acc, curr) => acc + curr.quantity, 0),
    };
  });

  const rangeStart = startOfDay(subDays(new Date(), days - 1));

  // ── Category Rotation ─────────────────────────────────────────────────────
  const categoryRotations: Record<string, number> = {};
  transactions
    .filter(t => t.type === 'DISPATCH' && !t.reference?.startsWith('[BAJA]') && new Date(t.date) >= rangeStart)
    .forEach(tx => {
      const p = products.find(prod => prod.id === tx.productId);
      if (p) categoryRotations[p.category || 'General'] = (categoryRotations[p.category || 'General'] || 0) + tx.quantity;
    });

  const categoryChartData = Object.entries(categoryRotations)
    .map(([name, rot]) => ({ nombre: name, rotacion: rot }))
    .sort((a, b) => b.rotacion - a.rotacion)
    .slice(0, 6);

  // ── Stock Histórico ───────────────────────────────────────────────────────
  const sortedTxs = [...transactions]
    .filter(t => t.status !== 'CANCELLED')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let running = 0;
  const stockHistoryMap: Record<string, { in: number; out: number; mermas: number; balance: number }> = {};
  sortedTxs.forEach(tx => {
    const day = format(new Date(tx.date), 'dd/MM/yy');
    if (!stockHistoryMap[day]) stockHistoryMap[day] = { in: 0, out: 0, mermas: 0, balance: 0 };
    if (tx.type === 'RECEPTION') { running += tx.quantity; stockHistoryMap[day].in += tx.quantity; }
    else if (tx.type === 'DISPATCH') {
      running -= tx.quantity;
      if (tx.reference?.startsWith('[BAJA]')) stockHistoryMap[day].mermas += tx.quantity;
      else stockHistoryMap[day].out += tx.quantity;
    }
    stockHistoryMap[day].balance = running;
  });

  const stockHistoryData = Object.entries(stockHistoryMap).map(([date, v]) => ({ date, ...v }));

  const totalIn       = sortedTxs.filter(t => t.type === 'RECEPTION').reduce((s, t) => s + t.quantity, 0);
  const totalOut      = sortedTxs.filter(t => t.type === 'DISPATCH' && !t.reference?.startsWith('[BAJA]')).reduce((s, t) => s + t.quantity, 0);
  const totalWriteoff = sortedTxs.filter(t => t.reference?.startsWith('[BAJA]')).reduce((s, t) => s + t.quantity, 0);
  const netBalance    = totalIn - totalOut - totalWriteoff;

  // ── Por Producto ──────────────────────────────────────────────────────────
  const byProductBase: Record<string, {
    name: string; code: string; in: number; out: number; writeoff: number;
    sizes: Record<string, { in: number; out: number; writeoff: number }>;
  }> = {};

  sortedTxs.forEach(tx => {
    const p = products.find(prod => prod.id === tx.productId);
    if (!p) return;
    const baseKey = p.name.trim();
    if (!byProductBase[baseKey]) byProductBase[baseKey] = { name: p.name, code: p.code, in: 0, out: 0, writeoff: 0, sizes: {} };
    const size = p.size?.trim() || 'S/T';
    if (!byProductBase[baseKey].sizes[size]) byProductBase[baseKey].sizes[size] = { in: 0, out: 0, writeoff: 0 };
    const isWO = tx.reference?.startsWith('[BAJA]');
    if (tx.type === 'RECEPTION') { byProductBase[baseKey].in += tx.quantity; byProductBase[baseKey].sizes[size].in += tx.quantity; }
    else if (tx.type === 'DISPATCH') {
      if (isWO) { byProductBase[baseKey].writeoff += tx.quantity; byProductBase[baseKey].sizes[size].writeoff += tx.quantity; }
      else { byProductBase[baseKey].out += tx.quantity; byProductBase[baseKey].sizes[size].out += tx.quantity; }
    }
  });

  const byProductList = Object.entries(byProductBase)
    .map(([, v]) => ({ ...v, balance: v.in - v.out - v.writeoff,
      sizeList: Object.entries(v.sizes).map(([size, sv]) => ({ size, ...sv, balance: sv.in - sv.out - sv.writeoff })).sort((a, b) => b.in - a.in) }))
    .sort((a, b) => b.in - a.in);

  // ── Por Talla ─────────────────────────────────────────────────────────────
  const bySize: Record<string, { in: number; out: number; writeoff: number }> = {};
  sortedTxs.forEach(tx => {
    const p    = products.find(prod => prod.id === tx.productId);
    const size = p?.size?.trim() || 'S/T';
    if (!bySize[size]) bySize[size] = { in: 0, out: 0, writeoff: 0 };
    const isWO = tx.reference?.startsWith('[BAJA]');
    if (tx.type === 'RECEPTION') bySize[size].in += tx.quantity;
    else if (tx.type === 'DISPATCH') { if (isWO) bySize[size].writeoff += tx.quantity; else bySize[size].out += tx.quantity; }
  });

  const bySizeList = Object.entries(bySize)
    .map(([size, v]) => ({ size, ...v, balance: v.in - v.out - v.writeoff }))
    .sort((a, b) => b.in - a.in);

  // ── Low Stock ─────────────────────────────────────────────────────────────
  const lowStockItems = products.map(p => {
    const total = stockLevels.filter(s => s.productId === p.id).reduce((acc, curr) => acc + curr.quantity, 0);
    return { ...p, totalStock: total };
  }).filter(p => p.lowStockThreshold !== undefined && p.totalStock <= p.lowStockThreshold);

  // ── Exports ───────────────────────────────────────────────────────────────
  const exportProductoCSV = () => {
    const rows: string[][] = [['Producto','Total Ingresado','Total Despachado','Balance','Talla','Ingresado Talla','Despachado Talla','Balance Talla']];
    byProductList.forEach(p => {
      if (p.sizeList.length === 0) rows.push([p.name,String(p.in),String(p.out),String(p.balance),'','','','']);
      else p.sizeList.forEach((s,i) => rows.push([i===0?p.name:'',i===0?String(p.in):'',i===0?String(p.out):'',i===0?String(p.balance):'',s.size,String(s.in),String(s.out),String(s.balance)]));
    });
    const blob = new Blob(['\ufeff'+rows.map(r=>r.map(v=>v.includes(',')?'"'+v+'"':v).join(',')).join('\n')],{type:'text/csv;charset=utf-8;'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`stock_por_producto_${format(new Date(),'yyyyMMdd')}.csv`; a.click();
  };
  const exportProductoExcel = () => {
    const rows: (string|number)[][] = [['Producto','Total Ingresado','Total Despachado','Balance','Talla','Ingresado','Despachado','Balance Talla']];
    byProductList.forEach(p => {
      if (p.sizeList.length===0) rows.push([p.name,p.in,p.out,p.balance,'','','','']);
      else p.sizeList.forEach((s,i)=>rows.push([i===0?p.name:'',i===0?p.in:'',i===0?p.out:'',i===0?p.balance:'',s.size,s.in,s.out,s.balance]));
    });
    const ws=XLSX.utils.aoa_to_sheet(rows); ws['!cols']=[40,14,14,10,10,10,10,12].map(w=>({wch:w}));
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Stock por Producto');
    XLSX.writeFile(wb,`stock_por_producto_${format(new Date(),'yyyyMMdd')}.xlsx`);
  };
  const exportProductoPDF = () => {
    const now=format(new Date(),"dd 'de' MMMM yyyy, HH:mm",{locale:es});
    const rows=byProductList.map(p=>{
      const sHTML=p.sizeList.map(s=>`<span style="display:inline-flex;flex-direction:column;align-items:center;border:1px solid #ccc;padding:3px 6px;margin:2px;font-size:8px;"><b>${s.size}</b><span style="color:#15803d">+${s.in}</span><span style="color:#dc2626">-${s.out}</span></span>`).join('');
      return `<tr><td><b>${p.name}</b></td><td style="text-align:center;color:#15803d;font-weight:700">+${p.in}</td><td style="text-align:center;color:#dc2626;font-weight:700">-${p.out}</td><td style="text-align:center;font-weight:900;color:${p.balance>=0?'#141414':'#dc2626'}">${p.balance>=0?'+':''}${p.balance}</td><td>${sHTML}</td></tr>`;
    }).join('');
    const html=`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Courier New',monospace;padding:32px 40px;font-size:10px;color:#141414}@page{size:A4;margin:14mm}h1{font-size:16px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px}.meta{font-size:8px;opacity:.5;margin-bottom:24px;letter-spacing:.06em}table{width:100%;border-collapse:collapse;font-size:9px}thead{background:#141414;color:#E4E3E0}th{padding:8px 10px;text-align:left;font-size:8px;letter-spacing:.12em;text-transform:uppercase;font-weight:700}td{padding:7px 10px;border-bottom:1px solid #e5e7eb;vertical-align:middle}tr:nth-child(even) td{background:#fafafa}</style></head><body><h1>Stock Acumulado | Por Producto</h1><div class="meta">Generado: ${now} · ${byProductList.length} productos</div><table><thead><tr><th>Producto</th><th>Ingresado</th><th>Despachado</th><th>Balance</th><th>Por Talla</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
    const win=window.open('','_blank'); if(!win)return; win.document.write(html); win.document.close(); win.focus(); setTimeout(()=>{win.print();win.close();},500);
  };
  const exportTallaCSV = () => {
    const rows=[['Talla','Ingresado','Despachado','Balance'],...bySizeList.map(s=>[s.size,String(s.in),String(s.out),String(s.balance)])];
    const blob=new Blob(['\ufeff'+rows.map(r=>r.join(',')).join('\n')],{type:'text/csv;charset=utf-8;'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`stock_por_talla_${format(new Date(),'yyyyMMdd')}.csv`; a.click();
  };
  const exportTallaExcel = () => {
    const rows=[['Talla','Ingresado','Despachado','Balance'],...bySizeList.map(s=>[s.size,s.in,s.out,s.balance])];
    const ws=XLSX.utils.aoa_to_sheet(rows); ws['!cols']=[12,12,12,10].map(w=>({wch:w}));
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Stock por Talla');
    XLSX.writeFile(wb,`stock_por_talla_${format(new Date(),'yyyyMMdd')}.xlsx`);
  };
  const exportTallaPDF = () => {
    const now=format(new Date(),"dd 'de' MMMM yyyy, HH:mm",{locale:es});
    const rows=bySizeList.map(s=>`<tr><td style="font-weight:900;font-size:14px">${s.size}</td><td style="text-align:center;color:#15803d;font-weight:700">+${s.in}</td><td style="text-align:center;color:#dc2626;font-weight:700">-${s.out}</td><td style="text-align:center;font-weight:900;color:${s.balance>=0?'#141414':'#dc2626'}">${s.balance>=0?'+':''}${s.balance}</td></tr>`).join('');
    const html=`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Courier New',monospace;padding:32px 40px;font-size:10px;color:#141414}@page{size:A4;margin:14mm}h1{font-size:16px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px}.meta{font-size:8px;opacity:.5;margin-bottom:24px;letter-spacing:.06em}table{width:100%;border-collapse:collapse;font-size:10px}thead{background:#141414;color:#E4E3E0}th{padding:8px 12px;text-align:left;font-size:8px;letter-spacing:.12em;text-transform:uppercase;font-weight:700}td{padding:10px 12px;border-bottom:1px solid #e5e7eb}tr:nth-child(even) td{background:#fafafa}</style></head><body><h1>Stock Acumulado | Por Talla</h1><div class="meta">Generado: ${now} · ${bySizeList.length} tallas</div><table><thead><tr><th>Talla</th><th>Ingresado</th><th>Despachado</th><th>Balance</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
    const win=window.open('','_blank'); if(!win)return; win.document.write(html); win.document.close(); win.focus(); setTimeout(()=>{win.print();win.close();},500);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">
      <TutorialModal open={showTutorial} onClose={() => setShowTutorial(false)} steps={DASHBOARD_TUTORIAL_STEPS} title="Dashboard" />

      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-40">Módulo 03</span>
            <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-500">En línea</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm opacity-40 mt-0.5 capitalize">
            {format(new Date(), "EEEE, dd 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
        <button
          onClick={() => setShowTutorial(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-all text-sm font-medium"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
          </svg>
          Tutorial
        </button>
      </div>

      {/* ── LOW STOCK ALERT ──────────────────────────────────────────────── */}
      {lowStockItems.length > 0 && (
        <button
          onClick={() => { window.sessionStorage.setItem('inventoryFilter', 'LOW_STOCK'); navigate('/inventory'); }}
          className="w-full text-left rounded-xl border border-red-500/40 bg-red-500/8 hover:bg-red-500/12 transition-all p-4 group"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle size={16} className="text-red-500" />
              </div>
              <div>
                <div className="font-semibold text-sm text-red-500">{lowStockItems.length} productos con stock bajo</div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {lowStockItems.slice(0, 6).map(item => (
                    <span key={item.id} className="text-[10px] font-mono font-bold bg-red-500/15 text-red-500 px-2 py-0.5 rounded-full">
                      {item.code} · {item.totalStock}/{item.lowStockThreshold}
                    </span>
                  ))}
                  {lowStockItems.length > 6 && (
                    <span className="text-[10px] font-mono font-bold bg-red-500/15 text-red-500 px-2 py-0.5 rounded-full">
                      +{lowStockItems.length - 6} más
                    </span>
                  )}
                </div>
              </div>
            </div>
            <ArrowRight size={18} className="text-red-500 shrink-0 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>
      )}

      {/* ── KPI CARDS ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <ModernKpi
          label="Stock Total"
          value={totalItemsInStock.toLocaleString()}
          sub="unidades"
          icon={<Package size={16} />}
          accent="indigo"
        />
        <ModernKpi
          label="Recepciones hoy"
          value={todaysReceptions.toLocaleString()}
          sub="entradas"
          icon={<ArrowDownLeft size={16} />}
          accent="emerald"
          clickable
          onClick={() => { sessionStorage.setItem('operationsLogFilter', JSON.stringify({ type: 'RECEPTION', dateFrom: todayStr, dateTo: todayStr })); navigate('/operations'); }}
        />
        <ModernKpi
          label="Despachos hoy"
          value={todaysDispatches.toLocaleString()}
          sub="salidas"
          icon={<ArrowUpRight size={16} />}
          accent="red"
          clickable
          onClick={() => { sessionStorage.setItem('operationsLogFilter', JSON.stringify({ type: 'DISPATCH', dateFrom: todayStr, dateTo: todayStr })); navigate('/operations'); }}
        />
        <ModernKpi
          label="Mermas hoy"
          value={todaysWriteoffs.toLocaleString()}
          sub="bajas"
          icon={<Trash2 size={16} />}
          accent={todaysWriteoffs > 0 ? 'orange' : 'slate'}
          warn={todaysWriteoffs > 0}
        />
        <ModernKpi
          label="Valor inventario"
          value={totalInventoryValue > 0 ? `S/ ${totalInventoryValue.toLocaleString('es-PE',{maximumFractionDigits:0})}` : '—'}
          sub="costo estimado"
          icon={<DollarSign size={16} />}
          accent="violet"
          span2
        />
      </div>

      {/* ── TABS ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 rounded-xl bg-[var(--bg-sidebar)] border border-[var(--border)]">
        {TAB_LABELS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setMainTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              mainTab === tab.key
                ? 'bg-[var(--ink)] text-[var(--ink-inv)] shadow-sm'
                : 'opacity-50 hover:opacity-80 hover:bg-[var(--surface)]'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:block">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ═══════════════ TAB: RESUMEN ═══════════════════════════════════════ */}
      {mainTab === 'resumen' && (
        <div className="flex flex-col gap-5">

          {/* Row 1: Area chart grande */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <div>
                <h3 className="font-semibold text-sm">Movimientos</h3>
                <p className="text-[11px] opacity-40">Recepciones vs despachos en el período</p>
              </div>
              <div className="flex gap-0.5 p-0.5 rounded-lg bg-[var(--bg-sidebar)] border border-[var(--border)]">
                {([7, 14, 30] as const).map(d => (
                  <button key={d} onClick={() => setDays(d)}
                    className={`px-3 py-1 rounded-md text-[11px] font-bold font-mono transition-all ${days===d?'bg-[var(--ink)] text-[var(--ink-inv)]':'opacity-50 hover:opacity-80'}`}>
                    {d}D
                  </button>
                ))}
              </div>
            </div>
            <div className="h-56 px-2 pb-3">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 16, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gDsp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: axisColor, fontFamily: 'JetBrains Mono, monospace' }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: axisColor, fontFamily: 'JetBrains Mono, monospace' }} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ fontWeight: 700, marginBottom: 4 }} />
                  <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', paddingTop: 8 }} iconType="circle" />
                  <Area type="monotone" dataKey="recepciones" name="Recepciones" stroke="#10b981" strokeWidth={2} fill="url(#gRec)" />
                  <Area type="monotone" dataKey="despachos"   name="Despachos"   stroke="#ef4444" strokeWidth={2} fill="url(#gDsp)" />
                  {chartData.some(d => d.mermas > 0) && (
                    <Area type="monotone" dataKey="mermas" name="Mermas" stroke="#f97316" strokeWidth={1.5} strokeDasharray="4 2" fill="none" />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Row 2: Actividad Reciente + Stats acumulado */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Actividad Reciente — 2/3 */}
            <div className="lg:col-span-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="opacity-50" />
                  <h3 className="font-semibold text-sm">Actividad reciente</h3>
                </div>
                <button
                  onClick={() => navigate('/operations')}
                  className="text-[11px] font-medium opacity-40 hover:opacity-80 flex items-center gap-1 transition-opacity"
                >
                  Ver todo <ChevronRight size={12} />
                </button>
              </div>
              <div className="divide-y divide-[var(--border)]/40">
                {transactions.slice(0, 8).map(tx => {
                  const product = products.find(p => p.id === tx.productId);
                  const isBaja  = tx.reference?.startsWith('[BAJA]');
                  const meta    = isBaja ? TYPE_META.BAJA : TYPE_META[tx.type] || TYPE_META.TRANSFER;
                  return (
                    <div key={tx.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-[var(--row-hover)] transition-colors">
                      <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full ${meta.bg} ${meta.text} shrink-0`}>
                        {meta.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{product?.name || product?.code || '—'}</div>
                        <div className="text-[10px] opacity-40 font-mono truncate">{tx.reference}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-sm font-mono">{tx.quantity} u</div>
                        <div className="text-[10px] opacity-40 font-mono">{format(new Date(tx.date), 'dd/MM HH:mm')}</div>
                      </div>
                    </div>
                  );
                })}
                {transactions.length === 0 && (
                  <div className="p-8 text-center text-sm opacity-30">Sin registros de actividad</div>
                )}
              </div>
            </div>

            {/* Panel lateral: totales históricos — 1/3 */}
            <div className="flex flex-col gap-3">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3">
                <h3 className="font-semibold text-sm opacity-70">Acumulado histórico</h3>
                <div className="flex flex-col gap-2">
                  <StatRow label="Total ingresado"  value={`+${totalIn.toLocaleString()}`}       color="text-emerald-500" />
                  <StatRow label="Total despachado" value={`-${totalOut.toLocaleString()}`}       color="text-red-500" />
                  {totalWriteoff > 0 && <StatRow label="Total mermas" value={`-${totalWriteoff.toLocaleString()}`} color="text-orange-500" />}
                  <div className="h-px bg-[var(--border)] my-1" />
                  <StatRow
                    label="Balance neto"
                    value={`${netBalance >= 0 ? '+' : ''}${netBalance.toLocaleString()}`}
                    color={netBalance >= 0 ? 'text-[var(--ink)] font-black' : 'text-red-500 font-black'}
                    large
                  />
                </div>
              </div>

              {/* Rotación por categoría si hay datos */}
              {categoryChartData.length > 0 && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden flex-1">
                  <div className="px-4 pt-3.5 pb-1">
                    <h3 className="font-semibold text-sm">Top categorías</h3>
                    <p className="text-[10px] opacity-40">Por despachos en el período</p>
                  </div>
                  <div className="h-[140px] px-2 pb-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={categoryChartData} layout="vertical" margin={{ top: 0, right: 16, left: 4, bottom: 0 }}>
                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: axisColor, fontFamily: 'JetBrains Mono, monospace' }} />
                        <YAxis type="category" dataKey="nombre" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: axisColor, fontFamily: 'JetBrains Mono, monospace' }} width={60} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="rotacion" name="Unidades" radius={[0, 4, 4, 0]} maxBarSize={12}>
                          {categoryChartData.map((_, idx) => (
                            <Cell key={idx} fill={['#6366f1','#8b5cf6','#a78bfa','#c4b5fd','#ddd6fe','#ede9fe'][idx % 6]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Row 3: Stock histórico acumulado */}
          {stockHistoryData.length > 0 && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
              <div className="flex items-center gap-2 px-5 pt-4 pb-2">
                <TrendingUp size={14} className="opacity-50" />
                <div>
                  <h3 className="font-semibold text-sm">Stock histórico acumulado</h3>
                  <p className="text-[11px] opacity-40">Balance = Recepciones − Despachos − Mermas</p>
                </div>
              </div>
              <div className="h-52 px-2 pb-3">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stockHistoryData} margin={{ top: 10, right: 16, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: axisColor, fontFamily: 'JetBrains Mono, monospace' }} dy={8} interval="preserveStartEnd" />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: axisColor, fontFamily: 'JetBrains Mono, monospace' }} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(val: number, name: string) => [val.toLocaleString(), name]} />
                    <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1} />
                    <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', paddingTop: 8 }} iconType="circle" />
                    <Line type="monotone" dataKey="balance" name="Balance acumulado" stroke="#6366f1" strokeWidth={2.5} dot={stockHistoryData.length <= 30} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="in"      name="Ingresado"         stroke="#10b981" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                    <Line type="monotone" dataKey="out"     name="Despachado"        stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ TAB: POR PRODUCTO ══════════════════════════════════ */}
      {mainTab === 'producto' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Stock acumulado por producto</h3>
              <span className="text-[11px] font-mono opacity-40 bg-[var(--bg-sidebar)] border border-[var(--border)] px-2 py-0.5 rounded-full">{byProductList.length}</span>
            </div>
            <div className="flex gap-1">
              <ExportBtn onClick={exportProductoPDF}   icon={<Printer size={12} />}        label="PDF"   />
              <ExportBtn onClick={exportProductoExcel} icon={<FileSpreadsheet size={12} />} label="Excel" />
              <ExportBtn onClick={exportProductoCSV}   icon={<FileText size={12} />}        label="CSV"   />
            </div>
          </div>

          {/* Totales */}
          <div className="grid grid-cols-4 gap-3">
            <SummaryPill label="Total ingresado"  value={`+${totalIn.toLocaleString()}`}       color="emerald" />
            <SummaryPill label="Total despachado" value={`-${totalOut.toLocaleString()}`}       color="red"     />
            <SummaryPill label="Total mermas"     value={`-${totalWriteoff.toLocaleString()}`} color="orange"  />
            <SummaryPill label="Balance neto"     value={`${netBalance>=0?'+':''}${netBalance.toLocaleString()}`} color={netBalance>=0?'slate':'red'} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {byProductList.map(p => {
              const outPct = p.in > 0 ? Math.min(Math.round((p.out / p.in) * 100), 100) : 0;
              return (
                <div key={p.name} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden flex flex-col">
                  <div className="px-4 py-3 border-b border-[var(--border)] flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{p.name}</div>
                      <div className="text-[10px] font-mono opacity-40">{p.code}</div>
                    </div>
                    <span className={`font-mono text-sm font-black shrink-0 ${p.balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {p.balance >= 0 ? '+' : ''}{p.balance}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 bg-[var(--bg-sidebar)]">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-red-500 transition-all" style={{ width: `${outPct}%` }} />
                  </div>
                  <div className={`grid ${p.writeoff > 0 ? 'grid-cols-3' : 'grid-cols-2'} divide-x divide-[var(--border)]/30`}>
                    <div className="p-3">
                      <div className="text-[9px] font-mono uppercase opacity-40 mb-0.5">IN</div>
                      <div className="font-bold text-lg text-emerald-500 font-mono">+{p.in}</div>
                    </div>
                    <div className="p-3">
                      <div className="text-[9px] font-mono uppercase opacity-40 mb-0.5">OUT</div>
                      <div className="font-bold text-lg text-red-500 font-mono">-{p.out}</div>
                    </div>
                    {p.writeoff > 0 && (
                      <div className="p-3 bg-orange-500/5">
                        <div className="text-[9px] font-mono uppercase text-orange-500 opacity-70 mb-0.5">MERMA</div>
                        <div className="font-bold text-lg text-orange-500 font-mono">-{p.writeoff}</div>
                      </div>
                    )}
                  </div>
                  {p.sizeList.length > 0 && (
                    <div className="px-3 pb-3 pt-1">
                      <div className="text-[9px] font-mono uppercase opacity-30 mb-1.5">Por talla</div>
                      <div className="flex flex-wrap gap-1.5">
                        {p.sizeList.map(s => (
                          <div key={s.size} className="rounded-lg bg-[var(--bg-sidebar)] border border-[var(--border)]/50 px-2 py-1 flex flex-col items-center min-w-[40px]">
                            <span className="font-mono text-[9px] font-black">{s.size}</span>
                            <span className="font-mono text-[8px] text-emerald-500">+{s.in}</span>
                            <span className="font-mono text-[8px] text-red-500">-{s.out}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {byProductList.length === 0 && (
              <div className="col-span-3 py-16 text-center text-sm opacity-30 rounded-xl border border-[var(--border)] border-dashed">Sin movimientos registrados</div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════ TAB: POR TALLA ═════════════════════════════════════ */}
      {mainTab === 'talla' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Stock acumulado por talla</h3>
              <span className="text-[11px] font-mono opacity-40 bg-[var(--bg-sidebar)] border border-[var(--border)] px-2 py-0.5 rounded-full">{bySizeList.length}</span>
            </div>
            <div className="flex gap-1">
              <ExportBtn onClick={exportTallaPDF}   icon={<Printer size={12} />}        label="PDF"   />
              <ExportBtn onClick={exportTallaExcel} icon={<FileSpreadsheet size={12} />} label="Excel" />
              <ExportBtn onClick={exportTallaCSV}   icon={<FileText size={12} />}        label="CSV"   />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <SummaryPill label="Total ingresado"  value={`+${totalIn.toLocaleString()}`}       color="emerald" />
            <SummaryPill label="Total despachado" value={`-${totalOut.toLocaleString()}`}       color="red"     />
            <SummaryPill label="Total mermas"     value={`-${totalWriteoff.toLocaleString()}`} color="orange"  />
            <SummaryPill label="Balance neto"     value={`${netBalance>=0?'+':''}${netBalance.toLocaleString()}`} color={netBalance>=0?'slate':'red'} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {bySizeList.map(s => (
              <div key={s.size} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden flex flex-col">
                <div className="py-5 text-center border-b border-[var(--border)]">
                  <div className="text-3xl font-black font-mono">{s.size}</div>
                </div>
                <div className="h-1.5 bg-[var(--bg-sidebar)]">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-red-500 transition-all"
                    style={{ width: `${s.in > 0 ? Math.min(Math.round((s.out/s.in)*100),100) : 0}%` }} />
                </div>
                <div className="p-3 text-center border-b border-[var(--border)]/30">
                  <div className="text-[9px] font-mono uppercase opacity-40 mb-0.5">Balance</div>
                  <div className={`text-2xl font-black font-mono ${s.balance >= 0 ? '' : 'text-red-500'}`}>
                    {s.balance >= 0 ? '+' : ''}{s.balance}
                  </div>
                </div>
                <div className={`grid ${s.writeoff > 0 ? 'grid-cols-3' : 'grid-cols-2'} divide-x divide-[var(--border)]/30`}>
                  <div className="p-2 text-center">
                    <div className="text-[8px] font-mono opacity-40 uppercase">IN</div>
                    <div className="font-bold font-mono text-emerald-500">+{s.in}</div>
                  </div>
                  <div className="p-2 text-center">
                    <div className="text-[8px] font-mono opacity-40 uppercase">OUT</div>
                    <div className="font-bold font-mono text-red-500">-{s.out}</div>
                  </div>
                  {s.writeoff > 0 && (
                    <div className="p-2 text-center bg-orange-500/5">
                      <div className="text-[8px] font-mono text-orange-500 uppercase opacity-70">MERMA</div>
                      <div className="font-bold font-mono text-orange-500">-{s.writeoff}</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {bySizeList.length === 0 && (
              <div className="col-span-full py-16 text-center text-sm opacity-30 rounded-xl border border-[var(--border)] border-dashed">Sin movimientos registrados</div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  indigo:  { bg: 'bg-indigo-500/10',  text: 'text-indigo-500',  ring: 'ring-indigo-500/20'  },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', ring: 'ring-emerald-500/20' },
  red:     { bg: 'bg-red-500/10',     text: 'text-red-500',     ring: 'ring-red-500/20'     },
  orange:  { bg: 'bg-orange-500/10',  text: 'text-orange-500',  ring: 'ring-orange-500/20'  },
  violet:  { bg: 'bg-violet-500/10',  text: 'text-violet-500',  ring: 'ring-violet-500/20'  },
  slate:   { bg: 'bg-[var(--surface)]', text: 'text-[var(--ink)]', ring: 'ring-[var(--border)]' },
};

interface ModernKpiProps {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  accent?: string;
  clickable?: boolean;
  onClick?: () => void;
  warn?: boolean;
  span2?: boolean;
}

const ModernKpi: React.FC<ModernKpiProps> = ({ label, value, sub, icon, accent = 'slate', clickable, onClick, warn, span2 }) => {
  const colors = ACCENT_COLORS[accent] || ACCENT_COLORS.slate;
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-2 transition-all ${clickable ? 'cursor-pointer hover:border-[var(--ink)] hover:shadow-sm' : ''} ${warn ? 'border-orange-500/40 bg-orange-500/5' : ''} ${span2 ? 'col-span-2 lg:col-span-1' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors.bg} ${colors.text}`}>
          {icon}
        </div>
        {clickable && <ChevronRight size={14} className="opacity-20" />}
      </div>
      <div>
        <div className={`text-2xl font-bold tracking-tight ${colors.text !== 'text-[var(--ink)]' ? colors.text : ''}`}>{value}</div>
        <div className="text-[11px] opacity-40 mt-0.5">{sub}</div>
      </div>
      <div className="text-[11px] font-medium opacity-60">{label}</div>
    </div>
  );
};

interface ExportBtnProps { onClick: () => void; icon: React.ReactNode; label: string; }
const ExportBtn: React.FC<ExportBtnProps> = ({ onClick, icon, label }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--border)] text-[11px] font-medium hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-colors"
  >
    {icon} {label}
  </button>
);

interface StatRowProps { label: string; value: string; color?: string; large?: boolean; }
const StatRow: React.FC<StatRowProps> = ({ label, value, color = '', large }) => (
  <div className="flex items-center justify-between">
    <span className={`text-${large ? 'sm' : '[11px]'} opacity-50`}>{label}</span>
    <span className={`font-mono font-bold ${large ? 'text-lg' : 'text-sm'} ${color}`}>{value}</span>
  </div>
);

const SUMMARY_COLORS: Record<string, { bg: string; text: string }> = {
  emerald: { bg: 'bg-emerald-500/8 border-emerald-500/20', text: 'text-emerald-500' },
  red:     { bg: 'bg-red-500/8     border-red-500/20',     text: 'text-red-500'     },
  orange:  { bg: 'bg-orange-500/8  border-orange-500/20',  text: 'text-orange-500'  },
  slate:   { bg: 'bg-[var(--surface)] border-[var(--border)]', text: 'text-[var(--ink)]' },
};

interface SummaryPillProps { label: string; value: string; color?: string; }
const SummaryPill: React.FC<SummaryPillProps> = ({ label, value, color = 'slate' }) => {
  const c = SUMMARY_COLORS[color] || SUMMARY_COLORS.slate;
  return (
    <div className={`rounded-xl border p-4 ${c.bg}`}>
      <div className="text-[10px] opacity-50 uppercase font-mono mb-1">{label}</div>
      <div className={`text-xl font-black font-mono ${c.text}`}>{value}</div>
    </div>
  );
};
