const fs = require('fs');
let c = fs.readFileSync('src/pages/Inventory.tsx', 'utf-8');

// 1. KPI Cards
c = c.replace(
  /<div className="grid grid-cols-3 gap-2">[\s\S]*?<\/div>\s*<\/div>\s*<div className="flex flex-col gap-3 border-b border-\[var\(--border\)\] pb-3">/,
  `<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="skeuo-panel p-6 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 skeuo-inset flex items-center justify-center rounded-full shrink-0">
              <ArrowDownLeft size={20} className="text-green-500" />
            </div>
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--ink)] opacity-60">Total Recepcionado</span>
          </div>
          <div className="mt-2">
            <span className="font-mono font-black text-3xl text-[var(--ink)] leading-none">{totalRecepcionado.toLocaleString()}</span>
            <div className="text-[10px] text-[var(--ink)]/40 uppercase tracking-widest mt-1">unidades ingresadas</div>
          </div>
        </div>

        <div className="skeuo-panel p-6 flex flex-col gap-2 relative overflow-hidden group">
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
            <span className="font-mono font-black text-4xl text-[var(--ink)] leading-none">{totalDisponible.toLocaleString()}</span>
            <div className="text-[10px] text-[var(--ink)]/40 uppercase tracking-widest mt-1">en stock ahora</div>
          </div>
        </div>

        <div className="skeuo-panel p-6 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 skeuo-inset flex items-center justify-center rounded-full shrink-0">
              <ArrowUpRight size={20} className="text-red-500" />
            </div>
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--ink)] opacity-60">Total Despachado</span>
          </div>
          <div className="mt-2">
            <span className="font-mono font-black text-3xl text-[var(--ink)] leading-none">{totalDespachado.toLocaleString()}</span>
            <div className="text-[10px] text-[var(--ink)]/40 uppercase tracking-widest mt-1">unidades salidas</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-4 mb-4">`
);

// 2. Buttons in Title row
// IMPORT CSV
c = c.replace(
  /className="bg-\[var\(--bg-input\)\] hover:bg-\[var\(--ink\)\] border border-\[var\(--border\)\] text-\[var\(--ink\)\] hover:text-\[var\(--ink-inv\)\] shadow-\[2px_2px_0_var\(--border\)\] active:shadow-none active:translate-y-\[2px\] active:translate-x-\[2px\] transition-all px-3 py-2 flex items-center gap-1\.5 font-mono text-\[10px\] font-bold uppercase shrink-0 h-\[34px\]"/g,
  'className="skeuo-btn px-4 py-2 hover:opacity-80 flex items-center gap-2 font-bold text-xs uppercase shrink-0 transition-opacity h-10"'
);

// NEW SKU Button
c = c.replace(
  /className="bg-\[var\(--ink\)\] hover:bg-\[var\(--bg-input\)\] text-\[var\(--ink-inv\)\] hover:text-\[var\(--ink\)\] border border-\[var\(--border\)\] shadow-\[2px_2px_0_var\(--border\)\] active:shadow-none active:translate-y-\[2px\] active:translate-x-\[2px\] transition-all px-3 py-2 flex items-center gap-1\.5 font-mono text-\[10px\] font-bold uppercase shrink-0 h-\[34px\]"/g,
  'className="skeuo-btn-accent px-4 py-2 hover:opacity-90 flex items-center gap-2 font-bold text-xs uppercase shrink-0 transition-opacity h-10"'
);

// NUEVAS VARIANTES button (which might use slightly different classes)
c = c.replace(
  /className="bg-\[var\(--surface\)\] hover:bg-\[var\(--ink\)\] border border-\[var\(--border\)\] text-\[var\(--ink\)\] hover:text-\[var\(--ink-inv\)\] shadow-\[2px_2px_0_var\(--border\)\] active:shadow-none active:translate-y-\[2px\] active:translate-x-\[2px\] transition-all px-3 py-2 flex items-center gap-1\.5 font-mono text-\[10px\] font-bold uppercase shrink-0 h-\[34px\]"/g,
  'className="skeuo-btn px-4 py-2 hover:opacity-80 flex items-center gap-2 font-bold text-xs uppercase shrink-0 transition-opacity h-10"'
);

// 3. Search and Filters
c = c.replace(
  /<div className="flex flex-col sm:flex-row gap-2">[\s\S]*?<div className="relative flex-1">[\s\S]*?<input[\s\S]*?className="w-full bg-\[var\(--bg-input\)\] border border-\[var\(--border\)\] text-\[var\(--ink\)\] pl-8 pr-3 py-2 text-xs font-mono placeholder:text-\[var\(--ink\)\]\/40 outline-none focus:border-blue-500"[\s\S]*?\/>[\s\S]*?<\/div>[\s\S]*?<div className="flex gap-2 shrink-0">/,
  `<div className="skeuo-panel p-4 flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative flex-1 skeuo-inset">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink)]/40" />
            <input
              type="text"
              placeholder="BUSCAR POR NOMBRE O SKU..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-transparent text-[var(--ink)] pl-10 pr-4 py-3 text-sm font-bold placeholder:text-[var(--ink)]/40 outline-none"
            />
          </div>
          <div className="flex gap-4 shrink-0 flex-wrap">`
);

// Replace Select inputs in Filters (category, location, color, size, status)
c = c.replace(
  /className="bg-\[var\(--bg-input\)\] border border-\[var\(--border\)\] text-\[var\(--ink\)\] px-2 py-1\.5 text-\[10px\] font-mono font-bold uppercase outline-none focus:border-blue-500"/g,
  'className="skeuo-inset bg-transparent text-[var(--ink)] px-4 py-3 text-xs font-bold uppercase outline-none cursor-pointer"'
);

// 4. Data Headers
c = c.replace(
  /<div className="grid grid-cols-\[minmax\(250px,2fr\)_minmax\(80px,1fr\)_minmax\(80px,1fr\)_minmax\(150px,1\.5fr\)_minmax\(100px,1fr\)_minmax\(100px,1fr\)_minmax\(80px,1fr\)\] data-header">/g,
  `<div className="grid grid-cols-[minmax(250px,2fr)_minmax(80px,1fr)_minmax(80px,1fr)_minmax(150px,1.5fr)_minmax(100px,1fr)_minmax(100px,1fr)_minmax(80px,1fr)] bg-[var(--surface)] text-[10px] font-bold uppercase tracking-widest text-[var(--ink)]/60 px-4 py-3 border-b border-[var(--border)] rounded-t-xl mt-4">`
);

// Write changes
fs.writeFileSync('src/pages/Inventory.tsx', c);
console.log('Script ejecutado exitosamente');
