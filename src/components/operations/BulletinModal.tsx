import React, { useState } from 'react';
import { Mail, CalendarDays, Printer, X } from 'lucide-react';
import { TransactionType } from '../../types';
import { useAppContext } from '../../store/AppContext';

export interface BulletinData {
  type: TransactionType;
  reference: string;
  date: string;
  rawDate: string;
  operator: string;
  brand: string;
  txIds: string[];
  items: { productName: string; productCode: string; quantity: number; variant?: string; serialNumber?: string }[];
  fromLocation?: string;
  toLocation?: string;
  contact?: string;
  signature?: string;
  photo?: string;
  labelOverride?: string;
  colorOverride?: string;
}

export function buildBulletinHTML(p: BulletinData): string {
  const TYPE_LABEL: Record<TransactionType, string> = { RECEPTION: 'RECEPCIÓN', DISPATCH: 'DESPACHO', TRANSFER: 'TRASLADO' };
  const TYPE_COLOR: Record<TransactionType, string> = { RECEPTION: '#16a34a', DISPATCH: '#dc2626', TRANSFER: '#0891b2' };
  const label = p.labelOverride ?? TYPE_LABEL[p.type];
  const color = p.colorOverride ?? TYPE_COLOR[p.type];
  const brandDisplay = p.brand.replace('_', ' ');
  const totalQty = p.items.reduce((s, i) => s + i.quantity, 0);
  const contactLabel = p.type === 'RECEPTION' ? 'Proveedor' : 'Cliente';

  const row = (lbl: string, val: string) =>
    `<tr>
      <td style="padding:8px 0;font-size:11px;letter-spacing:.15em;opacity:.5;text-transform:uppercase;font-weight:700;border-bottom:1px solid rgba(20,20,20,.1);width:40%">${lbl}</td>
      <td style="padding:8px 0;font-size:11px;font-weight:900;text-transform:uppercase;text-align:right;border-bottom:1px solid rgba(20,20,20,.1)">${val}</td>
    </tr>`;

  const itemsHTML = p.items.length === 1
    ? `<div style="border:2px solid #141414;padding:16px;margin:20px 0;background:#fff">
        <div style="font-size:9px;letter-spacing:.25em;opacity:.4;text-transform:uppercase;margin-bottom:4px">${p.items[0].productCode}</div>
        <div style="font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:.05em">${p.items[0].productName}</div>
        ${p.items[0].variant ? `<div style="font-size:9px;opacity:.5;margin-top:4px;text-transform:uppercase;letter-spacing:.1em">${p.items[0].variant}</div>` : ''}
        ${p.items[0].serialNumber ? `<div style="font-size:9px;opacity:.5;margin-top:2px">S/N: ${p.items[0].serialNumber}</div>` : ''}
        <div style="display:inline-block;background:#141414;color:#E4E3E0;font-size:22px;font-weight:900;padding:8px 18px;margin-top:12px;letter-spacing:.05em">${p.items[0].quantity} UND</div>
      </div>`
    : `<div style="margin:20px 0">
        <div style="font-size:9px;letter-spacing:.2em;opacity:.4;text-transform:uppercase;margin-bottom:8px;font-weight:700">PRODUCTOS — ${p.items.length} LÍNEAS</div>
        <table style="width:100%;border-collapse:collapse;background:#fff;border:2px solid #141414">
          <thead><tr style="background:#141414;color:#E4E3E0">
            <td style="padding:7px 10px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase">Código</td>
            <td style="padding:7px 10px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase">Producto</td>
            <td style="padding:7px 10px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;text-align:right">Cant.</td>
          </tr></thead>
          <tbody>${p.items.map(it => `<tr style="border-bottom:1px solid #eee">
            <td style="padding:6px 10px;font-size:9px;font-weight:700;opacity:.5">${it.productCode}</td>
            <td style="padding:6px 10px;font-size:11px;font-weight:900;text-transform:uppercase">
              ${it.productName}
              ${it.variant ? `<div style="font-size:9px;font-weight:400;opacity:.55;text-transform:uppercase;letter-spacing:.08em;margin-top:2px">${it.variant}</div>` : ''}
              ${it.serialNumber ? `<div style="font-size:9px;font-weight:400;opacity:.45;margin-top:1px">S/N: ${it.serialNumber}</div>` : ''}
            </td>
            <td style="padding:6px 10px;font-size:11px;font-weight:900;text-align:right">${it.quantity}</td>
          </tr>`).join('')}</tbody>
          <tfoot><tr style="background:#f5f5f5">
            <td colspan="2" style="padding:8px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em">TOTAL UNIDADES</td>
            <td style="padding:8px 10px;font-size:14px;font-weight:900;text-align:right">${totalQty}</td>
          </tr></tfoot>
        </table>
      </div>`;

  const sigHTML = p.signature
    ? `<div style="margin-top:16px;padding-top:16px;border-top:1px dashed rgba(20,20,20,.3)">
        <div style="font-size:9px;letter-spacing:.2em;opacity:.5;text-transform:uppercase;margin-bottom:8px;font-weight:700">FIRMA DE CONFORMIDAD</div>
        <img src="${p.signature}" alt="Firma" style="max-width:200px;max-height:80px;border:1px solid #141414;padding:4px;background:#fff;display:block">
      </div>` : '';

  const photoHTML = p.photo
    ? `<div style="margin-top:16px;padding-top:16px;border-top:1px dashed rgba(20,20,20,.3)">
        <div style="font-size:9px;letter-spacing:.2em;opacity:.5;text-transform:uppercase;margin-bottom:8px;font-weight:700">EVIDENCIA FOTOGRÁFICA</div>
        <img src="${p.photo}" alt="Evidencia" style="max-width:100%;max-height:240px;border:1px solid #141414;padding:4px;background:#fff;display:block">
      </div>` : '';

  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<style>*{box-sizing:border-box}body{margin:0;padding:24px 32px;background:#f0efec;font-family:'Courier New',monospace}</style>
</head><body>
  <div style="max-width:680px;margin:0 auto;background:#E4E3E0;border:2px solid #141414;box-shadow:6px 6px 0 #141414">
    <div style="background:#141414;color:#E4E3E0;padding:28px 36px">
      <div style="font-size:9px;letter-spacing:.35em;opacity:.5;text-transform:uppercase">${brandDisplay} — SISTEMA DE ALMACÉN</div>
      <div style="display:inline-block;background:${color};color:#fff;padding:6px 16px;font-size:10px;font-weight:900;letter-spacing:.3em;margin-top:14px;text-transform:uppercase">${label}</div>
      <div style="font-size:28px;font-weight:900;letter-spacing:.08em;margin-top:10px;text-transform:uppercase">${p.reference}</div>
      <div style="font-size:10px;opacity:.4;margin-top:4px;letter-spacing:.15em">${p.date}</div>
    </div>
    <div style="padding:28px 36px">
      <table style="width:100%;border-collapse:collapse">
        ${row('Operador', p.operator)}
        ${p.contact ? row(contactLabel, p.contact) : ''}
        ${p.fromLocation ? row('Origen', p.fromLocation) : ''}
        ${p.toLocation ? row('Destino', p.toLocation) : ''}
      </table>
      ${itemsHTML}${sigHTML}${photoHTML}
    </div>
    <div style="background:#D4D3D0;border-top:1px solid #141414;padding:12px 36px;font-size:9px;opacity:.45;letter-spacing:.15em;text-transform:uppercase">
      LogixZazu v3.0 — Comprobante generado automáticamente // ${p.date}
    </div>
  </div>
</body></html>`;
}

export const BulletinModal: React.FC<{ data: BulletinData; onClose: () => void }> = ({ data, onClose }) => {
  const { updateTransaction } = useAppContext();
  const [editingDate, setEditingDate] = useState(false);
  const [newDate, setNewDate] = useState(data.rawDate);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const html = buildBulletinHTML(data);

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=700,height=900');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.onload = () => win.print();
  };

  const handleSaveDate = async () => {
    if (!newDate || newDate === data.rawDate) { setEditingDate(false); return; }
    setSaving(true);
    try {
      await Promise.all(data.txIds.map(id => updateTransaction(id, { date: newDate + 'T12:00:00Z' })));
      setSaved(true);
      setEditingDate(false);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8" style={{ background: 'rgba(0,0,0,0.75)' }} onClick={onClose}>
      <div
        className="w-full flex flex-col"
        style={{ background: 'var(--bg-card)', border: '2px solid var(--border)', boxShadow: '8px 8px 0 var(--border)', maxWidth: '780px', height: '92vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="flex items-center gap-2">
            <Mail size={13} style={{ color: 'var(--ink)' }} />
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--ink)' }}>
              Comprobante · {data.reference}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Cambiar fecha */}
            {editingDate ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  className="font-mono text-[10px] border px-2 py-1"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-card)', color: 'var(--ink)' }}
                />
                <button
                  onClick={handleSaveDate}
                  disabled={saving}
                  className="flex items-center gap-1 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wider border transition-all hover:opacity-80 disabled:opacity-40"
                  style={{ borderColor: '#16a34a', color: '#fff', background: '#16a34a' }}
                >
                  {saving ? '...' : 'OK'}
                </button>
                <button
                  onClick={() => { setEditingDate(false); setNewDate(data.rawDate); }}
                  className="px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wider border hover:opacity-70"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink)' }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingDate(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-wider border transition-all hover:opacity-80"
                style={{ borderColor: 'var(--border)', color: 'var(--ink)', background: saved ? '#16a34a22' : 'transparent' }}
              >
                <CalendarDays size={11} /> {saved ? '✓ Fecha guardada' : 'Cambiar fecha'}
              </button>
            )}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-wider border transition-all hover:opacity-80"
              style={{ borderColor: 'var(--border)', color: 'var(--ink-inv)', background: 'var(--ink)' }}
            >
              <Printer size={11} /> Imprimir
            </button>
            <button onClick={onClose} className="p-1 hover:opacity-60 transition-opacity" style={{ color: 'var(--ink)' }}>
              <X size={14} />
            </button>
          </div>
        </div>

        {/* iframe preview — ocupa todo el espacio restante */}
        <div className="flex-1 overflow-hidden">
          <iframe
            srcDoc={html}
            title="Comprobante de operación"
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            sandbox="allow-same-origin"
          />
        </div>
      </div>
    </div>
  );
};
