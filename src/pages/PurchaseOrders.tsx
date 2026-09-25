import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { Plus, Trash2, ChevronDown, ChevronUp, CheckCircle, XCircle, Package, ShoppingCart, ArrowUpRight, FileText, BarChart2, Mail, ClipboardList, MoreVertical, X, AlertTriangle } from 'lucide-react';
import { PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus } from '../types';
import { canEdit as hasPermission } from '../lib/permissions';
import { fmtLima } from '../lib/utils';
import { sendPurchaseOrderEmail, sendOperationEmail, sendOperationToInternalRecipients, OperationType } from '../lib/emailService';
import { OperationForm, OperationsReport, BulletinsTab } from './Operations';
import { cn } from '../lib/utils';
import { TutorialModal, PURCHASE_ORDERS_TUTORIAL_STEPS } from '../components/TutorialModal';

// ─── Tipos internos ─────────────────────────────────────────────────────────────
type ProductRef = { id: string; name: string; code: string; color?: string; size?: string; availableStock?: number };

const PO_SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', 'TALLA ÚNICA', '(TALLA ÚNICA)'];
function sortPoSizes(sizes: string[]) {
  return [...sizes].sort((a, b) => {
    const ia = PO_SIZE_ORDER.indexOf(a.toUpperCase());
    const ib = PO_SIZE_ORDER.indexOf(b.toUpperCase());
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

// ─── Selector cascada para OC (todos los productos) ────────────────────────────
function POCascadeSelector({ products, onAdd }: {
  products: ProductRef[];
  onAdd: (items: PurchaseOrderItem[]) => void;
}) {
  const [baseName, setBaseName] = useState('');
  const [color, setColor] = useState('');
  const [sizeQtys, setSizeQtys] = useState<Record<string, string>>({});
  const [sizesCosts, setSizesCosts] = useState<Record<string, string>>({});
  const [qty, setQty] = useState('');
  const [cost, setCost] = useState('');

  const uniqueNames = useMemo(() => [...new Set(products.map(p => p.name))].sort(), [products]);
  const byName = useMemo(() => products.filter(p => p.name === baseName), [products, baseName]);
  const colors = useMemo(() => [...new Set(byName.filter(p => p.color).map(p => p.color!))].sort() as string[], [byName]);
  const byColor = useMemo(() => color ? byName.filter(p => p.color === color) : byName, [byName, color]);
  const sizes = useMemo(() => sortPoSizes([...new Set(byColor.filter(p => p.size).map(p => p.size!))] as string[]), [byColor]);
  const needsColor = colors.length > 0;
  const colorReady = !needsColor || !!color;
  const needsSize = sizes.length > 0;
  const singleProd = !needsSize ? (byColor[0] ?? null) : null;

  const reset = () => { setBaseName(''); setColor(''); setSizeQtys({}); setSizesCosts({}); setQty(''); setCost(''); };

  const handleAdd = () => {
    if (needsSize) {
      const items: PurchaseOrderItem[] = [];
      for (const size of sizes) {
        const q = parseInt(sizeQtys[size] ?? '', 10);
        if (!q || q <= 0) continue;
        const prod = byColor.find(p => p.size === size);
        if (!prod) continue;
        items.push({ productId: prod.id, quantity: q, unitCost: parseFloat(sizesCosts[size] ?? '0') || 0, receivedQuantity: 0 });
      }
      if (items.length > 0) { onAdd(items); reset(); }
    } else if (singleProd) {
      const q = parseInt(qty, 10);
      if (!q || q <= 0) return;
      onAdd([{ productId: singleProd.id, quantity: q, unitCost: parseFloat(cost) || 0, receivedQuantity: 0 }]);
      reset();
    }
  };

  const anySizeQty = sizes.some(s => parseInt(sizeQtys[s] ?? '', 10) > 0);
  const canAdd = needsSize ? anySizeQty : (!!singleProd && parseInt(qty, 10) > 0);

  const selectCls = "w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3 py-2 text-xs font-semibold text-[var(--ink)] rounded-xl focus:outline-none focus:border-blue-500 transition-all uppercase cursor-pointer";
  const inputCls = "w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-2 py-1.5 text-xs font-mono font-semibold text-[var(--ink)] rounded-lg focus:outline-none focus:border-blue-500 transition-all text-center";

  return (
    <div className="flex flex-col gap-3 border border-[var(--border-soft)] bg-[var(--surface)] rounded-2xl p-4 shadow-sm">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]/50">Agregar productos a la Orden</span>
      <select value={baseName} onChange={e => { setBaseName(e.target.value); setColor(''); setSizeQtys({}); setSizesCosts({}); setQty(''); setCost(''); }} className={selectCls}>
        <option value="">— SELECCIONE MODELO —</option>
        {uniqueNames.map(n => <option key={n} value={n}>{n}</option>)}
      </select>
      {baseName && needsColor && (
        <select value={color} onChange={e => { setColor(e.target.value); setSizeQtys({}); setSizesCosts({}); }} className={selectCls}>
          <option value="">— SELECCIONE COLOR —</option>
          {colors.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      )}
      {baseName && colorReady && needsSize && (
        <div className="flex flex-col gap-1.5 pt-1">
          <div className="grid grid-cols-[80px_1fr_1fr] gap-2 px-1 mb-0.5">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--ink)]/40">Talla</span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--ink)]/40 text-center">Cant.</span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--ink)]/40 text-center">Costo U. (S/)</span>
          </div>
          {sizes.map(size => (
            <div key={size} className="grid grid-cols-[80px_1fr_1fr] gap-2 items-center">
              <span className="font-mono text-xs font-bold uppercase text-[var(--ink)] px-1">{size}</span>
              <input type="number" min="0" placeholder="0" value={sizeQtys[size] ?? ''} onChange={e => setSizeQtys(prev => ({ ...prev, [size]: e.target.value }))} className={inputCls} />
              <input type="number" min="0" step="0.01" placeholder="0.00" value={sizesCosts[size] ?? ''} onChange={e => setSizesCosts(prev => ({ ...prev, [size]: e.target.value }))} className={inputCls} />
            </div>
          ))}
        </div>
      )}
      {baseName && colorReady && !needsSize && singleProd && (
        <div className="grid grid-cols-2 gap-3 pt-1">
          <input type="number" min="1" placeholder="Cantidad" value={qty} onChange={e => setQty(e.target.value)} className={inputCls} />
          <input type="number" min="0" step="0.01" placeholder="Costo unit." value={cost} onChange={e => setCost(e.target.value)} className={inputCls} />
        </div>
      )}
      {baseName && colorReady && (
        <button type="button" onClick={handleAdd} disabled={!canAdd}
          className="modern-btn-primary py-2 text-xs flex items-center justify-center gap-1.5 mt-1 disabled:opacity-40">
          <Plus size={14} /> AGREGAR A LA LISTA
        </button>
      )}
    </div>
  );
}

