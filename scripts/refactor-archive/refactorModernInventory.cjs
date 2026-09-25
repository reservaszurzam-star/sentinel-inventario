const fs = require('fs');
let c = fs.readFileSync('src/pages/Inventory.tsx', 'utf-8');

// 1. KPI Cards
c = c.replace(
  /<div className="grid grid-cols-3 gap-2">[\s\S]*?<\/div>\s*<\/div>\s*<div className="flex flex-col gap-3 border-b border-\[var\(--border\)\] pb-3">/,
  `<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)]/50 p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
              <ArrowDownLeft size={16} className="text-green-600 dark:text-green-400" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink)]/60">Total Recepcionado</span>
          </div>
          <div>
            <span className="font-sans font-bold text-3xl text-[var(--ink)] leading-none tracking-tight">{totalRecepcionado.toLocaleString()}</span>
            <div className="text-[10px] text-[var(--ink)]/40 uppercase tracking-widest mt-1">unidades ingresadas</div>
          </div>
        </div>

        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)]/50 p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute -right-6 -bottom-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <Package size={120} />
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
              <Package size={16} className="text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink)]/60">Total Disponible</span>
          </div>
          <div className="relative z-10">
            <span className="font-sans font-bold text-4xl text-[var(--ink)] leading-none tracking-tight">{totalDisponible.toLocaleString()}</span>
            <div className="text-[10px] text-[var(--ink)]/40 uppercase tracking-widest mt-1">en stock ahora</div>
          </div>
        </div>

        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)]/50 p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
              <ArrowUpRight size={16} className="text-red-600 dark:text-red-400" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink)]/60">Total Despachado</span>
          </div>
          <div>
            <span className="font-sans font-bold text-3xl text-[var(--ink)] leading-none tracking-tight">{totalDespachado.toLocaleString()}</span>
            <div className="text-[10px] text-[var(--ink)]/40 uppercase tracking-widest mt-1">unidades salidas</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 mb-2">`
);

// 2. Title Row Actions (Buttons)
c = c.replace(
  /className="bg-\[var\(--bg-input\)\] hover:bg-\[var\(--ink\)\] border border-\[var\(--border\)\] text-\[var\(--ink\)\] hover:text-\[var\(--ink-inv\)\] shadow-\[2px_2px_0_var\(--border\)\] active:shadow-none active:translate-y-\[2px\] active:translate-x-\[2px\] transition-all px-3 py-2 flex items-center gap-1\.5 font-mono text-\[10px\] font-bold uppercase shrink-0 h-\[34px\]"/g,
  'className="bg-[var(--surface)] border border-[var(--border)]/50 text-[var(--ink)] hover:bg-[var(--bg-input)] shadow-sm font-semibold text-[11px] px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 uppercase"'
);

c = c.replace(
  /className="bg-\[var\(--surface\)\] hover:bg-\[var\(--ink\)\] border border-\[var\(--border\)\] text-\[var\(--ink\)\] hover:text-\[var\(--ink-inv\)\] shadow-\[2px_2px_0_var\(--border\)\] active:shadow-none active:translate-y-\[2px\] active:translate-x-\[2px\] transition-all px-3 py-2 flex items-center gap-1\.5 font-mono text-\[10px\] font-bold uppercase shrink-0 h-\[34px\]"/g,
  'className="bg-[var(--surface)] border border-[var(--border)]/50 text-[var(--ink)] hover:bg-[var(--bg-input)] shadow-sm font-semibold text-[11px] px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 uppercase"'
);

c = c.replace(
  /className="bg-\[var\(--ink\)\] hover:bg-\[var\(--bg-input\)\] text-\[var\(--ink-inv\)\] hover:text-\[var\(--ink\)\] border border-\[var\(--border\)\] shadow-\[2px_2px_0_var\(--border\)\] active:shadow-none active:translate-y-\[2px\] active:translate-x-\[2px\] transition-all px-3 py-2 flex items-center gap-1\.5 font-mono text-\[10px\] font-bold uppercase shrink-0 h-\[34px\]"/g,
  'className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm font-semibold text-[11px] px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 uppercase border border-transparent"'
);


// 3. Filters
const filterRegex = /\{\/\*\s*Filter row .*?\*\/\}\s*<div className="flex items-center gap-2 overflow-x-auto pb-0\.5">([\s\S]*?)<\/div>\s*<\/div>\s*<div className="data-table-container flex-1 flex flex-col overflow-hidden">/g;

c = c.replace(filterRegex, (match, p1) => {
  let sub = p1;
  // Replace selects
  sub = sub.replace(/bg-\[var\(--surface\)\] border border-\[var\(--border\)\] py-1\.5 px-2 text-\[10px\] font-bold text-\[var\(--ink\)\] focus:outline-none focus:bg-\[var\(--bg-input\)\] focus:shadow-\[2px_2px_0_var\(--border\)\] transition-all font-mono uppercase cursor-pointer h-\[32px\]/g, 
    'bg-transparent hover:bg-[var(--bg-input)] border border-transparent hover:border-[var(--border)]/30 px-3 py-2 text-[11px] font-semibold text-[var(--ink)] rounded-lg focus:outline-none transition-all uppercase cursor-pointer');
  
  // Replace Search
  sub = sub.replace(/<div className="relative shrink-0 w-36 sm:w-44">/g, '<div className="relative shrink-0 w-44 sm:w-56 bg-[var(--bg-input)] rounded-lg border border-[var(--border)]/30">');
  sub = sub.replace(/absolute left-2\.5 top-1\/2 -translate-y-1\/2 opacity-50/g, 'absolute left-3 top-1/2 -translate-y-1/2 opacity-40 text-[var(--ink)]');
  sub = sub.replace(/w-full bg-\[var\(--surface\)\] border border-\[var\(--border\)\] px-7 py-1\.5 text-\[10px\] font-bold text-\[var\(--ink\)\] focus:outline-none focus:bg-\[var\(--bg-input\)\] focus:shadow-\[2px_2px_0_var\(--border\)\] transition-all font-mono uppercase h-\[32px\]/g,
    'w-full bg-transparent px-9 py-2 text-[11px] font-semibold text-[var(--ink)] placeholder-[var(--ink)]/40 focus:outline-none transition-all uppercase');
    
  return `<div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)]/50 p-2 flex items-center gap-1 overflow-x-auto shadow-sm mt-4">
${sub}
</div>
</div>
<div className="bg-[var(--surface)] flex-1 flex flex-col overflow-hidden rounded-2xl border border-[var(--border)]/50 shadow-sm mt-2">`;
});

// 4. Data Headers
c = c.replace(
  /<div className="grid grid-cols-\[1fr_100px\] data-header">/g,
  `<div className="grid grid-cols-[1fr_100px] bg-[var(--border)]/5 text-[10px] font-bold uppercase tracking-widest text-[var(--ink)]/60 px-6 py-4 border-b border-[var(--border)]/30">`
);

// 5. Data Rows
c = c.replace(/className="data-row /g, 'className="px-6 py-4 border-b border-[var(--border)]/10 bg-transparent hover:bg-[var(--bg-input)] cursor-pointer transition-colors ');

fs.writeFileSync('src/pages/Inventory.tsx', c);
console.log('Script ejecutado exitosamente');
