import React, { useState, useMemo, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, RefreshCw, Package, Search, Layers, QrCode, Sparkles } from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { cn } from '../lib/utils';

export function QRs() {
  const { activeBrand, products, stockLevels } = useAppContext();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showOnlyWithStock, setShowOnlyWithStock] = useState(false);

  // Total stock per product id
  const productStock = useMemo(() => {
    const map = new Map<string, number>();
    stockLevels.forEach(s => {
      map.set(s.productId, (map.get(s.productId) ?? 0) + s.quantity);
    });
    return map;
  }, [stockLevels]);

  // One QR per MODEL (unique product name). The QR opens the StockViewer for that
  // model, which then shows colors as buttons → sizes → quantities.
  const qrModels = useMemo(() => {
    const byName = new Map<string, { name: string; qty: number; variants: number }>();
    products.forEach(p => {
      const key = (p.name || '').trim();
      if (!key) return;
      const qty = productStock.get(p.id) ?? 0;
      const existing = byName.get(key);
      if (existing) {
        existing.qty += qty;
        existing.variants += 1;
      } else {
        byName.set(key, { name: key, qty, variants: 1 });
      }
    });
    const merged = Array.from(byName.values());
    return merged
      .filter(m => { if (showOnlyWithStock) return m.qty > 0; return true; })
      .filter(m => {
        const s = search.toLowerCase();
        if (!s) return true;
        return m.name.toLowerCase().includes(s);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, productStock, search, showOnlyWithStock]);

  // Number of models with stock
  const totalWithStock = useMemo(() => {
    const qtyByName = new Map<string, number>();
    products.forEach(p => {
      const key = (p.name || '').trim();
      if (!key) return;
      const q = productStock.get(p.id) ?? 0;
      qtyByName.set(key, (qtyByName.get(key) ?? 0) + q);
    });
    let count = 0;
    qtyByName.forEach(q => { if (q > 0) count++; });
    return count;
  }, [products, productStock]);

  // QR value points to the StockViewer route for this model.
  const getQRValue = (modelName: string) => {
    const baseUrl = window.location.origin + window.location.pathname; // includes /index.html if present
    const safeModel = encodeURIComponent(modelName.trim());
    const safeBrand = encodeURIComponent(activeBrand);
    return `${baseUrl}#/q/${safeModel}?b=${safeBrand}`;
  };

  const doRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  };

  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Print a single model's QR as a physical label
  const printOne = (modelName: string) => {
    const m = qrModels.find(x => x.name === modelName);
    if (!m) return;
    
    const card = cardRefs.current.get(modelName);
    if (!card) return;
    
    // Extract the SVG from the rendered card
    const svgElement = card.querySelector('svg');
    const svgHtml = svgElement ? svgElement.outerHTML : '';

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Impresión QR — ${modelName}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { 
          font-family: system-ui, -apple-system, sans-serif; 
          background: #fff; color: #000; 
          padding: 40px; 
          display: flex; 
          justify-content: center; 
        }
        .a4-page {
          width: 210mm;
          min-height: 297mm;
          border: 4px solid #000;
          padding: 40px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .header {
          text-align: center;
          margin-bottom: 40px;
          width: 100%;
          border-bottom: 4px solid #000;
          padding-bottom: 20px;
        }
        .brand { 
          font-size: 24px; 
          font-weight: 900; 
          text-transform: uppercase; 
          letter-spacing: 4px; 
          margin-bottom: 10px;
          color: #444;
        }
        .model { 
          font-size: 64px; 
          font-weight: 900; 
          text-align: center; 
          line-height: 1.1; 
          text-transform: uppercase; 
        }
        .qr-box { 
          padding: 20px; 
          border: 4px solid #000; 
          border-radius: 12px; 
          margin-bottom: 40px;
          background: #fff;
        }
        .qr-box svg { 
          width: 350px !important; 
          height: 350px !important; 
          display: block; 
        }
        .details-box {
          border: 4px solid #000;
          width: 100%;
          padding: 20px;
          font-size: 24px;
          font-weight: 700;
          display: flex;
          justify-content: space-between;
          text-transform: uppercase;
        }
        .info-label {
          font-size: 16px;
          color: #666;
          display: block;
          margin-bottom: 4px;
        }
        @media print { 
          @page { size: A4 portrait; margin: 0; }
          body { padding: 0; } 
          .a4-page { border: none; min-height: 100vh; }
        }
      </style></head><body>
        <div class="a4-page">
          <div class="header">
            <div class="brand">${activeBrand.replace('_', ' ')}</div>
            <div class="model">${m.name}</div>
          </div>
          
          <div class="qr-box">${svgHtml}</div>
          
          <div class="details-box">
            <div>
              <span class="info-label">Variantes registradas</span>
              ${m.variants} variante${m.variants !== 1 ? 's' : ''}
            </div>
            <div style="text-align: right">
              <span class="info-label">Escanear para</span>
              Ver inventario en vivo
            </div>
          </div>
        </div>
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  const handlePrintAll = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    
    let allPagesHtml = '';
    
    qrModels.forEach(m => {
      const card = cardRefs.current.get(m.name);
      if (!card) return;
      
      const svgElement = card.querySelector('svg');
      const svgHtml = svgElement ? svgElement.outerHTML : '';
      
      allPagesHtml += `
        <div class="a4-page">
          <div class="header">
            <div class="brand">${activeBrand.replace('_', ' ')}</div>
            <div class="model">${m.name}</div>
          </div>
          
          <div class="qr-box">${svgHtml}</div>
          
          <div class="details-box">
            <div>
              <span class="info-label">Variantes registradas</span>
              ${m.variants} variante${m.variants !== 1 ? 's' : ''}
            </div>
            <div style="text-align: right">
              <span class="info-label">Escanear para</span>
              Ver inventario en vivo
            </div>
          </div>
        </div>
      `;
    });

    win.document.write(`
      <html><head><title>Impresión de todos los QRs</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { 
          font-family: system-ui, -apple-system, sans-serif; 
          background: #f0f0f0; color: #000; 
          display: flex; 
          flex-direction: column;
          align-items: center; 
          gap: 20px;
          padding: 20px;
        }
        .a4-page {
          width: 210mm;
          height: 297mm;
          border: 4px solid #000;
          padding: 40px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: white;
          page-break-after: always;
        }
        .header {
          text-align: center;
          margin-bottom: 40px;
          width: 100%;
          border-bottom: 4px solid #000;
          padding-bottom: 20px;
        }
        .brand { 
          font-size: 24px; 
          font-weight: 900; 
          text-transform: uppercase; 
          letter-spacing: 4px; 
          margin-bottom: 10px;
          color: #444;
        }
        .model { 
          font-size: 64px; 
          font-weight: 900; 
          text-align: center; 
          line-height: 1.1; 
          text-transform: uppercase; 
        }
        .qr-box { 
          padding: 20px; 
          border: 4px solid #000; 
          border-radius: 12px; 
          margin-bottom: 40px;
          background: #fff;
        }
        .qr-box svg { 
          width: 350px !important; 
          height: 350px !important; 
          display: block; 
        }
        .details-box {
          border: 4px solid #000;
          width: 100%;
          padding: 20px;
          font-size: 24px;
          font-weight: 700;
          display: flex;
          justify-content: space-between;
          text-transform: uppercase;
        }
        .info-label {
          font-size: 16px;
          color: #666;
          display: block;
          margin-bottom: 4px;
        }
        @media print { 
          @page { size: A4 portrait; margin: 0; }
          body { padding: 0; background: white; } 
          .a4-page { border: none; height: 100vh; }
        }
      </style></head><body>
        ${allPagesHtml}
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 800);
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-12 animate-fade-in">
      {/* Module Header */}
      <ModuleInfo
        number="18"
        title="Códigos QR por Modelo"
        description="Generación de etiquetas QR de alta fidelidad. Al escanear desde cualquier smartphone, abre la ficha técnica con stock disponible por talla y color en tiempo real."
      />

      {/* Main Actions & Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-[var(--surface)] border border-[var(--border-soft)] p-4 rounded-3xl shadow-xs no-print">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 sm:max-w-md">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink)]/40" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar modelo textil..."
              className="input-technical rounded-xl text-xs py-2.5 pl-10 pr-4 w-full"
            />
          </div>

          <button
            onClick={() => setShowOnlyWithStock(v => !v)}
            className={cn(
              "px-3.5 py-2.5 rounded-xl font-mono text-xs font-bold transition-all duration-150 border shrink-0 flex items-center gap-2",
              showOnlyWithStock
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                : "bg-[var(--surface-alt)]/60 border-[var(--border-soft)] text-[var(--ink)]/60 hover:text-[var(--ink)]"
            )}
          >
            <Package size={14} />
            <span className="hidden md:inline">Solo con Stock</span>
            <span className="px-1.5 py-0.2 bg-[var(--ink)]/10 rounded-md text-[10px]">{totalWithStock}</span>
          </button>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={doRefresh}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] hover:bg-[var(--surface-alt)] font-mono text-xs font-bold text-[var(--ink)]/70 transition-colors shrink-0"
            title="Actualizar listado"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>

          <button 
            onClick={handlePrintAll}
            disabled={qrModels.length === 0}
            className="modern-btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs shadow-xs shrink-0 disabled:opacity-50"
          >
            <Printer size={15} />
            <span>Imprimir Todos (A4)</span>
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <span className="font-mono text-xs text-[var(--ink)]/50 uppercase tracking-wider">
          {qrModels.length} modelo{qrModels.length !== 1 ? 's' : ''} en catálogo ({activeBrand.replace('_', ' ')})
        </span>
      </div>

      {qrModels.length === 0 ? (
        <div className="modern-card p-16 rounded-3xl text-center space-y-3 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-[var(--surface-alt)] text-[var(--ink)]/30 flex items-center justify-center mx-auto">
            <Layers size={28} />
          </div>
          <h4 className="font-mono text-sm font-bold text-[var(--ink)]">No hay modelos para mostrar</h4>
          <p className="font-mono text-xs text-[var(--ink)]/40 max-w-sm mx-auto">
            No se encontraron prendas con los criterios de búsqueda actuales.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {qrModels.map((m) => (
            <div
              key={m.name}
              ref={(el) => {
                if (el) cardRefs.current.set(m.name, el);
                else cardRefs.current.delete(m.name);
              }}
              className="modern-card rounded-3xl p-5 flex flex-col items-center justify-between text-center transition-all duration-200 hover:shadow-lg hover:border-[var(--ink)]/30 group"
            >
              <div className="w-full">
                <h3 className="font-mono text-xs font-bold tracking-tight text-[var(--ink)] uppercase line-clamp-2 min-h-[32px] mb-3">
                  {m.name}
                </h3>

                {/* QR Container */}
                <div className="p-3 bg-white rounded-2xl shadow-xs border border-slate-100 dark:border-slate-800 mx-auto w-fit mb-3 transition-transform group-hover:scale-105 duration-200">
                  <QRCodeSVG
                    value={getQRValue(m.name)}
                    size={130}
                    level="Q"
                    includeMargin={false}
                  />
                </div>

                <div className="font-mono text-[10px] text-[var(--ink)]/50 uppercase tracking-wider mb-2">
                  {m.variants} variante{m.variants !== 1 ? 's' : ''}
                </div>
              </div>

              <div className="w-full space-y-2 pt-2 border-t border-[var(--border-soft)]">
                <div className={cn(
                  "w-full py-1.5 rounded-xl font-mono text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 border",
                  m.qty > 0
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                    : "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
                )}>
                  <span className={`w-1.5 h-1.5 rounded-full ${m.qty > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                  <span>{m.qty > 0 ? `${m.qty} unidades` : 'Sin stock'}</span>
                </div>

                <button
                  onClick={() => printOne(m.name)}
                  className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl font-mono text-xs font-bold text-[var(--ink)]/70 hover:text-[var(--ink)] bg-[var(--surface-alt)] hover:bg-[var(--ink)]/10 transition-colors"
                >
                  <Printer size={13} />
                  <span>Imprimir A4</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Estilos para impresión */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
