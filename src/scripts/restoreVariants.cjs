const fs = require('fs');

try {
  let c = fs.readFileSync('src/pages/Inventory.tsx', 'utf-8');
  let modalText = fs.readFileSync('extracted_modal.txt', 'utf-8');

  // Modernize the modal classes
  modalText = modalText
    // Modal container
    .replace('border-4 border-[var(--border)] w-full max-w-2xl shadow-[8px_8px_0_var(--border)] flex flex-col max-h-[92vh]', 'bg-[var(--bg)] w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[92vh] border border-[var(--border)]/20 overflow-hidden relative')
    // Modal header
    .replace('p-3 border-b border-[var(--border)] bg-[var(--bg-sidebar)] flex justify-between items-center shrink-0', 'p-6 border-b border-[var(--border)]/10 flex justify-between items-start bg-[var(--surface)]')
    .replace('font-serif italic font-bold text-xs uppercase tracking-widest', 'text-xl font-black text-[var(--ink)] tracking-tight')
    .replace('opacity-60 hover:opacity-100 hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] p-1 border border-transparent hover:border-[var(--border)] transition-all', 'p-2 hover:bg-[var(--border)]/10 rounded-full transition-colors cursor-pointer text-[var(--ink)]')
    // Modal inputs
    .replace(/bg-\[var\(--bg-card-alt\)\] border border-\[var\(--border\)\] p-2 text-xs font-bold uppercase focus:bg-\[var\(--bg-input\)\] focus:outline-none focus:shadow-\[2px_2px_0_var\(--border\)\] transition-all rounded-none/g, 'w-full bg-[var(--surface)] border border-[var(--border)]/20 px-4 py-3 rounded-xl text-[13px] font-semibold text-[var(--ink)] focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all uppercase placeholder-[var(--ink)]/30')
    // Labels
    .replace(/font-mono text-\[9px\] font-bold tracking-\[0\.2em\] opacity-80 uppercase/g, 'text-[10px] font-bold text-[var(--ink)]/40 uppercase tracking-widest mb-1')
    // Colors and sizes buttons
    .replace(/bg-\[var\(--bg-card-alt\)\] text-\[var\(--ink\)\] border-\[var\(--border\)\] opacity-60 hover:opacity-100/g, 'bg-[var(--surface)] border-[var(--border)]/20 text-[var(--ink)]/70 hover:bg-[var(--border)]/10 rounded-lg')
    .replace(/bg-\[var\(--ink\)\] text-\[var\(--ink-inv\)\] border-\[var\(--border\)\] shadow-\[2px_2px_0_var\(--border\)\]/g, 'bg-blue-600 border-transparent text-white shadow-sm rounded-lg')
    // Size custom input
    .replace(/bg-\[var\(--bg-card-alt\)\] border border-\[var\(--border\)\] p-1\.5 text-xs font-bold font-mono uppercase focus:outline-none focus:shadow-\[2px_2px_0_var\(--border\)\] flex-1 rounded-none/g, 'w-full bg-[var(--surface)] border border-[var(--border)]/20 px-3 py-2 rounded-lg text-xs font-semibold text-[var(--ink)] focus:outline-none focus:border-blue-500/50 transition-all uppercase placeholder-[var(--ink)]/30 flex-1')
    // + Button
    .replace(/bg-\[var\(--bg-input\)\] border border-\[var\(--border\)\] px-3 text-\[10px\] font-mono font-bold hover:bg-\[var\(--ink\)\] hover:text-\[var\(--ink-inv\)\] transition-all/g, 'bg-[var(--surface)] border border-[var(--border)]/20 px-3 py-2 rounded-lg hover:bg-[var(--border)]/10 text-[var(--ink)] transition-colors cursor-pointer')
    // Action buttons at bottom
    .replace(/bg-\[var\(--bg-input\)\] border border-\[var\(--border\)\] text-\[var\(--ink\)\] px-5 py-2\.5 text-\[10px\] font-mono tracking-widest font-bold hover:bg-\[var\(--ink\)\] hover:text-\[var\(--ink-inv\)\] transition-all shadow-\[2px_2px_0_var\(--border\)\]/g, 'bg-transparent border border-[var(--border)]/20 text-[var(--ink)] px-5 py-2.5 rounded-xl hover:bg-[var(--border)]/10 transition-colors font-semibold text-[11px] uppercase')
    .replace(/bg-\[var\(--ink\)\] text-\[var\(--ink-inv\)\] border border-\[var\(--border\)\] px-5 py-2\.5 text-\[10px\] font-mono tracking-widest font-bold shadow-\[4px_4px_0_var\(--border\)\] hover:bg-\[var\(--bg-input\)\] hover:text-\[var\(--ink\)\] active:shadow-none active:translate-y-\[4px\] active:translate-x-\[4px\] transition-all/g, 'bg-blue-600 text-white shadow-sm px-5 py-2.5 rounded-xl font-semibold text-[11px] uppercase transition-all border border-transparent hover:bg-blue-700');

  // Insert modal back before showAddModal
  const insertTarget = '{showAddModal && (';
  const insertIndex = c.indexOf(insertTarget);
  
  if (insertIndex !== -1) {
    c = c.substring(0, insertIndex) + modalText + '\n      ' + c.substring(insertIndex);
  } else {
    throw new Error("Could not find {showAddModal && (");
  }

  // Update the variants button in the header
  const brutalistVariantsBtn = 'className="bg-[var(--bg-input)] hover:bg-[var(--ink)] text-[var(--ink)] hover:text-[var(--ink-inv)] border border-[var(--border)] shadow-[2px_2px_0_var(--border)] active:shadow-none active:translate-y-[2px] active:translate-x-[2px] transition-all px-3 py-2 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase shrink-0 h-[34px]"';
  const modernVariantsBtn = 'className="bg-transparent hover:bg-[var(--border)]/10 text-[var(--ink)] border border-[var(--border)]/50 shadow-sm px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 uppercase font-semibold text-[11px] h-full"';
  
  c = c.replace(brutalistVariantsBtn, modernVariantsBtn);

  fs.writeFileSync('src/pages/Inventory.tsx', c);
  console.log('Restored VariantsModal!');
} catch (e) {
  console.error(e);
}
