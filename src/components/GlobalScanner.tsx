import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { ScanLine, X, ShoppingCart, Plus, Minus, Check } from 'lucide-react';
import { useCart } from '../store/CartContext';
import { useAppContext } from '../store/AppContext';
import { DispatchCart } from './DispatchCart';

export function GlobalScanner() {
  const { isScannerOpen, setIsScannerOpen, isCartOpen, setIsCartOpen, items, addItem } = useCart();
  const { products, activeBrand, locations, stockLevels } = useAppContext();
  
  const [scannedModel, setScannedModel] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [qty, setQty] = useState(1);
  const [maxQty, setMaxQty] = useState(0);
  
  useEffect(() => {
    if (!isScannerOpen) {
      setScannedModel(null);
      return;
    }

    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: {width: 250, height: 250}, rememberLastUsedCamera: true },
      /* verbose= */ false
    );

    scanner.render((decodedText) => {
      // Intentar parsear el texto
      // Esperamos algo como: http://localhost:3000/#/q/CAMISA%20WAFFLE?b=OVERSHARK
      try {
        if (decodedText.includes('#/q/')) {
          const parts = decodedText.split('#/q/');
          const qs = parts[1].split('?');
          const modelName = decodeURIComponent(qs[0]);
          setScannedModel(modelName);
          scanner.clear();
        } else {
          // Si es un código de barras normal o nombre directo
          setScannedModel(decodedText);
          scanner.clear();
        }
      } catch (e) {
        console.error("No se pudo leer el QR:", e);
      }
    }, (error) => {
      // ignorar errores continuos
    });

    return () => {
      scanner.clear().catch(e => console.error(e));
    };
  }, [isScannerOpen]);

  // Al tener un modelo escaneado, filtramos los productos
  const availableProducts = scannedModel ? products.filter(p => p.brand === activeBrand && p.name.toUpperCase() === scannedModel.toUpperCase()) : [];
  
  // Al seleccionar producto, calculamos maxQty basado en el location seleccionado (o sugerimos el primero)
  useEffect(() => {
    if (availableProducts.length > 0 && !selectedProduct) {
      setSelectedProduct(availableProducts[0].id);
    }
  }, [availableProducts, selectedProduct]);

  useEffect(() => {
    if (selectedProduct) {
      // Find stock in BIN location first, or any location
      const stocks = stockLevels.filter(s => s.productId === selectedProduct && s.quantity > 0);
      if (stocks.length > 0) {
        setSelectedLocation(stocks[0].locationId);
        setMaxQty(stocks[0].quantity);
      } else {
        setSelectedLocation('');
        setMaxQty(0);
      }
      setQty(1);
    }
  }, [selectedProduct, stockLevels]);

  const handleAddToCart = () => {
    if (!selectedProduct || !selectedLocation || qty <= 0) return;
    
    const prod = products.find(p => p.id === selectedProduct);
    const loc = locations.find(l => l.id === selectedLocation);
    if (!prod || !loc) return;

    addItem({
      productId: prod.id,
      locationId: loc.id,
      quantity: qty,
      details: {
        model: prod.name,
        color: prod.color || 'N/A',
        size: prod.size || 'N/A',
        locationName: loc.name
      }
    });

    setScannedModel(null);
    setIsScannerOpen(false);
  };

  const totalCartItems = items.reduce((acc, i) => acc + i.quantity, 0);

  return (
    <>
      {/* Botones Flotantes */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-4">
        {totalCartItems > 0 && (
          <button 
            onClick={() => setIsCartOpen(true)}
            className="w-14 h-14 bg-[var(--accent)] text-[var(--bg)] rounded-full shadow-2xl flex items-center justify-center hover:scale-105 transition-transform relative"
          >
            <ShoppingCart size={24} />
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-[var(--bg)]">
              {totalCartItems}
            </span>
          </button>
        )}
        
        <button 
          onClick={() => setIsScannerOpen(true)}
          className="w-14 h-14 bg-[var(--ink)] text-[var(--bg)] rounded-full shadow-2xl flex items-center justify-center hover:scale-105 transition-transform"
        >
          <ScanLine size={24} />
        </button>
      </div>

      <DispatchCart />

      {/* Modal de Escáner */}
      {isScannerOpen && !scannedModel && (
        <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center p-4">
          <div className="absolute top-4 right-4 z-[101]">
            <button onClick={() => setIsScannerOpen(false)} className="bg-white/20 p-2 rounded-full text-white">
              <X size={24} />
            </button>
          </div>
          <div className="w-full max-w-md bg-white rounded-xl overflow-hidden">
            <div id="reader" className="w-full"></div>
            <div className="p-4 text-center">
              <p className="font-mono text-xs font-bold text-gray-800">APUNTA AL CÓDIGO QR O DE BARRAS</p>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Selección tras escanear */}
      {scannedModel && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[var(--bg)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-[var(--border)]">
              <h3 className="font-black tracking-widest text-lg">AÑADIR A CARRO</h3>
              <button onClick={() => setScannedModel(null)}><X size={20} /></button>
            </div>

            <div className="p-6 flex flex-col gap-6">
              <div>
                <p className="text-[10px] tracking-widest opacity-50 uppercase mb-1">Modelo Escaneado</p>
                <p className="text-xl font-black">{scannedModel}</p>
              </div>

              {availableProducts.length === 0 ? (
                <div className="p-4 bg-red-500/10 text-red-500 rounded border border-red-500/20 text-center">
                  <p className="font-bold text-sm tracking-widest uppercase">No se encontró el modelo</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-[10px] tracking-widest opacity-50 uppercase mb-2 block">Seleccionar Variante</label>
                    <select 
                      value={selectedProduct} 
                      onChange={e => setSelectedProduct(e.target.value)}
                      className="w-full bg-[var(--surface)] border border-[var(--border)] rounded p-3 text-sm focus:outline-none"
                    >
                      {availableProducts.map(p => {
                        const s = stockLevels.filter(st => st.productId === p.id).reduce((a, b) => a + b.quantity, 0);
                        return (
                          <option key={p.id} value={p.id}>
                            {p.color} - {p.size} (Stock total: {s})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {maxQty > 0 ? (
                    <>
                      <div>
                        <label className="text-[10px] tracking-widest opacity-50 uppercase mb-2 block">Ubicación Origen</label>
                        <select 
                          value={selectedLocation} 
                          onChange={e => {
                            setSelectedLocation(e.target.value);
                            const st = stockLevels.find(s => s.productId === selectedProduct && s.locationId === e.target.value);
                            setMaxQty(st?.quantity || 0);
                            setQty(1);
                          }}
                          className="w-full bg-[var(--surface)] border border-[var(--border)] rounded p-3 text-sm focus:outline-none"
                        >
                          {stockLevels.filter(s => s.productId === selectedProduct && s.quantity > 0).map(s => {
                            const l = locations.find(loc => loc.id === s.locationId);
                            return (
                              <option key={s.locationId} value={s.locationId}>
                                {l?.name} ({s.quantity} disp.)
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] tracking-widest opacity-50 uppercase mb-2 block">Cantidad a Despachar</label>
                        <div className="flex items-center gap-4">
                          <button 
                            onClick={() => setQty(Math.max(1, qty - 1))}
                            className="w-12 h-12 flex items-center justify-center bg-[var(--surface)] border border-[var(--border)] rounded hover:bg-[var(--border)]"
                          >
                            <Minus size={20} />
                          </button>
                          <div className="flex-1 text-center font-black text-2xl">
                            {qty}
                          </div>
                          <button 
                            onClick={() => setQty(Math.min(maxQty, qty + 1))}
                            className="w-12 h-12 flex items-center justify-center bg-[var(--surface)] border border-[var(--border)] rounded hover:bg-[var(--border)]"
                          >
                            <Plus size={20} />
                          </button>
                        </div>
                      </div>
                      
                      <button 
                        onClick={handleAddToCart}
                        className="w-full bg-[var(--accent)] text-[var(--bg)] p-4 rounded-lg font-bold tracking-widest uppercase flex justify-center gap-2 items-center hover:brightness-110 mt-2"
                      >
                        <Check size={20} /> Añadir al Carrito
                      </button>
                    </>
                  ) : (
                    <div className="p-4 bg-orange-500/10 text-orange-500 rounded border border-orange-500/20 text-center">
                      <p className="font-bold text-sm tracking-widest uppercase">Sin stock disponible</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
