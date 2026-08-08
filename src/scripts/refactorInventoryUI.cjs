const fs = require('fs');
let c = fs.readFileSync('src/pages/Inventory.tsx', 'utf-8');

// 1. Fix KPI cards sizes
c = c.replace(/className="skeuo-panel p-6 flex flex-col gap-2"/g, 'className="skeuo-panel p-4 flex flex-col gap-2"');
c = c.replace(/className="skeuo-panel p-6 flex flex-col gap-2 relative overflow-hidden group"/g, 'className="skeuo-panel p-4 flex flex-col gap-2 relative overflow-hidden group"');
c = c.replace(/font-black text-3xl/g, 'font-black text-2xl');
c = c.replace(/font-black text-4xl/g, 'font-black text-3xl');

// 2. Fix the Variants button (it wasn't matched properly before)
c = c.replace(
  /className="bg-\[var\(--bg-input\)\] hover:bg-\[var\(--ink\)\] text-\[var\(--ink\)\] hover:text-\[var\(--ink-inv\)\] border border-\[var\(--border\)\] shadow-\[2px_2px_0_var\(--border\)\] active:shadow-none active:translate-y-\[2px\] active:translate-x-\[2px\] transition-all px-3 py-2 flex items-center gap-1\.5 font-mono text-\[10px\] font-bold uppercase shrink-0 h-\[34px\]"/g,
  'className="skeuo-btn px-4 py-2 hover:opacity-80 flex items-center gap-2 font-bold text-xs uppercase shrink-0 transition-opacity h-10"'
);

// 3. Replace the entire Filters container
const filterStart = c.indexOf('{/* Filter row — scrollable on mobile */}');
const filterEnd = c.indexOf('</div>\n      </div>\n\n      <div className="data-table-container flex-1 flex flex-col overflow-hidden">');
if (filterStart > -1 && filterEnd > -1) {
  let sub = c.substring(filterStart, filterEnd);
  
  // Replace select inputs
  sub = sub.replace(/bg-\[var\(--surface\)\] border border-\[var\(--border\)\] py-1\.5 px-2 text-\[10px\] font-bold text-\[var\(--ink\)\] focus:outline-none focus:bg-\[var\(--bg-input\)\] focus:shadow-\[2px_2px_0_var\(--border\)\] transition-all font-mono uppercase cursor-pointer h-\[32px\]/g, 
    'skeuo-inset bg-transparent px-3 py-2 text-xs font-bold uppercase outline-none cursor-pointer text-[var(--ink)]');
  
  // Replace search input
  sub = sub.replace(/w-full bg-\[var\(--surface\)\] border border-\[var\(--border\)\] px-7 py-1\.5 text-\[10px\] font-bold text-\[var\(--ink\)\] focus:outline-none focus:bg-\[var\(--bg-input\)\] focus:shadow-\[2px_2px_0_var\(--border\)\] transition-all font-mono uppercase h-\[32px\]/g,
    'w-full bg-transparent skeuo-inset px-8 py-2 text-xs font-bold uppercase outline-none text-[var(--ink)]');
  
  // Wrap in a nicer skeuo container
  sub = sub.replace(/<div className="flex items-center gap-2 overflow-x-auto pb-0\.5">/,
    `<div className="skeuo-panel p-3 flex items-center gap-4 overflow-x-auto mt-4">`);
  
  c = c.substring(0, filterStart) + sub + c.substring(filterEnd);
}

// 4. Update the data-table-container and header to skeuomorphic styling
c = c.replace(
  /<div className="data-table-container flex-1 flex flex-col overflow-hidden">/g,
  `<div className="skeuo-panel flex-1 flex flex-col overflow-hidden mt-4">`
);

c = c.replace(
  /<div className="grid grid-cols-\[1fr_100px\] data-header">/g,
  `<div className="grid grid-cols-[1fr_100px] bg-[var(--bg-sidebar)] text-xs font-bold uppercase tracking-widest text-[var(--ink)]/80 px-4 py-3 border-b border-black/10">`
);

// We need to also clean up the row styling. 
// Rows are typically using 'data-row' class. But they are inside a map. Let's make sure it looks ok.
c = c.replace(/className="data-row /g, 'className="px-4 py-3 border-b border-[var(--border)] bg-transparent hover:bg-[var(--surface)] cursor-pointer transition-colors ');

// Save
fs.writeFileSync('src/pages/Inventory.tsx', c);
console.log('Script executed');
