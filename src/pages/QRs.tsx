import React, { useState, useMemo, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, RefreshCw, Package, Search, Layers } from 'lucide-react';
import { useAppContext } from '../store/AppContext';

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

  // Print a single model's QR as a physical label (uses the already-rendered QR svg
  // from that card so we don't need to re-generate it in a blank window).
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
          width: 210mm; /* A4 width */
          min-height: 297mm; /* A4 height */
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
    // Generate A4 pages for all models
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
        .a4-page:last-child {
          page-break-after: auto;
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
    <div className="flex flex-col h-full bg-[var(--bg)] p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-widest text-[var(--ink)]">CÓDIGOS QR · MODELOS</h1>
          <p className="text-sm text-[var(--ink)]/50 tracking-widest uppercase mt-1">
            Un QR por modelo en inventario ({activeBrand})
          </p>
        </div>

        <div className="flex gap-2 no-print flex-wrap">
          <button
            onClick={doRefresh}
            className="flex items-center gap-2 px-3 py-2 border border-[var(--border)] rounded font-mono text-xs tracking-widest hover:bg-[var(--surface)] transition-colors"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            ACTUALIZAR
          </button>
          <button 
            onClick={handlePrintAll}
            className="flex items-center gap-2 px-3 py-2 bg-[var(--accent)] text-[var(--bg)] rounded font-mono text-xs tracking-widest font-bold hover:brightness-110 transition-all"
          >
            <Printer size={14} />
            IMPRIMIR TODOS (A4)
          </button>
        </div>
      </div>

      {/* Toolbar: search + stock filter */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4 no-print">
        <div className="relative flex-1 sm:max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-40" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="BUSCAR MODELO..."
            className="w-full bg-[var(--surface)] border border-[var(--border)]/40 rounded-lg pl-8 pr-3 py-2 font-mono text-xs font-bold uppercase focus:outline-none focus:border-[var(--border)] transition-all"
          />
        </div>
        <button
          onClick={() => setShowOnlyWithStock(v => !v)}
          className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-mono text-xs font-bold uppercase transition-all border ${
            showOnlyWithStock
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-[var(--surface)] border-[var(--border)]/40 text-[var(--ink)] hover:bg-[var(--border)]/10'
          }`}
        >
          <Package size={14} />
          SOLO CON STOCK ({totalWithStock})
        </button>
      </div>

            <div className="font-mono text-[10px] uppercase tracking-widest opacity-50 mb-3">
        {qrModels.length} modelo{qrModels.length !== 1 ? 's' : ''} {activeBrand}
      </div>

      {qrModels.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[var(--ink)]/40">
          <Layers size={40} />
          <p className="font-mono text-xs uppercase tracking-widest text-center">
            No hay modelos en inventario para mostrar
          </p>
          <p className="font-mono text-[10px] uppercase tracking-widest opacity-60">
            Los QRs se generan automáticamente al crear un producto
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-6 print:grid-cols-3 print:gap-3 print:p-0">
            {qrModels.map((m) => (
              <div
                key={m.name}
                ref={(el) => {
                  if (el) cardRefs.current.set(m.name, el);
                  else cardRefs.current.delete(m.name);
                }}
                className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 flex flex-col items-center text-center hover:shadow-md transition-shadow print:break-inside-avoid print:border-black print:bg-white"
              >
                {/* Model name */}
                <h3 className="font-mono text-[11px] sm:text-xs font-bold tracking-wide uppercase line-clamp-2 min-h-[32px] mb-2">
                  {m.name}
                </h3>

                {/* QR — opens the StockViewer for the model */}
                <div className="bg-white p-1.5 rounded mb-2 border border-black/5">
                  <QRCodeSVG
                    value={getQRValue(m.name)}
                    size={120}
                    level="Q"
                    includeMargin={false}
                  />
                </div>

                {/* Variants */}
                <div className="font-mono text-[9px] opacity-60 uppercase tracking-wider mt-1">
                  {m.variants} variante{(m.variants !== 1) ? 's' : ''}
                </div>

                {/* Stock badge */}
                <div className={`mt-2 w-full rounded-lg border py-1.5 flex items-center justify-center gap-1.5 font-mono text-xs font-black uppercase tracking-wider ${
                  m.qty > 0
                    ? 'bg-green-500/10 border-green-500/30 text-green-600'
                    : 'bg-red-500/10 border-red-500/30 text-red-500'
                }`}>
                  <Package size={13} />
                  {m.qty > 0 ? `${m.qty} uds` : 'sin stock'}
                </div>

                {/* Print one label */}
                <button
                  onClick={() => printOne(m.name)}
                  className="no-print no-print-label mt-1 flex items-center justify-center gap-1.5 w-full px-2 py-1.5 border border-[var(--border)] rounded-lg font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--ink)] hover:bg-[var(--ink)] hover:text-[var(--bg)] transition-colors active:scale-95"
                >
                  <Printer size={12} />
                  IMPRIMIR
                </button>
              </div>
          ))}
          </div>
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
          .print\\:grid-cols-3 {
            visibility: visible;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print\\:grid-cols-3 * {
            visibility: visible;
          }
        }
      `}</style>
    </div>
  );
}
