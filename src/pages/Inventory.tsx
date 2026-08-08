import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { Search, Plus, X, ChevronDown, ChevronRight, Edit2, AlertTriangle, Trash2, Download, Upload, QrCode, ArrowDownLeft, ArrowUpRight, Package } from 'lucide-react';
import { Product } from '../types';
import Papa from 'papaparse';
import { canEdit } from '../lib/permissions';
import { QRModal } from '../components/QRModal';
import { TutorialModal, INVENTORY_TUTORIAL_STEPS } from '../components/TutorialModal';

export const Inventory: React.FC = () => {
  const { products, stockLevels, locations, transactions, addProduct, updateProduct, deleteProduct, activeBrand, setActiveBrand, currentUser } = useAppContext();
  const [showTutorial, setShowTutorial] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [filterColor, setFilterColor] = useState('');
  const [filterSize, setFilterSize] = useState('');
  const [filterStatus, setFilterStatus] = useState(() => {
    return window.sessionStorage.getItem('inventoryFilter') === 'LOW_STOCK' ? 'LOW_STOCK' : 'ALL';
  });

  // Clear session storage filter once read
  useEffect(() => {
    window.sessionStorage.removeItem('inventoryFilter');
  }, []);

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [expandedColors, setExpandedColors] = useState<Set<string>>(new Set());
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
  const [filterLocation, setFilterLocation] = useState('');
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
  const [variantBaseSearch, setVariantBaseSearch] = useState('');
  const [variantBaseOpen, setVariantBaseOpen] = useState(false);
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

  // Next correlative index for a given code prefix
  const nextIndexForPrefix = (prefix: string): number => {
    const upper = prefix.toUpperCase();
    const existing = products
      .map(p => p.code)
      .filter(c => c.startsWith(upper + '-'))
      .map(c => parseInt(c.slice(upper.length + 1), 10))
      .filter(n => !isNaN(n));
    return existing.length > 0 ? Math.max(...existing) + 1 : 0;
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
    setVariantBaseSearch(p.name);
    setVariantBaseOpen(false);
  };

  const handleAddVariants = () => {
    if (!variantForm.name || !variantForm.codePrefix) return;
    const colors = variantColors.length ? variantColors : [''];
    const sizes = variantSizes.length ? variantSizes : [''];
    const startIdx = nextIndexForPrefix(variantForm.codePrefix);
    let idx = 0;
    for (const color of colors) {
      for (const size of sizes) {
        const suffix = String(startIdx + idx).padStart(3, '0');
        addProduct({
          code: `${variantForm.codePrefix.toUpperCase()}-${suffix}`,
          name: variantForm.name.toUpperCase(),
          color: color || undefined,
          size: size || undefined,
          category: variantForm.category,
          costPrice: variantForm.costPrice ? Number(variantForm.costPrice) : undefined,
          sellPrice: variantForm.sellPrice ? Number(variantForm.sellPrice) : undefined,
          lowStockThreshold: variantForm.lowStockThreshold ? Number(variantForm.lowStockThreshold) : undefined,
        });
        idx++;
      }
    }
    setShowVariantsModal(false);
    setVariantForm({ name: '', codePrefix: '', category: '', costPrice: '', sellPrice: '', lowStockThreshold: '' });
    setVariantBaseSearch('');
    setVariantColors([]);
    setVariantSizes([]);
    setVariantColors([]);
    setVariantSizes([]);
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

  const uniqueColors = Array.from(new Set(products.map(p => p.color).filter(Boolean))) as string[];
  const uniqueSizes = Array.from(new Set(products.map(p => p.size).filter(Boolean))) as string[];
  

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

  const toggleExpand = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleProduct = (name: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const toggleColor = (key: string) => {
    setExpandedColors(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const groupedByProduct = inventoryData.reduce<Record<string, typeof inventoryData>>((acc, p) => {
    if (!acc[p.name]) acc[p.name] = [];
    acc[p.name].push(p);
    return acc;
  }, {});

  const sortedProductNames = Object.keys(groupedByProduct).sort();

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProduct.code && newProduct.name) {
      addProduct({
        code: newProduct.code,
        name: newProduct.name,
        color: newProduct.color,
        size: newProduct.size,
        category: newProduct.category,
        lowStockThreshold: newProduct.lowStockThreshold ? Number(newProduct.lowStockThreshold) : undefined,
        costPrice: newProduct.costPrice ? Number(newProduct.costPrice) : undefined,
        sellPrice: newProduct.sellPrice ? Number(newProduct.sellPrice) : undefined
      });
      setShowAddModal(false);
      setNewProduct({ code: '', name: '', color: '', size: '', category: '', lowStockThreshold: '', costPrice: '', sellPrice: '' });
    }
  };

  const openEditModal = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProduct(product);
    setShowEditModal(true);
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
    
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }); // \uFEFF is BOM for Excel UTF-8 display
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
    <div className="flex flex-col gap-6 h-full relative">
      <TutorialModal open={showTutorial} onClose={() => setShowTutorial(false)} steps={INVENTORY_TUTORIAL_STEPS} title="Inventario" />
      <div className="flex items-stretch gap-0">
        <div className="flex-1">
          <ModuleInfo number="05" title="Inventario" description="Directorio completo de productos organizados por nombre, color y talla. Registra, edita y elimina SKUs, consulta ubicaciones y exporta el inventario." />
        </div>
        <button
          onClick={() => setShowTutorial(true)}
          className="flex items-center gap-1.5 px-4 border border-l-0 border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-all duration-150 shrink-0"
          title="Ver tutorial"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
          </svg>
          <span className="font-mono text-[9px] font-bold uppercase tracking-widest hidden sm:block">Tutorial</span>
        </button>
      </div>
      <datalist id="product-names">
        <option value="CAMISA WAFFLE" />
        <option value="CAMISERO JERSEY" />
        <option value="CAMISERO PIKE" />
        <option value="WAFFLE" />
        <option value="WAFFLE CAMISERO" />
        <option value="WAFFLE MANGA LARGA" />
        <option value="CUELLO CHINO" />
        <option value="CUELLO CHINO WAFFLE" />
        <option value="JERSEY MANGA LARGA" />
        <option value="BABY TY ESCOTE" />
        <option value="BABY TY" />
        <option value="BABY TY ESCOTADO MANGA" />
        <option value="BABY TY MANGA" />
        <option value="TOP RIB" />
        <option value="TOP RIB MANGA" />
        <option value="CLASICO" />
        <option value="OVERSIZE" />
        <option value="MEDIAS LARGAS" />
        <option value="MEDIAS CORTAS" />
      </datalist>

      <datalist id="category-list">
        <option value="Polos" />
        <option value="Medias" />
        <option value="Poleras" />
        <option value="Pantalones" />
      </datalist>

      <datalist id="variant-options">
        <option value="Azul / S" />
        <option value="Beige / M" />
        <option value="Botella / L" />
        <option value="Negro / XL" />
        <option value="Cemento / S" />
        <option value="Denim / M" />
        <option value="Melanqe O. / L" />
        <option value="Pacay / XL" />
        <option value="P.Rosa / S" />
        <option value="Perla / M" />
        <option value="Vino / L" />
        <option value="Menta / UNI" />
        <option value="Camote / XL" />
        <option value="Topo / S" />
        <option value="Plomo / UNI" />
        <option value="Marron / M" />
      </datalist>

      {/* -- Tarjetas de resumen -- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
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

      <div className="flex flex-col gap-3 mb-2">
        {/* Title row + primary actions */}
        <div className="flex justify-between items-end">
          <div>
            <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest">01 // Directorio_Inventario</h2>
            <p className="font-mono text-[10px] opacity-70 uppercase tracking-wide mt-1 hidden sm:block">Estado consolidado de SKU y ubicaciones.</p>
          </div>
          <div className="flex items-center gap-2">
            {canEdit(currentUser.role, 'inventory') && (
              <>
                <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-[var(--surface)] border border-[var(--border)]/50 text-[var(--ink)] hover:bg-[var(--bg-input)] shadow-sm font-semibold text-[11px] px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 uppercase"
                  title="IMPORTAR CSV"
                >
                  <Upload size={13} /><span className="hidden sm:inline">IMPORTAR</span>
                </button>
              </>
            )}
            <button
              onClick={exportCSV}
              className="bg-[var(--surface)] border border-[var(--border)]/50 text-[var(--ink)] hover:bg-[var(--bg-input)] shadow-sm font-semibold text-[11px] px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 uppercase"
              title="EXPORTAR CSV"
            >
              <Download size={13} /><span className="hidden sm:inline">EXPORTAR</span>
            </button>
            {canEdit(currentUser.role, 'inventory') && (
              <>
                <button
                  onClick={() => setShowVariantsModal(true)}
                  className="bg-transparent hover:bg-[var(--border)]/10 text-[var(--ink)] border border-[var(--border)]/50 shadow-sm px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 uppercase font-semibold text-[11px] h-full"
                  title="CREAR VARIANTES EN LOTE"
                >
                  <Package size={13} /><span className="hidden sm:inline">VARIANTES</span>
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm font-semibold text-[11px] px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 uppercase border border-transparent"
                >
                  <Plus size={13} /><span className="hidden xs:inline">NUEVO SKU</span><span className="xs:hidden">NUEVO</span>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2 pb-2 overflow-x-auto">
          <select
            value={activeBrand}
            onChange={(e) => setActiveBrand(e.target.value as any)}
            className="shrink-0 bg-[var(--surface)] border border-[var(--border)]/30 px-3 py-1.5 text-[10px] font-semibold text-[var(--ink)] rounded-lg focus:outline-none transition-all uppercase cursor-pointer w-28 shadow-sm"
          >
            <option value="OVERSHARK">OVERSHARK</option>
            <option value="BRAVOS">BRAVOS URBAN</option>
            <option value="BOX_PRIME">BOX PRIME</option>
          </select>
          <div className="shrink-0 relative w-48 bg-[var(--surface)] rounded-lg border border-[var(--border)]/30 shadow-sm">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-40 text-[var(--ink)]" />
            <input
              type="text" placeholder="BUSCAR..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-transparent pl-7 pr-3 py-1.5 text-[10px] font-semibold text-[var(--ink)] placeholder-[var(--ink)]/40 focus:outline-none transition-all uppercase"
            />
          </div>

          <div className="flex items-center gap-1.5 ml-2 border-l border-[var(--border)]/20 pl-4">
            <button
              onClick={() => setFilterFabric(null)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all shadow-sm ${!filterFabric ? 'bg-blue-600 text-white' : 'bg-[var(--surface)] text-[var(--ink)] border border-[var(--border)]/30 hover:bg-[var(--border)]/10'}`}
            >
              TODAS
            </button>
            {FABRIC_TYPES.map(c => (
              <button
                key={c}
                onClick={() => setFilterFabric(c)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all shadow-sm ${filterFabric === c ? 'bg-blue-600 text-white' : 'bg-[var(--surface)] text-[var(--ink)] border border-[var(--border)]/30 hover:bg-[var(--border)]/10'}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>
      {/* Product Grid */}
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
          <div className="bg-[var(--bg)] w-full max-w-4xl h-[85vh] max-h-[600px] rounded-3xl shadow-2xl flex flex-col border border-[var(--border)]/20 overflow-hidden relative">
            
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-[var(--border)]/10 flex justify-between items-start bg-[var(--surface)]">
              <div className="min-w-0">
                <h2 className="text-lg sm:text-2xl font-black text-[var(--ink)] tracking-tight truncate">{selectedProductForModal}</h2>
                <p className="text-[10px] sm:text-[11px] font-bold text-[var(--ink)]/50 uppercase tracking-widest mt-1">
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
                  <div key={item.id} className="bg-[var(--surface)] border border-[var(--border)]/20 rounded-xl p-3 sm:p-4 flex items-center justify-between gap-2 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[var(--border)]/5 flex items-center justify-center shrink-0">
                        <QrCode size={16} className="text-[var(--ink)]/40" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-mono text-[13px] sm:text-sm font-bold text-[var(--ink)] truncate">{item.code}</span>
                        <div className="flex gap-2 text-[10px] uppercase font-bold text-[var(--ink)]/60 mt-1">
                          <span className="truncate">{item.color || 'N/A'}</span>
                          <span className="opacity-50 shrink-0">•</span>
                          <span className="shrink-0">{item.size || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                      <div className="text-right">
                        <div className="text-[18px] sm:text-[20px] font-black text-[var(--ink)] leading-none">{item.totalStock}</div>
                        <div className="text-[9px] uppercase font-bold text-[var(--ink)]/40 mt-1 tracking-wider">Unidades</div>
                      </div>
                      
                      <div className="flex items-center gap-1 border-l border-[var(--border)]/10 pl-3 sm:pl-6">
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

      {showVariantsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-[var(--bg)] bg-[var(--bg)] w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[92vh] border border-[var(--border)]/20 overflow-hidden relative">
            <div className="p-6 border-b border-[var(--border)]/10 flex justify-between items-start bg-[var(--surface)]">
              <h2 className="text-xl font-black text-[var(--ink)] tracking-tight">REGISTRO // VARIANTES_EN_LOTE</h2>
              <button
                onClick={() => setShowVariantsModal(false)}
                className="p-2 hover:bg-[var(--border)]/10 rounded-full transition-colors cursor-pointer text-[var(--ink)]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-5">
              {/* Base fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[var(--ink)]/40 uppercase tracking-widest mb-1">NOMBRE DEL PRODUCTO *</label>
                  <input
                    required
                    list="product-names"
                    value={variantForm.name}
                    onChange={e => setVariantForm({ ...variantForm, name: e.target.value })}
                    className="w-full bg-[var(--surface)] border border-[var(--border)]/20 px-4 py-3 rounded-xl text-[13px] font-semibold text-[var(--ink)] focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all uppercase placeholder-[var(--ink)]/30"
                    placeholder="EJ: CAMISA WAFFLE"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[var(--ink)]/40 uppercase tracking-widest mb-1">PREFIJO DE CÓDIGO *</label>
                  <input
                    required
                    value={variantForm.codePrefix}
                    onChange={e => setVariantForm({ ...variantForm, codePrefix: e.target.value })}
                    className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold font-mono uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                    placeholder="EJ: CWF"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[var(--ink)]/40 uppercase tracking-widest mb-1">CATEGORÍA</label>
                  <input
                    list="category-list"
                    value={variantForm.category}
                    onChange={e => setVariantForm({ ...variantForm, category: e.target.value })}
                    className="w-full bg-[var(--surface)] border border-[var(--border)]/20 px-4 py-3 rounded-xl text-[13px] font-semibold text-[var(--ink)] focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all uppercase placeholder-[var(--ink)]/30"
                    placeholder="EJ: POLOS"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[var(--ink)]/40 uppercase tracking-widest mb-1">UMBRAL MÍNIMO</label>
                  <input
                    type="number"
                    value={variantForm.lowStockThreshold}
                    onChange={e => setVariantForm({ ...variantForm, lowStockThreshold: e.target.value })}
                    className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold font-mono focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                    placeholder="EJ: 5"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[var(--ink)]/40 uppercase tracking-widest mb-1">COSTO (S/)</label>
                  <input
                    type="number" step="0.01"
                    value={variantForm.costPrice}
                    onChange={e => setVariantForm({ ...variantForm, costPrice: e.target.value })}
                    className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold font-mono focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                    placeholder="EJ: 15.50"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[var(--ink)]/40 uppercase tracking-widest mb-1">PRECIO VENTA (S/)</label>
                  <input
                    type="number" step="0.01"
                    value={variantForm.sellPrice}
                    onChange={e => setVariantForm({ ...variantForm, sellPrice: e.target.value })}
                    className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold font-mono focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                    placeholder="EJ: 45.00"
                  />
                </div>
              </div>

              {/* Colors */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-[var(--ink)]/40 uppercase tracking-widest mb-1">COLORES</label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleVariantColor(c)}
                      className={`px-2.5 py-1 text-[9px] font-mono font-bold uppercase border transition-all ${variantColors.includes(c) ? 'bg-blue-600 border-transparent text-white shadow-sm rounded-lg' : 'bg-[var(--surface)] border-[var(--border)]/20 text-[var(--ink)]/70 hover:bg-[var(--border)]/10 rounded-lg'}`}
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
                    className="w-full bg-[var(--surface)] border border-[var(--border)]/20 px-3 py-2 rounded-lg text-xs font-semibold text-[var(--ink)] focus:outline-none focus:border-blue-500/50 transition-all uppercase placeholder-[var(--ink)]/30 flex-1"
                    placeholder="OTRO COLOR + ENTER"
                  />
                  <button
                    type="button"
                    onClick={() => { if (customColor.trim()) { toggleVariantColor(customColor.trim()); setCustomColor(''); }}}
                    className="bg-[var(--surface)] border border-[var(--border)]/20 px-3 py-2 rounded-lg hover:bg-[var(--border)]/10 text-[var(--ink)] transition-colors cursor-pointer"
                  >
                    +
                  </button>
                </div>
                {variantColors.length > 0 && (
                  <p className="font-mono text-[9px] opacity-60">Seleccionados: {variantColors.join(', ')}</p>
                )}
              </div>

              {/* Sizes */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-[var(--ink)]/40 uppercase tracking-widest mb-1">TALLAS</label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_SIZES.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleVariantSize(s)}
                      className={`px-2.5 py-1 text-[9px] font-mono font-bold uppercase border transition-all ${variantSizes.includes(s) ? 'bg-blue-600 border-transparent text-white shadow-sm rounded-lg' : 'bg-[var(--surface)] border-[var(--border)]/20 text-[var(--ink)]/70 hover:bg-[var(--border)]/10 rounded-lg'}`}
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
                    className="w-full bg-[var(--surface)] border border-[var(--border)]/20 px-3 py-2 rounded-lg text-xs font-semibold text-[var(--ink)] focus:outline-none focus:border-blue-500/50 transition-all uppercase placeholder-[var(--ink)]/30 flex-1"
                    placeholder="OTRA TALLA + ENTER"
                  />
                  <button
                    type="button"
                    onClick={() => { if (customSize.trim()) { toggleVariantSize(customSize.trim()); setCustomSize(''); }}}
                    className="bg-[var(--surface)] border border-[var(--border)]/20 px-3 py-2 rounded-lg hover:bg-[var(--border)]/10 text-[var(--ink)] transition-colors cursor-pointer"
                  >
                    +
                  </button>
                </div>
                {variantSizes.length > 0 && (
                  <p className="font-mono text-[9px] opacity-60">Seleccionadas: {variantSizes.join(', ')}</p>
                )}
              </div>

              {/* Preview count */}
              {(variantForm.name || variantForm.codePrefix) && (
                <div className="border border-[var(--border)] bg-[var(--surface)] p-3 flex items-center justify-between">
                  <span className="font-mono text-[10px] opacity-70 uppercase tracking-widest">SKUs a generar</span>
                  <span className="font-mono font-black text-xl">
                    {Math.max(variantColors.length || 1, 1) * Math.max(variantSizes.length || 1, 1)}
                  </span>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[var(--border)] flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowVariantsModal(false)}
                className="bg-transparent border border-[var(--border)]/20 text-[var(--ink)] px-5 py-2.5 rounded-xl hover:bg-[var(--border)]/10 transition-colors font-semibold text-[11px] uppercase"
              >
                CANCELAR
              </button>
              <button
                type="button"
                onClick={handleAddVariants}
                disabled={!variantForm.name || !variantForm.codePrefix}
                className="bg-[var(--ink)] text-[var(--ink-inv)] border border-[var(--border)] px-6 py-2.5 text-[10px] font-mono tracking-widest font-bold shadow-[4px_4px_0_var(--border)] hover:bg-[var(--bg-input)] hover:text-[var(--ink)] active:shadow-none active:translate-y-[4px] active:translate-x-[4px] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                CREAR_{Math.max(variantColors.length || 1, 1) * Math.max(variantSizes.length || 1, 1)}_SKUs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 transition-opacity">
          <div className="bg-[var(--bg)] border-4 border-[var(--border)] w-full max-w-md shadow-[8px_8px_0_var(--border)] flex flex-col">
            <div className="p-3 border-b border-[var(--border)] bg-[var(--bg-sidebar)] flex justify-between items-center">
              <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest">REGISTRO // NUEVO_SKU</h2>
              <button 
                onClick={() => setShowAddModal(false)} 
                className="opacity-60 hover:opacity-100 hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] p-1 border border-transparent hover:border-[var(--border)] transition-all"
              >
                <X size={16}/>
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">CODIGO SKU</label>
                <input 
                  required
                  value={newProduct.code}
                  onChange={e => setNewProduct({...newProduct, code: e.target.value})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold font-mono uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                  placeholder="EJ: SKU-0010"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">NOMBRE DEL PRODUCTO</label>
                <input 
                  required
                  list="product-names"
                  value={newProduct.name}
                  onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                  placeholder="EJ: CAMISA WAFFLE"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">COLOR (OPCIONAL)</label>
                <input 
                  value={newProduct.color}
                  onChange={e => setNewProduct({...newProduct, color: e.target.value})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                  placeholder="EJ: NEGRO"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">TALLA (OPCIONAL)</label>
                <input 
                  value={newProduct.size}
                  onChange={e => setNewProduct({...newProduct, size: e.target.value})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                  placeholder="EJ: XL"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">CATEGORIA</label>
                <input 
                  list="category-list"
                  value={newProduct.category}
                  onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                  placeholder="EJ: POLOS"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">UMBRAL MIN. DE STOCK (OPCIONAL)</label>
                <input 
                  type="number"
                  value={newProduct.lowStockThreshold}
                  onChange={e => setNewProduct({...newProduct, lowStockThreshold: e.target.value})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold font-mono uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                  placeholder="EJ: 10"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">COSTO (S/)</label>
                <input 
                  type="number"
                  step="0.01"
                  value={newProduct.costPrice}
                  onChange={e => setNewProduct({...newProduct, costPrice: e.target.value})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold font-mono uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                  placeholder="EJ: 15.50"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">PRECIO VENTA (S/)</label>
                <input 
                  type="number"
                  step="0.01"
                  value={newProduct.sellPrice}
                  onChange={e => setNewProduct({...newProduct, sellPrice: e.target.value})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold font-mono uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                  placeholder="EJ: 45.00"
                />
              </div>
              
              <div className="mt-4 flex justify-end">
                <button 
                  type="submit" 
                  className="bg-[var(--ink)] text-[var(--ink-inv)] border border-[var(--border)] px-6 py-2.5 text-[10px] font-mono tracking-widest font-bold shadow-[4px_4px_0_var(--border)] hover:bg-[var(--bg-input)] hover:text-[var(--ink)] active:shadow-none active:translate-y-[4px] active:translate-x-[4px] transition-all"
                >
                  CREAR_REGISTRO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {showEditModal && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 transition-opacity">
          <div className="bg-[var(--bg)] border-4 border-[var(--border)] w-full max-w-md shadow-[8px_8px_0_var(--border)] flex flex-col">
            <div className="p-3 border-b border-[var(--border)] bg-[var(--bg-sidebar)] flex justify-between items-center">
              <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest">EDICION // SKU</h2>
              <button 
                onClick={() => {setShowEditModal(false); setEditingProduct(null);}} 
                className="opacity-60 hover:opacity-100 hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] p-1 border border-transparent hover:border-[var(--border)] transition-all"
              >
                <X size={16}/>
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">CODIGO SKU</label>
                <input 
                  required
                  value={editingProduct.code}
                  onChange={e => setEditingProduct({...editingProduct, code: e.target.value})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold font-mono uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                  placeholder="EJ: SKU-0010"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">NOMBRE DEL PRODUCTO</label>
                <input 
                  required
                  list="product-names"
                  value={editingProduct.name}
                  onChange={e => setEditingProduct({...editingProduct, name: e.target.value})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                  placeholder="EJ: CAMISA WAFFLE"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">COLOR (OPCIONAL)</label>
                <input 
                  value={editingProduct.color || ''}
                  onChange={e => setEditingProduct({...editingProduct, color: e.target.value})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                  placeholder="EJ: NEGRO"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">TALLA (OPCIONAL)</label>
                <input 
                  value={editingProduct.size || ''}
                  onChange={e => setEditingProduct({...editingProduct, size: e.target.value})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                  placeholder="EJ: XL"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">CATEGORIA</label>
                <input 
                  list="category-list"
                  value={editingProduct.category}
                  onChange={e => setEditingProduct({...editingProduct, category: e.target.value})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                  placeholder="EJ: POLOS"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">UMBRAL MIN. DE STOCK (OPCIONAL)</label>
                <input 
                  type="number"
                  value={editingProduct.lowStockThreshold ?? ''}
                  onChange={e => setEditingProduct({...editingProduct, lowStockThreshold: e.target.value ? Number(e.target.value) : undefined})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold font-mono uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                  placeholder="EJ: 10"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">COSTO (S/)</label>
                <input 
                  type="number"
                  step="0.01"
                  value={editingProduct.costPrice ?? ''}
                  onChange={e => setEditingProduct({...editingProduct, costPrice: e.target.value ? Number(e.target.value) : undefined})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold font-mono uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                  placeholder="EJ: 15.50"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[9px] font-bold tracking-[0.2em] opacity-80 uppercase">PRECIO VENTA (S/)</label>
                <input 
                  type="number"
                  step="0.01"
                  value={editingProduct.sellPrice ?? ''}
                  onChange={e => setEditingProduct({...editingProduct, sellPrice: e.target.value ? Number(e.target.value) : undefined})}
                  className="bg-[var(--bg-card-alt)] border border-[var(--border)] p-2 text-xs font-bold font-mono uppercase focus:bg-[var(--bg-input)] focus:outline-none focus:shadow-[2px_2px_0_var(--border)] transition-all rounded-none"
                  placeholder="EJ: 45.00"
                />
              </div>
              
              <div className="mt-4 flex justify-end">
                <button 
                  type="submit" 
                  className="bg-[var(--ink)] text-[var(--ink-inv)] border border-[var(--border)] px-6 py-2.5 text-[10px] font-mono tracking-widest font-bold shadow-[4px_4px_0_var(--border)] hover:bg-[var(--bg-input)] hover:text-[var(--ink)] active:shadow-none active:translate-y-[4px] active:translate-x-[4px] transition-all"
                >
                  GUARDAR_CAMBIOS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 transition-opacity">
          <div className="bg-[var(--bg)] border-4 border-[var(--border)] w-full max-w-sm shadow-[8px_8px_0_var(--border)] flex flex-col">
            <div className="p-3 border-b border-[var(--border)] bg-[var(--bg-sidebar)] flex gap-2 items-center">
              <AlertTriangle size={16} className="text-red-600" />
              <h2 className="font-serif italic font-bold text-xs uppercase tracking-widest text-[var(--ink)]">ELIMINAR SKU</h2>
            </div>
            
            <div className="p-5 flex flex-col gap-6">
              <p className="font-mono text-sm font-bold text-center leading-relaxed">
                Are you sure you want to delete this product? This action cannot be undone.
              </p>
              <div className="text-center bg-[var(--surface)] border border-[var(--border)]/20 p-2">
                <span className="font-mono text-xs font-bold">{productToDelete.code}</span>
                <span className="block text-[10px] font-mono opacity-70 mt-1">{productToDelete.name}</span>
              </div>
              <div className="flex justify-between gap-4 mt-2">
                <button 
                  onClick={() => setProductToDelete(null)}
                  className="flex-1 bg-[var(--bg-input)] border border-[var(--border)] text-[var(--ink)] px-4 py-2 text-[10px] font-mono tracking-widest font-bold hover:bg-[var(--ink)] hover:text-white transition-all shadow-[2px_2px_0_var(--border)]"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 bg-red-700 text-white border border-[var(--border)] px-4 py-2 text-[10px] font-mono tracking-widest font-bold hover:bg-black transition-all shadow-[2px_2px_0_var(--border)]"
                >
                  Confirm
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
