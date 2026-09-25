import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { Plus, ChevronDown, ChevronUp, Upload, Download, CheckCircle, XCircle, AlertCircle, PackagePlus, SlidersHorizontal, Clock, Check, X as XIcon } from 'lucide-react';
import { AdjustmentReason, AdjustmentStatus } from '../types';
import { TutorialModal, ADJUSTMENTS_TUTORIAL_STEPS } from '../components/TutorialModal';
import { canEdit } from '../lib/permissions';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '../lib/utils';

const REASON_LABEL: Record<AdjustmentReason, string> = {
  DAMAGE: 'DAÑO / ROTURA',
  LOSS: 'MERMA / PÉRDIDA',
  COUNT: 'CONTEO FÍSICO',
  RETURN: 'DEVOLUCIÓN',
  OTHER: 'OTRO',
};

const REASON_COLOR: Record<AdjustmentReason, string> = {
  DAMAGE: 'border-red-500/30 text-red-600 bg-red-500/10',
  LOSS: 'border-orange-500/30 text-orange-600 bg-orange-500/10',
  COUNT: 'border-blue-500/30 text-blue-600 bg-blue-500/10',
  RETURN: 'border-emerald-500/30 text-emerald-600 bg-emerald-500/10',
  OTHER: 'border-[var(--border-soft)] text-[var(--ink-50)] bg-[var(--ink)]/5',
};

const VALID_REASONS: Record<string, AdjustmentReason> = {
  DAMAGE: 'DAMAGE', DAÑO: 'DAMAGE',
  LOSS: 'LOSS', MERMA: 'LOSS',
  COUNT: 'COUNT', CONTEO: 'COUNT',
  RETURN: 'RETURN', DEVOLUCION: 'RETURN', DEVOLUCIÓN: 'RETURN',
  OTHER: 'OTHER', OTRO: 'OTHER',
};

const PAGE_SIZE = 20;

type BulkMode = 'adjust' | 'reception';

type BulkRow = {
  line: number;
  code: string;
  qty: number;
  reason: AdjustmentReason;
  locationName: string;
  notes: string;
  productId: string | null;
  locationId: string | null;
  stockActual: number;
  error: string | null;
};

const STATUS_LABEL: Record<AdjustmentStatus, string> = {
  PENDING: 'PENDIENTE',
  APPROVED: 'APROBADO',
  REJECTED: 'RECHAZADO',
};

const STATUS_COLOR: Record<AdjustmentStatus, string> = {
  PENDING: 'border-amber-500/30 text-amber-600 bg-amber-500/10',
  APPROVED: 'border-emerald-500/30 text-emerald-600 bg-emerald-500/10',
  REJECTED: 'border-red-500/30 text-red-600 bg-red-500/10',
};

