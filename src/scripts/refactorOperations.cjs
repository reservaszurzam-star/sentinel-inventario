const fs = require('fs');

let content = fs.readFileSync('src/pages/Operations.tsx', 'utf-8');

const targetStr = `return \`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<style>*{box-sizing:border-box}body{margin:0;padding:24px 32px;background:#f0efec;font-family:'Courier New',monospace}</style>
</head><body>
  <div style="max-width:680px;margin:0 auto;background:#E4E3E0;border:2px solid #141414;box-shadow:6px 6px 0 #141414">
    <div style="background:#141414;color:#E4E3E0;padding:28px 36px">
      <div style="font-size:9px;letter-spacing:.35em;opacity:.5;text-transform:uppercase">\${brandDisplay} — SISTEMA DE ALMACÉN</div>
      <div style="display:inline-block;background:\${color};color:#fff;padding:6px 16px;font-size:10px;font-weight:900;letter-spacing:.3em;margin-top:14px;text-transform:uppercase">\${label}</div>
      <div style="font-size:28px;font-weight:900;letter-spacing:.08em;margin-top:10px;text-transform:uppercase">\${p.reference}</div>
      <div style="font-size:10px;opacity:.4;margin-top:4px;letter-spacing:.15em">\${p.date}</div>
    </div>
    <div style="padding:28px 36px">
      <table style="width:100%;border-collapse:collapse">
        \${row('Operador', p.operator)}
        \${p.contact ? row(contactLabel, p.contact) : ''}
        \${p.fromLocation ? row('Origen', p.fromLocation) : ''}
        \${p.toLocation ? row('Destino', p.toLocation) : ''}
      </table>
      \${itemsHTML}\${sigHTML}\${photoHTML}
    </div>
    <div style="background:#D4D3D0;border-top:1px solid #141414;padding:12px 36px;font-size:9px;opacity:.45;letter-spacing:.15em;text-transform:uppercase">
      LogixZazu v3.0 — Comprobante generado automáticamente // \${p.date}
    </div>
  </div>
</body></html>\`;`;

const replacement = `return \`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<style>
  *{box-sizing:border-box}
  body{margin:0;padding:24px;background:#f0f2f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#333}
</style>
</head><body>
  <div style="max-width:700px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.05);overflow:hidden">
    <!-- Header Ticket -->
    <div style="text-align:center;padding:40px 40px 20px;border-bottom:2px dashed #eee">
      <h1 style="margin:0;font-size:32px;letter-spacing:4px;text-transform:uppercase;color:#111">\${brandDisplay}</h1>
      <p style="margin:5px 0 20px;font-size:11px;color:#888;letter-spacing:2px;text-transform:uppercase">TICKET DE OPERACIÓN LOGÍSTICA</p>
      
      <!-- Barcode simulation -->
      <div style="font-family:'Libre Barcode 39', 'Courier New', monospace;font-size:36px;margin:15px 0;">*\${p.reference.replace(/\\W/g, '')}*</div>
      
      <div style="display:inline-block;background:\${color};color:#fff;padding:6px 16px;border-radius:4px;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase">\${label} - \${p.reference}</div>
    </div>
    
    <!-- Info -->
    <div style="padding:30px 40px">
      <div style="display:flex;justify-content:space-between;margin-bottom:30px;font-size:13px">
        <table style="width:100%;border-collapse:collapse">
          \${row('Operador', p.operator)}
          \${p.contact ? row(contactLabel, p.contact) : ''}
          \${p.fromLocation ? row('Origen', p.fromLocation) : ''}
          \${p.toLocation ? row('Destino', p.toLocation) : ''}
          \${row('Fecha', p.date)}
        </table>
      </div>
      
      <!-- Items -->
      <div style="background:#fafafa;border:1px solid #eee;border-radius:8px;padding:20px">
        \${itemsHTML.replace(/border:2px solid #141414|background:#141414;color:#E4E3E0/g, 'background:#fff;color:#333;border:1px solid #ddd;border-radius:4px').replace(/font-family:'Courier New',monospace/g, '')}
      </div>
      
      \${sigHTML}
      \${photoHTML}
    </div>
    
    <!-- Footer -->
    <div style="background:#f9f9f9;border-top:1px solid #eee;padding:20px 40px;text-align:center">
      <p style="margin:0;font-size:10px;color:#999;letter-spacing:1px;text-transform:uppercase">Generado automáticamente por el Sistema LogixZazu Logistics</p>
      <p style="margin:5px 0 0;font-size:9px;color:#bbb">El documento acredita el movimiento físico de mercancía en la fecha indicada.</p>
    </div>
  </div>
</body></html>\`;`;

content = content.replace(targetStr, replacement);
fs.writeFileSync('src/pages/Operations.tsx', content, 'utf-8');
console.log('Operations.tsx updated successfully');
