import React, { useState } from 'react';
import { X, Trash2, Send, Plus, Minus, AlertTriangle, CheckCircle2, ShoppingCart } from 'lucide-react';
import { useCart } from '../store/CartContext';
import { useAppContext } from '../store/AppContext';

export function DispatchCart() {
  const { isCartOpen, setIsCartOpen, items, updateQuantity, removeItem, clearCart, processCart } = useCart();
  const { contacts, stockLevels } = useAppContext();
  
  const [selectedContact, setSelectedContact] = useState<string>('');
  const [reference, setReference] = useState('');
  const [processing, setProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isCartOpen) return null;

  const handleProcess = async () => {
    if (items.length === 0) return;
    setProcessing(true);
    setSuccessMsg('');
    setErrorMsg('');

    const { success, error } = await processCart(selectedContact || null, reference);
    
    setProcessing(false);
    if (success) {
      setSuccessMsg('¡Despacho masivo completado con éxito!');
      setSelectedContact('');
      setReference('');
      setTimeout(() => {
        setSuccessMsg('');
        setIsCartOpen(false);
      }, 2000);
    } else {
      setErrorMsg(error || 'Ocurrió un error');
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/50 flex justify-end">
      <div className="w-full max-w-md bg-[var(--bg)] h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-[var(--border)] bg-[var(--surface)]">
          <h2 className="text-lg font-black tracking-widest flex items-center gap-2">
            CARRITO DE DESPACHO
          </h2>
          <button 
            onClick={() => setIsCartOpen(false)}
            className="p-2 hover:bg-[var(--border)] rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {successMsg && (
            <div className="bg-green-500/10 border border-green-500/20 text-green-500 p-4 rounded flex items-center gap-3">
              <CheckCircle2 size={24} />
              <p className="font-bold text-sm tracking-widest uppercase">{successMsg}</p>
            </div>
          )}

          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded flex items-center gap-3">
              <AlertTriangle size={24} />
              <p className="font-bold text-sm tracking-widest uppercase">{errorMsg}</p>
            </div>
          )}

          {items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center opacity-50">
              <ShoppingCart size={48} className="mb-4" />
              <p className="tracking-widest uppercase text-sm font-bold">Carrito vacío</p>
            </div>
          ) : (
            <>
              {/* Lista de Items */}
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] tracking-widest opacity-50 uppercase">Prendas ({items.length})</span>
                  <button onClick={clearCart} className="text-[10px] tracking-widest uppercase text-red-500 font-bold hover:underline">
                    Vaciar todo
                  </button>
                </div>
                
                {items.map(item => {
                  const maxStock = stockLevels.find(s => s.productId === item.productId && s.locationId === item.locationId)?.quantity || 0;
                  
                  return (
                    <div key={item.id} className="bg-[var(--surface)] border border-[var(--border)] p-3 rounded flex gap-4 items-center">
                      <div className="flex-1">
                        <p className="font-bold text-sm line-clamp-1">{item.details.model}</p>
                        <p className="text-[10px] tracking-widest opacity-50 uppercase mt-1">
                          {item.details.color} - {item.details.size}
                        </p>
                        <p className="text-[10px] tracking-widest text-[var(--accent)] uppercase mt-1">
                          De: {item.details.locationName}
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-3 bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1">
                        <button 
                          onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                          className="hover:text-[var(--accent)]"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="font-mono font-bold text-sm w-6 text-center">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.id, Math.min(maxStock, item.quantity + 1))}
                          className="hover:text-[var(--accent)]"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      
                      <button 
                        onClick={() => removeItem(item.id)}
                        className="text-red-500/50 hover:text-red-500 p-2"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Formulario de Checkout */}
              <div className="border-t border-[var(--border)] pt-6 flex flex-col gap-4 mt-auto">
                <div>
                  <label className="text-[10px] tracking-widest opacity-50 uppercase mb-2 block">
                    Contacto Destino (Opcional)
                  </label>
                  <select
                    value={selectedContact}
                    onChange={(e) => setSelectedContact(e.target.value)}
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded p-3 text-sm focus:outline-none"
                  >
                    <option value="">Seleccione un contacto...</option>
                    {contacts.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="text-[10px] tracking-widest opacity-50 uppercase mb-2 block">
                    Referencia / Motivo
                  </label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Ej. PEDIDO-1234"
                    className="w-full bg-[var(--surface)] border border-[var(--border)] rounded p-3 text-sm focus:outline-none placeholder:opacity-30"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[var(--border)] bg-[var(--surface)]">
          <button
            onClick={handleProcess}
            disabled={items.length === 0 || processing}
            className="w-full bg-[var(--accent)] text-[var(--bg)] p-4 rounded font-bold tracking-widest uppercase flex items-center justify-center gap-2 disabled:opacity-50 hover:brightness-110 transition-all"
          >
            {processing ? (
              <>Procesando...</>
            ) : (
              <>
                <Send size={18} /> Procesar Despachos
              </>
            )}
          </button>
        </div>
        
      </div>
    </div>
  );
}

