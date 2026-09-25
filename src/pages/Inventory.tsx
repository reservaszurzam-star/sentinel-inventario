import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { Search, Plus, X, Edit2, AlertTriangle, Trash2, Download, Upload, QrCode, ArrowDownLeft, ArrowUpRight, Package, Layers, Sparkles } from 'lucide-react';
import { Product } from '../types';
import Papa from 'papaparse';
import { canEdit } from '../lib/permissions';
import { QRModal } from '../components/QRModal';
import { TutorialModal, INVENTORY_TUTORIAL_STEPS } from '../components/TutorialModal';

export const Inventory: React.FC = () => {
  const { products, stockLevels, transactions, addProduct, updateProduct, deleteProduct, activeBrand, setActiveBrand, currentUser } = useAppContext();
  const [showTutorial, setShowTutorial] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [filterColor] = useState('');
  const [filterSize] = useState('');
  const [filterStatus] = useState(() => {
    return window.sessionStorage.getItem('inventoryFilter') === 'LOW_STOCK' ? 'LOW_STOCK' : 'ALL';
  });

  // Clear session storage filter once read
  useEffect(() => {
    window.sessionStorage.removeItem('inventoryFilter');
  }, []);

  const [filterFabric, setFilterFabric] = useState<string | null>(null);
  const FABRIC_TYPES = ['JERSEY', 'WAFFLE', 'CATANIA', 'FRENCH TERRY', 'BRATZ', 'PIQUE'];
  
  const PRODUCT_FABRICS: Record<string, string> = {
    'BABY TY': 'JERSEY',
    'BABY TY ESCOTADO MANGA': 'JERSEY',
    'BABY TY ESCOTE': 'JERSEY',
    'BABY TY MANGA': 'JERSEY',
    'CAMISERO JERSEY': 'JERSEY',
    'CLASICO': 'JERSEY',
    'CLASICOS DE REGALO': 'JERSEY',
    'OVERSIZE': 'JERSEY',
    'SLIM FIT': 'JERSEY',
    'JERSEY MANGA LARGA': 'JERSEY',
    'MEDIAS CORTAS': 'JERSEY',
    'MEDIAS LARGAS': 'JERSEY',
    
    'CAMISA WAFFLE': 'WAFFLE',
    'CUELLO CHINO WAFFLE': 'WAFFLE',
    'WAFFLE': 'WAFFLE',
    'WAFFLE CAMISERO': 'WAFFLE',
    'WAFFLE MANGA LARGA': 'WAFFLE',
    'TOP RIB': 'WAFFLE',
    'TOP RIB MANGA': 'WAFFLE',
    
    'PANTALON CATANIA': 'CATANIA',
    
    'POLERA NERU': 'FRENCH TERRY',
    'POLERA BOXYFIT': 'FRENCH TERRY',
    
    'PANTALON BRATZ': 'BRATZ',
    'PANTALON OPRA': 'BRATZ',
    
    'CAMISERO PIQUE': 'PIQUE',
    'CAMISERO PIQUE MANGA LARGA': 'PIQUE',
    'CUELLO CHINO': 'PIQUE'
  };
  const [filterLocation] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProductForModal, setSelectedProductForModal] = useState<string | null>(null);
  const [modalColorFilter, setModalColorFilter] = useState<string | null>(null);
  const [modalSizeFilter, setModalSizeFilter] = useState<string | null>(null);
  const [newProduct, setNewProduct] = useState<{code: string, name: string, color: string, size: string, category: string, lowStockThreshold: string, costPrice: string, sellPrice: string}>({ code: '', name: '', color: '', size: '', category: '', lowStockThreshold: '', costPrice: '', sellPrice: '' });

  const [showVariantsModal, setShowVariantsModal] = useState(false);
  const [variantForm, setVariantForm] = useState({
    name: '', codePrefix: '', category: '',
    costPrice: '', sellPrice: '', lowStockThreshold: ''
  });
  const PRESET_COLORS = ['Negro','Blanco','Azul','Rojo','Verde','Gris','Beige','Cemento','Vino','Marron','Plomo','Pacay','Menta','Camote','Denim','Topo','P.Rosa','Perla','Botella','Melanqe O.'];
  const PRESET_SIZES = ['XS','S','M','L','XL','XXL','XXXL','TALLA UNICA'];
  const [variantColors, setVariantColors] = useState<string[]>([]);
  const [variantSizes, setVariantSizes] = useState<string[]>([]);
  const [customColor, setCustomColor] = useState('');
  const [customSize, setCustomSize] = useState('');

  const toggleVariantColor = (c: string) => setVariantColors(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  const toggleVariantSize = (s: string) => setVariantSizes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  // Unique product families (distinct names) for the base selector
  const productFamilies = useMemo(() => {
    const seen = new Map<string, Product>();
    for (const p of products) {
      if (!seen.has(p.name)) seen.set(p.name, p);
    }
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  // Next correlative index and padding for a given code prefix
  const getNextCodeInfo = (prefix: string) => {
    const upper = prefix.toUpperCase().trim();
    const matching = products
      .map(p => p.code)
      .filter(c => c.toUpperCase().startsWith(upper + '-'));

    let padLength = 3;
    const nums: number[] = [];
    for (const code of matching) {
      const part = code.slice(upper.length + 1);
      if (part.length > padLength) padLength = part.length;
      const parsed = parseInt(part, 10);
      if (!isNaN(parsed)) nums.push(parsed);
    }
    const nextIdx = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    return { nextIdx, padLength: Math.max(padLength, 3) };
  };

  const selectVariantBase = (p: Product) => {
    const prefix = p.code.includes('-') ? p.code.split('-')[0] : p.code;
    setVariantForm({
      name: p.name,
      codePrefix: prefix,
      category: p.category ?? '',
      costPrice: p.costPrice != null ? String(p.costPrice) : '',
      sellPrice: p.sellPrice != null ? String(p.sellPrice) : '',
      lowStockThreshold: p.lowStockThreshold != null ? String(p.lowStockThreshold) : '',
    });
  };

  const handleVariantNameChange = (nameVal: string) => {
    const upper = nameVal.trim().toUpperCase();
    const existing = products.find(p => p.name.trim().toUpperCase() === upper);
    if (existing) {
      const prefix = existing.code.includes('-') ? existing.code.split('-')[0] : existing.code;
      setVariantForm({
        name: nameVal,
        codePrefix: prefix,
        category: existing.category || '',
        costPrice: existing.costPrice != null ? String(existing.costPrice) : '',
        sellPrice: existing.sellPrice != null ? String(existing.sellPrice) : '',
        lowStockThreshold: existing.lowStockThreshold != null ? String(existing.lowStockThreshold) : '',
      });
    } else {
      setVariantForm(prev => ({
        ...prev,
        name: nameVal,
        codePrefix: prev.codePrefix || (activeBrand === 'BRAVOS' ? 'BRV' : activeBrand === 'BOX_PRIME' ? 'BP' : '')
      }));
    }
  };

  const [isSubmittingVariants, setIsSubmittingVariants] = useState(false);
  const [variantError, setVariantError] = useState<string | null>(null);

  const handleAddVariants = async () => {
    if (!variantForm.name || !variantForm.codePrefix) return;
    const colors = variantColors.length ? variantColors : [''];
    const sizes = variantSizes.length ? variantSizes : [''];
    const { nextIdx: startIdx, padLength } = getNextCodeInfo(variantForm.codePrefix);
    
    setIsSubmittingVariants(true);
    setVariantError(null);
    try {
      let idx = 0;
      for (const color of colors) {
        for (const size of sizes) {
          const suffix = String(startIdx + idx).padStart(padLength, '0');
          await addProduct({
            code: `${variantForm.codePrefix.toUpperCase()}-${suffix}`,
            name: variantForm.name.toUpperCase().trim(),
            color: color ? color.trim() : undefined,
            size: size ? size.trim() : undefined,
            category: variantForm.category || 'General',
            costPrice: variantForm.costPrice ? Number(variantForm.costPrice) : undefined,
            sellPrice: variantForm.sellPrice ? Number(variantForm.sellPrice) : undefined,
            lowStockThreshold: variantForm.lowStockThreshold ? Number(variantForm.lowStockThreshold) : undefined,
          });
          idx++;
        }
      }
      setShowVariantsModal(false);
      setVariantForm({ name: '', codePrefix: '', category: '', costPrice: '', sellPrice: '', lowStockThreshold: '' });
      setVariantColors([]);
      setVariantSizes([]);
      alert(`Se crearon exitosamente ${idx} variante(s) para "${variantForm.name.toUpperCase()}".`);
    } catch (err: unknown) {
      console.error('Error creating variants:', err);
      const msg = err instanceof Error ? err.message : 'Error al registrar variantes.';
      setVariantError(msg);
      alert('No se pudieron crear las variantes: ' + msg);
    } finally {
      setIsSubmittingVariants(false);
    }
  };

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [qrProduct, setQrProduct] = useState<Product | null>(null);

  const totalRecepcionado = useMemo(() =>
    transactions.filter(t => t.type === 'RECEPTION' && t.status !== 'CANCELLED').reduce((s, t) => s + t.quantity, 0),
  [transactions]);

  const totalDisponible = useMemo(() =>
    stockLevels.reduce((s, sl) => s + sl.quantity, 0),
  [stockLevels]);

  const totalDespachado = useMemo(() =>
    transactions.filter(t => t.type === 'DISPATCH' && t.status !== 'CANCELLED').reduce((s, t) => s + t.quantity, 0),
  [transactions]);

  // Calculate aggregated stock per product
  const inventoryData = products.map(p => {
    const productStock = stockLevels.filter(s => s.productId === p.id);
    const filteredStock = filterLocation ? productStock.filter(s => s.locationId === filterLocation) : productStock;
    const total = filteredStock.reduce((acc, curr) => acc + curr.quantity, 0);
    return { ...p, totalStock: total, locations: filteredStock };
  }).filter(p => {
    const s = search.toLowerCase();
    const searchMatch = p.name.toLowerCase().includes(s) || p.code.toLowerCase().includes(s);
    const colorMatch = filterColor ? p.color === filterColor : true;
    const sizeMatch = filterSize ? p.size === filterSize : true;
    let categoryMatch = true;
    if (filterFabric) {
      const explicitFabric = PRODUCT_FABRICS[p.name.toUpperCase()];
      if (explicitFabric) {
        categoryMatch = explicitFabric === filterFabric;
      } else {
        categoryMatch = p.name.toUpperCase().includes(filterFabric);
      }
    }
    const statusMatch = filterStatus === 'LOW_STOCK' ? (p.lowStockThreshold !== undefined && p.totalStock <= p.lowStockThreshold) : true;
    const locationMatch = filterLocation ? p.totalStock > 0 : true;
    return searchMatch && colorMatch && sizeMatch && categoryMatch && statusMatch && locationMatch;
  });

  const groupedByProduct = inventoryData.reduce<Record<string, typeof inventoryData>>((acc, p) => {
    if (!acc[p.name]) acc[p.name] = [];
    acc[p.name].push(p);
    return acc;
  }, {});

  const sortedProductNames = Object.keys(groupedByProduct).sort();

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newProduct.code && newProduct.name) {
      try {
        await addProduct({
          code: newProduct.code.trim().toUpperCase(),
          name: newProduct.name.trim().toUpperCase(),
          color: newProduct.color ? newProduct.color.trim() : undefined,
          size: newProduct.size ? newProduct.size.trim() : undefined,
          category: newProduct.category || 'General',
          lowStockThreshold: newProduct.lowStockThreshold ? Number(newProduct.lowStockThreshold) : undefined,
          costPrice: newProduct.costPrice ? Number(newProduct.costPrice) : undefined,
          sellPrice: newProduct.sellPrice ? Number(newProduct.sellPrice) : undefined
        });
        setShowAddModal(false);
        setNewProduct({ code: '', name: '', color: '', size: '', category: '', lowStockThreshold: '', costPrice: '', sellPrice: '' });
      } catch (err: unknown) {
        alert('No se pudo registrar el SKU: ' + (err instanceof Error ? err.message : 'Error desconocido'));
      }
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct && editingProduct.code && editingProduct.name) {
      updateProduct(editingProduct);
      setShowEditModal(false);
      setEditingProduct(null);
    }
  };

  const confirmDelete = () => {
    if (productToDelete) {
      deleteProduct(productToDelete.id);
      setProductToDelete(null);
    }
  };

  const exportCSV = () => {
    const headers = ["Codigo", "Nombre", "Color", "Talla", "Categor-a", "Stock Total", "Umbral Bajo", "Costo Unitario", "Precio Venta"];
    
    const rows = inventoryData.map(item => [
      item.code,
      item.name,
      item.color || '',
      item.size || '',
      item.category,
      item.totalStock,
      item.lowStockThreshold !== undefined ? item.lowStockThreshold : '',
      item.costPrice !== undefined ? item.costPrice : '',
      item.sellPrice !== undefined ? item.sellPrice : ''
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(field => `"${String(field).replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `inventario_${activeBrand.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        results.data.forEach((row: any) => {
          if (row['Codigo'] && row['Nombre']) {
            addProduct({
              code: row['Codigo'],
              name: row['Nombre'],
              color: row['Color'],
              size: row['Talla'],
              category: row['Categor-a'] || 'General',
              lowStockThreshold: row['Umbral Bajo'] ? Number(row['Umbral Bajo']) : undefined
            });
          }
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
        alert(`Se importaron ${results.data.length} productos.`);
      },
      error: (error: any) => {
        alert('Error al leer el archivo CSV: ' + error.message);
      }
    });
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-10">
      <TutorialModal open={showTutorial} onClose={() => setShowTutorial(false)} steps={INVENTORY_TUTORIAL_STEPS} title="Inventario" />
      
      {/* Hero Module Header */}
      <ModuleInfo 
        number="05" 
        title="Inventario" 
        description="Directorio consolidado de productos por marca, color y talla. Registra nuevos SKUs, genera variantes en lote, consulta existencias por almacén y exporta tus catálogos."
        onTutorial={() => setShowTutorial(true)}
      />

      <datalist id="product-names">
        {productFamilies.map(p => (
          <option key={p.id} value={p.name} />
        ))}
      </datalist>

      <datalist id="category-list">
        <option value="Polos" />
        <option value="Medias" />
        <option value="Poleras" />
        <option value="Pantalones" />
      </datalist>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border-soft)] p-4.5 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <ArrowDownLeft size={20} className="text-emerald-500" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]/50">Recepcionado Total</p>
              <h4 className="text-2xl font-black text-[var(--ink)] tracking-tight leading-none mt-1">
                {totalRecepcionado.toLocaleString()}
              </h4>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-lg">Entradas</span>
        </div>

        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border-soft)] p-4.5 flex items-center justify-between shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-blue-500/5 to-transparent pointer-events-none" />
          <div className="flex items-center gap-3.5 relative z-10">
            <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
              <Package size={20} className="text-blue-500 group-hover:scale-110 transition-transform" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]/50">Stock Disponible</p>
              <h4 className="text-2xl font-black text-blue-600 dark:text-blue-400 tracking-tight leading-none mt-1">
                {totalDisponible.toLocaleString()}
              </h4>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold text-blue-500 bg-blue-500/10 px-2.5 py-1 rounded-lg relative z-10">Activo</span>
        </div>

        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border-soft)] p-4.5 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
              <ArrowUpRight size={20} className="text-violet-500" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]/50">Despachado Total</p>
              <h4 className="text-2xl font-black text-[var(--ink)] tracking-tight leading-none mt-1">
                {totalDespachado.toLocaleString()}
              </h4>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold text-violet-500 bg-violet-500/10 px-2 py-1 rounded-lg">Salidas</span>
        </div>
      </div>

      {/* Modern Filter & Action Toolbar */}
      <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl p-3.5 shadow-sm flex flex-col gap-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Brand select + Search */}
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={activeBrand}
              onChange={(e) => setActiveBrand(e.target.value as any)}
              className="bg-[var(--bg-input)] border border-[var(--border-soft)] px-3 py-2 text-xs font-bold text-[var(--ink)] rounded-xl focus:outline-none focus:border-blue-500/50 transition-all uppercase cursor-pointer shadow-sm"
            >
              <option value="OVERSHARK">OVERSHARK</option>
              <option value="BRAVOS">BRAVOS URBAN</option>
              <option value="BOX_PRIME">BOX PRIME</option>
            </select>

            <div className="relative w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink)]/40 pointer-events-none" />
              <input
                type="text" 
                placeholder="BUSCAR SKU O PRENDA..." 
                value={search} 
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] pl-8 pr-3 py-2 text-xs font-semibold text-[var(--ink)] placeholder-[var(--ink)]/40 rounded-xl focus:outline-none focus:border-blue-500/50 transition-all uppercase"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--ink)]/40 hover:text-[var(--ink)]">
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {canEdit(currentUser.role, 'inventory') && (
              <>
                <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="modern-btn px-3.5 py-2 text-xs flex items-center gap-1.5"
                  title="IMPORTAR CSV"
                >
                  <Upload size={14} />
                  <span className="hidden sm:inline">Importar</span>
                </button>
              </>
            )}
            
            <button
              onClick={exportCSV}
              className="modern-btn px-3.5 py-2 text-xs flex items-center gap-1.5"
              title="EXPORTAR CSV"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Exportar</span>
            </button>

            {canEdit(currentUser.role, 'inventory') && (
              <>
                <button
                  onClick={() => setShowVariantsModal(true)}
                  className="modern-btn px-3.5 py-2 text-xs flex items-center gap-1.5 text-blue-600 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
                  title="CREAR VARIANTES EN LOTE"
                >
                  <Sparkles size={14} />
                  <span>Variantes</span>
                </button>

                <button
                  onClick={() => setShowAddModal(true)}
                  className="modern-btn-primary px-4 py-2 text-xs flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  <span>Nuevo SKU</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Fabric filters pills */}
        <div className="flex items-center gap-1.5 pt-2 border-t border-[var(--border-soft)]/50 overflow-x-auto pb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]/40 shrink-0 mr-1 flex items-center gap-1">
            <Layers size={12} /> Tejido:
          </span>
          <button
            onClick={() => setFilterFabric(null)}
            className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all shrink-0 ${
              !filterFabric 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'bg-[var(--bg-input)] text-[var(--ink)]/70 hover:text-[var(--ink)] hover:bg-[var(--border-soft)]'
            }`}
          >
            TODOS
          </button>
          {FABRIC_TYPES.map(c => (
            <button
              key={c}
              onClick={() => setFilterFabric(c)}
              className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all shrink-0 ${
                filterFabric === c 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'bg-[var(--bg-input)] text-[var(--ink)]/70 hover:text-[var(--ink)] hover:bg-[var(--border-soft)]'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
        {sortedProductNames.length === 0 && (
          <div className="col-span-full py-16 flex flex-col items-center justify-center text-center gap-3 bg-[var(--surface)] rounded-2xl border border-[var(--border-soft)]">
            <div className="w-12 h-12 rounded-2xl bg-[var(--border-soft)]/50 flex items-center justify-center text-[var(--ink)]/30">
              <Package size={24} />
            </div>
            <div>
              <p className="font-bold text-sm text-[var(--ink)]">No hay productos que coincidan</p>
              <p className="text-xs text-[var(--ink)]/50 mt-0.5">Prueba cambiando los filtros o agregando nuevos SKUs</p>
            </div>
          </div>
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
              className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl p-4 flex flex-col gap-3 cursor-pointer hover:shadow-lg hover:border-blue-500/40 hover:-translate-y-0.5 transition-all group shadow-sm"
            >
              <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Package size={20} className="text-blue-500 group-hover:scale-110 transition-transform" />
              </div>
              <h3 className="font-bold text-[var(--ink)] text-xs line-clamp-2 leading-snug min-h-[34px] group-hover:text-blue-500 transition-colors">
                {productName}
              </h3>
              <div className="mt-auto pt-3 flex items-center justify-between border-t border-[var(--border-soft)]/60">
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

      {/* Product Details Modal */}
      {selectedProductForModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[var(--surface)] w-full max-w-4xl h-[85vh] max-h-[640px] rounded-3xl shadow-2xl flex flex-col border border-[var(--border-soft)] overflow-hidden relative">
            
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-[var(--border-soft)] flex justify-between items-center bg-[var(--surface)] gap-3">
              <div className="min-w-0">
                <h2 className="text-lg sm:text-2xl font-black text-[var(--ink)] tracking-tight truncate">{selectedProductForModal}</h2>
                <p className="text-[10px] sm:text-xs font-bold text-[var(--ink)]/50 uppercase tracking-widest mt-1">
                  {groupedByProduct[selectedProductForModal]?.length || 0} VARIANTES REGISTRADAS
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {canEdit(currentUser.role, 'inventory') && (
                  <button
                    onClick={() => {
                      const baseProduct = groupedByProduct[selectedProductForModal]?.[0];
                      if (baseProduct) {
                        selectVariantBase(baseProduct);
                      } else {
                        handleVariantNameChange(selectedProductForModal);
                      }
                      setSelectedProductForModal(null);
                      setShowVariantsModal(true);
                    }}
                    className="modern-btn-primary px-3.5 py-2 text-xs flex items-center gap-1.5"
                    title="Agregar nuevas tallas o colores a este producto"
                  >
                    <Plus size={14} />
                    <span className="hidden sm:inline">Nuevas Variantes</span>
                  </button>
                )}
                <button 
                  onClick={() => setSelectedProductForModal(null)} 
                  className="p-2 hover:bg-[var(--border-soft)] rounded-full transition-colors cursor-pointer text-[var(--ink)]/60 hover:text-[var(--ink)]"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="p-4 border-b border-[var(--border-soft)] bg-[var(--bg-input)]/40 flex flex-col gap-3">
              {/* Colors */}
              <div>
                <span className="text-[10px] font-bold text-[var(--ink)]/40 uppercase tracking-wider mb-1.5 block">Filtrar por Color:</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setModalColorFilter(null)}
                    className={"px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all " + (!modalColorFilter ? 'bg-blue-600 text-white shadow-sm' : 'bg-[var(--surface)] border border-[var(--border-soft)] text-[var(--ink)]/70 hover:bg-[var(--border-soft)]')}
                  >
                    TODOS
                  </button>
                  {Array.from(new Set(groupedByProduct[selectedProductForModal]?.map(i => i.color || 'SIN COLOR') || [])).sort().map(color => (
                    <button
                      key={color}
                      onClick={() => setModalColorFilter(color)}
                      className={"px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all " + (modalColorFilter === color ? 'bg-blue-600 text-white shadow-sm' : 'bg-[var(--surface)] border border-[var(--border-soft)] text-[var(--ink)]/70 hover:bg-[var(--border-soft)]')}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sizes */}
              <div>
                <span className="text-[10px] font-bold text-[var(--ink)]/40 uppercase tracking-wider mb-1.5 block">Filtrar por Talla:</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setModalSizeFilter(null)}
                    className={"px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all " + (!modalSizeFilter ? 'bg-zinc-800 dark:bg-white text-white dark:text-zinc-900 shadow-sm' : 'bg-[var(--surface)] border border-[var(--border-soft)] text-[var(--ink)]/70 hover:bg-[var(--border-soft)]')}
                  >
                    TODAS
                  </button>
                  {Array.from(new Set(groupedByProduct[selectedProductForModal]?.map(i => i.size || 'SIN TALLA') || [])).sort().map(size => (
                    <button
                      key={size}
                      onClick={() => setModalSizeFilter(size)}
                      className={"px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all " + (modalSizeFilter === size ? 'bg-zinc-800 dark:bg-white text-white dark:text-zinc-900 shadow-sm' : 'bg-[var(--surface)] border border-[var(--border-soft)] text-[var(--ink)]/70 hover:bg-[var(--border-soft)]')}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-auto p-4 sm:p-5">
              <div className="flex flex-col gap-2.5">
                {(groupedByProduct[selectedProductForModal] || [])
                  .filter(item => !modalColorFilter || (item.color || 'SIN COLOR') === modalColorFilter)
                  .filter(item => !modalSizeFilter || (item.size || 'SIN TALLA') === modalSizeFilter)
                  .map(item => (
                  <div key={item.id} className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-xl p-3.5 sm:p-4 flex items-center justify-between gap-3 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                        <QrCode size={18} className="text-blue-500" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-mono text-xs sm:text-sm font-bold text-[var(--ink)] truncate">{item.code}</span>
                        <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-[var(--ink)]/60 mt-0.5">
                          <span className="truncate">{item.color || 'Sin color'}</span>
                          <span className="opacity-40">•</span>
                          <span>{item.size || 'Sin talla'}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                      <div className="text-right">
                        <div className="text-lg sm:text-xl font-black text-[var(--ink)] leading-none">{item.totalStock}</div>
                        <div className="text-[9px] uppercase font-bold text-[var(--ink)]/40 mt-1 tracking-wider">Unidades</div>
                      </div>
                      
                      <div className="flex items-center gap-1 border-l border-[var(--border-soft)] pl-3 sm:pl-4">
                        <button
                          onClick={(e) => { e.stopPropagation(); setQrProduct(item); }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--border-soft)] text-[var(--ink)]/70 hover:text-[var(--ink)] transition-colors cursor-pointer"
                          title="Ver QR"
                        >
                          <QrCode size={15} />
                        </button>
                        {canEdit(currentUser.role, 'inventory') && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingProduct(item); setShowEditModal(true); }}
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 transition-colors cursor-pointer"
                              title="Editar"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setProductToDelete(item); }}
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-red-500 transition-colors cursor-pointer"
                              title="Eliminar"
                            >
                              <Trash2 size={15} />
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

      {/* Bulk Variants Modal */}
      {showVariantsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[var(--surface)] w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[92vh] border border-[var(--border-soft)] overflow-hidden relative">
            <div className="p-6 border-b border-[var(--border-soft)] flex justify-between items-center bg-[var(--surface)]">
              <div>
                <h2 className="text-xl font-black text-[var(--ink)] tracking-tight">Registro de Variantes en Lote</h2>
                <p className="text-xs text-[var(--ink)]/50 mt-0.5">Genera automáticamente múltiples combinaciones de color y talla</p>
              </div>
              <button
                onClick={() => setShowVariantsModal(false)}
                className="p-2 hover:bg-[var(--border-soft)] rounded-full transition-colors cursor-pointer text-[var(--ink)]/60 hover:text-[var(--ink)]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 flex flex-col gap-5">
              {/* Base fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Nombre del Producto *</label>
                  <input
                    required
                    list="product-names"
                    value={variantForm.name}
                    onChange={e => handleVariantNameChange(e.target.value)}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[var(--ink)] focus:outline-none focus:border-blue-500 transition-all uppercase placeholder-[var(--ink)]/30"
                    placeholder={activeBrand === 'BRAVOS' ? 'EJ: POLERA BOXYFIT' : 'EJ: CAMISA WAFFLE'}
                  />
                  {variantForm.codePrefix && (
                    <span className="text-[10px] text-blue-500 font-mono font-bold">
                      ✓ Prefijo asignado: {variantForm.codePrefix}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Prefijo de Código *</label>
                  <input
                    required
                    value={variantForm.codePrefix}
                    onChange={e => setVariantForm({ ...variantForm, codePrefix: e.target.value.toUpperCase() })}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold text-[var(--ink)] focus:outline-none focus:border-blue-500 transition-all uppercase placeholder-[var(--ink)]/30"
                    placeholder={activeBrand === 'BRAVOS' ? 'EJ: BRV' : 'EJ: CWF'}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Categoría</label>
                  <input
                    list="category-list"
                    value={variantForm.category}
                    onChange={e => setVariantForm({ ...variantForm, category: e.target.value })}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[var(--ink)] focus:outline-none focus:border-blue-500 transition-all uppercase placeholder-[var(--ink)]/30"
                    placeholder="EJ: POLOS"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Umbral Mínimo</label>
                  <input
                    type="number"
                    value={variantForm.lowStockThreshold}
                    onChange={e => setVariantForm({ ...variantForm, lowStockThreshold: e.target.value })}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[var(--ink)] focus:outline-none focus:border-blue-500 transition-all placeholder-[var(--ink)]/30"
                    placeholder="EJ: 5"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Costo (S/)</label>
                  <input
                    type="number" step="0.01"
                    value={variantForm.costPrice}
                    onChange={e => setVariantForm({ ...variantForm, costPrice: e.target.value })}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[var(--ink)] focus:outline-none focus:border-blue-500 transition-all placeholder-[var(--ink)]/30"
                    placeholder="EJ: 15.50"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Precio Venta (S/)</label>
                  <input
                    type="number" step="0.01"
                    value={variantForm.sellPrice}
                    onChange={e => setVariantForm({ ...variantForm, sellPrice: e.target.value })}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[var(--ink)] focus:outline-none focus:border-blue-500 transition-all placeholder-[var(--ink)]/30"
                    placeholder="EJ: 45.00"
                  />
                </div>
              </div>

              {/* Colors selection */}
              <div className="flex flex-col gap-2 pt-2 border-t border-[var(--border-soft)]">
                <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Colores</label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleVariantColor(c)}
                      className={`px-2.5 py-1 text-[10px] font-bold uppercase transition-all rounded-lg ${
                        variantColors.includes(c) 
                          ? 'bg-blue-600 text-white shadow-sm' 
                          : 'bg-[var(--bg-input)] border border-[var(--border-soft)] text-[var(--ink)]/70 hover:bg-[var(--border-soft)]'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-1">
                  <input
                    value={customColor}
                    onChange={e => setCustomColor(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && customColor.trim()) { toggleVariantColor(customColor.trim()); setCustomColor(''); e.preventDefault(); }}}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3 py-2 rounded-xl text-xs font-semibold text-[var(--ink)] focus:outline-none focus:border-blue-500 transition-all uppercase placeholder-[var(--ink)]/30 flex-1"
                    placeholder="OTRO COLOR + ENTER"
                  />
                  <button
                    type="button"
                    onClick={() => { if (customColor.trim()) { toggleVariantColor(customColor.trim()); setCustomColor(''); }}}
                    className="modern-btn px-3 py-2 text-xs"
                  >
                    +
                  </button>
                </div>
                {variantColors.length > 0 && (
                  <p className="text-[11px] text-[var(--ink)]/60 font-medium">Seleccionados: {variantColors.join(', ')}</p>
                )}
              </div>

              {/* Sizes selection */}
              <div className="flex flex-col gap-2 pt-2 border-t border-[var(--border-soft)]">
                <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Tallas</label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_SIZES.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleVariantSize(s)}
                      className={`px-2.5 py-1 text-[10px] font-bold uppercase transition-all rounded-lg ${
                        variantSizes.includes(s) 
                          ? 'bg-blue-600 text-white shadow-sm' 
                          : 'bg-[var(--bg-input)] border border-[var(--border-soft)] text-[var(--ink)]/70 hover:bg-[var(--border-soft)]'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-1">
                  <input
                    value={customSize}
                    onChange={e => setCustomSize(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && customSize.trim()) { toggleVariantSize(customSize.trim()); setCustomSize(''); e.preventDefault(); }}}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3 py-2 rounded-xl text-xs font-semibold text-[var(--ink)] focus:outline-none focus:border-blue-500 transition-all uppercase placeholder-[var(--ink)]/30 flex-1"
                    placeholder="OTRA TALLA + ENTER"
                  />
                  <button
                    type="button"
                    onClick={() => { if (customSize.trim()) { toggleVariantSize(customSize.trim()); setCustomSize(''); }}}
                    className="modern-btn px-3 py-2 text-xs"
                  >
                    +
                  </button>
                </div>
                {variantSizes.length > 0 && (
                  <p className="text-[11px] text-[var(--ink)]/60 font-medium">Seleccionadas: {variantSizes.join(', ')}</p>
                )}
              </div>

              {/* Preview calculation */}
              {(variantForm.name || variantForm.codePrefix) && (() => {
                const count = Math.max(variantColors.length || 1, 1) * Math.max(variantSizes.length || 1, 1);
                const info = variantForm.codePrefix ? getNextCodeInfo(variantForm.codePrefix) : null;
                const startCode = info ? `${variantForm.codePrefix.toUpperCase()}-${String(info.nextIdx).padStart(info.padLength, '0')}` : '';
                const endCode = info ? `${variantForm.codePrefix.toUpperCase()}-${String(info.nextIdx + count - 1).padStart(info.padLength, '0')}` : '';
                return (
                  <div className="border border-blue-500/20 bg-blue-500/5 p-4 flex items-center justify-between rounded-2xl">
                    <div>
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">SKUs a generar</span>
                      {info && (
                        <span className="font-mono text-xs text-[var(--ink)]/80 font-bold block mt-0.5">
                          Códigos correlativos: {startCode} {count > 1 ? `hasta ${endCode}` : ''}
                        </span>
                      )}
                    </div>
                    <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                      {count}
                    </span>
                  </div>
                );
              })()}

              {variantError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 text-xs font-semibold rounded-xl">
                  {variantError}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[var(--border-soft)] flex justify-end gap-3 bg-[var(--surface)]">
              <button
                type="button"
                onClick={() => setShowVariantsModal(false)}
                disabled={isSubmittingVariants}
                className="modern-btn px-4 py-2.5 text-xs uppercase"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddVariants}
                disabled={!variantForm.name || !variantForm.codePrefix || isSubmittingVariants}
                className="modern-btn-primary px-5 py-2.5 text-xs flex items-center gap-2 uppercase disabled:opacity-40"
              >
                {isSubmittingVariants ? (
                  <span>Creando SKUs...</span>
                ) : (
                  <span>Crear {Math.max(variantColors.length || 1, 1) * Math.max(variantSizes.length || 1, 1)} SKUs</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-opacity">
          <div className="bg-[var(--surface)] border border-[var(--border-soft)] w-full max-w-md rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-5 border-b border-[var(--border-soft)] flex justify-between items-center bg-[var(--surface)]">
              <div>
                <h2 className="text-lg font-black text-[var(--ink)] tracking-tight">Nuevo SKU</h2>
                <p className="text-xs text-[var(--ink)]/50 mt-0.5">Registra un producto individual en el catálogo</p>
              </div>
              <button 
                onClick={() => setShowAddModal(false)} 
                className="p-2 hover:bg-[var(--border-soft)] rounded-full transition-colors text-[var(--ink)]/60 hover:text-[var(--ink)]"
              >
                <X size={18}/>
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="p-5 flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Código SKU *</label>
                <input 
                  required
                  value={newProduct.code}
                  onChange={e => setNewProduct({...newProduct, code: e.target.value})}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold uppercase focus:outline-none focus:border-blue-500 transition-all"
                  placeholder="EJ: SKU-0010"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Nombre del Producto *</label>
                <input 
                  required
                  list="product-names"
                  value={newProduct.name}
                  onChange={e => {
                    const val = e.target.value;
                    const match = products.find(p => p.name.trim().toUpperCase() === val.trim().toUpperCase());
                    if (match && !newProduct.code) {
                      const prefix = match.code.includes('-') ? match.code.split('-')[0] : match.code;
                      const { nextIdx, padLength } = getNextCodeInfo(prefix);
                      setNewProduct(prev => ({
                        ...prev,
                        name: val,
                        code: `${prefix.toUpperCase()}-${String(nextIdx).padStart(padLength, '0')}`,
                        category: match.category || prev.category,
                        lowStockThreshold: match.lowStockThreshold != null ? String(match.lowStockThreshold) : prev.lowStockThreshold,
                        costPrice: match.costPrice != null ? String(match.costPrice) : prev.costPrice,
                        sellPrice: match.sellPrice != null ? String(match.sellPrice) : prev.sellPrice
                      }));
                    } else {
                      setNewProduct(prev => ({ ...prev, name: val }));
                    }
                  }}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3.5 py-2.5 rounded-xl text-xs font-semibold uppercase focus:outline-none focus:border-blue-500 transition-all"
                  placeholder={activeBrand === 'BRAVOS' ? 'EJ: POLERA BOXYFIT' : 'EJ: CAMISA WAFFLE'}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Color</label>
                  <input 
                    value={newProduct.color}
                    onChange={e => setNewProduct({...newProduct, color: e.target.value})}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3.5 py-2.5 rounded-xl text-xs font-semibold uppercase focus:outline-none focus:border-blue-500 transition-all"
                    placeholder="EJ: NEGRO"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Talla</label>
                  <input 
                    value={newProduct.size}
                    onChange={e => setNewProduct({...newProduct, size: e.target.value})}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3.5 py-2.5 rounded-xl text-xs font-semibold uppercase focus:outline-none focus:border-blue-500 transition-all"
                    placeholder="EJ: XL"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Categoría</label>
                  <input 
                    list="category-list"
                    value={newProduct.category}
                    onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3.5 py-2.5 rounded-xl text-xs font-semibold uppercase focus:outline-none focus:border-blue-500 transition-all"
                    placeholder="EJ: POLOS"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Umbral Mínimo</label>
                  <input 
                    type="number"
                    value={newProduct.lowStockThreshold}
                    onChange={e => setNewProduct({...newProduct, lowStockThreshold: e.target.value})}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3.5 py-2.5 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500 transition-all"
                    placeholder="EJ: 10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Costo (S/)</label>
                  <input 
                    type="number"
                    step="0.01"
                    value={newProduct.costPrice}
                    onChange={e => setNewProduct({...newProduct, costPrice: e.target.value})}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3.5 py-2.5 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500 transition-all"
                    placeholder="EJ: 15.50"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Precio Venta (S/)</label>
                  <input 
                    type="number"
                    step="0.01"
                    value={newProduct.sellPrice}
                    onChange={e => setNewProduct({...newProduct, sellPrice: e.target.value})}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3.5 py-2.5 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500 transition-all"
                    placeholder="EJ: 45.00"
                  />
                </div>
              </div>
              
              <div className="mt-4 flex justify-end gap-2.5 pt-3 border-t border-[var(--border-soft)]">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="modern-btn px-4 py-2 text-xs uppercase"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="modern-btn-primary px-5 py-2 text-xs uppercase"
                >
                  Crear SKU
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {showEditModal && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-opacity">
          <div className="bg-[var(--surface)] border border-[var(--border-soft)] w-full max-w-md rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-5 border-b border-[var(--border-soft)] flex justify-between items-center bg-[var(--surface)]">
              <div>
                <h2 className="text-lg font-black text-[var(--ink)] tracking-tight">Editar SKU</h2>
                <p className="text-xs text-[var(--ink)]/50 mt-0.5">Modifica los detalles del producto seleccionado</p>
              </div>
              <button 
                onClick={() => {setShowEditModal(false); setEditingProduct(null);}} 
                className="p-2 hover:bg-[var(--border-soft)] rounded-full transition-colors text-[var(--ink)]/60 hover:text-[var(--ink)]"
              >
                <X size={18}/>
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-5 flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Código SKU</label>
                <input 
                  required
                  value={editingProduct.code}
                  onChange={e => setEditingProduct({...editingProduct, code: e.target.value})}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold uppercase focus:outline-none focus:border-blue-500 transition-all"
                  placeholder="EJ: SKU-0010"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Nombre del Producto</label>
                <input 
                  required
                  list="product-names"
                  value={editingProduct.name}
                  onChange={e => setEditingProduct({...editingProduct, name: e.target.value})}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3.5 py-2.5 rounded-xl text-xs font-semibold uppercase focus:outline-none focus:border-blue-500 transition-all"
                  placeholder="EJ: CAMISA WAFFLE"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Color</label>
                  <input 
                    value={editingProduct.color || ''}
                    onChange={e => setEditingProduct({...editingProduct, color: e.target.value})}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3.5 py-2.5 rounded-xl text-xs font-semibold uppercase focus:outline-none focus:border-blue-500 transition-all"
                    placeholder="EJ: NEGRO"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Talla</label>
                  <input 
                    value={editingProduct.size || ''}
                    onChange={e => setEditingProduct({...editingProduct, size: e.target.value})}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3.5 py-2.5 rounded-xl text-xs font-semibold uppercase focus:outline-none focus:border-blue-500 transition-all"
                    placeholder="EJ: XL"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Categoría</label>
                  <input 
                    list="category-list"
                    value={editingProduct.category}
                    onChange={e => setEditingProduct({...editingProduct, category: e.target.value})}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3.5 py-2.5 rounded-xl text-xs font-semibold uppercase focus:outline-none focus:border-blue-500 transition-all"
                    placeholder="EJ: POLOS"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Umbral Mínimo</label>
                  <input 
                    type="number"
                    value={editingProduct.lowStockThreshold ?? ''}
                    onChange={e => setEditingProduct({...editingProduct, lowStockThreshold: e.target.value ? Number(e.target.value) : undefined})}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3.5 py-2.5 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500 transition-all"
                    placeholder="EJ: 10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Costo (S/)</label>
                  <input 
                    type="number"
                    step="0.01"
                    value={editingProduct.costPrice ?? ''}
                    onChange={e => setEditingProduct({...editingProduct, costPrice: e.target.value ? Number(e.target.value) : undefined})}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3.5 py-2.5 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500 transition-all"
                    placeholder="EJ: 15.50"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Precio Venta (S/)</label>
                  <input 
                    type="number"
                    step="0.01"
                    value={editingProduct.sellPrice ?? ''}
                    onChange={e => setEditingProduct({...editingProduct, sellPrice: e.target.value ? Number(e.target.value) : undefined})}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3.5 py-2.5 rounded-xl text-xs font-semibold focus:outline-none focus:border-blue-500 transition-all"
                    placeholder="EJ: 45.00"
                  />
                </div>
              </div>
              
              <div className="mt-4 flex justify-end gap-2.5 pt-3 border-t border-[var(--border-soft)]">
                <button 
                  type="button" 
                  onClick={() => {setShowEditModal(false); setEditingProduct(null);}}
                  className="modern-btn px-4 py-2 text-xs uppercase"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="modern-btn-primary px-5 py-2 text-xs uppercase"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-opacity">
          <div className="bg-[var(--surface)] border border-red-500/20 w-full max-w-sm rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-5 border-b border-[var(--border-soft)] flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <div>
                <h2 className="text-base font-black text-[var(--ink)] tracking-tight">Eliminar SKU</h2>
                <p className="text-xs text-[var(--ink)]/50 mt-0.5">Esta acción no se puede deshacer</p>
              </div>
            </div>
            
            <div className="p-5 flex flex-col gap-4">
              <p className="text-xs text-[var(--ink)]/80 leading-relaxed">
                ¿Estás seguro de que deseas eliminar este producto del inventario?
              </p>
              <div className="bg-[var(--bg-input)] border border-[var(--border-soft)] rounded-xl p-3">
                <span className="font-mono text-xs font-bold text-[var(--ink)]">{productToDelete.code}</span>
                <span className="block text-xs text-[var(--ink)]/60 mt-0.5">{productToDelete.name}</span>
              </div>
              <div className="flex justify-end gap-2.5 mt-2">
                <button 
                  onClick={() => setProductToDelete(null)}
                  className="modern-btn px-4 py-2 text-xs uppercase"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmDelete}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-xl transition-all shadow-sm uppercase"
                >
                  Confirmar Eliminación
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {qrProduct && (
        <QRModal
          item={{ kind: 'product', id: qrProduct.id, code: qrProduct.code, name: qrProduct.name, color: qrProduct.color, size: qrProduct.size, brand: activeBrand }}
          onClose={() => setQrProduct(null)}
        />
      )}
    </div>
  );
};
