const fs = require('fs');
let c = fs.readFileSync('src/pages/Inventory.tsx', 'utf-8');

// 1. KPI Cards (smaller size)
c = c.replace(
  /<div className="grid grid-cols-3 gap-2">[\s\S]*?<\/div>\s*<\/div>\s*<div className="flex flex-col gap-3 border-b border-\[var\(--border\)\] pb-3">/,
  `<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="skeuo-panel p-4 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 skeuo-inset flex items-center justify-center rounded-full shrink-0">
              <ArrowDownLeft size={20} className="text-green-500" />
            </div>
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--ink)] opacity-60">Total Recepcionado</span>
          </div>
          <div className="mt-2">
            <span className="font-mono font-black text-2xl text-[var(--ink)] leading-none">{totalRecepcionado.toLocaleString()}</span>
            <div className="text-[10px] text-[var(--ink)]/40 uppercase tracking-widest mt-1">unidades ingresadas</div>
          </div>
        </div>

        <div className="skeuo-panel p-4 flex flex-col gap-2 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Package size={100} />
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 skeuo-inset flex items-center justify-center rounded-full shrink-0">
              <Package size={20} className="text-[var(--ink)]" />
            </div>
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--ink)] opacity-60">Total Disponible</span>
          </div>
          <div className="mt-2 relative z-10">
            <span className="font-mono font-black text-3xl text-[var(--ink)] leading-none">{totalDisponible.toLocaleString()}</span>
            <div className="text-[10px] text-[var(--ink)]/40 uppercase tracking-widest mt-1">en stock ahora</div>
          </div>
        </div>

        <div className="skeuo-panel p-4 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 skeuo-inset flex items-center justify-center rounded-full shrink-0">
              <ArrowUpRight size={20} className="text-red-500" />
            </div>
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--ink)] opacity-60">Total Despachado</span>
          </div>
          <div className="mt-2">
            <span className="font-mono font-black text-2xl text-[var(--ink)] leading-none">{totalDespachado.toLocaleString()}</span>
            <div className="text-[10px] text-[var(--ink)]/40 uppercase tracking-widest mt-1">unidades salidas</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-4 mb-4">`
);

// 2. Buttons in Title row
c = c.replace(
  /className="bg-\[var\(--bg-input\)\] hover:bg-\[var\(--ink\)\] border border-\[var\(--border\)\] text-\[var\(--ink\)\] hover:text-\[var\(--ink-inv\)\] shadow-\[2px_2px_0_var\(--border\)\] active:shadow-none active:translate-y-\[2px\] active:translate-x-\[2px\] transition-all px-3 py-2 flex items-center gap-1\.5 font-mono text-\[10px\] font-bold uppercase shrink-0 h-\[34px\]"/g,
  'className="skeuo-btn px-4 py-2 hover:opacity-80 flex items-center gap-2 font-bold text-xs uppercase shrink-0 transition-opacity h-10"'
);

c = c.replace(
  /className="bg-\[var\(--ink\)\] hover:bg-\[var\(--bg-input\)\] text-\[var\(--ink-inv\)\] hover:text-\[var\(--ink\)\] border border-\[var\(--border\)\] shadow-\[2px_2px_0_var\(--border\)\] active:shadow-none active:translate-y-\[2px\] active:translate-x-\[2px\] transition-all px-3 py-2 flex items-center gap-1\.5 font-mono text-\[10px\] font-bold uppercase shrink-0 h-\[34px\]"/g,
  'className="skeuo-btn-accent px-4 py-2 hover:opacity-90 flex items-center gap-2 font-bold text-xs uppercase shrink-0 transition-opacity h-10"'
);

c = c.replace(
  /className="bg-\[var\(--surface\)\] hover:bg-\[var\(--ink\)\] border border-\[var\(--border\)\] text-\[var\(--ink\)\] hover:text-\[var\(--ink-inv\)\] shadow-\[2px_2px_0_var\(--border\)\] active:shadow-none active:translate-y-\[2px\] active:translate-x-\[2px\] transition-all px-3 py-2 flex items-center gap-1\.5 font-mono text-\[10px\] font-bold uppercase shrink-0 h-\[34px\]"/g,
  'className="skeuo-btn px-4 py-2 hover:opacity-80 flex items-center gap-2 font-bold text-xs uppercase shrink-0 transition-opacity h-10"'
);

// 3. Search and Filters
// We use regex to match from the filter row comment up to the data table container
const filterRegex = /\{\/\*\s*Filter row .*?\*\/\}\s*<div className="flex items-center gap-2 overflow-x-auto pb-0\.5">([\s\S]*?)<\/div>\s*<\/div>\s*<div className="data-table-container flex-1 flex flex-col overflow-hidden">/g;

c = c.replace(filterRegex, (match, p1) => {
  let sub = p1;
  sub = sub.replace(/bg-\[var\(--surface\)\] border border-\[var\(--border\)\] py-1\.5 px-2 text-\[10px\] font-bold text-\[var\(--ink\)\] focus:outline-none focus:bg-\[var\(--bg-input\)\] focus:shadow-\[2px_2px_0_var\(--border\)\] transition-all font-mono uppercase cursor-pointer h-\[32px\]/g, 
    'skeuo-inset bg-transparent px-3 py-2 text-[10px] font-bold uppercase outline-none cursor-pointer text-[var(--ink)]');
  
  sub = sub.replace(/w-full bg-\[var\(--surface\)\] border border-\[var\(--border\)\] px-7 py-1\.5 text-\[10px\] font-bold text-\[var\(--ink\)\] focus:outline-none focus:bg-\[var\(--bg-input\)\] focus:shadow-\[2px_2px_0_var\(--border\)\] transition-all font-mono uppercase h-\[32px\]/g,
    'w-full bg-transparent skeuo-inset px-8 py-2 text-[10px] font-bold uppercase outline-none text-[var(--ink)]');
    
  return `<div className="skeuo-panel p-3 flex items-center gap-4 overflow-x-auto mt-4 mb-4">
${sub}
</div>
</div>
<div className="skeuo-panel flex-1 flex flex-col overflow-hidden">`;
});


// 4. Data Headers
c = c.replace(
  /<div className="grid grid-cols-\[1fr_100px\] data-header">/g,
  `<div className="grid grid-cols-[1fr_100px] bg-[var(--surface)] text-[10px] font-bold uppercase tracking-widest text-[var(--ink)]/80 px-4 py-3 border-b border-[var(--border)]">`
);

// 5. Clean up data-row styles
c = c.replace(/className="data-row /g, 'className="px-4 py-3 border-b border-[var(--border)] bg-transparent hover:bg-[var(--surface)] cursor-pointer transition-colors ');


// Write changes
fs.writeFileSync('src/pages/Inventory.tsx', c);
console.log('Script ejecutado exitosamente');
