import React, { useState, useMemo } from 'react';
import { Rack3D, RackSlot3D } from '../../types/warehouse3d';
import { Product, Location, StockLevel } from '../../types';
import { getColorStyle } from '../../lib/colors';
import {
  X,
  Package,
  Layers,
  MapPin,
  QrCode,
  RotateCw,
  Move,
  Trash2,
  Copy,
  Plus,
  Search,
  Check,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { QRModal } from '../QRModal';

interface RackInspectorDrawerProps {
  rack: Rack3D | null;
  selectedSlotKey: string | null;
  products: Product[];
  locations: Location[];
  stockLevels: StockLevel[];
  onClose: () => void;
  onSelectSlot: (slotKey: string) => void;
  onUpdateRack: (updatedRack: Rack3D) => void;
  onDeleteRack: (rackId: string) => void;
  onDuplicateRack: (rack: Rack3D) => void;
  onAssignProduct: (slotKey: string, productId: string | null) => Promise<void>;
  onEnsureLocation: (slotKey: string) => Promise<string>;
}

export const RackInspectorDrawer: React.FC<RackInspectorDrawerProps> = ({
  rack,
  selectedSlotKey,
  products,
  locations,
  stockLevels,
  onClose,
  onSelectSlot,
  onUpdateRack,
  onDeleteRack,
  onDuplicateRack,
  onAssignProduct,
  onEnsureLocation,
}) => {
  const [productSearch, setProductSearch] = useState('');
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [qrModalLocation, setQrModalLocation] = useState<Location | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!rack) return null;

  // Estadísticas globales del rack
  const totalSlotsCount = rack.levels * rack.bays;
  const rackSlotsList: RackSlot3D[] = Object.values(rack.slots);
  const totalStockUnits = rackSlotsList.reduce((sum, s) => sum + (s.stockUnits || 0), 0);
  const totalCapacity = rackSlotsList.reduce((sum, s) => sum + (s.capacity || 150), 0);
  const occupancyPercent = totalCapacity > 0 ? Math.round((totalStockUnits / totalCapacity) * 100) : 0;

  // Slot actualmente seleccionado (o el primero por defecto)
  const activeKey = selectedSlotKey || '1-1';
  const activeSlot: RackSlot3D = rack.slots[activeKey] || {
    level: 1,
    bay: 1,
    code: `${rack.name.replace(/\s+/g, '-')}-N1-C1`,
    capacity: 150,
    stockUnits: 0,
  };

  // Filtrado de productos para asignación
  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products.slice(0, 40);
    return products.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.color || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q)
    ).slice(0, 40);
  }, [products, productSearch]);

  // Manejo de rotación en 90°
  const handleRotate = () => {
    const newRot = (rack.rotationY + Math.PI / 2) % (Math.PI * 2);
    onUpdateRack({ ...rack, rotationY: newRot });
  };

  // Manejo de traslación en pasos de 1 metro (grid snap)
  const handleMove = (dx: number, dz: number) => {
    const [x, y, z] = rack.position;
    onUpdateRack({
      ...rack,
      position: [Math.round(x + dx), y, Math.round(z + dz)],
    });
  };

  // Manejo de asignación de producto
  const handleSelectProduct = async (prod: Product | null) => {
    setAssigning(true);
    try {
      await onAssignProduct(activeKey, prod ? prod.id : null);
      setShowProductPicker(false);
    } finally {
      setAssigning(false);
    }
  };

  // Abrir QR para el slot actual
  const handleOpenQR = async () => {
    let loc = locations.find(l => l.name.toUpperCase().trim() === activeSlot.code.toUpperCase().trim() || l.id === activeSlot.locationId);
    if (!loc) {
      const newLocId = await onEnsureLocation(activeKey);
      loc = { id: newLocId, name: activeSlot.code, type: 'BIN' };
    }
    setQrModalLocation(loc);
  };

  return (
    <div
      className="w-80 md:w-96 h-full flex flex-col border-l shadow-2xl z-20 transition-all select-none overflow-hidden"
      style={{
        background: 'var(--bg-card)',
        borderColor: 'var(--border)',
        color: 'var(--ink)',
      }}
    >
      {/* Modal QR si se abre */}
      {qrModalLocation && (
        <QRModal location={qrModalLocation} onClose={() => setQrModalLocation(null)} />
      )}

      {/* Header del Inspector */}
      <div className="p-3.5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center p-1.5 shrink-0"
            style={{ background: `${rack.color || '#3b82f6'}20`, color: rack.color || '#3b82f6' }}
          >
            <Layers size={18} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-mono text-xs font-black uppercase tracking-tight truncate">
              {rack.name}
            </span>
            <span className="font-mono text-[9px] opacity-60 uppercase truncate">
              {rack.aisle} · {rack.bays} Cuerpos × {rack.levels} Pisos
            </span>
          </div>
        </div>

        {/* Acciones Rápidas en el Header */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleRotate}
            title="Girar 90°"
            className="p-1.5 rounded-lg opacity-60 hover:opacity-100 hover:text-sky-400 hover:bg-[var(--surface)] transition-all cursor-pointer"
          >
            <RotateCw size={15} />
          </button>
          <button
            type="button"
            onClick={() => onDuplicateRack(rack)}
            title="Duplicar este estante"
            className="p-1.5 rounded-lg opacity-60 hover:opacity-100 hover:text-sky-400 hover:bg-[var(--surface)] transition-all cursor-pointer"
          >
            <Copy size={15} />
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            title="Eliminar este estante"
            className="p-1.5 rounded-lg text-red-400 hover:text-red-500 hover:bg-red-500/15 transition-all cursor-pointer"
          >
            <Trash2 size={15} />
          </button>
          <div className="w-[1px] h-4 bg-[var(--border)] mx-0.5" />
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg opacity-60 hover:opacity-100 transition-opacity hover:bg-[var(--surface)] cursor-pointer"
            title="Cerrar panel"
          >
            <X size={17} />
          </button>
        </div>
      </div>

      {/* Banner de Confirmación Superior para Eliminar */}
      {confirmDelete && (
        <div className="p-3 bg-red-500/15 border-b border-red-500/30 flex flex-col gap-2 animate-in fade-in duration-100 select-none">
          <div className="flex items-center gap-2 text-red-400 font-mono text-xs font-black">
            <AlertTriangle size={15} className="shrink-0" />
            <span>¿Eliminar {rack.name}?</span>
          </div>
          <p className="font-mono text-[10px] text-slate-300">
            Se removerá permanentemente del escenario 3D y de este almacén.
          </p>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                onDeleteRack(rack.id);
                setConfirmDelete(false);
              }}
              className="flex-1 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-mono text-xs font-black shadow-md cursor-pointer transition-colors"
            >
              Sí, Eliminar
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1.5 rounded-lg border font-mono text-xs opacity-70 hover:opacity-100 cursor-pointer"
              style={{ borderColor: 'var(--border)' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Barra de progreso de Ocupación Global */}
      <div className="px-4 py-2.5 bg-[var(--surface)] border-b flex flex-col gap-1.5" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between text-[10px] font-mono font-bold">
          <span className="opacity-60 uppercase">Ocupación Total Rack</span>
          <span className={occupancyPercent > 80 ? 'text-red-500' : 'text-emerald-500'}>
            {totalStockUnits} / {totalCapacity} unds ({occupancyPercent}%)
          </span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
          <div
            className="h-full transition-all duration-300 rounded-full"
            style={{
              width: `${Math.min(100, occupancyPercent)}%`,
              background: occupancyPercent > 85 ? '#ef4444' : occupancyPercent > 50 ? '#f59e0b' : '#10b981',
            }}
          />
        </div>
      </div>

      {/* Contenido scrolleable */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
        {/* Matriz 2D Frontal de Niveles x Bahías */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider opacity-60">
              Matriz Frontal de Baldas
            </span>
            <span className="font-mono text-[9px] text-sky-500 font-bold">
              Clic para seleccionar casillero
            </span>
          </div>

          <div
            className="p-2 rounded-xl border flex flex-col gap-1.5 bg-[var(--surface)]"
            style={{ borderColor: 'var(--border)' }}
          >
            {/* Niveles de arriba hacia abajo (nivel mayor arriba) */}
            {Array.from({ length: rack.levels }, (_, i) => rack.levels - i).map(lvl => (
              <div key={lvl} className="flex items-center gap-1.5">
                <span className="font-mono text-[9px] font-bold opacity-40 w-5 text-right">
                  N{lvl}
                </span>
                <div className="flex-1 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${rack.bays}, minmax(0, 1fr))` }}>
                  {Array.from({ length: rack.bays }, (_, j) => j + 1).map(bay => {
                    const key = `${lvl}-${bay}`;
                    const slot = rack.slots[key];
                    const isSelected = activeKey === key;
                    const hasProduct = Boolean(slot?.productName);
                    const stock = slot?.stockUnits || 0;

                    let bgCell = 'bg-[var(--bg-card)]';
                    let borderCell = 'border-[var(--border)]';

                    if (isSelected) {
                      bgCell = 'bg-sky-500/20';
                      borderCell = 'border-sky-500 shadow-xs';
                    } else if (stock > 0) {
                      bgCell = 'bg-emerald-500/10';
                      borderCell = 'border-emerald-500/40';
                    }

                    return (
                      <button
                        key={bay}
                        type="button"
                        onClick={() => onSelectSlot(key)}
                        className={`h-8 rounded-lg border text-[9px] font-mono font-bold flex flex-col items-center justify-center transition-all cursor-pointer ${bgCell} ${borderCell}`}
                        title={`${slot?.code || `N${lvl}-C${bay}`} (${stock} unds)`}
                      >
                        <span className="leading-none text-[8px] opacity-60">C{bay}</span>
                        <span className={`leading-none text-[9px] ${stock > 0 ? 'text-emerald-500 font-black' : 'opacity-40'}`}>
                          {stock > 0 ? stock : '—'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ficha del Slot Seleccionado */}
        <div
          className="p-3.5 rounded-xl border flex flex-col gap-3"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sky-500" />
              <span className="font-mono text-xs font-black tracking-tight uppercase">
                {activeSlot.code}
              </span>
            </div>
            <button
              onClick={handleOpenQR}
              className="p-1 rounded hover:bg-[var(--bg-card)] transition-colors opacity-70 hover:opacity-100"
              title="Ver código QR para imprimir"
            >
              <QrCode size={16} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
            <div className="p-2 rounded-lg bg-[var(--bg-card)] border" style={{ borderColor: 'var(--border)' }}>
              <span className="opacity-50 block">PISO / ALTURA:</span>
              <span className="font-bold text-xs">Nivel {activeSlot.level}</span>
            </div>
            <div className="p-2 rounded-lg bg-[var(--bg-card)] border" style={{ borderColor: 'var(--border)' }}>
              <span className="opacity-50 block">CUERPO / COLUMNA:</span>
              <span className="font-bold text-xs">Columna {activeSlot.bay}</span>
            </div>
          </div>

          {/* Producto Asignado (Slotting) */}
          <div className="flex flex-col gap-1.5 mt-1">
            <span className="font-mono text-[9px] font-bold uppercase tracking-wider opacity-60">
              Producto / Prenda Asignada
            </span>

            {activeSlot.productName ? (
              <div
                className="p-2.5 rounded-xl border flex items-center justify-between gap-2"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-5 h-5 rounded-full shrink-0 border"
                    style={{
                      backgroundColor: activeSlot.productColor
                        ? getColorStyle(activeSlot.productColor).hex
                        : '#3b82f6',
                      borderColor: 'rgba(0,0,0,0.2)',
                    }}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="font-mono text-xs font-bold truncate">
                      {activeSlot.productName}
                    </span>
                    <span className="font-mono text-[9px] opacity-60 truncate">
                      Color: {activeSlot.productColor || '—'} · {activeSlot.productCategory || 'General'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setShowProductPicker(true)}
                  className="font-mono text-[9px] font-bold text-sky-500 hover:underline shrink-0"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowProductPicker(true)}
                className="w-full py-2.5 px-3 rounded-xl border border-dashed flex items-center justify-center gap-2 text-xs font-mono font-bold text-sky-500 hover:bg-sky-500/10 transition-colors cursor-pointer"
                style={{ borderColor: 'var(--border)' }}
              >
                <Plus size={14} /> Asignar Producto a esta Balda
              </button>
            )}

            {activeSlot.productName && (
              <button
                onClick={() => handleSelectProduct(null)}
                className="text-[9px] font-mono text-red-400 hover:underline self-end mt-0.5"
              >
                Quitar asignación
              </button>
            )}
          </div>

          {/* Stock Actual en este Slot */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-card)] border" style={{ borderColor: 'var(--border)' }}>
            <span className="font-mono text-[10px] opacity-60">Stock Físico Actual:</span>
            <span className={`font-mono text-xs font-black ${activeSlot.stockUnits > 0 ? 'text-emerald-500' : 'opacity-40'}`}>
              {activeSlot.stockUnits} unidades
            </span>
          </div>
        </div>

        {/* Controles de Posicionamiento y Rotación 3D del Rack */}
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider opacity-60">
            Ajuste Espacial 3D del Rack
          </span>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleRotate}
              className="p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-mono font-bold hover:bg-[var(--surface)] transition-all cursor-pointer"
              style={{ borderColor: 'var(--border)' }}
              title="Girar rack 90 grados"
            >
              <RotateCw size={14} /> Girar 90°
            </button>

            <button
              type="button"
              onClick={() => onDuplicateRack(rack)}
              className="p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-mono font-bold hover:bg-[var(--surface)] transition-all cursor-pointer"
              style={{ borderColor: 'var(--border)' }}
            >
              <Copy size={14} /> Duplicar
            </button>
          </div>

          {/* Mover en Pasos X / Z o Coordenadas exactas */}
          <div className="p-3 rounded-xl border flex flex-col gap-2.5 bg-[var(--surface)]" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] opacity-60 uppercase font-bold">
                Mover Estante en Cuadrícula
              </span>
              <span className="font-mono text-[8px] text-sky-400 font-bold">
                Paso: 0.5m
              </span>
            </div>

            {/* Inputs directos de coordenadas */}
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div className="flex items-center gap-1.5 p-1.5 rounded-lg border bg-[var(--bg-card)]" style={{ borderColor: 'var(--border)' }}>
                <span className="opacity-50 font-bold">X:</span>
                <input
                  type="number"
                  step="0.5"
                  value={rack.position[0]}
                  onChange={e => {
                    const val = parseFloat(e.target.value) || 0;
                    onUpdateRack({ ...rack, position: [val, rack.position[1], rack.position[2]] });
                  }}
                  className="w-full bg-transparent font-bold outline-none text-right"
                />
                <span className="opacity-40">m</span>
              </div>
              <div className="flex items-center gap-1.5 p-1.5 rounded-lg border bg-[var(--bg-card)]" style={{ borderColor: 'var(--border)' }}>
                <span className="opacity-50 font-bold">Z:</span>
                <input
                  type="number"
                  step="0.5"
                  value={rack.position[2]}
                  onChange={e => {
                    const val = parseFloat(e.target.value) || 0;
                    onUpdateRack({ ...rack, position: [rack.position[0], rack.position[1], val] });
                  }}
                  className="w-full bg-transparent font-bold outline-none text-right"
                />
                <span className="opacity-40">m</span>
              </div>
            </div>

            {/* Botones direccionales */}
            <div className="grid grid-cols-3 gap-1.5 max-w-[170px] mx-auto">
              <div />
              <button
                type="button"
                onClick={() => handleMove(0, -0.5)}
                className="p-1.5 rounded-lg border bg-[var(--bg-card)] text-xs font-mono font-bold hover:bg-sky-500/20 text-center"
                style={{ borderColor: 'var(--border)' }}
                title="Mover Norte (-Z)"
              >
                ▲
              </button>
              <div />
              <button
                type="button"
                onClick={() => handleMove(-0.5, 0)}
                className="p-1.5 rounded-lg border bg-[var(--bg-card)] text-xs font-mono font-bold hover:bg-sky-500/20 text-center"
                style={{ borderColor: 'var(--border)' }}
                title="Mover Oeste (-X)"
              >
                ◀
              </button>
              <div className="flex items-center justify-center font-mono text-[8px] opacity-40">
                MOVE
              </div>
              <button
                type="button"
                onClick={() => handleMove(0.5, 0)}
                className="p-1.5 rounded-lg border bg-[var(--bg-card)] text-xs font-mono font-bold hover:bg-sky-500/20 text-center"
                style={{ borderColor: 'var(--border)' }}
                title="Mover Este (+X)"
              >
                ▶
              </button>
              <div />
              <button
                type="button"
                onClick={() => handleMove(0, 0.5)}
                className="p-1.5 rounded-lg border bg-[var(--bg-card)] text-xs font-mono font-bold hover:bg-sky-500/20 text-center"
                style={{ borderColor: 'var(--border)' }}
                title="Mover Sur (+Z)"
              >
                ▼
              </button>
              <div />
            </div>

            <p className="text-[9px] font-mono text-center text-sky-400/80">
              💡 O haz clic y arrástralo con el ratón directamente en el escenario 3D.
            </p>
          </div>
        </div>

        {/* Zona Peligro: Eliminar Rack */}
        <div className="pt-2 border-t mt-auto" style={{ borderColor: 'var(--border)' }}>
          {confirmDelete ? (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex flex-col gap-2">
              <span className="font-mono text-xs font-bold text-red-500">
                ¿Eliminar {rack.name} del almacén 3D?
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onDeleteRack(rack.id)}
                  className="flex-1 py-1.5 rounded-lg bg-red-600 text-white font-mono text-xs font-bold hover:bg-red-700"
                >
                  Sí, Eliminar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 rounded-lg border font-mono text-xs opacity-70 hover:opacity-100"
                  style={{ borderColor: 'var(--border)' }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="w-full py-2 rounded-xl text-red-400 hover:text-red-500 hover:bg-red-500/10 font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Trash2 size={14} /> Eliminar este Rack
            </button>
          )}
        </div>
      </div>

      {/* Modal / Selector de Producto para Slotting */}
      {showProductPicker && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="w-full max-w-md rounded-2xl border shadow-2xl p-5 flex flex-col gap-4 max-h-[85vh] animate-in fade-in zoom-in-95 duration-150"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--ink)' }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--border)' }}>
              <div>
                <h3 className="font-mono font-bold text-sm uppercase">Asignar Prenda / Producto</h3>
                <span className="font-mono text-[10px] opacity-60">Para balda {activeSlot.code}</span>
              </div>
              <button
                onClick={() => setShowProductPicker(false)}
                className="p-1 rounded-lg opacity-60 hover:opacity-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Búsqueda rápida */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
              <input
                type="text"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                placeholder="Buscar por nombre, código o color..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border bg-[var(--surface)] text-xs font-mono outline-none focus:border-sky-500"
                style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
                autoFocus
              />
            </div>

            {/* Lista de productos */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 max-h-72 pr-1">
              {filteredProducts.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectProduct(p)}
                  disabled={assigning}
                  className="flex items-center justify-between p-2.5 rounded-xl border text-left transition-all hover:bg-[var(--surface)] cursor-pointer group"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-4 h-4 rounded-full shrink-0 border"
                      style={{
                        backgroundColor: p.color ? getColorStyle(p.color).hex : '#3b82f6',
                        borderColor: 'rgba(0,0,0,0.2)',
                      }}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="font-mono text-xs font-bold truncate group-hover:text-sky-500">
                        {p.name}
                      </span>
                      <span className="font-mono text-[9px] opacity-50 truncate">
                        {p.code} · Color: {p.color || '—'} · Talla: {p.size || '—'}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="opacity-40 group-hover:opacity-100 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
