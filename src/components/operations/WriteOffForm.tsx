import React, { useState, useRef, useMemo } from 'react';
import { Minus, Camera, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAppContext } from '../../store/AppContext';
import { FamilyQRModal } from '../FamilyQRModal';
import { CascadeProductSelector } from './CascadeProductSelector';
import {
  LineItem,
  nextGuideNumber,
  resizeImage,
  WRITEOFF_REASONS,
} from './constants';
import { FormGroup } from './ui';

export const WriteOffForm: React.FC = () => {
  const { products, locations, addTransaction, stockLevels, activeBrand, currentUser, contacts, transactions } = useAppContext();

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [fromLocation, setFromLocation] = useState('');
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [scanningForKey, setScanningForKey] = useState<string | null>(null);

  // Devolución al proveedor
  const [isReturn, setIsReturn] = useState(false);
  const [returnContactId, setReturnContactId] = useState('');
  const [returnTxRef, setReturnTxRef] = useState('');

  const suppliers = contacts.filter(c => c.type === 'SUPPLIER');
  const receptionRefs = useMemo(() => {
    const seen = new Set<string>();
    return transactions
      .filter(tx => tx.type === 'RECEPTION' && tx.status !== 'CANCELLED' && tx.reference?.trim())
      .filter(tx => { const k = tx.reference!.trim(); if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 50);
  }, [transactions]);

  // Modal de productos de recepción
  const [showReceptionModal, setShowReceptionModal] = useState(false);
  const [receptionModalRef, setReceptionModalRef] = useState('');
  const [defectQtys, setDefectQtys] = useState<Record<string, string>>({});
  const [modalFilterName, setModalFilterName] = useState<string | null>(null);
  const [modalFilterColor, setModalFilterColor] = useState<string | null>(null);

  const receptionModalItems = useMemo(() => {
    if (!receptionModalRef) return [];
    const txs = transactions.filter(tx =>
      tx.type === 'RECEPTION' &&
      tx.status !== 'CANCELLED' &&
      tx.reference?.trim() === receptionModalRef
    );
    const map = new Map<string, number>();
    txs.forEach(tx => map.set(tx.productId, (map.get(tx.productId) ?? 0) + tx.quantity));
    return Array.from(map.entries()).map(([productId, qty]) => ({
      productId,
      qty,
      product: products.find(p => p.id === productId),
    }));
  }, [receptionModalRef, transactions, products]);

  const openReceptionModal = (ref: string) => {
    setReturnTxRef(ref);
    if (ref) {
      setReceptionModalRef(ref);
      setDefectQtys({});
      setModalFilterName(null);
      setModalFilterColor(null);
      setShowReceptionModal(true);
    } else {
      setReceptionModalRef('');
    }
  };

  const confirmReceptionDefects = () => {
    const toAdd: LineItem[] = [];
    receptionModalItems.forEach(({ productId, qty }) => {
      const raw = defectQtys[productId];
      const n = parseInt(raw, 10);
      if (!n || n <= 0) return;
      const capped = Math.min(n, qty);
      toAdd.push({ key: `${productId}-${Date.now()}-${Math.random()}`, productId, qty: String(capped) });
    });
    if (toAdd.length > 0) {
      setLineItems(prev => {
        const existing = prev.filter(l => !toAdd.some(a => a.productId === l.productId));
        return [...existing, ...toAdd];
      });
    }
    setShowReceptionModal(false);
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const resized = await resizeImage(file);
    setPhoto(resized);
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (lineItems.length === 0) errs.lines = 'AGREGA_AL_MENOS_UN_PRODUCTO';
    if (!fromLocation) errs.fromLocation = 'SELECCIONE_UBICACIÓN_ORIGEN';
    if (!reason) errs.reason = 'SELECCIONE_MOTIVO_DE_BAJA';
    if (reason === 'Otro motivo' && !customReason.trim()) errs.customReason = 'DESCRIBE_EL_MOTIVO';
    if (isReturn && !returnContactId) errs.returnContact = 'SELECCIONE_PROVEEDOR';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const effectiveReason = reason === 'Otro motivo' ? customReason.trim() : reason;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!validate()) return;
    setShowPreview(true);
  };

  const executeWriteOff = async () => {
    setShowPreview(false);
    const guideNumber = await nextGuideNumber('DISPATCH', activeBrand);
    const prefix = isReturn ? '[BAJA/DEV]' : '[BAJA]';
    const refSuffix = isReturn && returnTxRef ? ` · REF:${returnTxRef}` : '';
    const reference = `${prefix} ${effectiveReason}${notes.trim() ? ' · ' + notes.trim() : ''}${refSuffix}`;
    try {
      for (const item of lineItems) {
        await addTransaction({
          type: 'DISPATCH',
          productId: item.productId,
          quantity: parseInt(item.qty, 10),
          fromLocationId: fromLocation,
          reference,
          contactId: isReturn ? returnContactId : undefined,
          user: currentUser.username,
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'ERROR AL REGISTRAR' });
      return;
    }

    setLineItems([]);
    setFromLocation('');
    setReason('');
    setCustomReason('');
    setNotes('');
    setPhoto(null);
    setIsReturn(false);
    setReturnContactId('');
    setReturnTxRef('');
    setErrors({});
    if (photoInputRef.current) photoInputRef.current.value = '';

    setFeedback({ type: 'success', message: `¡BAJA REGISTRADA! GUÍA ${guideNumber}` });
    setTimeout(() => setFeedback(null), 6000);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 relative z-10">
      {feedback && (
        <div className={cn(
          'p-3.5 rounded-xl border font-bold font-mono text-xs uppercase tracking-wider shadow-sm',
          feedback.type === 'success' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/15 border-red-500/30 text-red-600'
        )}>
          {feedback.message}
        </div>
      )}

      {/* Productos */}
      <div className="flex flex-col gap-3">
        <label className="font-mono text-[9px] font-bold tracking-[0.2em] uppercase opacity-70">
          AGREGAR PRODUCTOS A DAR DE BAJA
        </label>
        <div className="border border-red-500/20 bg-red-500/5 rounded-2xl p-4 shadow-xs">
          <CascadeProductSelector
            products={products}
            onAdd={(item) => setLineItems(prev => [...prev, item])}
            onScanClick={() => setScanningForKey('matrix')}
            stockLevels={stockLevels}
            fromLocation={fromLocation}
            opType="DISPATCH"
          />
        </div>
        {errors.lines && (
          <span className="font-mono text-[9px] font-bold text-red-600 uppercase border border-red-500/20 px-2 py-0.5 bg-red-500/10 rounded-md w-fit tracking-wider">
            {errors.lines}
          </span>
        )}
        {lineItems.length > 0 && (
          <div className="flex flex-col gap-0 border border-red-500/25 rounded-2xl overflow-hidden shadow-xs">
            <div className="bg-red-600 text-white px-4 py-2 font-mono text-[9px] font-bold uppercase tracking-wider flex justify-between items-center">
              <span>PRENDAS A DAR DE BAJA</span>
              <span className="opacity-80">{lineItems.length} LÍNEAS · {lineItems.reduce((s, l) => s + (parseInt(l.qty) || 0), 0)} UND</span>
            </div>
            {lineItems.map((item, idx) => {
              const prod = products.find(p => p.id === item.productId);
              return (
                <div key={item.key} className={cn(
                  'flex items-center gap-3 px-4 py-2.5 font-mono text-[11px] border-b border-red-500/15 last:border-0 transition-colors',
                  idx % 2 === 0 ? 'bg-[var(--surface)]' : 'bg-red-500/5'
                )}>
                  <span className="opacity-40 text-[9px] w-4 shrink-0 font-bold">{idx + 1}</span>
                  <span className="opacity-60 text-[9px] font-bold shrink-0">{prod?.code}</span>
                  <span className="font-bold flex-1 truncate uppercase">{prod?.name} {prod?.color} {prod?.size}</span>
                  <span className="font-black text-sm shrink-0 px-2 py-0.5 rounded-md bg-red-500/10 text-red-600 dark:text-red-400">{item.qty} u</span>
                  <button type="button" onClick={() => setLineItems(prev => prev.filter(l => l.key !== item.key))}
                    className="shrink-0 text-red-500 hover:text-red-700 transition-colors p-1 rounded-md hover:bg-red-500/10 cursor-pointer"
                    title="Quitar prenda"
                  >
                    <Minus size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ubicación origen + Motivo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormGroup label="UBICACIÓN ORIGEN (ALMACÉN)" error={errors.fromLocation}>
          <select
            value={fromLocation}
            onChange={e => { setFromLocation(e.target.value); setErrors(prev => ({ ...prev, fromLocation: '' })); }}
            className={cn('input-technical', errors.fromLocation && 'border-red-600 bg-red-500/10')}
          >
            <option value="">Seleccione Almacén...</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </FormGroup>

        <FormGroup label="MOTIVO DE BAJA" error={errors.reason}>
          <select
            value={reason}
            onChange={e => { setReason(e.target.value); setErrors(prev => ({ ...prev, reason: '', customReason: '' })); }}
            className={cn('input-technical', errors.reason && 'border-red-600 bg-red-500/10')}
          >
            <option value="">- Seleccione motivo -</option>
            {WRITEOFF_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </FormGroup>

        {reason === 'Otro motivo' && (
          <FormGroup label="DESCRIBE EL MOTIVO" error={errors.customReason} className="md:col-span-2">
            <input
              type="text"
              value={customReason}
              onChange={e => { setCustomReason(e.target.value); setErrors(prev => ({ ...prev, customReason: '' })); }}
              className={cn('input-technical', errors.customReason && 'border-red-600 bg-red-500/10')}
              placeholder="EJ: PRENDAS VENCIDAS POR PLAZO DE ALMACENAMIENTO"
            />
          </FormGroup>
        )}

        <FormGroup label="OBSERVACIONES ADICIONALES (OPCIONAL)" className="md:col-span-2">
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="input-technical"
            placeholder="EJ: LOTE 2024-03, DETECTADO EN REVISIÓN MENSUAL"
          />
        </FormGroup>
      </div>

      {/* Devolución al proveedor */}
      <div className={cn(
        'border rounded-2xl p-4 md:p-5 flex flex-col gap-4 transition-all shadow-xs',
        isReturn ? 'border-orange-500/30 bg-orange-500/5' : 'border-[var(--border-soft)] bg-[var(--surface)]'
      )}>
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <button
            type="button"
            onClick={() => { setIsReturn(v => !v); setReturnContactId(''); setReturnTxRef(''); setErrors(prev => ({ ...prev, returnContact: '' })); }}
            className={cn(
              'w-11 h-6 rounded-full relative transition-colors shrink-0 p-0.5 cursor-pointer',
              isReturn ? 'bg-orange-500' : 'bg-[var(--border-soft)]'
            )}
          >
            <span className={cn('block w-5 h-5 rounded-full bg-white shadow-xs transition-transform', isReturn ? 'translate-x-5' : 'translate-x-0')} />
          </button>
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
            ¿Aplica devolución al proveedor?
          </span>
        </label>

        {isReturn && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-orange-500/20">
            <FormGroup label="PROVEEDOR" error={errors.returnContact}>
              <select
                value={returnContactId}
                onChange={e => { setReturnContactId(e.target.value); setErrors(prev => ({ ...prev, returnContact: '' })); }}
                className={cn('input-technical', errors.returnContact && 'border-red-600 bg-red-500/10')}
              >
                <option value="">- Seleccione proveedor -</option>
                {suppliers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormGroup>

            <FormGroup label="VINCULAR A RECEPCIÓN (OPCIONAL)">
              <div className="flex gap-2">
                <select
                  value={returnTxRef}
                  onChange={e => openReceptionModal(e.target.value)}
                  className="input-technical flex-1"
                >
                  <option value="">- Sin referencia -</option>
                  {receptionRefs.map(tx => (
                    <option key={tx.id} value={tx.reference!}>
                      {tx.reference} · {tx.date.slice(0, 10)}
                    </option>
                  ))}
                </select>
                {returnTxRef && (
                  <button
                    type="button"
                    onClick={() => { setReceptionModalRef(returnTxRef); setDefectQtys({}); setShowReceptionModal(true); }}
                    className="shrink-0 border border-orange-500/30 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 px-3.5 font-mono text-[9px] font-bold uppercase hover:bg-orange-500/20 transition-colors cursor-pointer"
                  >
                    VER PRENDAS
                  </button>
                )}
              </div>
            </FormGroup>

            <p className="md:col-span-2 font-mono text-[10px] text-orange-600 dark:text-orange-400 font-semibold tracking-wide border border-orange-500/20 bg-orange-500/10 p-3 rounded-xl">
              SE REGISTRARÁ COMO [BAJA/DEV] — DESCUENTA INVENTARIO Y QUEDA VINCULADO AL PROVEEDOR SELECCIONADO
            </p>
          </div>
        )}
      </div>

      {/* Foto evidencia */}
      <FormGroup label="EVIDENCIA FOTOGRÁFICA (RECOMENDADO)">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => photoInputRef.current?.click()}
            className="flex items-center gap-2 border border-[var(--border-soft)] bg-[var(--surface)] hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-all px-3.5 py-2 font-mono text-[10px] font-bold uppercase rounded-xl cursor-pointer shadow-xs">
            <Camera size={14} />
            {photo ? 'CAMBIAR FOTO' : 'CAPTURAR / ADJUNTAR'}
          </button>
          {photo && (
            <button type="button" onClick={() => { setPhoto(null); if (photoInputRef.current) photoInputRef.current.value = ''; }}
              className="text-red-500 hover:text-red-700 transition-colors p-1 cursor-pointer">
              <X size={15} />
            </button>
          )}
        </div>
        <input ref={photoInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="hidden" />
        {photo && (
          <div className="mt-2 border border-[var(--border-soft)] bg-[var(--bg-card)] p-1.5 rounded-xl w-fit shadow-xs">
            <img src={photo} alt="evidencia" className="max-h-28 max-w-full rounded-lg object-contain" />
          </div>
        )}
      </FormGroup>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mt-2 pt-2 border-t border-[var(--border-soft)]">
        <div className="font-mono text-[10px] opacity-60 uppercase tracking-wider font-bold">
          {lineItems.length} {lineItems.length === 1 ? 'LÍNEA' : 'LÍNEAS'} · {lineItems.reduce((s, l) => s + (parseInt(l.qty) || 0), 0)} UND TOTAL
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white px-8 py-3 text-[11px] font-mono tracking-widest font-bold transition-all rounded-xl shadow-xs hover:shadow-md cursor-pointer uppercase active:scale-[0.98]"
        >
          REGISTRAR BAJA
        </button>
      </div>

      {/* Preview modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-modal)] border border-red-500/30 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-red-600 text-white px-5 py-3.5 flex justify-between items-center rounded-t-2xl">
              <div>
                <div className="font-mono text-[9px] opacity-80 uppercase tracking-widest">CONFIRMAR BAJA / MERMA</div>
                <div className="font-mono font-black text-sm uppercase tracking-widest">BAJA DE INVENTARIO</div>
              </div>
              <button onClick={() => setShowPreview(false)} className="w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs opacity-80 hover:opacity-100 hover:bg-white/10 transition-colors cursor-pointer">✕</button>
            </div>
            <div className="p-5 flex flex-col gap-4 overflow-y-auto">
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3.5 font-mono text-[10px] flex flex-col gap-1.5">
                <div className="flex gap-3"><span className="opacity-50 uppercase w-24 shrink-0">Tipo</span><span className={cn('font-bold', isReturn ? 'text-orange-600' : '')}>{isReturn ? 'BAJA + DEVOLUCIÓN A PROVEEDOR' : 'BAJA / MERMA'}</span></div>
                <div className="flex gap-3"><span className="opacity-50 uppercase w-24 shrink-0">Motivo</span><span className="font-bold">{effectiveReason}</span></div>
                {notes && <div className="flex gap-3"><span className="opacity-50 uppercase w-24 shrink-0">Notas</span><span className="font-bold">{notes}</span></div>}
                <div className="flex gap-3"><span className="opacity-50 uppercase w-24 shrink-0">Almacén</span><span className="font-bold">{locations.find(l => l.id === fromLocation)?.name}</span></div>
                <div className="flex gap-3"><span className="opacity-50 uppercase w-24 shrink-0">Operador</span><span className="font-bold">{currentUser.username}</span></div>
                {isReturn && <div className="flex gap-3"><span className="opacity-50 uppercase w-24 shrink-0">Proveedor</span><span className="font-bold text-orange-600">{contacts.find(c => c.id === returnContactId)?.name}</span></div>}
                {isReturn && returnTxRef && <div className="flex gap-3"><span className="opacity-50 uppercase w-24 shrink-0">Ref. recep.</span><span className="font-bold text-orange-600">{returnTxRef}</span></div>}
              </div>
              <div className="border border-red-500/20 rounded-xl overflow-hidden shadow-xs">
                <div className="bg-red-600 text-white px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-widest">PRENDAS A DAR DE BAJA</div>
                {lineItems.map((item, i) => {
                  const prod = products.find(p => p.id === item.productId);
                  return (
                    <div key={item.key} className={`flex justify-between items-center px-3 py-2 font-mono text-[10px] ${i % 2 === 0 ? 'bg-[var(--surface)]' : ''}`}>
                      <div>
                        <span className="font-bold">{prod?.code}</span>
                        <span className="opacity-60 ml-2">{prod?.name} {prod?.color} {prod?.size}</span>
                      </div>
                      <span className="font-black text-sm ml-4">{item.qty} uds</span>
                    </div>
                  );
                })}
                <div className="flex justify-between px-3 py-2 bg-red-500/10 border-t border-red-500/20 font-mono text-[10px] font-bold">
                  <span>TOTAL A DAR DE BAJA</span>
                  <span>{lineItems.reduce((s, l) => s + (parseInt(l.qty, 10) || 0), 0)} uds</span>
                </div>
              </div>
              <p className="font-mono text-[9px] text-red-600 font-bold uppercase tracking-wider border border-red-500/20 bg-red-500/10 p-2.5 rounded-xl">
                ESTA ACCIÓN DESCUENTA EL INVENTARIO Y NO SE PUEDE REVERTIR DIRECTAMENTE.
              </p>
              <div className="flex gap-2 pt-2">
                <button onClick={executeWriteOff} className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2.5 text-xs font-bold font-mono uppercase shadow-xs transition-all cursor-pointer">
                  CONFIRMAR BAJA
                </button>
                <button onClick={() => setShowPreview(false)} className="flex-1 border border-[var(--border-soft)] rounded-xl py-2.5 text-xs font-bold font-mono uppercase hover:bg-[var(--surface)] transition-all cursor-pointer">
                  VOLVER
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: prendas de la recepción seleccionada */}
      {showReceptionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-modal)] border border-orange-500/30 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-orange-600 text-white px-5 py-3.5 flex justify-between items-center shrink-0 rounded-t-2xl">
              <div>
                <div className="font-mono text-[9px] opacity-80 uppercase tracking-widest">RECEPCIÓN VINCULADA</div>
                <div className="font-mono font-black text-sm uppercase tracking-widest truncate">{receptionModalRef}</div>
              </div>
              <button onClick={() => setShowReceptionModal(false)} className="w-7 h-7 rounded-lg flex items-center justify-center font-mono text-sm opacity-80 hover:opacity-100 hover:bg-white/10 cursor-pointer">✕</button>
            </div>

            {/* Filtros: nivel 1 — modelo, nivel 2 — color */}
            {receptionModalItems.length > 0 && (() => {
              const names = Array.from(new Set(receptionModalItems.map(i => i.product?.name ?? '').filter(Boolean)));
              const colorsForName = modalFilterName
                ? Array.from(new Set(receptionModalItems.filter(i => i.product?.name === modalFilterName).map(i => i.product?.color ?? '').filter(Boolean)))
                : [];
              return (
                <div className="px-4 pt-3 pb-2 shrink-0 border-b border-[var(--border-soft)] flex flex-col gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => { setModalFilterName(null); setModalFilterColor(null); }}
                      className={cn(
                        'px-3 py-1 rounded-lg font-mono text-[9px] font-black uppercase tracking-wider border transition-colors cursor-pointer',
                        modalFilterName === null
                          ? 'bg-orange-600 text-white border-orange-600'
                          : 'border-[var(--border-soft)] opacity-60 hover:opacity-100'
                      )}
                    >
                      TODOS ({names.length})
                    </button>
                    {names.map(name => (
                      <button
                        type="button"
                        key={name}
                        onClick={() => { setModalFilterName(name); setModalFilterColor(null); }}
                        className={cn(
                          'px-3 py-1 rounded-lg font-mono text-[9px] font-black uppercase tracking-wider border transition-colors cursor-pointer',
                          modalFilterName === name
                            ? 'bg-orange-600 text-white border-orange-600'
                            : 'border-[var(--border-soft)] opacity-60 hover:opacity-100'
                        )}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                  {modalFilterName && colorsForName.length > 1 && (
                    <div className="flex flex-wrap gap-1.5 pl-2 border-l-2 border-orange-500">
                      <button
                        type="button"
                        onClick={() => setModalFilterColor(null)}
                        className={cn(
                          'px-2 py-0.5 rounded-md font-mono text-[8px] font-bold uppercase tracking-wider border transition-colors cursor-pointer',
                          modalFilterColor === null
                            ? 'bg-orange-600 text-white border-orange-600'
                            : 'border-[var(--border-soft)] opacity-60 hover:opacity-100'
                        )}
                      >
                        TODOS LOS COLORES ({colorsForName.length})
                      </button>
                      {colorsForName.map(color => (
                        <button
                          type="button"
                          key={color}
                          onClick={() => setModalFilterColor(color)}
                          className={cn(
                            'px-2 py-0.5 rounded-md font-mono text-[8px] font-bold uppercase tracking-wider border transition-colors cursor-pointer',
                            modalFilterColor === color
                              ? 'bg-orange-600 text-white border-orange-600'
                              : 'border-[var(--border-soft)] opacity-60 hover:opacity-100'
                          )}
                        >
                          {color}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-2">
              {receptionModalItems.length === 0 ? (
                <div className="p-8 text-center font-mono text-[10px] opacity-40 uppercase">No hay productos en esta recepción</div>
              ) : (
                receptionModalItems
                  .filter(item => {
                    if (modalFilterName && item.product?.name !== modalFilterName) return false;
                    if (modalFilterColor && item.product?.color !== modalFilterColor) return false;
                    return true;
                  })
                  .map(({ productId, qty, product }) => {
                  const val = defectQtys[productId] ?? '';
                  const numVal = parseInt(val, 10);
                  const invalid = !isNaN(numVal) && (numVal < 0 || numVal > qty);
                  return (
                    <div key={productId} className="flex items-center justify-between gap-3 border border-[var(--border-soft)] rounded-xl p-3 bg-[var(--surface)] shadow-xs">
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] font-bold uppercase truncate">{product?.name ?? '-'}</div>
                        <div className="font-mono text-[9px] opacity-60">{product?.code} · {product?.color} · {product?.size}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="number"
                          min="0"
                          max={qty}
                          value={val}
                          onChange={e => setDefectQtys(prev => ({ ...prev, [productId]: e.target.value }))}
                          placeholder="0"
                          className={cn(
                            'w-16 text-center font-mono text-sm font-black border rounded-lg px-2 py-1 outline-none',
                            invalid ? 'border-red-600 bg-red-500/10 text-red-600' : 'border-orange-500/40 bg-orange-500/10'
                          )}
                        />
                        <span className="font-mono text-[9px] opacity-50 font-bold">/ {qty}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex gap-2 p-4 border-t border-[var(--border-soft)] shrink-0">
              <button
                type="button"
                onClick={confirmReceptionDefects}
                disabled={receptionModalItems.length === 0}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white rounded-xl py-2.5 text-xs font-bold font-mono uppercase shadow-xs transition-colors disabled:opacity-40 cursor-pointer"
              >
                AGREGAR DEFECTUOSAS A LA BAJA
              </button>
              <button
                type="button"
                onClick={() => setShowReceptionModal(false)}
                className="flex-1 border border-[var(--border-soft)] rounded-xl py-2.5 text-xs font-bold font-mono uppercase hover:bg-[var(--surface)] cursor-pointer"
              >
                CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}

      {scanningForKey !== null && (
        <FamilyQRModal
          products={products}
          stockLevels={stockLevels}
          fromLocation={fromLocation}
          opType="DISPATCH"
          onAdd={(items) => setLineItems(prev => [...prev, ...items])}
          onClose={() => setScanningForKey(null)}
        />
      )}
    </form>
  );
};
