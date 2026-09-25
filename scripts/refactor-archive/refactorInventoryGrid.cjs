const fs = require('fs');

try {
  let c = fs.readFileSync('src/pages/Inventory.tsx', 'utf-8');

  // 1. Add states
  const stateSearch = "const [showAddModal, setShowAddModal] = useState(false);";
  if (!c.includes("const [selectedProductForModal")) {
    c = c.replace(
      stateSearch,
      stateSearch + "\n  const [selectedProductForModal, setSelectedProductForModal] = useState<string | null>(null);\n  const [modalColorFilter, setModalColorFilter] = useState<string | null>(null);\n  const [modalSizeFilter, setModalSizeFilter] = useState<string | null>(null);"
    );
  }

  // 2. Replace the data table
  const startStr = '<div className="bg-[var(--surface)] flex-1 flex flex-col overflow-hidden rounded-2xl border border-[var(--border)]/50 shadow-sm mt-2">';
  const endStr = '{showAddModal && (';

  const startIndex = c.indexOf(startStr);
  const endIndex = c.indexOf(endStr);

  if (startIndex === -1 || endIndex === -1) {
    throw new Error('Could not find start or end bounds for replacement.');
  }

  const replacement = `      {/* Product Grid */}
      <div className="flex-1 overflow-auto mt-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pb-12">
          {sortedProductNames.length === 0 && (
            <div className="col-span-full p-12 flex items-center justify-center text-[var(--ink)] opacity-50 font-sans text-sm uppercase">NO HAY PRODUCTOS COINCIDENTES</div>
          )}
          {sortedProductNames.map(productName => {
            const productItems = groupedByProduct[productName];
            const productTotal = productItems.reduce((s, i) => s + i.totalStock, 0);
            
            return (
              <div 
                key={productName}
                onClick={() => {
                  setSelectedProductForModal(productName);
                  setModalColorFilter(null);
                  setModalSizeFilter(null);
                }}
                className="bg-[var(--surface)] border border-[var(--border)]/20 rounded-2xl p-4 flex flex-col gap-3 cursor-pointer hover:shadow-lg hover:border-blue-500/50 hover:-translate-y-1 transition-all group shadow-sm"
              >
                <div className="w-12 h-12 rounded-xl bg-[var(--border)]/5 flex items-center justify-center">
                  <Package size={24} className="text-[var(--ink)]/40 group-hover:text-blue-500 group-hover:scale-110 transition-all" />
                </div>
                <h3 className="font-bold text-[var(--ink)] text-[13px] line-clamp-2 leading-tight min-h-[36px]">{productName}</h3>
                <div className="mt-auto pt-3 flex items-center justify-between border-t border-[var(--border)]/10">
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-[var(--ink)]/40 tracking-wider">Variantes</span>
                    <span className="text-xs font-semibold text-[var(--ink)]/70">{productItems.length} SKU</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[9px] uppercase font-bold text-[var(--ink)]/40 tracking-wider">Stock</span>
                    <span className="text-sm font-black text-blue-600 dark:text-blue-400">{productTotal}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Product Details Modal */}
      {selectedProductForModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--bg)] w-full max-w-4xl h-[85vh] rounded-3xl shadow-2xl flex flex-col border border-[var(--border)]/20 overflow-hidden relative">
            
            {/* Header */}
            <div className="p-6 border-b border-[var(--border)]/10 flex justify-between items-start bg-[var(--surface)]">
              <div>
                <h2 className="text-2xl font-black text-[var(--ink)] tracking-tight">{selectedProductForModal}</h2>
                <p className="text-[11px] font-bold text-[var(--ink)]/50 uppercase tracking-widest mt-1">
                  {groupedByProduct[selectedProductForModal].length} VARIANTES REGISTRADAS
                </p>
              </div>
              <button onClick={() => setSelectedProductForModal(null)} className="p-2 hover:bg-[var(--border)]/10 rounded-full transition-colors cursor-pointer">
                <X size={20} className="text-[var(--ink)]" />
              </button>
            </div>

            {/* Filters */}
            <div className="p-4 border-b border-[var(--border)]/10 bg-[var(--surface)]/50 flex flex-col gap-4">
              {/* Colors */}
              <div>
                <span className="text-[10px] font-bold text-[var(--ink)]/40 uppercase tracking-widest mb-2 block">Filtrar por Color:</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setModalColorFilter(null)}
                    className={"px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all " + (!modalColorFilter ? 'bg-blue-600 text-white shadow-sm' : 'bg-transparent border border-[var(--border)]/20 text-[var(--ink)] hover:bg-[var(--border)]/10')}
                  >
                    TODOS
                  </button>
                  {Array.from(new Set(groupedByProduct[selectedProductForModal].map(i => i.color || 'SIN COLOR'))).sort().map(color => (
                    <button
                      key={color}
                      onClick={() => setModalColorFilter(color)}
                      className={"px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all " + (modalColorFilter === color ? 'bg-blue-600 text-white shadow-sm' : 'bg-transparent border border-[var(--border)]/20 text-[var(--ink)] hover:bg-[var(--border)]/10')}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
              {/* Sizes */}
              <div>
                <span className="text-[10px] font-bold text-[var(--ink)]/40 uppercase tracking-widest mb-2 block">Filtrar por Talla:</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setModalSizeFilter(null)}
                    className={"px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all " + (!modalSizeFilter ? 'bg-zinc-800 dark:bg-gray-200 text-white dark:text-black shadow-sm' : 'bg-transparent border border-[var(--border)]/20 text-[var(--ink)] hover:bg-[var(--border)]/10')}
                  >
                    TODAS
                  </button>
                  {Array.from(new Set(groupedByProduct[selectedProductForModal].map(i => i.size || 'SIN TALLA'))).sort().map(size => (
                    <button
                      key={size}
                      onClick={() => setModalSizeFilter(size)}
                      className={"px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all " + (modalSizeFilter === size ? 'bg-zinc-800 dark:bg-gray-200 text-white dark:text-black shadow-sm' : 'bg-transparent border border-[var(--border)]/20 text-[var(--ink)] hover:bg-[var(--border)]/10')}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-auto bg-[var(--border)]/5 p-4">
              <div className="flex flex-col gap-3">
                {groupedByProduct[selectedProductForModal]
                  .filter(item => !modalColorFilter || (item.color || 'SIN COLOR') === modalColorFilter)
                  .filter(item => !modalSizeFilter || (item.size || 'SIN TALLA') === modalSizeFilter)
                  .map(item => (
                  <div key={item.id} className="bg-[var(--surface)] border border-[var(--border)]/20 rounded-xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-[var(--border)]/5 flex items-center justify-center shrink-0">
                        <QrCode size={18} className="text-[var(--ink)]/40" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-mono text-sm font-bold text-[var(--ink)]">{item.code}</span>
                        <div className="flex gap-2 text-[10px] uppercase font-bold text-[var(--ink)]/60 mt-1">
                          <span>{item.color || 'N/A'}</span>
                          <span className="opacity-50">•</span>
                          <span>{item.size || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-[20px] font-black text-[var(--ink)] leading-none">{item.totalStock}</div>
                        <div className="text-[9px] uppercase font-bold text-[var(--ink)]/40 mt-1 tracking-wider">Unidades</div>
                      </div>
                      
                      <div className="flex items-center gap-1 border-l border-[var(--border)]/10 pl-6">
                        <button
                          onClick={(e) => { e.stopPropagation(); setQrProduct(item); }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--border)]/10 text-[var(--ink)] transition-colors cursor-pointer"
                          title="Ver QR"
                        >
                          <QrCode size={14} />
                        </button>
                        {canEdit(currentUser.role, 'inventory') && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingProduct(item); setShowEditModal(true); }}
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--border)]/10 text-blue-600 transition-colors cursor-pointer"
                              title="Editar"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setProductToDelete(item); }}
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-red-600 transition-colors cursor-pointer"
                              title="Eliminar"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      `;

  c = c.substring(0, startIndex) + replacement + c.substring(endIndex);

  fs.writeFileSync('src/pages/Inventory.tsx', c);
  console.log('Script executed successfully!');
} catch(e) {
  console.error(e.message);
}
