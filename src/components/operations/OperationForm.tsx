import React, { useState, useRef, useEffect } from 'react';
import { Minus, Camera, X } from 'lucide-react';
import SignaturePad from 'signature_pad';
import { cn } from '../../lib/utils';
import { TransactionType } from '../../types';
import { useAppContext } from '../../store/AppContext';
import { sendOperationEmail, sendOperationToInternalRecipients, OperationType, OperationItem } from '../../lib/emailService';
import { uploadSignature } from '../../lib/signatureStorage';
import { FamilyQRModal } from '../FamilyQRModal';
import { CascadeProductSelector } from './CascadeProductSelector';
import { GuideModal } from './GuideModal';
import {
  LineItem,
  OperationGuide,
  nextGuideNumber,
  resizeImage,
  TYPE_META,
} from './constants';
import { FormGroup, PreviewRow } from './ui';

export const OperationForm: React.FC<{ type: TransactionType }> = ({ type }) => {
  const { products, locations, addTransaction, stockLevels, activeBrand, contacts, currentUser, users } = useAppContext();

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [reference, setReference] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [contactId, setContactId] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext('2d')?.scale(ratio, ratio);
    const pad = new SignaturePad(canvas);
    padRef.current = pad;
    pad.addEventListener('beginStroke', () => setErrors(prev => ({ ...prev, signature: '' })));
    return () => { pad.off(); padRef.current = null; };
  }, []);

  const [scanningForKey, setScanningForKey] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lineErrors, setLineErrors] = useState<Record<string, { productId?: string; qty?: string }>>({});
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [guide, setGuide] = useState<OperationGuide | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [pendingSig, setPendingSig] = useState<string | undefined>(undefined);

  const addLineItems = (items: LineItem[]) =>
    setLineItems(prev => [...prev, ...items]);

  const removeLineItem = (key: string) =>
    setLineItems(prev => prev.filter(l => l.key !== key));

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const resized = await resizeImage(file);
    setPhoto(resized);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    const newLineErrors: Record<string, { productId?: string; qty?: string }> = {};
    let hasLineError = false;

    if (lineItems.length === 0) {
      newErrors.lines = 'AGREGA_AL_MENOS_UN_PRODUCTO';
    }

    for (const item of lineItems) {
      const errs: { productId?: string; qty?: string } = {};
      const qty = parseInt(item.qty, 10);
      if (!item.qty || isNaN(qty) || qty <= 0) {
        errs.qty = 'CANTIDAD_INVALIDA';
      } else if ((type === 'DISPATCH' || type === 'TRANSFER') && item.productId && fromLocation) {
        const avail = stockLevels.filter(s => s.productId === item.productId && s.locationId === fromLocation).reduce((sum, s) => sum + s.quantity, 0);
        if (avail === 0) errs.productId = 'SIN_STOCK_EN_ORIGEN';
        else if (qty > avail) errs.qty = 'CANTIDAD_EXCEDE_STOCK';
      }
      if (Object.keys(errs).length) { newLineErrors[item.key] = errs; hasLineError = true; }
    }

    if (type === 'RECEPTION' && !toLocation) newErrors.toLocation = 'SELECCIONE_DESTINO';
    if (type === 'DISPATCH' && !fromLocation) newErrors.fromLocation = 'SELECCIONE_ORIGEN';
    if (type === 'TRANSFER') {
      if (!fromLocation) newErrors.fromLocation = 'SELECCIONE_ORIGEN';
      if (!toLocation) newErrors.toLocation = 'SELECCIONE_DESTINO';
      if (fromLocation && toLocation && fromLocation === toLocation) newErrors.toLocation = 'DESTINO_DEBE_SER_DIFERENTE';
    }
    if (!reference.trim()) newErrors.reference = 'REFERENCIA_OBLIGATORIA';
    if ((type === 'RECEPTION' || type === 'DISPATCH') && (!padRef.current || padRef.current.isEmpty())) {
      newErrors.signature = 'FIRMA_REQUERIDA';
    }

    setErrors(newErrors);
    setLineErrors(newLineErrors);
    return !hasLineError && Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!validate()) return;
    const sigData = (type === 'RECEPTION' || type === 'DISPATCH') && padRef.current && !padRef.current.isEmpty()
      ? padRef.current.toDataURL()
      : undefined;
    setPendingSig(sigData);
    setShowPreview(true);
  };

  const confirmPreview = () => {
    setShowPreview(false);
    executeTransactions(pendingSig);
  };

  const executeTransactions = async (sigData: string | undefined) => {
    const guideNumber = await nextGuideNumber(type, activeBrand);
    const guideItems: OperationItem[] = [];

    const storedSig = sigData ? await uploadSignature(sigData) : undefined;

    try {
      for (const item of lineItems) {
        await addTransaction({
          type,
          productId: item.productId,
          quantity: parseInt(item.qty, 10),
          fromLocationId: type !== 'RECEPTION' ? fromLocation || undefined : undefined,
          toLocationId: type !== 'DISPATCH' ? toLocation || undefined : undefined,
          reference,
          user: currentUser.username,
          contactId: contactId || undefined,
          signature: storedSig,
          serialNumber: activeBrand === 'BOX_PRIME' ? serialNumber || undefined : undefined,
        });
        const product = products.find(p => p.id === item.productId);
        guideItems.push({
          productName: [product?.name, product?.color, product?.size].filter(Boolean).join(' · ') || item.productId,
          productCode: product?.code ?? '',
          quantity: parseInt(item.qty, 10),
          serialNumber: activeBrand === 'BOX_PRIME' ? serialNumber || undefined : undefined,
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'ERROR AL REGISTRAR' });
      return;
    }

    const fromLoc = locations.find(l => l.id === fromLocation);
    const toLoc = locations.find(l => l.id === toLocation);
    const contact = contacts.find(c => c.id === contactId);
    const now = new Date();
    const dateStr = now.toLocaleString('es-PE', { timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short' });

    setGuide({
      number: guideNumber,
      type,
      date: dateStr,
      operator: currentUser.username,
      brand: activeBrand,
      items: guideItems,
      fromLocation: fromLoc?.name,
      toLocation: toLoc?.name,
      reference,
      contact: contact?.name,
      signature: sigData,
      photo: photo ?? undefined,
    });

    // Reset
    setLineItems([]);
    setFromLocation('');
    setToLocation('');
    setReference('');
    setSerialNumber('');
    setContactId('');
    setPhoto(null);
    setErrors({});
    setLineErrors({});
    padRef.current?.clear();
    if (photoInputRef.current) photoInputRef.current.value = '';

    const emailPayload = {
      brand: activeBrand,
      operationType: type as OperationType,
      reference,
      date: dateStr,
      operator: currentUser.username,
      items: guideItems,
      fromLocation: fromLoc?.name,
      toLocation: toLoc?.name,
      contact: contact?.name,
      signature: sigData,
      photo: photo ?? undefined,
    };

    const userRecord = users.find(u => u.id === currentUser.id);
    const operatorEmail = (userRecord as any)?.emailPersonal || (userRecord as any)?.email;
    if (operatorEmail) {
      setFeedback({ type: 'success', message: '¡OPERACIÓN REGISTRADA! ENVIANDO COMPROBANTE...' });
      sendOperationEmail({ toEmail: operatorEmail, toName: currentUser.username, ...emailPayload })
        .then(() => setFeedback({ type: 'success', message: `¡REGISTRADA! COMPROBANTE → ${operatorEmail}` }))
        .catch((err) => setFeedback({ type: 'success', message: `¡OPERACIÓN REGISTRADA! (SIN EMAIL: ${err instanceof Error ? err.message : 'ERROR DESCONOCIDO'})` }));
    } else {
      setFeedback({ type: 'success', message: '¡OPERACIÓN REGISTRADA CORRECTAMENTE!' });
    }
    setTimeout(() => setFeedback(null), 6000);

    if (contact?.email && (type === 'RECEPTION' || type === 'DISPATCH')) {
      sendOperationEmail({ toEmail: contact.email, toName: contact.name, ...emailPayload }).catch(() => {});
    }

    sendOperationToInternalRecipients(emailPayload).catch((err) => console.error('send-email (internal recipients) failed:', err));
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

      {/* -- SELECTOR DE PRODUCTOS -- */}
      <div className="flex flex-col gap-3">
        <label className="font-mono text-[9px] font-bold tracking-[0.2em] uppercase opacity-70">
          AGREGAR PRODUCTOS
        </label>
        <div className="border border-[var(--border-soft)] bg-[var(--surface)] rounded-2xl p-4 shadow-xs">
          <CascadeProductSelector
            products={products}
            onAdd={(item) => addLineItems([item])}
            onScanClick={() => setScanningForKey('matrix')}
            stockLevels={stockLevels}
            fromLocation={fromLocation}
            opType={type}
          />
        </div>

        {errors.lines && (
          <span className="font-mono text-[9px] font-bold text-red-600 uppercase border border-red-500/20 px-2 py-0.5 bg-red-500/10 rounded-md w-fit tracking-wider">
            {errors.lines}
          </span>
        )}

        {/* Lista de líneas confirmadas */}
        {lineItems.length > 0 && (
          <div className="flex flex-col gap-0 border border-[var(--border-soft)] rounded-2xl overflow-hidden shadow-xs">
            <div className="bg-[var(--ink)] text-[var(--ink-inv)] px-4 py-2 font-mono text-[9px] font-bold uppercase tracking-wider flex justify-between items-center">
              <span>PRODUCTOS EN OPERACIÓN</span>
              <span className="opacity-80">{lineItems.length} LÍNEAS · {lineItems.reduce((s, l) => s + (parseInt(l.qty) || 0), 0)} UND</span>
            </div>
            {lineItems.map((item, idx) => {
              const prod = products.find(p => p.id === item.productId);
              const itemErr = lineErrors[item.key];
              return (
                <div key={item.key} className={cn(
                  'flex items-center gap-3 px-4 py-2.5 font-mono text-[11px] border-b border-[var(--border-soft)] last:border-0 transition-colors',
                  idx % 2 === 0 ? 'bg-[var(--surface)]' : 'bg-[var(--bg-modal)]/60',
                  itemErr && 'bg-red-500/10 border-red-500/30'
                )}>
                  <span className="opacity-40 text-[9px] w-4 shrink-0 font-bold">{idx + 1}</span>
                  <span className="opacity-60 text-[9px] font-bold shrink-0">{prod?.code}</span>
                  <span className="font-bold flex-1 truncate uppercase">{prod?.name} {prod?.color} {prod?.size}</span>
                  <span className="font-black text-sm shrink-0 px-2 py-0.5 rounded-md bg-[var(--ink)]/5 text-[var(--ink)]">{item.qty} u</span>
                  {itemErr && (
                    <span className="text-[9px] text-red-600 font-bold shrink-0">{itemErr.qty || itemErr.productId}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeLineItem(item.key)}
                    className="shrink-0 text-red-500 hover:text-red-700 transition-colors p-1 rounded-md hover:bg-red-500/10 cursor-pointer"
                    title="Quitar ítem"
                  >
                    <Minus size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* -- LOCATIONS -- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(type === 'DISPATCH' || type === 'TRANSFER') && (
          <FormGroup label="UBICACIÓN ORIGEN" error={errors.fromLocation}>
            <select
              value={fromLocation}
              onChange={e => { setFromLocation(e.target.value); if (type === 'TRANSFER' && e.target.value === toLocation) setToLocation(''); setErrors(prev => ({ ...prev, fromLocation: '' })); }}
              className={cn('input-technical', errors.fromLocation && 'border-red-600 bg-red-500/10')}
            >
              <option value="">Seleccione Origen...</option>
              {locations.filter(l => ['ALMACEN-RESERVA GENERAL', 'ALMACEN-STOCK DESPACHO', 'ALMACEN-TEXAJO'].includes(l.name.toUpperCase())).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </FormGroup>
        )}

        {(type === 'RECEPTION' || type === 'TRANSFER') && (
          <FormGroup label="UBICACIÓN DESTINO" error={errors.toLocation}>
            <select
              value={toLocation}
              onChange={e => { setToLocation(e.target.value); setErrors(prev => ({ ...prev, toLocation: '' })); }}
              className={cn('input-technical', errors.toLocation && 'border-red-600 bg-red-500/10')}
            >
              <option value="">Seleccione Destino...</option>
              {locations.filter(l => ['ALMACEN-RESERVA GENERAL', 'ALMACEN-STOCK DESPACHO', 'ALMACEN-TEXAJO'].includes(l.name.toUpperCase())).map(l => (
                <option key={l.id} value={l.id} disabled={type === 'TRANSFER' && l.id === fromLocation}>{l.name}</option>
              ))}
            </select>
            {toLocation && (() => {
              const items = stockLevels.filter(s => s.locationId === toLocation && s.quantity > 0);
              return items.length > 0 ? (
                <div className="text-[9px] font-mono border border-[var(--border-soft)] bg-[var(--surface-alt)] rounded-xl p-2.5 mt-1.5 max-h-28 overflow-y-auto">
                  <span className="opacity-60 uppercase tracking-widest font-bold mb-1 block">EN DESTINO:</span>
                  {items.map((s, i) => (
                    <div key={i} className="flex justify-between items-center border-b border-[var(--border-soft)] last:border-0 py-0.5">
                      <span className="font-bold truncate pr-2">{products.find(p => p.id === s.productId)?.name ?? '-'}</span>
                      <span className="bg-[var(--ink)] text-[var(--ink-inv)] px-1.5 py-0.5 rounded-sm">{s.quantity}</span>
                    </div>
                  ))}
                </div>
              ) : null;
            })()}
          </FormGroup>
        )}
      </div>

      {/* -- METADATA -- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormGroup label="REFERENCIA / GUÍA" error={errors.reference}>
          <input
            type="text"
            placeholder={type === 'RECEPTION' ? 'Ej. GR-00123 / Factura' : type === 'DISPATCH' ? 'Ej. Pedido #4521' : 'Ej. Reabastecimiento rack B'}
            value={reference}
            onChange={e => { setReference(e.target.value); setErrors(prev => ({ ...prev, reference: '' })); }}
            className={cn('input-technical', errors.reference && 'border-red-600 bg-red-500/10')}
          />
        </FormGroup>

        {(type === 'RECEPTION' || type === 'DISPATCH') && (
          <FormGroup label={type === 'RECEPTION' ? 'PROVEEDOR' : 'CLIENTE'}>
            <select value={contactId} onChange={e => setContactId(e.target.value)} className="input-technical cursor-pointer">
              <option value="">— Ninguno —</option>
              {contacts
                .filter(c => type === 'RECEPTION' ? c.type === 'SUPPLIER' : c.type === 'CUSTOMER')
                .map(c => <option key={c.id} value={c.id}>{c.name}</option>)
              }
            </select>
          </FormGroup>
        )}

        {/* -- SERIAL (BOX_PRIME only) -- */}
        {activeBrand === 'BOX_PRIME' && (
          <FormGroup label="NÚMERO DE SERIE / LOTE (BOX PRIME)">
            <input
              type="text"
              placeholder="Ej. BP-2024-001"
              value={serialNumber}
              onChange={e => setSerialNumber(e.target.value)}
              className="input-technical"
            />
          </FormGroup>
        )}

        {/* -- PHOTO -- */}
        <FormGroup label="EVIDENCIA FOTOGRÁFICA" className={activeBrand !== 'BOX_PRIME' ? 'md:col-span-2' : ''}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="flex items-center gap-2 border border-[var(--border-soft)] bg-[var(--surface)] hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-all px-3.5 py-2 font-mono text-[10px] font-bold uppercase rounded-xl cursor-pointer shadow-xs"
            >
              <Camera size={14} />
              {photo ? 'CAMBIAR FOTO' : 'CAPTURAR / ADJUNTAR'}
            </button>
            {photo && (
              <button type="button" onClick={() => { setPhoto(null); if (photoInputRef.current) photoInputRef.current.value = ''; }} className="text-red-500 hover:text-red-700 transition-colors p-1 cursor-pointer">
                <X size={15} />
              </button>
            )}
          </div>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoCapture}
            className="hidden"
          />
          {photo ? (
            <div className="mt-2 border border-[var(--border-soft)] bg-[var(--bg-card)] p-1.5 rounded-xl w-fit shadow-xs">
              <img src={photo} alt="evidencia" className="max-h-28 max-w-full rounded-lg object-contain" />
            </div>
          ) : (
            <span className="font-mono text-[9px] opacity-50 uppercase tracking-wide mt-1">
              Opcional · se incluirá en guía y comprobante
            </span>
          )}
        </FormGroup>
      </div>

      {/* -- SIGNATURE -- */}
      {(type === 'RECEPTION' || type === 'DISPATCH') && (
        <FormGroup label="FIRMA DIGITAL" error={errors.signature}>
          <div className={cn(
            'border border-[var(--border-soft)] bg-[var(--bg-input)] rounded-2xl relative w-full h-32 overflow-hidden shadow-xs',
            errors.signature && 'border-red-500/50 ring-2 ring-red-500/20'
          )}>
            <canvas
              ref={canvasRef}
              className="w-full h-full cursor-crosshair"
            />
            <button
              type="button"
              onClick={() => padRef.current?.clear()}
              className="absolute top-2 right-2 font-mono text-[9px] font-bold uppercase opacity-50 hover:opacity-100 bg-[var(--surface)] border border-[var(--border-soft)] px-2 py-0.5 rounded-md cursor-pointer transition-opacity"
            >
              LIMPIAR
            </button>
          </div>
        </FormGroup>
      )}

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mt-2 pt-2 border-t border-[var(--border-soft)]">
        <div className="font-mono text-[10px] opacity-60 uppercase tracking-wider font-bold">
          {lineItems.length} {lineItems.length === 1 ? 'LÍNEA' : 'LÍNEAS'} · {lineItems.reduce((s, l) => s + (parseInt(l.qty) || 0), 0)} UND TOTAL
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-[11px] font-mono tracking-widest font-bold transition-all rounded-xl shadow-xs hover:shadow-md cursor-pointer uppercase active:scale-[0.98]"
        >
          EJECUTAR_{type}
        </button>
      </div>

      {showPreview && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-modal)] border border-[var(--border-soft)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-[var(--ink)] text-[var(--ink-inv)] px-5 py-3.5 flex justify-between items-center">
              <div>
                <div className="font-mono text-[9px] opacity-60 uppercase tracking-widest">CONFIRMAR OPERACIÓN</div>
                <div className="font-mono font-black text-sm uppercase tracking-widest">{TYPE_META[type].label}</div>
              </div>
              <button onClick={() => setShowPreview(false)} className="w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs opacity-60 hover:opacity-100 hover:bg-white/10 transition-colors cursor-pointer">✕</button>
            </div>
            <div className="p-5 flex flex-col gap-4 overflow-y-auto">
              <table className="w-full text-[10px] font-mono border-collapse">
                <tbody>
                  {reference && <PreviewRow label="Referencia" value={reference} />}
                  {contactId && <PreviewRow label={type === 'RECEPTION' ? 'Proveedor' : 'Cliente'} value={contacts.find(c => c.id === contactId)?.name || contactId} />}
                  {fromLocation && <PreviewRow label="Origen" value={locations.find(l => l.id === fromLocation)?.name || fromLocation} />}
                  {toLocation && <PreviewRow label="Destino" value={locations.find(l => l.id === toLocation)?.name || toLocation} />}
                  <PreviewRow label="Operador" value={currentUser.username} />
                </tbody>
              </table>
              <div className="border border-[var(--border-soft)] rounded-xl overflow-hidden shadow-xs">
                <div className="bg-[var(--ink)] text-[var(--ink-inv)] px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-widest">PRODUCTOS</div>
                {lineItems.filter(l => l.productId).map((item, i) => {
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
                <div className="flex justify-between px-3 py-2 bg-[var(--bg-sidebar)] border-t border-[var(--border-soft)] font-mono text-[10px] font-bold">
                  <span>TOTAL</span>
                  <span>{lineItems.reduce((s, l) => s + (parseInt(l.qty, 10) || 0), 0)} uds</span>
                </div>
              </div>
              {pendingSig && (
                <div>
                  <div className="font-mono text-[9px] opacity-50 uppercase tracking-widest mb-1">FIRMA</div>
                  <img src={pendingSig} alt="Firma" className="max-w-[160px] max-h-[60px] border border-[var(--border-soft)] rounded-lg bg-[var(--bg-input)] p-1" />
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button onClick={confirmPreview} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-xs font-bold font-mono uppercase shadow-xs transition-all cursor-pointer">
                  CONFIRMAR Y REGISTRAR
                </button>
                <button onClick={() => setShowPreview(false)} className="flex-1 border border-[var(--border-soft)] rounded-xl py-2.5 text-xs font-bold font-mono uppercase hover:bg-[var(--surface)] transition-all cursor-pointer">
                  VOLVER
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {guide && <GuideModal guide={guide} onClose={() => setGuide(null)} />}

      {scanningForKey !== null && (
        <FamilyQRModal
          products={products}
          stockLevels={stockLevels}
          fromLocation={fromLocation}
          opType={type}
          onAdd={(items) => addLineItems(items)}
          onClose={() => setScanningForKey(null)}
        />
      )}
    </form>
  );
};
