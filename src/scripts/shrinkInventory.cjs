const fs = require('fs');

try {
  let c = fs.readFileSync('src/pages/Inventory.tsx', 'utf-8');

  // Replace KPIs
  const kpiStart = c.indexOf('<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">');
  const kpiEndStr = '</div>\n      </div>\n\n      <div className="flex flex-col gap-4 mb-2">';
  const kpiEnd = c.indexOf(kpiEndStr) + kpiEndStr.length;
  
  if (kpiStart !== -1 && kpiEnd !== -1) {
    const newKpis = `<div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)]/30 p-3 flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
              <ArrowDownLeft size={14} className="text-green-600 dark:text-green-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]/60">Recepcionado</span>
          </div>
          <div>
            <span className="font-sans font-bold text-xl text-[var(--ink)] leading-none tracking-tight">{totalRecepcionado.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)]/30 p-3 flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Package size={60} />
          </div>
          <div className="flex items-center gap-2 relative z-10">
            <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
              <Package size={14} className="text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]/60">Disponible</span>
          </div>
          <div className="relative z-10">
            <span className="font-sans font-bold text-2xl text-[var(--ink)] leading-none tracking-tight">{totalDisponible.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)]/30 p-3 flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
              <ArrowUpRight size={14} className="text-red-600 dark:text-red-400" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]/60">Despachado</span>
          </div>
          <div>
            <span className="font-sans font-bold text-xl text-[var(--ink)] leading-none tracking-tight">{totalDespachado.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 mb-2">`;
      c = c.substring(0, kpiStart) + newKpis + c.substring(kpiEnd);
  }

  // Replace Filters
  const filtersStart = c.indexOf('<div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)]/50 p-2 flex items-center gap-1 overflow-x-auto shadow-sm mt-4">');
  const filtersEndStr = '</div>\n</div>\n      {/* Product Grid */}';
  const filtersEnd = c.indexOf(filtersEndStr) + filtersEndStr.length;

  if (filtersStart !== -1 && filtersEnd !== -1) {
    const newFilters = `<div className="flex items-center gap-2 mt-2 pb-2">
          <select
            value={activeBrand}
            onChange={(e) => setActiveBrand(e.target.value as any)}
            className="bg-[var(--surface)] border border-[var(--border)]/30 px-3 py-1.5 text-[10px] font-semibold text-[var(--ink)] rounded-lg focus:outline-none transition-all uppercase cursor-pointer w-28 shadow-sm"
          >
            <option value="OVERSHARK">OVERSHARK</option>
            <option value="BRAVOS">BRAVOS URBAN</option>
            <option value="BOX_PRIME">BOX PRIME</option>
          </select>
          <div className="relative w-48 bg-[var(--surface)] rounded-lg border border-[var(--border)]/30 shadow-sm">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-40 text-[var(--ink)]" />
            <input
              type="text" placeholder="BUSCAR..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-transparent pl-7 pr-3 py-1.5 text-[10px] font-semibold text-[var(--ink)] placeholder-[var(--ink)]/40 focus:outline-none transition-all uppercase"
            />
          </div>
        </div>
      </div>
      {/* Product Grid */}`;
    c = c.substring(0, filtersStart) + newFilters + c.substring(filtersEnd);
  }

  fs.writeFileSync('src/pages/Inventory.tsx', c);
  console.log('Done!');
} catch (e) {
  console.error(e);
}