export const Adjustments: React.FC = () => {
  const { adjustments, addAdjustment, approveAdjustment, rejectAdjustment, addTransaction, products, locations, stockLevels, currentUser } = useAppContext();
  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterReason, setFilterReason] = useState<'ALL' | AdjustmentReason>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | AdjustmentStatus>('ALL');
  const [page, setPage] = useState(1);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [reviewBusy, setReviewBusy] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);

  const canAdjust = canEdit(currentUser.role, 'adjustments');
  const canReview = currentUser.role === 'ADMIN_GENERAL';
  const pendingAdjustments = adjustments.filter(a => a.status === 'PENDING');

  const diffColor = (prev: number, next: number) => {
    if (next > prev) return 'text-emerald-600 dark:text-emerald-400 font-bold';
    if (next < prev) return 'text-red-600 font-bold';
    return 'opacity-50';
  };

  const handleApprove = async (id: string) => {
    setReviewBusy(id);
    try { await approveAdjustment(id); } catch (e) { alert(e instanceof Error ? e.message : 'Error al aprobar'); }
    finally { setReviewBusy(null); }
  };

  const openReject = (id: string) => { setRejectingId(id); setRejectReason(''); };

  const confirmReject = async () => {
    if (!rejectingId) return;
    setReviewBusy(rejectingId);
    try { await rejectAdjustment(rejectingId, rejectReason); setRejectingId(null); }
    catch (e) { alert(e instanceof Error ? e.message : 'Error al rechazar'); }
    finally { setReviewBusy(null); }
  };

  // --- Single adjustment form ---
  const [selName, setSelName] = useState('');
  const [selColor, setSelColor] = useState('');
  const [selSize, setSelSize] = useState('');
  const [form, setForm] = useState({
    productId: '',
    locationId: '',
    newQuantity: 0,
    reason: 'COUNT' as AdjustmentReason,
    notes: '',
  });
  const [error, setError] = useState('');

  const uniqueNames: string[] = Array.from(new Set<string>(products.map(p => p.name))).sort();
  const colorsForName: string[] = selName
    ? Array.from(new Set<string>(products.filter(p => p.name === selName && p.color).map(p => p.color!))).sort()
    : [];
  const sizesForNameColor: string[] = selName
    ? products
        .filter(p => p.name === selName && (!selColor || p.color === selColor))
        .map(p => p.size?.trim() || '')
        .filter((s): s is string => s.length > 0)
    : [];
  const uniqueSizes: string[] = Array.from(new Set<string>(sizesForNameColor)).sort();

  const resolveProductId = (name: string, color: string, size: string) => {
    const match = products.find(p =>
      p.name === name &&
      (!color || p.color === color) &&
      (!size || p.size?.trim() === size)
    );
    return match?.id || '';
  };

  const currentStock = form.productId && form.locationId
    ? stockLevels.find(s => s.productId === form.productId && s.locationId === form.locationId)?.quantity ?? 0
    : 0;

  const handleNameChange = (name: string) => {
    setSelName(name); setSelColor(''); setSelSize('');
    setForm(f => ({ ...f, productId: '' }));
  };
  const handleColorChange = (color: string) => {
    setSelColor(color); setSelSize('');
    setForm(f => ({ ...f, productId: '' }));
  };
  const handleSizeChange = (size: string) => {
    setSelSize(size);
    setForm(f => ({ ...f, productId: resolveProductId(selName, selColor, size) }));
  };

  const openAdd = () => {
    setSelName(''); setSelColor(''); setSelSize('');
    setForm({ productId: '', locationId: locations[0]?.id || '', newQuantity: 0, reason: 'COUNT', notes: '' });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selName) { setError('Selecciona un producto'); return; }
    if (!form.productId) { setError('Selecciona color y talla para identificar el SKU'); return; }
    if (!form.locationId) { setError('Selecciona una ubicación'); return; }
    if (form.newQuantity < 0) { setError('La cantidad no puede ser negativa'); return; }
    addAdjustment({
      productId: form.productId,
      locationId: form.locationId,
      previousQuantity: currentStock,
      newQuantity: form.newQuantity,
      reason: form.reason,
      notes: form.notes,
      user: currentUser.username,
    });
    setShowModal(false);
  };

  // --- Bulk upload ---
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkMode, setBulkMode] = useState<BulkMode>('adjust');
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkDone, setBulkDone] = useState(false);
  const [bulkApplied, setBulkApplied] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const bulkImpact = useMemo(() => {
    const valid = bulkRows.filter(r => !r.error);
    if (bulkMode === 'reception') {
      const totalUnits = valid.reduce((sum, r) => sum + r.qty, 0);
      return { validCount: valid.length, totalUnits, netDiff: totalUnits, increases: valid.length, decreases: 0, byReason: {} as Record<AdjustmentReason, number> };
    }
    let netDiff = 0;
    let increases = 0;
    let decreases = 0;
    const byReason: Record<AdjustmentReason, number> = { DAMAGE: 0, LOSS: 0, COUNT: 0, RETURN: 0, OTHER: 0 };
    for (const r of valid) {
      const diff = r.qty - r.stockActual;
      netDiff += diff;
      if (diff > 0) increases++;
      else if (diff < 0) decreases++;
      byReason[r.reason]++;
    }
    return { validCount: valid.length, totalUnits: netDiff, netDiff, increases, decreases, byReason };
  }, [bulkRows, bulkMode]);

  const parseBulkRows = (rawRows: Record<string, unknown>[], mode: BulkMode) => {
    const qtyKey = mode === 'reception'
      ? ['cantidad_a_ingresar', 'Cantidad_a_ingresar', 'CANTIDAD_A_INGRESAR', 'cantidad', 'nueva_cantidad']
      : ['nueva_cantidad', 'Nueva_Cantidad', 'NUEVA_CANTIDAD', 'cantidad'];

    const rows: BulkRow[] = rawRows.map((r, i) => {
      const code = String(r['codigo'] ?? r['Codigo'] ?? r['CODIGO'] ?? '').trim();
      const qtyRaw = qtyKey.reduce<unknown>((found, k) => found !== '' && found !== undefined ? found : r[k], '');
      const qty = parseInt(String(qtyRaw), 10);
      const reasonRaw = String(r['motivo'] ?? r['Motivo'] ?? r['MOTIVO'] ?? 'COUNT').toUpperCase().replace(/[^A-Za-z]/g, '');
      const reason: AdjustmentReason = VALID_REASONS[reasonRaw] ?? 'COUNT';
      const locationName = String(r['ubicacion'] ?? r['Ubicacion'] ?? r['UBICACION'] ?? '').trim();
      const notes = String(r['notas'] ?? r['Notas'] ?? r['NOTAS'] ?? '').trim();

      const prod = products.find(p => p.code.trim().toUpperCase() === code.toUpperCase());
      const loc = locationName
        ? locations.find(l => l.name.trim().toUpperCase() === locationName.toUpperCase())
        : locations[0];

      const stockActual = prod
        ? stockLevels.filter(s => s.productId === prod.id).reduce((sum, s) => sum + s.quantity, 0)
        : 0;

      let error: string | null = null;
      if (!code) error = 'Código vacío';
      else if (!prod) error = `Código "${code}" no encontrado`;
      else if (isNaN(qty) || qty < 0) error = 'Cantidad inválida';
      else if (!loc) error = `Ubicación "${locationName}" no encontrada`;

      return {
        line: i + 2,
        code,
        qty: isNaN(qty) ? 0 : qty,
        reason,
        locationName: loc?.name || locationName,
        notes,
        productId: prod?.id ?? null,
        locationId: loc?.id ?? null,
        stockActual,
        error,
      };
    });
    setBulkRows(rows);
    setBulkDone(false);
  };

  const handleBulkFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array' });
      const skip = new Set(['Motivos', 'Ubicaciones']);
      const raw: Record<string, unknown>[] = [];
      wb.SheetNames.filter(n => !skip.has(n)).forEach(sheetName => {
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
        raw.push(...rows);
      });
      parseBulkRows(raw, bulkMode);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const confirmBulk = async () => {
    const valid = bulkRows.filter(r => !r.error && r.productId && r.locationId);
    if (bulkMode === 'adjust') {
      valid.forEach(r => {
        const prev = stockLevels.find(s => s.productId === r.productId && s.locationId === r.locationId)?.quantity ?? 0;
        addAdjustment({
          productId: r.productId!,
          locationId: r.locationId!,
          previousQuantity: prev,
          newQuantity: r.qty,
          reason: r.reason,
          notes: r.notes,
          user: currentUser.username,
        });
      });
    } else {
      for (const r of valid) {
        await addTransaction({
          type: 'RECEPTION',
          productId: r.productId!,
          quantity: r.qty,
          toLocationId: r.locationId!,
          reference: r.notes || `Ingreso masivo ${format(new Date(), 'dd/MM/yyyy', { locale: es })}`,
          user: currentUser.username,
        });
      }
    }
    setBulkApplied(valid.length);
    setBulkDone(true);
  };

  const downloadTemplate = (mode: BulkMode) => {
    const defaultLoc = locations[0]?.name ?? '';
    const wb = XLSX.utils.book_new();

    const productNames = Array.from(new Set<string>(products.map(p => p.name))).sort();
    productNames.forEach(name => {
      const variants = products.filter(p => p.name === name);
      if (mode === 'adjust') {
        const data = variants.map(p => ({
          codigo: p.code,
          color: p.color ?? '',
          talla: p.size ?? '',
          stock_actual: stockLevels.filter(s => s.productId === p.id).reduce((sum, s) => sum + s.quantity, 0),
          nueva_cantidad: '',
          motivo: 'COUNT',
          ubicacion: defaultLoc,
          notas: '',
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 28 }, { wch: 30 }];
        const sheetName = name.slice(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      } else {
        const data = variants.map(p => ({
          codigo: p.code,
          color: p.color ?? '',
          talla: p.size ?? '',
          stock_actual: stockLevels.filter(s => s.productId === p.id).reduce((sum, s) => sum + s.quantity, 0),
          cantidad_a_ingresar: '',
          ubicacion: defaultLoc,
          notas: '',
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 20 }, { wch: 28 }, { wch: 30 }];
        const sheetName = name.slice(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }
    });

    const reasonsData = Object.entries(REASON_LABEL).map(([code, label]) => ({ codigo: code, descripcion: label }));
    const wsReasons = XLSX.utils.json_to_sheet(reasonsData);
    wsReasons['!cols'] = [{ wch: 12 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, wsReasons, 'Motivos');

    const locsData = locations.map(l => ({ nombre: l.name, tipo: l.type }));
    const wsLocs = XLSX.utils.json_to_sheet(locsData);
    wsLocs['!cols'] = [{ wch: 28 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsLocs, 'Ubicaciones');

    XLSX.writeFile(wb, mode === 'adjust' ? 'plantilla_ajuste_masivo.xlsx' : 'plantilla_ingreso_masivo.xlsx');
  };

  const filtered = adjustments.filter(a => {
    if (filterReason !== 'ALL' && a.reason !== filterReason) return false;
    if (filterStatus !== 'ALL' && a.status !== filterStatus) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openBulk = (mode: BulkMode) => {
    setBulkMode(mode);
    setBulkRows([]);
    setBulkDone(false);
    setBulkApplied(0);
    setShowBulkModal(true);
  };

  return (
    <div className="flex flex-col gap-6 h-full relative">
      <TutorialModal open={showTutorial} onClose={() => setShowTutorial(false)} steps={ADJUSTMENTS_TUTORIAL_STEPS} title="Ajustes" />
      
      <ModuleInfo
        number="08"
        title="Ajustes de Inventario"
        description="Correcciones manuales de stock con motivo obligatorio. Permite incrementar o decrementar unidades de cualquier SKU con trazabilidad completa."
        onTutorial={() => setShowTutorial(true)}
      />

      {/* Filter and Actions Bar */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value as any); setPage(1); }}
            className="border border-[var(--border-soft)] bg-[var(--surface)] rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold uppercase focus:outline-none cursor-pointer shadow-xs"
          >
            <option value="ALL">TODOS LOS ESTADOS</option>
            {(Object.keys(STATUS_LABEL) as AdjustmentStatus[]).map(s => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
          <select
            value={filterReason}
            onChange={e => { setFilterReason(e.target.value as any); setPage(1); }}
            className="border border-[var(--border-soft)] bg-[var(--surface)] rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold uppercase focus:outline-none cursor-pointer shadow-xs"
          >
            <option value="ALL">TODOS LOS MOTIVOS</option>
            {(Object.keys(REASON_LABEL) as AdjustmentReason[]).map(r => (
              <option key={r} value={r}>{REASON_LABEL[r]}</option>
            ))}
          </select>
        </div>

        {canAdjust && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => openBulk('reception')}
              className="flex items-center gap-2 border border-[var(--border-soft)] bg-[var(--surface)] hover:bg-[var(--bg-card)] rounded-xl px-3.5 py-2.5 text-xs font-bold font-mono uppercase shadow-xs transition-all cursor-pointer"
            >
              <PackagePlus size={14} /> INGRESO MASIVO
            </button>
            <button
              onClick={() => openBulk('adjust')}
              className="flex items-center gap-2 border border-[var(--border-soft)] bg-[var(--surface)] hover:bg-[var(--bg-card)] rounded-xl px-3.5 py-2.5 text-xs font-bold font-mono uppercase shadow-xs transition-all cursor-pointer"
            >
              <SlidersHorizontal size={14} /> AJUSTE MASIVO
            </button>
            <button
              onClick={openAdd}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2.5 text-xs font-bold font-mono uppercase shadow-xs hover:shadow-md transition-all cursor-pointer active:scale-[0.98]"
            >
              <Plus size={14} /> NUEVO AJUSTE
            </button>
          </div>
        )}
      </div>

      {canReview && pendingAdjustments.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 md:p-5 flex flex-col gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-amber-600" />
            <span className="font-mono font-bold text-xs uppercase tracking-wider text-amber-700 dark:text-amber-400">
              {pendingAdjustments.length} AJUSTE{pendingAdjustments.length !== 1 ? 'S' : ''} PENDIENTE{pendingAdjustments.length !== 1 ? 'S' : ''} DE APROBACIÓN
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {pendingAdjustments.map(adj => {
              const prod = products.find(p => p.id === adj.productId);
              const loc = locations.find(l => l.id === adj.locationId);
              const diff = adj.newQuantity - adj.previousQuantity;
              const busy = reviewBusy === adj.id;
              return (
                <div key={adj.id} className="border border-[var(--border-soft)] bg-[var(--surface)] rounded-xl p-3.5 flex items-center justify-between gap-3 flex-wrap shadow-xs">
                  <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                    <span className={`font-mono text-[9px] font-bold border rounded-full px-2.5 py-0.5 shrink-0 ${REASON_COLOR[adj.reason]}`}>{REASON_LABEL[adj.reason]}</span>
                    <span className="font-mono font-bold text-xs truncate">{prod ? `${prod.code} ${prod.name} ${prod.color || ''} ${prod.size || ''}`.trim() : adj.productId}</span>
                    <span className="font-mono text-[10px] opacity-60 shrink-0">({loc?.name})</span>
                    <span className={`font-mono font-bold text-xs shrink-0 ${diffColor(adj.previousQuantity, adj.newQuantity)}`}>{adj.previousQuantity} → {adj.newQuantity} ({diff > 0 ? `+${diff}` : diff})</span>
                    <span className="font-mono text-[9px] opacity-50 shrink-0">por {adj.user}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button disabled={busy} onClick={() => handleApprove(adj.id)}
                      className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3 py-1.5 text-[10px] font-mono font-bold uppercase transition-all disabled:opacity-40 cursor-pointer shadow-xs">
                      <Check size={13} /> APROBAR
                    </button>
                    <button disabled={busy} onClick={() => openReject(adj.id)}
                      className="flex items-center gap-1.5 border border-red-500/30 text-red-500 rounded-lg px-3 py-1.5 text-[10px] font-mono font-bold uppercase hover:bg-red-600 hover:text-white transition-all disabled:opacity-40 cursor-pointer">
                      <XIcon size={13} /> RECHAZAR
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center font-mono text-xs opacity-50 py-16 uppercase tracking-widest rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--surface)]">
          Sin ajustes registrados
        </div>
      )}

      {/* Adjustments Cards */}
      <div className="flex flex-col gap-3">
        {paginated.map(adj => {
          const prod = products.find(p => p.id === adj.productId);
          const loc = locations.find(l => l.id === adj.locationId);
          const diff = adj.newQuantity - adj.previousQuantity;
          const isExp = expanded === adj.id;

          return (
            <div key={adj.id} className="border border-[var(--border-soft)] rounded-2xl bg-[var(--surface)] hover:border-blue-500/30 transition-all shadow-xs overflow-hidden backdrop-blur-md">
              <div className="flex items-center justify-between gap-4 p-4 cursor-pointer" onClick={() => setExpanded(isExp ? null : adj.id)}>
                <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                  <span className={`font-mono text-[9px] font-bold border rounded-full px-2.5 py-0.5 shrink-0 ${STATUS_COLOR[adj.status]}`}>
                    {STATUS_LABEL[adj.status]}
                  </span>
                  <span className={`font-mono text-[9px] font-bold border rounded-full px-2.5 py-0.5 shrink-0 ${REASON_COLOR[adj.reason]}`}>
                    {REASON_LABEL[adj.reason]}
                  </span>
                  <span className="font-mono font-bold text-xs text-[var(--ink)] truncate">
                    {prod ? `${prod.code} ${prod.name} ${prod.color || ''} ${prod.size || ''}`.trim() : adj.productId}
                  </span>
                  <span className="font-mono text-[10px] opacity-60 shrink-0 font-medium">({loc?.name})</span>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <div className="font-mono text-[10px] opacity-50">{adj.previousQuantity} → {adj.newQuantity}</div>
                    <div className={`font-mono font-bold text-xs ${diffColor(adj.previousQuantity, adj.newQuantity)}`}>
                      {diff > 0 ? `+${diff}` : diff}
                    </div>
                  </div>
                  {isExp ? <ChevronUp size={15} className="opacity-60" /> : <ChevronDown size={15} className="opacity-60" />}
                </div>
              </div>
              {isExp && (
                <div className="border-t border-[var(--border-soft)] bg-[var(--bg-card)] px-5 py-3.5 flex flex-wrap gap-4 text-[11px] font-mono">
                  <div><span className="opacity-50 uppercase">Fecha:</span> <span className="font-bold">{format(new Date(adj.date), 'dd MMM yyyy HH:mm', { locale: es })}</span></div>
                  <div><span className="opacity-50 uppercase">Usuario:</span> <span className="font-bold">{adj.user}</span></div>
                  {adj.status !== 'PENDING' && adj.reviewedBy && (
                    <div><span className="opacity-50 uppercase">Revisado por:</span> <span className="font-bold">{adj.reviewedBy}</span></div>
                  )}
                  {adj.notes && <div className="w-full"><span className="opacity-50 uppercase">Notas:</span> <span className="italic">{adj.notes}</span></div>}
                  {adj.status === 'REJECTED' && adj.rejectionReason && (
                    <div className="w-full"><span className="opacity-50 uppercase">Motivo de rechazo:</span> <span className="italic text-red-600">{adj.rejectionReason}</span></div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="font-mono text-[10px] opacity-60 font-bold">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}
          </span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="border border-[var(--border-soft)] rounded-lg px-3 py-1.5 text-xs font-mono font-bold disabled:opacity-30 hover:bg-[var(--surface)] transition-all cursor-pointer">
              ←
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1).map((p, idx, arr) => (
              <React.Fragment key={p}>
                {idx > 0 && arr[idx - 1] !== p - 1 && <span className="font-mono text-xs opacity-30 px-1">…</span>}
                <button onClick={() => setPage(p)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-mono font-bold transition-all cursor-pointer',
                    p === page ? 'bg-blue-600 text-white' : 'border border-[var(--border-soft)] hover:bg-[var(--surface)]'
                  )}>
                  {p}
                </button>
              </React.Fragment>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="border border-[var(--border-soft)] rounded-lg px-3 py-1.5 text-xs font-mono font-bold disabled:opacity-30 hover:bg-[var(--surface)] transition-all cursor-pointer">
              →
            </button>
          </div>
        </div>
      )}

      {/* Summary cards */}
      {adjustments.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-2">
          {(Object.keys(REASON_LABEL) as AdjustmentReason[]).map(r => {
            const count = adjustments.filter(a => a.reason === r).length;
            return (
              <div
                key={r}
                className={cn(
                  'border rounded-2xl p-4 cursor-pointer transition-all shadow-xs backdrop-blur-md',
                  filterReason === r
                    ? 'bg-[var(--ink)] text-[var(--ink-inv)] border-[var(--ink)] shadow-md'
                    : 'border-[var(--border-soft)] bg-[var(--surface)] hover:bg-[var(--bg-card)] hover:border-blue-500/30'
                )}
                onClick={() => { setFilterReason(filterReason === r ? 'ALL' : r); setPage(1); }}
              >
                <div className="font-mono text-2xl font-black">{count}</div>
                <div className="font-mono text-[9px] uppercase tracking-wider opacity-70 mt-1 font-bold">{REASON_LABEL[r]}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Single adjustment modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-modal)] border border-[var(--border-soft)] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="border-b border-[var(--border-soft)] px-5 py-3.5 flex justify-between items-center bg-[var(--surface)]">
              <span className="font-mono font-bold text-xs uppercase tracking-wider">NUEVO AJUSTE DE INVENTARIO</span>
              <button onClick={() => setShowModal(false)} className="w-7 h-7 rounded-lg flex items-center justify-center font-mono text-sm opacity-60 hover:opacity-100 cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold uppercase tracking-wider opacity-70">Producto *</label>
                <select value={selName} onChange={e => handleNameChange(e.target.value)}
                  className="input-technical cursor-pointer" required>
                  <option value="">Seleccionar producto...</option>
                  {uniqueNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              {selName && colorsForName.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[9px] font-bold uppercase tracking-wider opacity-70">Color</label>
                  <div className="flex flex-wrap gap-1.5">
                    {colorsForName.map(c => (
                      <button key={c} type="button" onClick={() => handleColorChange(selColor === c ? '' : c)}
                        className={cn(
                          'px-3 py-1.5 text-[10px] font-mono font-bold uppercase rounded-lg border transition-all cursor-pointer',
                          selColor === c ? 'bg-blue-600 text-white border-blue-600' : 'border-[var(--border-soft)] bg-[var(--surface)] hover:bg-[var(--bg-input)]'
                        )}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {selName && uniqueSizes.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[9px] font-bold uppercase tracking-wider opacity-70">Talla</label>
                  <div className="flex flex-wrap gap-1.5">
                    {uniqueSizes.map(s => (
                      <button key={s} type="button" onClick={() => handleSizeChange(s)}
                        className={cn(
                          'min-w-[40px] px-3 py-1.5 text-[10px] font-mono font-bold uppercase rounded-lg border transition-all cursor-pointer',
                          selSize === s ? 'bg-blue-600 text-white border-blue-600' : 'border-[var(--border-soft)] bg-[var(--surface)] hover:bg-[var(--bg-input)]'
                        )}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {form.productId && (() => {
                const p = products.find(x => x.id === form.productId);
                return p ? (
                  <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-xl px-3.5 py-2 font-mono text-[11px] text-[var(--ink)] font-bold uppercase shadow-xs">
                    {p.code} · {p.name} {p.color} {p.size}
                  </div>
                ) : null;
              })()}
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold uppercase tracking-wider opacity-70">Ubicación *</label>
                <select value={form.locationId} onChange={e => setForm(f => ({ ...f, locationId: e.target.value }))}
                  className="input-technical cursor-pointer" required>
                  <option value="">Seleccionar...</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.type})</option>)}
                </select>
              </div>
              <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-xl px-4 py-3 flex justify-between items-center shadow-xs">
                <span className="font-mono text-[10px] opacity-60 uppercase font-bold">Stock actual en ubicación</span>
                <span className="font-mono font-black text-xl text-blue-600 dark:text-blue-400">{currentStock}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold uppercase tracking-wider opacity-70">Nueva cantidad *</label>
                <input type="number" min="0" value={form.newQuantity} onChange={e => setForm(f => ({ ...f, newQuantity: parseInt(e.target.value) || 0 }))}
                  className="input-technical text-center text-sm font-bold" required />
                {form.newQuantity !== currentStock && (
                  <div className={`font-mono text-[10px] font-bold text-center ${form.newQuantity > currentStock ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600'}`}>
                    Diferencia: {form.newQuantity > currentStock ? '+' : ''}{form.newQuantity - currentStock} unidades
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold uppercase tracking-wider opacity-70">Motivo *</label>
                <select value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value as AdjustmentReason }))}
                  className="input-technical cursor-pointer">
                  {(Object.entries(REASON_LABEL) as [AdjustmentReason, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold uppercase tracking-wider opacity-70">Notas</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  className="input-technical resize-none" placeholder="Opcional..." />
              </div>
              {error && <p className="font-mono text-[10px] text-red-600 font-bold">{error}</p>}
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-xs font-bold font-mono uppercase shadow-xs transition-all cursor-pointer">SOLICITAR AJUSTE</button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-[var(--border-soft)] rounded-xl py-2.5 text-xs font-bold font-mono uppercase hover:bg-[var(--surface)] transition-all cursor-pointer">CANCELAR</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-modal)] border border-[var(--border-soft)] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="border-b border-[var(--border-soft)] px-5 py-3.5 flex justify-between items-center shrink-0 bg-[var(--surface)]">
              <div className="flex items-center gap-3">
                {bulkMode === 'reception'
                  ? <PackagePlus size={16} className="text-emerald-600 dark:text-emerald-400" />
                  : <SlidersHorizontal size={16} className="text-blue-600 dark:text-blue-400" />}
                <span className="font-mono font-bold text-xs uppercase tracking-wider">
                  {bulkMode === 'reception' ? 'INGRESO MASIVO AL ALMACÉN' : 'AJUSTE MASIVO DE INVENTARIO'}
                </span>
              </div>
              <button onClick={() => setShowBulkModal(false)} className="w-7 h-7 rounded-lg flex items-center justify-center font-mono text-sm opacity-60 hover:opacity-100 cursor-pointer">✕</button>
            </div>

            <div className="p-5 flex flex-col gap-4 overflow-y-auto">
              <div className={`rounded-xl border px-3.5 py-2.5 text-[10px] font-mono leading-relaxed ${bulkMode === 'reception' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400'}`}>
                {bulkMode === 'reception'
                  ? 'INGRESO: suma las unidades al stock existente. Genera una transacción de RECEPCIÓN visible en el historial.'
                  : 'AJUSTE: queda como solicitud PENDIENTE hasta que ADMIN_GENERAL la apruebe. Útil para conteos físicos y correcciones.'}
              </div>

              {/* Instructions */}
              <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-xl p-4 flex flex-col gap-2 shadow-xs">
                <p className="font-mono text-[9px] font-bold uppercase tracking-wider opacity-70">
                  Columnas del archivo: {bulkMode === 'reception'
                    ? 'codigo | cantidad_a_ingresar | ubicacion | notas'
                    : 'codigo | nueva_cantidad | motivo | ubicacion | notas'}
                </p>
                <p className="font-mono text-[10px] opacity-60 leading-relaxed">
                  La plantilla incluye todos los productos del catálogo con su stock actual.<br />
                  {bulkMode === 'adjust' && 'Motivos: COUNT, DAMAGE, LOSS, RETURN, OTHER (o en español). '}
                  Deja vacía la cantidad si no deseas modificar ese producto.
                </p>
                <button onClick={() => downloadTemplate(bulkMode)}
                  className="self-start flex items-center gap-1.5 border border-[var(--border-soft)] rounded-lg px-3 py-1.5 text-[10px] font-mono font-bold uppercase bg-[var(--bg-card)] hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-all mt-1 cursor-pointer">
                  <Download size={12} /> Descargar plantilla Excel
                </button>
              </div>

              {/* File input */}
              {!bulkDone && (
                <>
                  <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleBulkFile} />
                  <button onClick={() => fileRef.current?.click()}
                    className="w-full border-2 border-dashed border-[var(--border-soft)] rounded-2xl py-8 flex flex-col items-center gap-2 hover:border-blue-500 hover:bg-[var(--surface)] transition-all cursor-pointer bg-[var(--surface-alt)]">
                    <Upload size={24} className="opacity-40 text-blue-500" />
                    <span className="font-mono text-xs uppercase tracking-wider font-semibold opacity-70">Haz clic para seleccionar el archivo Excel (.xlsx)</span>
                  </button>
                </>
              )}

              {/* Preview */}
              {bulkRows.length > 0 && !bulkDone && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-wider opacity-60 font-bold">
                      {bulkRows.filter(r => !r.error).length} válidas · {bulkRows.filter(r => r.error).length} con errores
                    </span>
                    <button onClick={() => fileRef.current?.click()}
                      className="font-mono text-[10px] uppercase tracking-wider underline opacity-60 hover:opacity-100 cursor-pointer">
                      Cambiar archivo
                    </button>
                  </div>

                  {bulkImpact.validCount > 0 && (
                    <div className="border border-[var(--border-soft)] rounded-2xl bg-[var(--surface)] p-4 flex flex-col gap-2.5 shadow-xs">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider opacity-70">Resumen de impacto</span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="flex flex-col bg-[var(--bg-card)] p-2.5 rounded-xl border border-[var(--border-soft)]/50">
                          <span className="font-mono text-[9px] opacity-60 uppercase font-bold">Filas a procesar</span>
                          <span className="font-mono font-black text-xl">{bulkImpact.validCount}</span>
                        </div>
                        <div className="flex flex-col bg-[var(--bg-card)] p-2.5 rounded-xl border border-[var(--border-soft)]/50">
                          <span className="font-mono text-[9px] opacity-60 uppercase font-bold">
                            {bulkMode === 'reception' ? 'Unidades a ingresar' : 'Impacto neto en stock'}
                          </span>
                          <span className={`font-mono font-black text-xl ${bulkImpact.netDiff > 0 ? 'text-emerald-600 dark:text-emerald-400' : bulkImpact.netDiff < 0 ? 'text-red-600' : ''}`}>
                            {bulkImpact.netDiff > 0 ? `+${bulkImpact.netDiff}` : bulkImpact.netDiff}
                          </span>
                        </div>
                        {bulkMode === 'adjust' && (
                          <>
                            <div className="flex flex-col bg-[var(--bg-card)] p-2.5 rounded-xl border border-[var(--border-soft)]/50">
                              <span className="font-mono text-[9px] opacity-60 uppercase font-bold">Suben stock</span>
                              <span className="font-mono font-black text-xl text-emerald-600 dark:text-emerald-400">{bulkImpact.increases}</span>
                            </div>
                            <div className="flex flex-col bg-[var(--bg-card)] p-2.5 rounded-xl border border-[var(--border-soft)]/50">
                              <span className="font-mono text-[9px] opacity-60 uppercase font-bold">Bajan stock</span>
                              <span className="font-mono font-black text-xl text-red-600">{bulkImpact.decreases}</span>
                            </div>
                          </>
                        )}
                      </div>
                      {bulkMode === 'adjust' && (
                        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[var(--border-soft)]">
                          {(Object.keys(REASON_LABEL) as AdjustmentReason[]).filter(r => bulkImpact.byReason[r] > 0).map(r => (
                            <span key={r} className={`font-mono text-[9px] font-bold border rounded-full px-2.5 py-0.5 ${REASON_COLOR[r]}`}>
                              {REASON_LABEL[r]}: {bulkImpact.byReason[r]}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="overflow-x-auto rounded-xl border border-[var(--border-soft)]">
                    <table className="w-full text-[10px] font-mono border-collapse">
                      <thead>
                        <tr className="border-b border-[var(--border-soft)] bg-[var(--bg-sidebar)]">
                          <th className="text-left py-2 px-2.5 opacity-60 font-bold uppercase tracking-wider w-8">#</th>
                          <th className="text-left py-2 px-2.5 opacity-60 font-bold uppercase tracking-wider">Código</th>
                          <th className="text-right py-2 px-2.5 opacity-60 font-bold uppercase tracking-wider">Stock actual</th>
                          <th className="text-right py-2 px-2.5 opacity-60 font-bold uppercase tracking-wider">
                            {bulkMode === 'reception' ? 'A ingresar' : 'Nueva cant.'}
                          </th>
                          {bulkMode === 'reception' && (
                            <th className="text-right py-2 px-2.5 opacity-60 font-bold uppercase tracking-wider">Stock final</th>
                          )}
                          {bulkMode === 'adjust' && (
                            <th className="text-left py-2 px-2.5 opacity-60 font-bold uppercase tracking-wider">Motivo</th>
                          )}
                          <th className="text-left py-2 px-2.5 opacity-60 font-bold uppercase tracking-wider">Ubicación</th>
                          <th className="text-left py-2 px-2.5 opacity-60 font-bold uppercase tracking-wider">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkRows.map(r => (
                          <tr key={r.line} className={`border-b border-[var(--border-soft)]/40 ${r.error ? 'bg-red-500/10' : 'bg-[var(--surface)]'}`}>
                            <td className="py-2 px-2.5 opacity-40">{r.line}</td>
                            <td className="py-2 px-2.5 font-bold">{r.code}</td>
                            <td className="py-2 px-2.5 text-right opacity-60">{r.stockActual}</td>
                            <td className={`py-2 px-2.5 text-right font-bold ${!r.error && bulkMode === 'reception' ? 'text-emerald-600' : ''}`}>
                              {bulkMode === 'reception' ? `+${r.qty}` : r.qty}
                            </td>
                            {bulkMode === 'reception' && (
                              <td className="py-2 px-2.5 text-right font-bold">
                                {!r.error ? r.stockActual + r.qty : '-'}
                              </td>
                            )}
                            {bulkMode === 'adjust' && (
                              <td className="py-2 px-2.5 opacity-70">{REASON_LABEL[r.reason]}</td>
                            )}
                            <td className="py-2 px-2.5 opacity-70 max-w-[140px] truncate">{r.locationName || '-'}</td>
                            <td className="py-2 px-2.5">
                              {r.error
                                ? <span className="flex items-center gap-1 text-red-600"><XCircle size={12} />{r.error}</span>
                                : <span className="flex items-center gap-1 text-emerald-600 font-bold"><CheckCircle size={12} />OK</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {bulkRows.some(r => r.error) && (
                    <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3.5 py-2.5">
                      <AlertCircle size={15} className="text-amber-600 mt-0.5 shrink-0" />
                      <p className="font-mono text-[10px] text-amber-700 dark:text-amber-400">Las filas con errores serán ignoradas. Solo se procesarán las filas válidas.</p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button onClick={confirmBulk} disabled={bulkRows.every(r => !!r.error)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-xs font-bold font-mono uppercase shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                      {bulkMode === 'reception'
                        ? `INGRESAR ${bulkRows.filter(r => !r.error).length} PRODUCTOS`
                        : `SOLICITAR ${bulkRows.filter(r => !r.error).length} AJUSTES`}
                    </button>
                    <button onClick={() => setShowBulkModal(false)}
                      className="flex-1 border border-[var(--border-soft)] rounded-xl py-2.5 text-xs font-bold font-mono uppercase hover:bg-[var(--surface)] transition-all cursor-pointer">
                      CANCELAR
                    </button>
                  </div>
                </>
              )}

              {/* Success */}
              {bulkDone && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <CheckCircle size={40} className="text-emerald-600" />
                  <p className="font-mono font-bold text-sm uppercase tracking-wide">
                    {bulkMode === 'reception' ? `${bulkApplied} productos ingresados al almacén` : `${bulkApplied} ajustes enviados a aprobación`}
                  </p>
                  <button onClick={() => setShowBulkModal(false)}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 py-2.5 text-xs font-bold font-mono uppercase shadow-xs transition-all mt-2 cursor-pointer">
                    CERRAR
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectingId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-modal)] border border-red-500/30 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="border-b border-red-500/20 bg-red-500/10 px-5 py-3.5 flex justify-between items-center text-red-600">
              <span className="font-mono font-bold text-xs uppercase tracking-wider">RECHAZAR AJUSTE</span>
              <button onClick={() => setRejectingId(null)} className="w-7 h-7 rounded-lg flex items-center justify-center opacity-60 hover:opacity-100 cursor-pointer">
                <XIcon size={15} />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold uppercase tracking-wider opacity-70">Motivo del rechazo (opcional)</label>
                <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3}
                  className="input-technical resize-none"
                  placeholder="Ej: cantidad no coincide con el conteo físico" />
              </div>
              <div className="flex gap-2">
                <button onClick={confirmReject} disabled={reviewBusy === rejectingId}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2.5 text-xs font-bold font-mono uppercase transition-all disabled:opacity-40 shadow-xs cursor-pointer">
                  CONFIRMAR RECHAZO
                </button>
                <button onClick={() => setRejectingId(null)} className="flex-1 border border-[var(--border-soft)] rounded-xl py-2.5 text-xs font-bold font-mono uppercase hover:bg-[var(--surface)] cursor-pointer">
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
