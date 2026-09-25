import React, { useRef } from 'react';
import { Printer, X } from 'lucide-react';
import { OperationGuide, TYPE_META, BRAND_ABBR, BRAND_NAME } from './constants';

export interface GuideModalProps {
  guide: OperationGuide;
  onClose: () => void;
}

export const GuideModal: React.FC<GuideModalProps> = ({ guide, onClose }) => {
  const printRef = useRef<HTMLDivElement>(null);
  const meta = TYPE_META[guide.type];
  const totalQty = guide.items.reduce((sum, i) => sum + i.quantity, 0);

  const handlePrint = async () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const logoB64 = await fetch('/Zazu/zazu-logo/zazu-light mode.png')
      .then(r => r.blob())
      .then(b => new Promise<string>(res => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(b); }))
      .catch(() => '');
    const brandAbbr = BRAND_ABBR[guide.brand] ?? 'LZ';

    const itemsHTML = guide.items.length === 1
      ? `<div class="section">
          <div class="section-title">Producto</div>
          <div class="product-name">${guide.items[0].productName}</div>
          <div class="product-code">${guide.items[0].productCode}${guide.items[0].serialNumber ? ' // S/N: ' + guide.items[0].serialNumber : ''}</div>
          <div class="qty-box">${guide.items[0].quantity} UND</div>
        </div>`
      : `<div class="section">
          <div class="section-title">Productos (${guide.items.length} líneas)</div>
          <table class="items-table">
            <thead><tr><th>Código</th><th>Producto</th><th class="right">Cant.</th></tr></thead>
            <tbody>${guide.items.map(it => `<tr><td class="code">${it.productCode}</td><td class="name">${it.productName}</td><td class="right qty">${it.quantity}</td></tr>`).join('')}</tbody>
            <tfoot><tr><td colspan="2" class="total-label">TOTAL</td><td class="right total-qty">${totalQty}</td></tr></tfoot>
          </table>
        </div>`;

    const photoHTML = guide.photo
      ? `<div class="section">
          <div class="section-title">Evidencia fotográfica</div>
          <img class="photo-img" src="${guide.photo}" alt="evidencia"/>
        </div>`
      : '';

    const sigHTML = guide.signature
      ? `<div class="sig-section">
          <div class="section-title">Firma de conformidad</div>
          <img class="sig-img" src="${guide.signature}" alt="firma"/>
        </div>`
      : '';

    const flowHTML = (guide.fromLocation || guide.toLocation)
      ? `<div class="section">
          <div class="section-title">Movimiento</div>
          <div class="flow">
            ${guide.fromLocation ? `<div class="flow-box"><div class="flow-label">Origen</div><div class="flow-name">${guide.fromLocation}</div></div>` : ''}
            ${guide.fromLocation && guide.toLocation ? `<div class="flow-arrow">${meta.icon}</div>` : ''}
            ${guide.toLocation ? `<div class="flow-box"><div class="flow-label">Destino</div><div class="flow-name">${guide.toLocation}</div></div>` : ''}
          </div>
        </div>`
      : '';

    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Guía ${guide.number}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Courier New',monospace;background:#fff;display:flex;justify-content:center;padding:32px 16px}
      .doc{width:420px;border:2px solid #141414}
      .stripe{height:6px;background:${meta.accentColor}}
      .top{padding:16px 20px 14px;border-bottom:2px solid #141414;display:flex;justify-content:space-between;align-items:center;gap:12px}
      .top-left{display:flex;align-items:center;gap:12px}
      .brand-logo{width:40px;height:40px;flex-shrink:0;display:flex;align-items:center;justify-content:center;}
      .brand{font-size:8px;font-weight:700;letter-spacing:3px;opacity:.4;text-transform:uppercase;margin-bottom:4px}
      .docnum{font-size:18px;font-weight:900;letter-spacing:1px;text-transform:uppercase}
      .badge{padding:6px 14px;color:#fff;font-size:9px;font-weight:900;letter-spacing:2px;text-transform:uppercase;background:${meta.accentColor};display:flex;align-items:center;gap:6px;flex-shrink:0}
      .meta{display:grid;grid-template-columns:1fr 1fr;gap:0;border-bottom:1px solid #e5e5e5}
      .meta-cell{padding:10px 20px;border-right:1px solid #e5e5e5;border-bottom:1px solid #e5e5e5}
      .meta-cell:nth-child(even){border-right:none}
      .meta-label{font-size:7px;font-weight:700;letter-spacing:2px;opacity:.4;text-transform:uppercase;margin-bottom:3px}
      .meta-value{font-size:11px;font-weight:900;text-transform:uppercase}
      .section{padding:14px 20px;border-bottom:1px solid #e5e5e5}
      .section-title{font-size:7px;font-weight:700;letter-spacing:3px;opacity:.35;text-transform:uppercase;margin-bottom:10px}
      .product-name{font-size:13px;font-weight:900;text-transform:uppercase;margin-bottom:2px}
      .product-code{font-size:9px;opacity:.5;font-weight:700;letter-spacing:1px}
      .qty-box{display:inline-block;background:#141414;color:#fff;padding:6px 16px;font-size:20px;font-weight:900;margin-top:8px}
      .items-table{width:100%;border-collapse:collapse;font-size:10px}
      .items-table thead tr{background:#141414;color:#fff}
      .items-table th,.items-table td{padding:5px 8px;text-align:left}
      .items-table .right{text-align:right}
      .items-table .code{opacity:.5;font-size:9px}
      .items-table .name{font-weight:900;text-transform:uppercase}
      .items-table .qty{font-weight:900}
      .items-table tfoot td{background:#f5f5f5;font-weight:700;border-top:2px solid #141414}
      .total-label{opacity:.5;text-transform:uppercase;letter-spacing:.1em}
      .total-qty{font-size:14px;font-weight:900}
      .flow{display:flex;align-items:center}
      .flow-box{flex:1;background:#f5f5f5;border:1px solid #ddd;padding:8px 10px}
      .flow-label{font-size:7px;font-weight:700;letter-spacing:2px;opacity:.4;text-transform:uppercase;margin-bottom:3px}
      .flow-name{font-size:10px;font-weight:900;text-transform:uppercase}
      .flow-arrow{padding:0 10px;font-size:18px;color:${meta.accentColor};font-weight:900;flex-shrink:0}
      .sig-section,.photo-section{padding:14px 20px;border-bottom:1px solid #e5e5e5}
      .sig-img{border:1px solid #ddd;padding:4px;max-height:60px;width:100%;object-fit:contain}
      .photo-img{max-width:100%;max-height:160px;object-fit:contain;border:1px solid #ddd;padding:4px;display:block}
      .footer{padding:10px 20px;display:flex;justify-content:space-between;align-items:center;background:#fafafa}
      .footer-text{font-size:7px;opacity:.35;letter-spacing:1px;text-transform:uppercase}
      .stamp{border:2px solid ${meta.accentColor};color:${meta.accentColor};padding:4px 10px;font-size:8px;font-weight:900;letter-spacing:2px;text-transform:uppercase}
      @media print{body{padding:0}}
    </style></head><body>
    <div class="doc">
      <div class="stripe"></div>
      <div class="top">
        <div class="top-left">
          ${logoB64 ? `<div class="brand-logo"><img src="${logoB64}" style="width:40px;height:40px;object-fit:contain" /></div>` : `<div class="brand-logo" style="background:#141414;color:#E4E3E0;font-size:11px;font-weight:900;letter-spacing:1px">${brandAbbr}</div>`}
          <div>
            <div class="brand">${BRAND_NAME[guide.brand] ?? guide.brand} // GUÍA DE OPERACIÓN</div>
            <div class="docnum">${guide.number}</div>
          </div>
        </div>
        <div class="badge"><span>${meta.icon}</span>${meta.label}</div>
      </div>
      <div class="meta">
        <div class="meta-cell"><div class="meta-label">Fecha</div><div class="meta-value">${guide.date}</div></div>
        <div class="meta-cell"><div class="meta-label">Operador</div><div class="meta-value">${guide.operator}</div></div>
        <div class="meta-cell"><div class="meta-label">Referencia</div><div class="meta-value">${guide.reference}</div></div>
        ${guide.contact ? `<div class="meta-cell"><div class="meta-label">${guide.type === 'RECEPTION' ? 'Proveedor' : 'Cliente'}</div><div class="meta-value">${guide.contact}</div></div>` : '<div class="meta-cell"></div>'}
      </div>
      ${itemsHTML}
      ${flowHTML}
      ${sigHTML}
      ${photoHTML}
      <div class="footer">
        <div class="footer-text">LogixZazu v3.0 // Documento generado automáticamente</div>
        <div class="stamp">REGISTRADO</div>
      </div>
    </div>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-[var(--bg-input)] border-2 border-[var(--border)] shadow-[10px_10px_0_var(--border)] w-full max-w-lg flex flex-col my-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="h-1.5 w-full" style={{ background: meta.accentColor }} />

        {/* Header */}
        <div className="px-6 py-4 border-b-2 border-[var(--border)] flex items-center justify-between gap-4" style={{ background: meta.bgColor }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-[var(--ink)] flex items-center justify-center shrink-0">
              <span className="font-mono font-black text-[var(--ink-inv)] text-[9px] tracking-wider">{BRAND_ABBR[guide.brand] ?? 'LZ'}</span>
            </div>
            <div className="min-w-0">
              <div className="font-mono text-[8px] font-bold tracking-[0.3em] opacity-40 uppercase mb-0.5">
                {BRAND_NAME[guide.brand] ?? guide.brand} // GUÍA DE OPERACIÓN
              </div>
              <div className="font-mono font-black text-xl tracking-tight text-[var(--ink)]">{guide.number}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 px-4 py-2 text-white font-mono font-black text-[10px] tracking-widest uppercase" style={{ background: meta.accentColor }}>
              <span className="text-base leading-none">{meta.icon}</span>
              {meta.label}
            </div>
            <button onClick={onClose} className="p-1 opacity-40 hover:opacity-80"><X size={15} /></button>
          </div>
        </div>

        <div ref={printRef}>
          {/* Meta grid */}
          <div className="grid grid-cols-2 border-b border-[var(--border)]/15">
            {[
              { label: 'FECHA', value: guide.date },
              { label: 'OPERADOR', value: guide.operator },
              { label: 'REFERENCIA', value: guide.reference },
              guide.contact ? { label: guide.type === 'RECEPTION' ? 'PROVEEDOR' : 'CLIENTE', value: guide.contact } : null,
            ].filter(Boolean).map((cell: any) => (
              <div key={cell.label} className="px-5 py-3 border-b border-r border-[var(--border)]/10 odd:border-r even:border-r-0">
                <div className="font-mono text-[8px] font-bold tracking-[0.2em] opacity-40 uppercase mb-1">{cell.label}</div>
                <div className="font-mono font-black text-[11px] text-[var(--ink)] uppercase">{cell.value}</div>
              </div>
            ))}
          </div>

          {/* Items */}
          <div className="px-5 py-4 border-b border-[var(--border)]/15">
            <div className="font-mono text-[8px] font-bold tracking-[0.3em] opacity-35 uppercase mb-3">
              {guide.items.length === 1 ? 'PRODUCTO' : `PRODUCTOS · ${guide.items.length} LÍNEAS`}
            </div>
            {guide.items.length === 1 ? (
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-mono font-black text-base text-[var(--ink)] uppercase leading-tight truncate">{guide.items[0].productName}</div>
                  <div className="font-mono text-[10px] opacity-50 mt-0.5">{guide.items[0].productCode}{guide.items[0].serialNumber ? ` · S/N: ${guide.items[0].serialNumber}` : ''}</div>
                </div>
                <div className="shrink-0 flex flex-col items-center justify-center px-4 py-2 text-white font-mono font-black" style={{ background: meta.accentColor, minWidth: 72 }}>
                  <span className="text-xl leading-none">{guide.items[0].quantity}</span>
                  <span className="text-[8px] tracking-widest opacity-80 mt-0.5">UND</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-0 border border-[var(--border)]/20 overflow-hidden">
                <div className="grid grid-cols-[auto_1fr_auto] text-[9px] font-mono font-bold uppercase tracking-wider" style={{ background: meta.accentColor, color: 'white' }}>
                  <div className="px-3 py-2">Código</div>
                  <div className="px-3 py-2">Producto</div>
                  <div className="px-3 py-2 text-right">Cant.</div>
                </div>
                {guide.items.map((item, i) => (
                  <div key={i} className="grid grid-cols-[auto_1fr_auto] text-[10px] font-mono border-t border-[var(--border)]/10 bg-[var(--surface)]">
                    <div className="px-3 py-2 opacity-50 text-[9px]">{item.productCode}</div>
                    <div className="px-3 py-2 font-bold uppercase truncate">{item.productName}</div>
                    <div className="px-3 py-2 font-black text-right">{item.quantity}</div>
                  </div>
                ))}
                <div className="grid grid-cols-[1fr_auto] bg-[var(--bg-modal)] border-t border-[var(--border)]/20 font-mono font-black text-[11px]">
                  <div className="px-3 py-2 opacity-50 uppercase text-[9px] tracking-widest self-center">TOTAL</div>
                  <div className="px-3 py-2 text-right" style={{ color: meta.accentColor }}>{totalQty} UND</div>
                </div>
              </div>
            )}
          </div>

          {/* Movement */}
          {(guide.fromLocation || guide.toLocation) && (
            <div className="px-5 py-4 border-b border-[var(--border)]/15">
              <div className="font-mono text-[8px] font-bold tracking-[0.3em] opacity-35 uppercase mb-3">MOVIMIENTO</div>
              <div className="flex items-stretch gap-0">
                {guide.fromLocation && (
                  <div className="flex-1 border border-[var(--border)]/20 bg-[var(--bg-card-alt)] px-3 py-2.5">
                    <div className="font-mono text-[7px] font-bold tracking-[0.2em] opacity-40 uppercase mb-1">ORIGEN</div>
                    <div className="font-mono font-black text-[11px] text-[var(--ink)] uppercase">{guide.fromLocation}</div>
                  </div>
                )}
                {guide.fromLocation && guide.toLocation && (
                  <div className="flex items-center justify-center px-3 font-black text-lg text-white shrink-0" style={{ background: meta.accentColor }}>
                    {meta.icon}
                  </div>
                )}
                {guide.toLocation && (
                  <div className="flex-1 border border-[var(--border)]/20 bg-[var(--bg-card-alt)] px-3 py-2.5">
                    <div className="font-mono text-[7px] font-bold tracking-[0.2em] opacity-40 uppercase mb-1">DESTINO</div>
                    <div className="font-mono font-black text-[11px] text-[var(--ink)] uppercase">{guide.toLocation}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Signature */}
          {guide.signature && (
            <div className="px-5 py-4 border-b border-[var(--border)]/15">
              <div className="font-mono text-[8px] font-bold tracking-[0.3em] opacity-35 uppercase mb-2">FIRMA DE CONFORMIDAD</div>
              <div className="border border-[var(--border)]/20 bg-[var(--bg-card-alt)] p-2">
                <img src={guide.signature} alt="firma" className="h-16 w-full object-contain" />
              </div>
            </div>
          )}

          {/* Photo */}
          {guide.photo && (
            <div className="px-5 py-4 border-b border-[var(--border)]/15">
              <div className="font-mono text-[8px] font-bold tracking-[0.3em] opacity-35 uppercase mb-2">EVIDENCIA FOTOGRÁFICA</div>
              <div className="border border-[var(--border)]/20 bg-[var(--bg-card-alt)] p-1">
                <img src={guide.photo} alt="evidencia" className="max-h-40 w-full object-contain" />
              </div>
            </div>
          )}

          {/* Footer stamp */}
          <div className="px-5 py-3 flex items-center justify-between bg-[var(--bg-card-alt)]">
            <div className="font-mono text-[8px] opacity-30 tracking-widest uppercase">LogixZazu v3.0 // Documento generado automáticamente</div>
            <div className="font-mono font-black text-[8px] tracking-widest uppercase px-3 py-1.5 border-2" style={{ borderColor: meta.accentColor, color: meta.accentColor }}>
              ✓ REGISTRADO
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t-2 border-[var(--border)] p-3 flex gap-2 bg-[var(--bg-modal)]">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 text-white py-2.5 text-[10px] font-bold font-mono uppercase transition-all hover:opacity-90"
            style={{ background: meta.accentColor }}
          >
            <Printer size={13} /> IMPRIMIR GUÍA
          </button>
          <button onClick={onClose} className="flex-1 border-2 border-[var(--border)] py-2.5 text-[10px] font-bold font-mono uppercase hover:bg-[var(--bg-input)] transition-all text-[var(--ink)]">
            CERRAR
          </button>
        </div>
      </div>
    </div>
  );
};