// ─── Selector cascada para REQUERIMIENTOS (solo con stock en reservas) ──────────
function ReqCascadeSelector({ products, onAdd }: {
  products: ProductRef[];
  onAdd: (items: PurchaseOrderItem[]) => void;
}) {
  const [baseName, setBaseName] = useState('');
  const [color, setColor] = useState('');
  const [sizeQtys, setSizeQtys] = useState<Record<string, string>>({});
  const [qty, setQty] = useState('');

  const uniqueNames = useMemo(() => [...new Set(products.map(p => p.name))].sort(), [products]);
  const byName = useMemo(() => products.filter(p => p.name === baseName), [products, baseName]);
  const colors = useMemo(() => [...new Set(byName.filter(p => p.color).map(p => p.color!))].sort() as string[], [byName]);
  const byColor = useMemo(() => color ? byName.filter(p => p.color === color) : byName, [byName, color]);
  const sizes = useMemo(() => sortPoSizes([...new Set(byColor.filter(p => p.size).map(p => p.size!))] as string[]), [byColor]);
  const needsColor = colors.length > 0;
  const colorReady = !needsColor || !!color;
  const needsSize = sizes.length > 0;
  const singleProd = !needsSize ? (byColor[0] ?? null) : null;

  const reset = () => { setBaseName(''); setColor(''); setSizeQtys({}); setQty(''); };

  const handleAdd = () => {
    if (needsSize) {
      const items: PurchaseOrderItem[] = [];
      for (const size of sizes) {
        const q = parseInt(sizeQtys[size] ?? '', 10);
        if (!q || q <= 0) continue;
        const prod = byColor.find(p => p.size === size);
        if (!prod) continue;
        items.push({ productId: prod.id, quantity: q, unitCost: 0, receivedQuantity: 0 });
      }
      if (items.length > 0) { onAdd(items); reset(); }
    } else if (singleProd) {
      const q = parseInt(qty, 10);
      if (!q || q <= 0) return;
      onAdd([{ productId: singleProd.id, quantity: q, unitCost: 0, receivedQuantity: 0 }]);
      reset();
    }
  };

  const anySizeQty = sizes.some(s => parseInt(sizeQtys[s] ?? '', 10) > 0);
  const canAdd = needsSize ? anySizeQty : (!!singleProd && parseInt(qty, 10) > 0);

  const selectCls = "w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3 py-2 text-xs font-semibold text-[var(--ink)] rounded-xl focus:outline-none focus:border-blue-500 transition-all uppercase cursor-pointer";
  const inputCls = "w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-2 py-1.5 text-xs font-mono font-semibold text-[var(--ink)] rounded-lg focus:outline-none focus:border-blue-500 transition-all text-center";

  return (
    <div className="flex flex-col gap-3 border border-[var(--border-soft)] bg-[var(--surface)] rounded-2xl p-4 shadow-sm">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]/50">Agregar prendas al requerimiento</span>
      {products.length === 0 ? (
        <div className="p-4 bg-[var(--bg-input)] rounded-xl text-center">
          <p className="text-xs font-bold text-[var(--ink)]/50 uppercase">Sin stock disponible en almacenes de reserva</p>
        </div>
      ) : (
        <>
          <select value={baseName} onChange={e => { setBaseName(e.target.value); setColor(''); setSizeQtys({}); setQty(''); }} className={selectCls}>
            <option value="">— SELECCIONE MODELO —</option>
            {uniqueNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          {baseName && needsColor && (
            <select value={color} onChange={e => { setColor(e.target.value); setSizeQtys({}); }} className={selectCls}>
              <option value="">— SELECCIONE COLOR —</option>
              {colors.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {baseName && colorReady && needsSize && (
            <div className="flex flex-col gap-1.5 pt-1">
              <div className="grid grid-cols-[80px_1fr_60px] gap-2 px-1 mb-0.5">
                <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--ink)]/40">Talla</span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--ink)]/40 text-center">Cant.</span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--ink)]/40 text-center">Disp.</span>
              </div>
              {sizes.map(size => {
                const prod = byColor.find(p => p.size === size);
                const avail = prod?.availableStock ?? 0;
                return (
                  <div key={size} className="grid grid-cols-[80px_1fr_60px] gap-2 items-center">
                    <span className="font-mono text-xs font-bold uppercase text-[var(--ink)] px-1">{size}</span>
                    <input type="number" min="0" max={avail} placeholder="0"
                      value={sizeQtys[size] ?? ''}
                      onChange={e => setSizeQtys(prev => ({ ...prev, [size]: String(Math.min(avail, parseInt(e.target.value) || 0)) }))}
                      className={inputCls}
                      disabled={!prod || avail === 0}
                    />
                    <span className={`font-mono text-xs font-bold text-center ${avail === 0 ? 'text-red-500' : 'text-emerald-500'}`}>{avail}</span>
                  </div>
                );
              })}
            </div>
          )}
          {baseName && colorReady && !needsSize && singleProd && (
            <div className="flex flex-col gap-1 pt-1">
              <div className="flex items-center justify-between px-1">
                <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--ink)]/40">
                  Cantidad (disponible: <span className={singleProd.availableStock === 0 ? 'text-red-500' : 'text-emerald-500'}>{singleProd.availableStock ?? 0}</span>)
                </span>
              </div>
              <input type="number" min="1" max={singleProd.availableStock ?? 0} placeholder="Cantidad"
                value={qty}
                onChange={e => setQty(String(Math.min(singleProd.availableStock ?? 0, parseInt(e.target.value) || 0)))}
                className={inputCls} />
            </div>
          )}
          {baseName && colorReady && (
            <button type="button" onClick={handleAdd} disabled={!canAdd}
              className="modern-btn-primary py-2 text-xs flex items-center justify-center gap-1.5 mt-1 disabled:opacity-40">
              <Plus size={14} /> AGREGAR AL REQUERIMIENTO
            </button>
          )}
        </>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'PENDIENTE',
  APPROVED: 'APROBADO',
  PARTIAL: 'PARCIAL',
  COMPLETED: 'COMPLETADO',
  CANCELLED: 'CANCELADO',
};

const STATUS_LABEL_OC: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'BORRADOR',
  APPROVED: 'APROBADA',
  PARTIAL: 'PARCIAL',
  COMPLETED: 'COMPLETADA',
  CANCELLED: 'CANCELADA',
};

const STATUS_STYLE: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
  APPROVED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
  PARTIAL: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
  COMPLETED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
  CANCELLED: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
};

const emptyItem = (): PurchaseOrderItem => ({ productId: '', quantity: 1, unitCost: 0, receivedQuantity: 0 });

