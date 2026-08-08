const fs = require('fs');

let c = fs.readFileSync('src/pages/Dashboard.tsx', 'utf-8');

// Replace KPI cards
const kpiStart = c.indexOf('{/* KPI Cards */}');
const kpiEnd = c.indexOf('{/* -- PESTANA: POR PRODUCTO');
if (kpiStart > -1 && kpiEnd > -1) {
  let sub = c.substring(kpiStart, kpiEnd);
  sub = sub.replace(/<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/,
`<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="skeuo-panel p-6 flex flex-col items-center justify-center">
          <div className="w-14 h-14 skeuo-inset flex items-center justify-center rounded-full mb-4">
            <Package size={24} className="text-[var(--ink)] opacity-70" />
          </div>
          <p className="text-[10px] tracking-widest uppercase opacity-50 mb-1">Stock Total</p>
          <p className="text-4xl font-black">{totalItemsInStock.toLocaleString()}</p>
        </div>

        <div className="skeuo-panel p-6 flex flex-col items-center justify-center">
          <div className="w-14 h-14 skeuo-inset flex items-center justify-center rounded-full mb-4">
            <ArrowDownLeft size={24} className="text-blue-500" />
          </div>
          <p className="text-[10px] tracking-widest uppercase opacity-50 mb-1">Entradas Hoy</p>
          <p className="text-4xl font-black text-blue-500">{todaysReceptions.toLocaleString()}</p>
        </div>

        <div className="skeuo-panel p-6 flex flex-col items-center justify-center">
          <div className="w-14 h-14 skeuo-inset flex items-center justify-center rounded-full mb-4">
            <ArrowUpRight size={24} className="text-green-500" />
          </div>
          <p className="text-[10px] tracking-widest uppercase opacity-50 mb-1">Salidas Hoy</p>
          <p className="text-4xl font-black text-green-500">{todaysDispatches.toLocaleString()}</p>
        </div>

        <div className="skeuo-panel p-6 flex flex-col items-center justify-center">
          <div className="w-14 h-14 skeuo-inset flex items-center justify-center rounded-full mb-4">
            <AlertTriangle size={24} className="text-red-500" />
          </div>
          <p className="text-[10px] tracking-widest uppercase opacity-50 mb-1">Bajas Hoy</p>
          <p className="text-4xl font-black text-red-500">{todaysWriteoffs.toLocaleString()}</p>
        </div>
      </div>`);
  c = c.substring(0, kpiStart) + sub + c.substring(kpiEnd);
}

// Replace Charts Container
c = c.replace(
  'className="bg-[var(--surface)] border border-[var(--border)] p-4 flex flex-col mt-4"',
  'className="skeuo-panel p-6 mt-8 flex flex-col"'
);

// Replace Time buttons
c = c.replace(
  /<div className="flex gap-2">[\s\S]*?<\/div>\s*<\/div>\s*<div className="h-64 w-full">/,
  `<div className="flex bg-[var(--bg)] p-1 rounded-lg skeuo-inset">
            {[7, 14, 30].map(d => (
              <button
                key={d}
                onClick={() => setDays(d as any)}
                className={\`px-4 py-2 text-xs font-bold tracking-widest uppercase rounded-md transition-all \${days === d ? 'skeuo-btn' : 'opacity-50 hover:opacity-100'}\`}
              >
                {d}D
              </button>
            ))}
          </div>
        </div>
        <div className="h-72 w-full skeuo-inset p-4">`
);

// Replace Inventory Value Estimate
c = c.replace(
  /<div className="bg-\[var\(--surface\)\] border border-\[var\(--border\)\] p-4 mt-4">[\s\S]*?Valorización Estimada de Inventario[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/,
  `<div className="skeuo-panel p-6 mt-8">
        <h2 className="text-sm font-bold tracking-widest uppercase mb-6">Valorización Estimada de Inventario</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
          <div className="skeuo-inset p-6 flex flex-col items-center justify-center">
            <span className="text-[10px] tracking-widest opacity-50 uppercase mb-2">Costo Total</span>
            <span className="text-4xl font-black">S/ {totalInventoryValue.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
          </div>
          <div className="skeuo-inset p-6 flex flex-col items-center justify-center">
            <span className="text-[10px] tracking-widest opacity-50 uppercase mb-2">Cant. Referencias (SKUs)</span>
            <span className="text-4xl font-black">{products.length}</span>
          </div>
        </div>
      </div>`
);

fs.writeFileSync('src/pages/Dashboard.tsx', c);
console.log('done');