export const PurchaseOrders: React.FC = () => {
  const { purchaseOrders, addPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder, receivePurchaseOrder, dispatchRequirement, contacts, products, locations, stockLevels, currentUser, activeBrand, users } = useAppContext();
  const [mainTab, setMainTab] = useState<'ops' | 'log' | 'reports' | 'bulletins' | 'oc'>('ops');
  const [showTutorial, setShowTutorial] = useState(false);
  const [activeOpt, setActiveOpt] = useState<'DISPATCH' | 'REQUIREMENT'>('REQUIREMENT');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [receiveModal, setReceiveModal] = useState<PurchaseOrder | null>(null);
  const [receiving, setReceiving] = useState(false);
  const [receiveError, setReceiveError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'ALL' | PurchaseOrderStatus>('ALL');
  const [filterReqStatus, setFilterReqStatus] = useState<'ALL' | PurchaseOrderStatus>('ALL');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!openMenuId) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-reqmenu]')) setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenuId]);

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [form, setForm] = useState({ supplierId: '', reference: '', notes: '', locationId: '', items: [emptyItem()] });
  const [reqForm, setReqForm] = useState(() => ({ reference: `REQ-${Date.now().toString().slice(-6)}`, notes: '', items: [] as PurchaseOrderItem[] }));
  const [receiveQtys, setReceiveQtys] = useState<Record<number, number>>({});
  const [fromLocationIds, setFromLocationIds] = useState<Record<number, string>>({});

  const isAdmin = hasPermission(currentUser.role, 'purchase-orders');
  const isJefeAlmacen = currentUser.role === 'JEFE_ALMACEN' || currentUser.role === 'ADMIN_GENERAL' || currentUser.role === 'CEO';
  const isDespachador = currentUser.role === 'DESPACHADOR';
  const canEdit = hasPermission(currentUser.role, 'purchase-orders');
  const suppliers = contacts.filter(c => c.type === 'SUPPLIER');

  // Ubicación destino fija para requerimientos
  const dispatchLocation = locations.find(l => l.name.toLowerCase().includes('despacho'));

  // Ubicaciones disponibles — cualquiera que no sea Despacho
  const reserveLocations = locations.filter(l => !l.name.toLowerCase().includes('despacho'));
  const reserveLocationIds = new Set(reserveLocations.map(l => l.id));
  const productsWithReserveStock = useMemo(() => {
    return products
      .map(p => {
        const available = stockLevels
          .filter(sl => reserveLocationIds.has(sl.locationId) && sl.productId === p.id)
          .reduce((sum, sl) => sum + sl.quantity, 0);
        return { ...p, availableStock: available };
      })
      .filter(p => (p.availableStock ?? 0) > 0);
  }, [products, stockLevels, reserveLocationIds]);

  // Separar OC de Requerimientos
  const purchaseOrdersOC = purchaseOrders.filter(po => po.type === 'OC' || !po.type);
  const requirements = purchaseOrders.filter(po => po.type === 'REQUIREMENT');

  const filteredOC = purchaseOrdersOC.filter(po => filterStatus === 'ALL' || po.status === filterStatus);
  const filteredReq = requirements.filter(po => filterReqStatus === 'ALL' || po.status === filterReqStatus);

  const totalValue = (po: PurchaseOrder) => po.items.reduce((s, i) => s + i.quantity * i.unitCost, 0);

  const buildEmailItems = (items: PurchaseOrderItem[]) =>
    items.map(item => {
      const prod = products.find(p => p.id === item.productId);
      return { productCode: prod?.code ?? item.productId, productName: [prod?.name, prod?.color, prod?.size].filter(Boolean).join(' '), quantity: item.quantity, unitCost: item.unitCost };
    });

  const openAdd = () => {
    setForm({ supplierId: suppliers[0]?.id || '', reference: `OC-${Date.now().toString().slice(-6)}`, notes: '', locationId: locations[0]?.id || '', items: [] });
    setShowModal(true);
  };

  const handleSubmitOC = (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = form.items.filter(i => i.productId);
    if (!form.supplierId || validItems.length === 0) return;
    const now = new Date();
    addPurchaseOrder({ ...form, type: 'OC', items: validItems, status: 'DRAFT' });
    setShowModal(false);
    const supplier = contacts.find(c => c.id === form.supplierId);
    sendPurchaseOrderEmail({ reference: form.reference, supplierName: supplier?.name ?? '—', status: 'DRAFT', date: now.toLocaleDateString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }), operator: currentUser.username, items: buildEmailItems(form.items), notes: form.notes });
  };

  const handleSubmitReq = (e: React.FormEvent) => {
    e.preventDefault();
    if (reqForm.items.length === 0) return;
    addPurchaseOrder({
      type: 'REQUIREMENT',
      supplierId: '',
      reference: reqForm.reference,
      notes: reqForm.notes,
      locationId: dispatchLocation?.id || '',
      items: reqForm.items,
      status: 'DRAFT',
    });
    setReqForm({ reference: `REQ-${Date.now().toString().slice(-6)}`, notes: '', items: [] });
  };

  const changeStatus = (po: PurchaseOrder, status: PurchaseOrderStatus) => {
    updatePurchaseOrder({ ...po, status });
    if (po.type === 'OC' && status === 'APPROVED') {
      const supplier = contacts.find(c => c.id === po.supplierId);
      const now = new Date();
      sendPurchaseOrderEmail({ reference: po.reference, supplierName: supplier?.name ?? '—', status: 'APPROVED', date: now.toLocaleDateString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }), operator: currentUser.username, items: buildEmailItems(po.items), notes: po.notes });
    }
  };

  const openReceive = (po: PurchaseOrder) => {
    const initQtys: Record<number, number> = {};
    const initLocs: Record<number, string> = {};
    po.items.forEach((item, i) => {
      initQtys[i] = item.quantity - item.receivedQuantity;
      if (po.type === 'REQUIREMENT') {
        const best = reserveLocations
          .map(l => ({ id: l.id, qty: stockLevels.find(sl => sl.productId === item.productId && sl.locationId === l.id)?.quantity ?? 0 }))
          .sort((a, b) => b.qty - a.qty)[0];
        if (best) initLocs[i] = best.id;
      }
    });
    setReceiveQtys(initQtys);
    setFromLocationIds(initLocs);
    setReceiveError(null);
    setReceiveModal(po);
  };

  const confirmReceive = async () => {
    if (!receiveModal) return;
    setReceiving(true);
    setReceiveError(null);
    try {
      if (receiveModal.type === 'REQUIREMENT') {
        await dispatchRequirement(receiveModal, receiveQtys, fromLocationIds);

        const now = new Date();
        const dateStr = now.toLocaleDateString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const fromLoc = reserveLocations.find(l => Object.values(fromLocationIds)[0] === l.id);
        const toLoc = dispatchLocation;
        const emailItems = receiveModal.items
          .map((item, i) => {
            const qty = receiveQtys[i] || 0;
            if (qty <= 0) return null;
            const prod = products.find(p => p.id === item.productId);
            return { productCode: prod?.code ?? item.productId, productName: [prod?.name, prod?.color, prod?.size].filter(Boolean).join(' '), quantity: qty };
          })
          .filter((x): x is NonNullable<typeof x> => x !== null);

        const emailPayload = {
          brand: activeBrand,
          operationType: 'TRANSFER' as OperationType,
          reference: receiveModal.reference,
          date: dateStr,
          operator: currentUser.username,
          items: emailItems,
          fromLocation: fromLoc?.name,
          toLocation: toLoc?.name,
        };

        const userRecord = users.find(u => u.id === currentUser.id);
        const operatorEmail = (userRecord as any)?.emailPersonal || (userRecord as any)?.email;
        if (operatorEmail) {
          sendOperationEmail({ toEmail: operatorEmail, toName: currentUser.username, ...emailPayload }).catch(() => {});
        }
        sendOperationToInternalRecipients(emailPayload);
      } else {
        await receivePurchaseOrder(receiveModal, receiveQtys);
      }
      setReceiveModal(null);
    }
    catch { setReceiveError('Error al registrar. Intenta de nuevo.'); }
    finally { setReceiving(false); }
  };

  const removeItem = (i: number) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i: number, field: keyof PurchaseOrderItem, value: string | number) =>
    setForm(f => ({ ...f, items: f.items.map((item, idx) => idx === i ? { ...item, [field]: value } : item) }));

  const removeReqItem = (i: number) => setReqForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const tabCls = (active: boolean) => cn(
    'flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all',
    active 
      ? 'bg-[var(--ink)] text-[var(--ink-inv)] shadow-sm' 
      : 'text-[var(--ink)]/60 hover:text-[var(--ink)] hover:bg-[var(--border-soft)]/50'
  );

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 pb-12">
      <TutorialModal
        open={showTutorial}
        onClose={() => setShowTutorial(false)}
        steps={PURCHASE_ORDERS_TUTORIAL_STEPS}
        title="Órdenes OC"
      />
      
      {/* Modern Hero Module Header */}
      <ModuleInfo 
        number="09" 
        title="Despacho & Traslado" 
        description="Gestión integral de requerimientos de almacén, traslados entre reservas y despacho, y órdenes de compra externas." 
        onTutorial={() => setShowTutorial(true)}
      />

      {/* Main navigation tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl shadow-sm">
        <button onClick={() => setMainTab('ops')} className={tabCls(mainTab === 'ops')}>
          <ArrowUpRight size={15} /> Operaciones
        </button>
        {!isDespachador && (
          <>
            <button onClick={() => setMainTab('log')} className={tabCls(mainTab === 'log')}>
              <FileText size={15} /> Historial
            </button>
            <button onClick={() => setMainTab('reports')} className={tabCls(mainTab === 'reports')}>
              <BarChart2 size={15} /> Reportes
            </button>
            <button onClick={() => setMainTab('bulletins')} className={tabCls(mainTab === 'bulletins')}>
              <Mail size={15} /> Comprobantes
            </button>
            <button onClick={() => setMainTab('oc')} className={tabCls(mainTab === 'oc')}>
              <ShoppingCart size={15} /> Órdenes OC
            </button>
          </>
        )}
      </div>

      {/* OPERACIONES tab */}
      {mainTab === 'ops' && (
        <div className="flex flex-col gap-5">
          {/* Dual switcher: REQUERIMIENTOS vs DESPACHO */}
          {!isDespachador && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <OptButton
                icon={<ClipboardList size={22} />}
                label="REQUERIMIENTOS"
                desc="Solicita prendas desde reservas hacia stock despacho."
                active={activeOpt === 'REQUIREMENT'}
                onClick={() => setActiveOpt('REQUIREMENT')}
              />
              <OptButton
                icon={<ArrowUpRight size={22} />}
                label="DESPACHO DIRECTO"
                desc="Registra salida de productos descontando del inventario disponible."
                active={activeOpt === 'DISPATCH'}
                onClick={() => setActiveOpt('DISPATCH')}
              />
            </div>
          )}

          {!isDespachador && activeOpt === 'DISPATCH' && (
            <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-3xl p-6 lg:p-8 shadow-sm">
              <OperationForm key="DISPATCH" type="DISPATCH" />
            </div>
          )}

          {(activeOpt === 'REQUIREMENT' || isDespachador) && (
            <div className="flex flex-col gap-4">
              {/* Formulario nuevo requerimiento */}
              <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-3xl p-6 lg:p-8 shadow-sm">
                <form onSubmit={handleSubmitReq} className="flex flex-col gap-5">
                  <div className="flex items-center justify-between pb-3 border-b border-[var(--border-soft)]">
                    <div>
                      <h3 className="text-base font-black text-[var(--ink)] tracking-tight">Nuevo Requerimiento</h3>
                      <p className="text-xs text-[var(--ink)]/50 mt-0.5">Traslada prendas desde almacenes de reserva hacia despacho</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Referencia *</label>
                      <input 
                        value={reqForm.reference} 
                        onChange={e => setReqForm(f => ({ ...f, reference: e.target.value }))}
                        className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold text-[var(--ink)] focus:outline-none focus:border-blue-500 transition-all uppercase" 
                        required 
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Destino (fijo)</label>
                      <div className="w-full bg-[var(--bg-input)]/50 border border-[var(--border-soft)] px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[var(--ink)]/70">
                        {dispatchLocation?.name ?? 'ALMACEN STOCK DESPACHO'}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Prendas * (solo stock disponible)</label>
                    <ReqCascadeSelector
                      products={productsWithReserveStock}
                      onAdd={newItems => setReqForm(f => ({ ...f, items: [...f.items, ...newItems] }))}
                    />

                    {reqForm.items.length > 0 && (
                      <div className="flex flex-col gap-2 mt-2">
                        <div className="grid grid-cols-12 gap-2 px-3 py-1">
                          <span className="col-span-8 text-[9px] font-bold uppercase tracking-wider text-[var(--ink)]/40">Producto</span>
                          <span className="col-span-2 text-[9px] font-bold uppercase tracking-wider text-[var(--ink)]/40 text-center">Cant.</span>
                          <span className="col-span-2"></span>
                        </div>
                        {reqForm.items.map((item, i) => {
                          const prod = productsWithReserveStock.find(p => p.id === item.productId);
                          const avail = prod?.availableStock ?? 0;
                          const overStock = item.quantity > avail;
                          return (
                            <div key={i} className={`grid grid-cols-12 gap-2 items-center bg-[var(--surface)] border px-3 py-2 rounded-xl transition-all ${overStock ? 'border-red-400 bg-red-500/5' : 'border-[var(--border-soft)] shadow-sm'}`}>
                              <div className="col-span-8 flex flex-col">
                                <span className="font-mono text-xs font-bold text-[var(--ink)] truncate">{prod?.name ?? '—'}</span>
                                <span className="text-[10px] text-[var(--ink)]/50 uppercase">{[prod?.color, prod?.size].filter(Boolean).join(' · ')} · <span className={overStock ? 'text-red-500 font-bold' : 'text-emerald-500 font-bold'}>disp: {avail}</span></span>
                              </div>
                              <div className="col-span-2 font-mono text-xs text-center font-bold">{item.quantity}</div>
                              <div className="col-span-2 text-right">
                                <button type="button" onClick={() => removeReqItem(i)} className="p-1.5 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Notas adicionales</label>
                    <textarea 
                      value={reqForm.notes} 
                      onChange={e => setReqForm(f => ({ ...f, notes: e.target.value }))} 
                      rows={2}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[var(--ink)] focus:outline-none focus:border-blue-500 transition-all resize-none" 
                      placeholder="Observaciones o indicaciones especiales..."
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={reqForm.items.length === 0}
                    className="modern-btn-primary py-3 text-xs uppercase flex items-center justify-center gap-2 disabled:opacity-40"
                  >
                    <ClipboardList size={16} /> Crear Requerimiento
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* HISTORIAL tab */}
      {mainTab === 'log' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl p-4 shadow-sm">
            <div>
              <h2 className="text-sm font-black text-[var(--ink)] tracking-tight uppercase">Historial de Requerimientos</h2>
              <p className="text-xs text-[var(--ink)]/50 mt-0.5">Todos los requerimientos de almacén registrados y su estado actual</p>
            </div>
            <select 
              value={filterReqStatus} 
              onChange={e => setFilterReqStatus(e.target.value as any)}
              className="bg-[var(--bg-input)] border border-[var(--border-soft)] px-3 py-2 text-xs font-bold text-[var(--ink)] rounded-xl focus:outline-none focus:border-blue-500 transition-all uppercase cursor-pointer"
            >
              <option value="ALL">TODOS LOS ESTADOS</option>
              {(Object.keys(STATUS_LABEL) as PurchaseOrderStatus[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>

          {filteredReq.length === 0 && (
            <div className="text-center text-xs text-[var(--ink)]/50 py-16 uppercase tracking-wider bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl">
              Sin requerimientos registrados
            </div>
          )}

          <div className="flex flex-col gap-3">
            {filteredReq.map(po => {
              const isExpanded = expanded === po.id;
              return (
                <div key={po.id} className="border border-[var(--border-soft)] bg-[var(--surface)] rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden">
                  <div className="flex items-center justify-between gap-4 p-4.5 cursor-pointer" onClick={() => setExpanded(isExpanded ? null : po.id)}>
                    <div className="flex items-center gap-3.5 min-w-0 flex-wrap">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg shrink-0 ${STATUS_STYLE[po.status]}`}>
                        {STATUS_LABEL[po.status]}
                      </span>
                      <span className="font-mono font-bold text-sm text-[var(--ink)] shrink-0">{po.reference}</span>
                      <span className="text-xs text-[var(--ink)]/50 font-medium">
                        {fmtLima(po.date, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </span>
                      <span className="text-xs text-[var(--ink)]/60 font-semibold bg-[var(--border-soft)]/40 px-2 py-0.5 rounded-md">
                        {po.items.reduce((s, i) => s + i.quantity, 0)} prendas
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isExpanded ? <ChevronUp size={16} className="text-[var(--ink)]/50" /> : <ChevronDown size={16} className="text-[var(--ink)]/50" />}
                      {/* 3-dot menu */}
                      <div className="relative" data-reqmenu onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setOpenMenuId(openMenuId === po.id ? null : po.id)}
                          className="p-1.5 hover:bg-[var(--border-soft)] rounded-lg text-[var(--ink)]/60 hover:text-[var(--ink)] transition-colors"
                          title="Opciones"
                        >
                          <MoreVertical size={15} />
                        </button>
                        {openMenuId === po.id && (
                          <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--surface)] border border-[var(--border-soft)] shadow-xl rounded-2xl min-w-[180px] flex flex-col p-1.5 animate-in fade-in zoom-in-95 duration-150">
                            {po.status === 'DRAFT' && isJefeAlmacen && (
                              <button
                                onClick={() => { setOpenMenuId(null); changeStatus(po, 'APPROVED'); }}
                                className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-emerald-600 hover:bg-emerald-500/10 rounded-xl transition-all text-left"
                              >
                                <CheckCircle size={14} /> Aprobar
                              </button>
                            )}
                            {(po.status === 'APPROVED' || po.status === 'PARTIAL') && isJefeAlmacen && (
                              <button
                                onClick={() => { setOpenMenuId(null); openReceive(po); }}
                                className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-500/10 rounded-xl transition-all text-left"
                              >
                                <Package size={14} /> Despachar
                              </button>
                            )}
                            {po.status !== 'COMPLETED' && po.status !== 'CANCELLED' && isJefeAlmacen && (
                              <button
                                onClick={() => { setOpenMenuId(null); changeStatus(po, 'CANCELLED'); }}
                                className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-amber-600 hover:bg-amber-500/10 rounded-xl transition-all text-left"
                              >
                                <XCircle size={14} /> Rechazar
                              </button>
                            )}
                            {isJefeAlmacen && (
                              <button
                                onClick={() => { setOpenMenuId(null); setConfirmDelete(po.id); }}
                                className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-500/10 rounded-xl transition-all text-left border-t border-[var(--border-soft)] mt-1"
                              >
                                <Trash2 size={14} /> Eliminar
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-[var(--border-soft)] p-5 flex flex-col gap-4 bg-[var(--bg-input)]/20">
                      <div className="overflow-x-auto rounded-xl border border-[var(--border-soft)] bg-[var(--surface)]">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-[var(--border-soft)] bg-[var(--bg-input)]/50">
                              <th className="text-left py-2.5 px-4 font-bold uppercase text-[10px] text-[var(--ink)]/50">Producto</th>
                              <th className="text-right py-2.5 px-4 font-bold uppercase text-[10px] text-[var(--ink)]/50">Solicitado</th>
                              <th className="text-right py-2.5 px-4 font-bold uppercase text-[10px] text-[var(--ink)]/50">Despachado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {po.items.map((item, i) => {
                              const prod = products.find(p => p.id === item.productId);
                              return (
                                <tr key={i} className="border-b border-[var(--border-soft)]/50 last:border-none">
                                  <td className="py-2.5 px-4 font-mono font-medium text-[var(--ink)]">{prod ? `${prod.code} ${prod.name} ${prod.color || ''} ${prod.size || ''}`.trim() : item.productId}</td>
                                  <td className="text-right py-2.5 px-4 font-mono">{item.quantity}</td>
                                  <td className={`text-right py-2.5 px-4 font-mono font-bold ${item.receivedQuantity >= item.quantity ? 'text-emerald-500' : item.receivedQuantity > 0 ? 'text-amber-500' : 'text-[var(--ink)]/40'}`}>{item.receivedQuantity}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {po.notes && <p className="text-xs text-[var(--ink)]/60 italic bg-[var(--surface)] p-3 rounded-xl border border-[var(--border-soft)]">{po.notes}</p>}
                      {dispatchLocation && (
                        <p className="text-[11px] text-[var(--ink)]/50 uppercase font-semibold">Destino asignado: {dispatchLocation.name}</p>
                      )}
                      {po.status === 'DRAFT' && !isJefeAlmacen && (
                        <span className="text-[11px] text-amber-500 font-semibold uppercase">Pendiente de aprobación por Jefe de Almacén</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* REPORTES tab */}
      {mainTab === 'reports' && (
        <div className="border border-[var(--border-soft)] bg-[var(--surface)] p-6 rounded-3xl shadow-sm">
          <OperationsReport mode="requerimientos" />
        </div>
      )}

      {/* COMPROBANTES tab */}
      {mainTab === 'bulletins' && <BulletinsTab mode="requerimientos" />}

      {/* ÓRDENES OC tab */}
      {mainTab === 'oc' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl p-4 shadow-sm">
            <div>
              <h2 className="text-sm font-black text-[var(--ink)] tracking-tight uppercase">Órdenes de Compra (OC)</h2>
              <p className="text-xs text-[var(--ink)]/50 mt-0.5">Gestión y control de abastecimiento con proveedores externos</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select 
                value={filterStatus} 
                onChange={e => setFilterStatus(e.target.value as any)}
                className="bg-[var(--bg-input)] border border-[var(--border-soft)] px-3 py-2 text-xs font-bold text-[var(--ink)] rounded-xl focus:outline-none focus:border-blue-500 transition-all uppercase cursor-pointer"
              >
                <option value="ALL">TODAS LAS OC</option>
                {(Object.keys(STATUS_LABEL_OC) as PurchaseOrderStatus[]).map(s => <option key={s} value={s}>{STATUS_LABEL_OC[s]}</option>)}
              </select>
              {isAdmin && (
                <button 
                  onClick={openAdd} 
                  className="modern-btn-primary px-4 py-2 text-xs flex items-center gap-1.5 uppercase"
                >
                  <Plus size={14} /> Nueva OC
                </button>
              )}
            </div>
          </div>

          {filteredOC.length === 0 && (
            <div className="text-center text-xs text-[var(--ink)]/50 py-16 uppercase tracking-wider bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl">
              Sin órdenes de compra registradas
            </div>
          )}

          <div className="flex flex-col gap-3">
            {filteredOC.map(po => {
              const supplier = contacts.find(c => c.id === po.supplierId);
              const isExpanded = expanded === po.id;
              return (
                <div key={po.id} className="border border-[var(--border-soft)] bg-[var(--surface)] rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden">
                  <div className="flex items-center justify-between gap-4 p-4.5 cursor-pointer" onClick={() => setExpanded(isExpanded ? null : po.id)}>
                    <div className="flex items-center gap-3.5 min-w-0 flex-wrap">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg shrink-0 ${STATUS_STYLE[po.status]}`}>
                        {STATUS_LABEL_OC[po.status]}
                      </span>
                      <span className="font-mono font-bold text-sm text-[var(--ink)] shrink-0">{po.reference}</span>
                      <span className="text-xs text-[var(--ink)]/70 font-semibold shrink-0">{supplier?.name || 'Proveedor desconocido'}</span>
                      <span className="text-xs text-[var(--ink)]/50 font-medium">
                        {fmtLima(po.date, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono font-black text-sm text-[var(--ink)] hidden sm:block">S/ {totalValue(po).toFixed(2)}</span>
                      {isExpanded ? <ChevronUp size={16} className="text-[var(--ink)]/50" /> : <ChevronDown size={16} className="text-[var(--ink)]/50" />}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-[var(--border-soft)] p-5 flex flex-col gap-4 bg-[var(--bg-input)]/20">
                      <div className="overflow-x-auto rounded-xl border border-[var(--border-soft)] bg-[var(--surface)]">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-[var(--border-soft)] bg-[var(--bg-input)]/50">
                              <th className="text-left py-2.5 px-4 font-bold uppercase text-[10px] text-[var(--ink)]/50">Producto</th>
                              <th className="text-right py-2.5 px-4 font-bold uppercase text-[10px] text-[var(--ink)]/50">Solicitado</th>
                              <th className="text-right py-2.5 px-4 font-bold uppercase text-[10px] text-[var(--ink)]/50">Recibido</th>
                              <th className="text-right py-2.5 px-4 font-bold uppercase text-[10px] text-[var(--ink)]/50">Costo U.</th>
                              <th className="text-right py-2.5 px-4 font-bold uppercase text-[10px] text-[var(--ink)]/50">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {po.items.map((item, i) => {
                              const prod = products.find(p => p.id === item.productId);
                              return (
                                <tr key={i} className="border-b border-[var(--border-soft)]/50 last:border-none">
                                  <td className="py-2.5 px-4 font-mono font-medium text-[var(--ink)]">{prod ? `${prod.code} ${prod.name} ${prod.color || ''} ${prod.size || ''}`.trim() : item.productId}</td>
                                  <td className="text-right py-2.5 px-4 font-mono">{item.quantity}</td>
                                  <td className={`text-right py-2.5 px-4 font-mono font-bold ${item.receivedQuantity >= item.quantity ? 'text-emerald-500' : item.receivedQuantity > 0 ? 'text-amber-500' : 'text-[var(--ink)]/40'}`}>{item.receivedQuantity}</td>
                                  <td className="text-right py-2.5 px-4 font-mono">S/ {item.unitCost.toFixed(2)}</td>
                                  <td className="text-right py-2.5 px-4 font-mono font-bold">S/ {(item.quantity * item.unitCost).toFixed(2)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-[var(--border-soft)] bg-[var(--bg-input)]/30 font-bold">
                              <td colSpan={4} className="py-2.5 px-4 text-right uppercase text-[10px] text-[var(--ink)]/60">Total Orden de Compra:</td>
                              <td className="text-right py-2.5 px-4 font-mono font-black text-sm text-[var(--ink)]">S/ {totalValue(po).toFixed(2)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      {po.notes && <p className="text-xs text-[var(--ink)]/60 italic bg-[var(--surface)] p-3 rounded-xl border border-[var(--border-soft)]">{po.notes}</p>}
                      {canEdit && (
                        <div className="flex flex-wrap items-center gap-2 pt-2">
                          {po.status === 'DRAFT' && isAdmin && (
                            <button onClick={() => changeStatus(po, 'APPROVED')} className="modern-btn-primary px-3.5 py-1.5 text-xs flex items-center gap-1.5 uppercase bg-emerald-600 hover:bg-emerald-700">
                              <CheckCircle size={14} /> Aprobar
                            </button>
                          )}
                          {(po.status === 'APPROVED' || po.status === 'PARTIAL') && (
                            <button onClick={() => openReceive(po)} className="modern-btn-primary px-3.5 py-1.5 text-xs flex items-center gap-1.5 uppercase">
                              <Package size={14} /> Recibir Mercadería
                            </button>
                          )}
                          {po.status !== 'COMPLETED' && po.status !== 'CANCELLED' && isAdmin && (
                            <button onClick={() => changeStatus(po, 'CANCELLED')} className="modern-btn px-3.5 py-1.5 text-xs flex items-center gap-1.5 uppercase text-red-500 hover:bg-red-500/10">
                              <XCircle size={14} /> Cancelar
                            </button>
                          )}
                          {isAdmin && (po.status === 'DRAFT' || po.status === 'CANCELLED') && (
                            <button onClick={() => setConfirmDelete(po.id)} className="modern-btn px-3.5 py-1.5 text-xs flex items-center gap-1.5 uppercase text-red-500 hover:bg-red-500/10 ml-auto">
                              <Trash2 size={14} /> Eliminar
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Modal Nueva OC */}
          {showModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="border-b border-[var(--border-soft)] p-5 flex justify-between items-center sticky top-0 bg-[var(--surface)] z-10">
                  <div>
                    <h3 className="text-base font-black text-[var(--ink)] tracking-tight">Nueva Orden de Compra</h3>
                    <p className="text-xs text-[var(--ink)]/50 mt-0.5">Registra una adquisición de productos para ingreso al almacén</p>
                  </div>
                  <button onClick={() => setShowModal(false)} className="p-2 hover:bg-[var(--border-soft)] rounded-full transition-colors text-[var(--ink)]/60 hover:text-[var(--ink)]">
                    <X size={18} />
                  </button>
                </div>
                <form onSubmit={handleSubmitOC} className="p-6 flex flex-col gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Referencia *</label>
                      <input 
                        value={form.reference} 
                        onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                        className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold text-[var(--ink)] focus:outline-none focus:border-blue-500 transition-all uppercase" 
                        required 
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Proveedor *</label>
                      <select 
                        value={form.supplierId} 
                        onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))}
                        className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[var(--ink)] focus:outline-none focus:border-blue-500 transition-all cursor-pointer" 
                        required
                      >
                        <option value="">Seleccionar proveedor...</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Ubicación Destino</label>
                    <select 
                      value={form.locationId} 
                      onChange={e => setForm(f => ({ ...f, locationId: e.target.value }))}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[var(--ink)] focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
                    >
                      <option value="">Sin asignar (a definir en recepción)</option>
                      {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>

                  <div className="flex flex-col gap-2.5 pt-1">
                    <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Ítems de la Orden *</label>
                    <POCascadeSelector
                      products={products}
                      onAdd={newItems => setForm(f => ({ ...f, items: [...f.items.filter(i => i.productId), ...newItems] }))}
                    />

                    {form.items.filter(i => i.productId).length > 0 && (
                      <div className="flex flex-col gap-2 mt-2">
                        <div className="grid grid-cols-12 gap-2 px-3 py-1">
                          <span className="col-span-5 text-[9px] font-bold uppercase tracking-wider text-[var(--ink)]/40">Producto</span>
                          <span className="col-span-2 text-[9px] font-bold uppercase tracking-wider text-[var(--ink)]/40 text-center">Cant.</span>
                          <span className="col-span-3 text-[9px] font-bold uppercase tracking-wider text-[var(--ink)]/40 text-center">Costo U.</span>
                          <span className="col-span-2"></span>
                        </div>
                        {form.items.map((item, i) => {
                          if (!item.productId) return null;
                          const prod = products.find(p => p.id === item.productId);
                          return (
                            <div key={i} className="grid grid-cols-12 gap-2 items-center bg-[var(--surface)] border border-[var(--border-soft)] px-3 py-2 rounded-xl shadow-sm">
                              <div className="col-span-5 flex flex-col min-w-0">
                                <span className="font-mono text-xs font-bold text-[var(--ink)] truncate">{prod?.name ?? '—'}</span>
                                <span className="text-[10px] text-[var(--ink)]/50 uppercase">{[prod?.color, prod?.size].filter(Boolean).join(' · ')}</span>
                              </div>
                              <div className="col-span-2">
                                <input 
                                  type="number" min="1" value={item.quantity}
                                  onChange={e => updateItem(i, 'quantity', parseInt(e.target.value) || 1)}
                                  className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-2 py-1 text-xs font-mono text-center rounded-lg focus:outline-none focus:border-blue-500" 
                                />
                              </div>
                              <div className="col-span-3">
                                <input 
                                  type="number" min="0" step="0.01" value={item.unitCost}
                                  onChange={e => updateItem(i, 'unitCost', parseFloat(e.target.value) || 0)}
                                  className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-2 py-1 text-xs font-mono text-center rounded-lg focus:outline-none focus:border-blue-500" 
                                />
                              </div>
                              <div className="col-span-2 text-right">
                                <button type="button" onClick={() => removeItem(i)} className="p-1.5 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Notas adicionales</label>
                    <textarea 
                      value={form.notes} 
                      onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} 
                      rows={2}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[var(--ink)] focus:outline-none focus:border-blue-500 transition-all resize-none" 
                    />
                  </div>

                  <div className="flex justify-end gap-2.5 pt-3 border-t border-[var(--border-soft)]">
                    <button type="button" onClick={() => setShowModal(false)} className="modern-btn px-4 py-2 text-xs uppercase">
                      Cancelar
                    </button>
                    <button type="submit" className="modern-btn-primary px-5 py-2 text-xs uppercase">
                      Crear Orden de Compra
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal Recibir Mercadería OC */}
          {receiveModal && mainTab === 'oc' && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="border-b border-[var(--border-soft)] p-5 flex justify-between items-center">
                  <div>
                    <h3 className="text-base font-black text-[var(--ink)] tracking-tight">Recibir Mercadería</h3>
                    <p className="text-xs text-[var(--ink)]/50 mt-0.5">Orden {receiveModal.reference}</p>
                  </div>
                  <button onClick={() => setReceiveModal(null)} className="p-2 hover:bg-[var(--border-soft)] rounded-full transition-colors text-[var(--ink)]/60 hover:text-[var(--ink)]">
                    <X size={18} />
                  </button>
                </div>
                <div className="p-6 flex flex-col gap-4">
                  {receiveModal.items.map((item, i) => {
                    const prod = products.find(p => p.id === item.productId);
                    const pending = item.quantity - item.receivedQuantity;
                    return (
                      <div key={i} className="flex items-center justify-between gap-4 border-b border-[var(--border-soft)]/50 pb-3">
                        <div className="min-w-0">
                          <div className="font-mono text-xs font-bold truncate text-[var(--ink)]">{prod?.code} {prod?.name} {prod?.color} {prod?.size}</div>
                          <div className="text-[10px] text-[var(--ink)]/60 font-semibold mt-0.5">Pendiente: {pending} de {item.quantity} unidades</div>
                        </div>
                        <input 
                          type="number" min="0" max={pending} value={receiveQtys[i] ?? pending}
                          onChange={e => setReceiveQtys(q => ({ ...q, [i]: Math.min(pending, parseInt(e.target.value) || 0) }))}
                          className="w-20 bg-[var(--bg-input)] border border-[var(--border-soft)] px-2 py-1.5 text-xs font-mono text-center rounded-xl focus:outline-none focus:border-blue-500" 
                        />
                      </div>
                    );
                  })}
                  {receiveError && <p className="text-xs text-red-500 font-semibold">{receiveError}</p>}
                  <div className="flex justify-end gap-2.5 pt-3 border-t border-[var(--border-soft)]">
                    <button onClick={() => setReceiveModal(null)} disabled={receiving} className="modern-btn px-4 py-2 text-xs uppercase">
                      Cancelar
                    </button>
                    <button onClick={confirmReceive} disabled={receiving} className="modern-btn-primary px-5 py-2 text-xs uppercase disabled:opacity-50">
                      {receiving ? 'Registrando...' : 'Confirmar Recepción'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal Confirm Delete */}
          {confirmDelete && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-[var(--surface)] border border-red-500/20 rounded-3xl shadow-2xl p-6 max-w-sm w-full">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                    <AlertTriangle size={20} className="text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[var(--ink)] tracking-tight">¿Eliminar registro?</h3>
                    <p className="text-xs text-[var(--ink)]/50 mt-0.5">Esta acción es irreversible</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2.5 mt-5">
                  <button onClick={() => setConfirmDelete(null)} className="modern-btn px-4 py-2 text-xs uppercase">
                    Cancelar
                  </button>
                  <button onClick={() => { deletePurchaseOrder(confirmDelete!); setConfirmDelete(null); }} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-xl transition-all uppercase">
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal despachar requerimiento */}
      {receiveModal && (mainTab === 'log' || (mainTab === 'ops' && activeOpt === 'REQUIREMENT')) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="border-b border-[var(--border-soft)] p-5 flex justify-between items-center">
              <div>
                <h3 className="text-base font-black text-[var(--ink)] tracking-tight">Despachar Requerimiento</h3>
                <p className="text-xs text-[var(--ink)]/50 mt-0.5">Orden {receiveModal.reference}</p>
              </div>
              <button onClick={() => setReceiveModal(null)} className="p-2 hover:bg-[var(--border-soft)] rounded-full transition-colors text-[var(--ink)]/60 hover:text-[var(--ink)]">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              {receiveModal.items.map((item, i) => {
                const prod = products.find(p => p.id === item.productId);
                const pending = item.quantity - item.receivedQuantity;
                return (
                  <div key={i} className="flex flex-col gap-2.5 border-b border-[var(--border-soft)]/50 pb-3">
                    <div className="font-mono text-xs font-bold text-[var(--ink)]">{prod?.code} {prod?.name} {prod?.color} {prod?.size}</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--ink)]/50">Desde (almacén de reserva)</span>
                        <select
                          value={fromLocationIds[i] ?? ''}
                          onChange={e => setFromLocationIds(l => ({ ...l, [i]: e.target.value }))}
                          className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] rounded-xl focus:outline-none focus:border-blue-500 cursor-pointer"
                        >
                          <option value="">— Sin origen —</option>
                          {reserveLocations.map(l => {
                            const qty = stockLevels.find(sl => sl.productId === item.productId && sl.locationId === l.id)?.quantity ?? 0;
                            return <option key={l.id} value={l.id}>{l.name} (stock: {qty})</option>;
                          })}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--ink)]/50">Cant. (pendiente: {pending})</span>
                        <input 
                          type="number" min="0" max={pending} value={receiveQtys[i] ?? pending}
                          onChange={e => setReceiveQtys(q => ({ ...q, [i]: Math.min(pending, parseInt(e.target.value) || 0) }))}
                          className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3 py-1.5 text-xs font-mono text-center rounded-xl focus:outline-none focus:border-blue-500" 
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              {receiveError && <p className="text-xs text-red-500 font-semibold">{receiveError}</p>}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-[var(--border-soft)]">
                <button onClick={() => setReceiveModal(null)} disabled={receiving} className="modern-btn px-4 py-2 text-xs uppercase">
                  Cancelar
                </button>
                <button onClick={confirmReceive} disabled={receiving} className="modern-btn-primary px-5 py-2 text-xs uppercase disabled:opacity-50">
                  {receiving ? 'Despachando...' : 'Confirmar Despacho'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirm Delete for Requerimientos */}
      {confirmDelete && (mainTab === 'log' || (mainTab === 'ops' && activeOpt === 'REQUIREMENT')) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-red-500/20 rounded-3xl shadow-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <div>
                <h3 className="text-sm font-black text-[var(--ink)] tracking-tight">¿Eliminar requerimiento?</h3>
                <p className="text-xs text-[var(--ink)]/50 mt-0.5">Esta acción es irreversible</p>
              </div>
            </div>
            <div className="flex justify-end gap-2.5 mt-5">
              <button onClick={() => setConfirmDelete(null)} className="modern-btn px-4 py-2 text-xs uppercase">
                Cancelar
              </button>
              <button onClick={() => { deletePurchaseOrder(confirmDelete!); setConfirmDelete(null); }} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-xl transition-all uppercase">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const OptButton = ({ icon, label, desc, active, onClick }: { icon: React.ReactNode; label: string; desc: string; active: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'group relative flex flex-col items-center justify-center p-5 rounded-2xl border transition-all duration-200 text-center cursor-pointer',
      active
        ? 'bg-[var(--surface)] border-blue-500/50 text-[var(--ink)] shadow-md ring-2 ring-blue-500/20'
        : 'bg-[var(--surface)] border-[var(--border-soft)] text-[var(--ink)]/70 hover:border-blue-500/30 hover:bg-[var(--surface)] hover:shadow-sm'
    )}
  >
    <div className={cn(
      'w-11 h-11 rounded-xl flex items-center justify-center mb-2.5 transition-transform duration-200 group-hover:scale-105',
      active
        ? 'bg-blue-600 text-white shadow-md'
        : 'bg-[var(--border-soft)]/50 text-[var(--ink)]/60'
    )}>
      {icon}
    </div>
    <span className="text-xs font-black uppercase tracking-wider">{label}</span>
    <span className="text-[10px] text-[var(--ink)]/50 mt-1 max-w-[240px] leading-relaxed">{desc}</span>
  </button>
);
