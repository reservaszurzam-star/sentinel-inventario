import React, { useState, useMemo, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Printer, RefreshCw, Package, Search, Layers, QrCode, Sparkles,
  ArrowDownLeft, CheckCircle2, ChevronRight, Filter, Tag, FolderOpen, Grid, LayoutGrid
} from 'lucide-react';
import { useAppContext } from '../store/AppContext';
import { FamilyQRModal } from './FamilyQRModal';
import { cn } from '../lib/utils';

interface CategoryGroup {
  category: string;
  models: {
    name: string;
    variantsCount: number;
    totalStock: number;
    colors: string[];
    sizes: string[];
  }[];
  totalVariants: number;
  totalStock: number;
}

export const CategoryQRsTab: React.FC = () => {
  const { activeBrand, products, stockLevels, locations, addTransaction, currentUser } = useAppContext();
  const [viewMode, setViewMode] = useState<'CATEGORIES' | 'MODELS'>('CATEGORIES');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [showOnlyWithStock, setShowOnlyWithStock] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Modal de ingreso rápido abierto para una categoría o modelo
  const [quickIngestQuery, setQuickIngestQuery] = useState<string | null>(null);
  const [destLocationId, setDestLocationId] = useState<string>('');
  const [feedback, setFeedback] = useState<string | null>(null);

  // Set default location
  React.useEffect(() => {
    if (!destLocationId && locations.length > 0) {
      const defaultLoc = locations.find(l => l.name.toUpperCase().includes('RESERVA')) || locations[0];
      setDestLocationId(defaultLoc.id);
    }
  }, [locations, destLocationId]);

  // Total stock map per product id
  const productStock = useMemo(() => {
    const map = new Map<string, number>();
    stockLevels.forEach(s => {
      map.set(s.productId, (map.get(s.productId) ?? 0) + s.quantity);
    });
    return map;
  }, [stockLevels]);

  // Group products by Category → then by Model Name
  const categoryGroups = useMemo<CategoryGroup[]>(() => {
    const catMap = new Map<string, Map<string, { variants: number; qty: number; colors: Set<string>; sizes: Set<string> }>>();

    products.forEach(p => {
      const cat = (p.category || 'General').trim();
      const modelName = (p.name || '').trim();
      if (!modelName) return;

      if (!catMap.has(cat)) catMap.set(cat, new Map());
      const modelMap = catMap.get(cat)!;

      const qty = productStock.get(p.id) ?? 0;
      if (!modelMap.has(modelName)) {
        modelMap.set(modelName, {
          variants: 1,
          qty,
          colors: new Set(p.color ? [p.color] : []),
          sizes: new Set(p.size ? [p.size] : []),
        });
      } else {
        const entry = modelMap.get(modelName)!;
        entry.variants += 1;
        entry.qty += qty;
        if (p.color) entry.colors.add(p.color);
        if (p.size) entry.sizes.add(p.size);
      }
    });

    const groups: CategoryGroup[] = [];

    catMap.forEach((modelMap, category) => {
      const models = Array.from(modelMap.entries()).map(([name, data]) => ({
        name,
        variantsCount: data.variants,
        totalStock: data.qty,
        colors: Array.from(data.colors),
        sizes: Array.from(data.sizes),
      }));

      const totalVariants = models.reduce((s, m) => s + m.variantsCount, 0);
      const totalStock = models.reduce((s, m) => s + m.totalStock, 0);

      groups.push({
        category,
        models: models.sort((a, b) => a.name.localeCompare(b.name)),
        totalVariants,
        totalStock,
      });
    });

    return groups.sort((a, b) => a.category.localeCompare(b.category));
  }, [products, productStock]);

  // Unique categories list
  const categoriesList = useMemo(() => {
    return categoryGroups.map(g => g.category);
  }, [categoryGroups]);

  // Filtered list based on search & category filter
  const filteredGroups = useMemo(() => {
    return categoryGroups
      .map(group => {
        if (selectedCategory !== 'ALL' && group.category !== selectedCategory) {
          return null;
        }

        const filteredModels = group.models.filter(m => {
          if (showOnlyWithStock && m.totalStock <= 0) return false;
          if (!search.trim()) return true;
          const q = search.toLowerCase();
          return (
            m.name.toLowerCase().includes(q) ||
            group.category.toLowerCase().includes(q) ||
            m.colors.some(c => c.toLowerCase().includes(q))
          );
        });

        if (filteredModels.length === 0) return null;

        return {
          ...group,
          models: filteredModels,
          totalVariants: filteredModels.reduce((s, m) => s + m.variantsCount, 0),
          totalStock: filteredModels.reduce((s, m) => s + m.totalStock, 0),
        };
      })
      .filter((g): g is CategoryGroup => g !== null);
  }, [categoryGroups, selectedCategory, search, showOnlyWithStock]);

  // Generates Master QR value for a whole category
  const getCategoryQRValue = (categoryName: string) => {
    const baseUrl = window.location.origin + window.location.pathname;
    const safeCat = encodeURIComponent(categoryName.trim());
    const safeBrand = encodeURIComponent(activeBrand);
    return `${baseUrl}#/q/category/${safeCat}?b=${safeBrand}`;
  };

  // Generates QR value for a single model
  const getModelQRValue = (modelName: string) => {
    const baseUrl = window.location.origin + window.location.pathname;
    const safeModel = encodeURIComponent(modelName.trim());
    const safeBrand = encodeURIComponent(activeBrand);
    return `${baseUrl}#/q/${safeModel}?b=${safeBrand}`;
  };

  const doRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  // ── Print Category Master Poster (A4) ────────────────────────────────────
  const catCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const modelCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const printMasterCategoryPoster = (categoryGroup: CategoryGroup) => {
    const card = catCardRefs.current.get(categoryGroup.category);
    const svgElement = card?.querySelector('svg');
    const svgHtml = svgElement ? svgElement.outerHTML : '';

    const win = window.open('', '_blank');
    if (!win) return;

    const modelsListHtml = categoryGroup.models
      .map(m => `<span class="model-pill">${m.name}</span>`)
      .join(' ');

    win.document.write(`
      <html><head><title>QR CATEGORÍA — ${categoryGroup.category}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: system-ui, -apple-system, sans-serif; background: #fff; color: #000; padding: 40px; display: flex; justify-content: center; }
        .a4-page { width: 210mm; min-height: 297mm; border: 5px solid #000; padding: 40px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; text-align: center; }
        .top-brand { font-size: 24px; font-weight: 900; letter-spacing: 5px; text-transform: uppercase; color: #444; }
        .badge { display: inline-block; background: #000; color: #fff; padding: 6px 20px; font-size: 16px; font-weight: 900; letter-spacing: 3px; text-transform: uppercase; margin-top: 10px; border-radius: 6px; }
        .cat-title { font-size: 56px; font-weight: 900; text-transform: uppercase; line-height: 1.1; margin: 20px 0 10px; }
        .sub-desc { font-size: 16px; font-weight: 700; color: #555; text-transform: uppercase; letter-spacing: 1px; }
        .qr-box { padding: 30px; border: 5px solid #000; border-radius: 20px; background: #fff; margin: 20px 0; }
        .qr-box svg { width: 360px !important; height: 360px !important; display: block; }
        .models-box { border: 4px solid #000; width: 100%; padding: 25px; border-radius: 12px; }
        .models-title { font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; color: #666; margin-bottom: 12px; }
        .models-grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
        .model-pill { background: #f0f0f0; border: 2px solid #000; padding: 8px 16px; font-size: 16px; font-weight: 900; text-transform: uppercase; border-radius: 8px; }
        .footer-note { font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #555; }
        @media print { @page { size: A4 portrait; margin: 0; } body { padding: 0; } .a4-page { border: none; min-height: 100vh; } }
      </style></head><body>
        <div class="a4-page">
          <div>
            <div class="top-brand">${activeBrand.replace('_', ' ')} · SISTEMA LOGIXZAZU</div>
            <div class="badge">CÓDIGO QR MAESTRO DE CATEGORÍA</div>
            <div class="cat-title">${categoryGroup.category}</div>
            <div class="sub-desc">Escanear para abrir matriz completa de ingreso (${categoryGroup.models.length} modelos)</div>
          </div>

          <div class="qr-box">${svgHtml}</div>

          <div class="models-box">
            <div class="models-title">MODELOS INCLUIDOS EN ESTA CATEGORÍA:</div>
            <div class="models-grid">${modelsListHtml}</div>
          </div>

          <div class="footer-note">
            LogixZazu // Sentinel Inventario · ${categoryGroup.totalVariants} variantes registradas
          </div>
        </div>
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  // ── Print Individual Model Label ─────────────────────────────────────────
  const printModelLabel = (category: string, modelName: string) => {
    const card = modelCardRefs.current.get(modelName);
    const svgElement = card?.querySelector('svg');
    const svgHtml = svgElement ? svgElement.outerHTML : '';

    const win = window.open('', '_blank');
    if (!win) return;

    win.document.write(`
      <html><head><title>QR — ${modelName}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: system-ui, -apple-system, sans-serif; background: #fff; color: #000; padding: 40px; display: flex; justify-content: center; }
        .a4-page { width: 210mm; min-height: 297mm; border: 4px solid #000; padding: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .header { text-align: center; margin-bottom: 30px; width: 100%; border-bottom: 4px solid #000; padding-bottom: 20px; }
        .brand { font-size: 22px; font-weight: 900; text-transform: uppercase; letter-spacing: 4px; color: #555; }
        .cat-badge { display: inline-block; background: #000; color: #fff; padding: 4px 14px; font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; margin-top: 8px; border-radius: 4px; }
        .model { font-size: 56px; font-weight: 900; text-align: center; line-height: 1.1; text-transform: uppercase; margin-top: 15px; }
        .qr-box { padding: 25px; border: 4px solid #000; border-radius: 16px; margin: 30px 0; background: #fff; }
        .qr-box svg { width: 340px !important; height: 340px !important; display: block; }
        @media print { @page { size: A4 portrait; margin: 0; } body { padding: 0; } .a4-page { border: none; min-height: 100vh; } }
      </style></head><body>
        <div class="a4-page">
          <div class="header">
            <div class="brand">${activeBrand.replace('_', ' ')}</div>
            <div class="cat-badge">CATEGORÍA: ${category}</div>
            <div class="model">${modelName}</div>
          </div>
          <div class="qr-box">${svgHtml}</div>
        </div>
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  // ── Handle Fast Direct Ingest from Category Tab ──────────────────────────
  const handleIngestFromModal = async (items: { productId: string; qty: string }[]) => {
    try {
      const targetLoc = destLocationId || locations[0]?.id;
      for (const item of items) {
        await addTransaction({
          type: 'RECEPTION',
          productId: item.productId,
          quantity: parseInt(item.qty, 10),
          toLocationId: targetLoc,
          reference: `ING-QR-${quickIngestQuery}`,
          user: currentUser.username,
        });
      }
      setFeedback(`¡Se ingresaron ${items.reduce((s, i) => s + parseInt(i.qty, 10), 0)} prendas correctamente!`);
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: any) {
      setFeedback(`Error: ${err?.message || 'No se pudo guardar'}`);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {feedback && (
        <div className="p-3 bg-emerald-500/15 border border-emerald-500 text-emerald-600 font-mono text-xs font-bold uppercase rounded-lg flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{feedback}</span>
        </div>
      )}

      {/* ── Top Header Toolbar ────────────────────────────────────────────── */}
      <div className="border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 rounded-xl shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md">
              QR MAESTROS DE CATEGORÍAS
            </span>
            <span className="text-[10px] font-mono opacity-40 uppercase">({activeBrand})</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">Códigos QR por Categoría y Familia</h2>
          <p className="text-xs opacity-50 font-mono mt-0.5">
            Cada QR abre la matriz completa con todos los modelos de esa categoría para ingresar stock en lote.
          </p>
        </div>

        {/* View Switcher & Refresh */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-[var(--bg)] border border-[var(--border)] rounded-xl p-1">
            <button
              onClick={() => setViewMode('CATEGORIES')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all',
                viewMode === 'CATEGORIES'
                  ? 'bg-[var(--ink)] text-[var(--ink-inv)] shadow-xs'
                  : 'opacity-60 hover:opacity-100'
              )}
            >
              <FolderOpen size={13} />
              <span>QR Categorías ({categoryGroups.length})</span>
            </button>
            <button
              onClick={() => setViewMode('MODELS')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all',
                viewMode === 'MODELS'
                  ? 'bg-[var(--ink)] text-[var(--ink-inv)] shadow-xs'
                  : 'opacity-60 hover:opacity-100'
              )}
            >
              <Grid size={13} />
              <span>Todos los Modelos</span>
            </button>
          </div>

          <button
            onClick={doRefresh}
            className="flex items-center gap-1.5 px-3 py-2 border border-[var(--border)] rounded-xl font-mono text-xs font-bold hover:bg-[var(--bg)] transition-colors"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            ACTUALIZAR
          </button>
        </div>
      </div>

      {/* ── Filter Bar ────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por categoría, modelo o prenda..."
              className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl pl-9 pr-4 py-2 text-xs font-mono font-bold uppercase focus:outline-none focus:border-[var(--ink)]"
            />
          </div>

          <button
            onClick={() => setShowOnlyWithStock(v => !v)}
            className={cn(
              'flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-mono text-xs font-bold uppercase transition-all border shrink-0',
              showOnlyWithStock
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-[var(--surface)] border-[var(--border)] opacity-70 hover:opacity-100'
            )}
          >
            <Package size={14} />
            SOLO CON STOCK
          </button>
        </div>

        {/* Categories Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="text-[10px] font-mono font-bold uppercase opacity-40 mr-1 shrink-0 flex items-center gap-1">
            <Filter size={12} /> CATEGORÍA:
          </span>
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold uppercase whitespace-nowrap transition-all border',
              selectedCategory === 'ALL'
                ? 'bg-[var(--ink)] text-[var(--ink-inv)] border-[var(--ink)] shadow-xs'
                : 'bg-[var(--surface)] border-[var(--border)] opacity-70 hover:opacity-100'
            )}
          >
            TODAS ({categoriesList.length})
          </button>
          {categoriesList.map(cat => {
            const isSelected = selectedCategory === cat;
            const group = categoryGroups.find(g => g.category === cat);
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  'px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold uppercase whitespace-nowrap transition-all border flex items-center gap-1.5',
                  isSelected
                    ? 'bg-[var(--ink)] text-[var(--ink-inv)] border-[var(--ink)] shadow-xs'
                    : 'bg-[var(--surface)] border-[var(--border)] opacity-70 hover:opacity-100'
                )}
              >
                <span>{cat}</span>
                <span className={cn(
                  'text-[9px] px-1.5 py-0.2 rounded-full font-black',
                  isSelected ? 'bg-emerald-400 text-black' : 'bg-[var(--border)] text-[var(--ink)]'
                )}>
                  {group?.models.length || 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── MODE 1: MASTER CATEGORY QR CARDS (MAIN VIEW) ──────────────────── */}
      {viewMode === 'CATEGORIES' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredGroups.map(group => {
            const qrCategoryVal = getCategoryQRValue(group.category);

            return (
              <div
                key={group.category}
                ref={el => {
                  if (el) catCardRefs.current.set(group.category, el);
                  else catCardRefs.current.delete(group.category);
                }}
                className="border-2 border-[var(--border)] bg-[var(--surface)] rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
              >
                {/* Accent stripe */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500" />

                {/* Top Title & Badge */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-mono font-black uppercase tracking-wider text-emerald-600 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                      QR MAESTRO DE CATEGORÍA
                    </span>
                    <span className="font-mono text-xs font-bold opacity-60">
                      {group.totalVariants} variantes
                    </span>
                  </div>

                  <h3 className="text-2xl font-black font-mono tracking-tight uppercase">
                    {group.category}
                  </h3>
                  <p className="text-xs font-mono opacity-50 mt-0.5">
                    Contiene {group.models.length} modelos listos para ingreso masivo
                  </p>
                </div>

                {/* QR Code + Models Preview Layout */}
                <div className="grid grid-cols-[140px_1fr] gap-4 items-center bg-[var(--bg)] border border-[var(--border)]/70 rounded-xl p-3.5">
                  {/* Centered QR SVG */}
                  <div className="bg-white p-2.5 rounded-lg border border-black/10 flex flex-col items-center justify-center shadow-2xs">
                    <QRCodeSVG
                      value={qrCategoryVal}
                      size={120}
                      level="Q"
                      includeMargin={false}
                    />
                    <span className="text-[7px] font-mono font-bold tracking-widest text-black/50 uppercase mt-1">
                      CATEGORÍA MAESTRA
                    </span>
                  </div>

                  {/* Models list pills */}
                  <div className="flex flex-col justify-between h-full gap-2 min-w-0">
                    <div className="text-[10px] font-mono font-bold uppercase opacity-50">
                      Modelos incluidos:
                    </div>
                    <div className="flex flex-wrap gap-1 overflow-y-auto max-h-24 pr-1">
                      {group.models.map(m => (
                        <span
                          key={m.name}
                          className="text-[10px] font-mono font-bold uppercase bg-[var(--surface)] border border-[var(--border)] px-2 py-0.5 rounded-md truncate max-w-full"
                          title={m.name}
                        >
                          {m.name}
                        </span>
                      ))}
                    </div>
                    <div className="text-[11px] font-mono font-bold text-emerald-600 mt-auto">
                      Stock: {group.totalStock} unidades
                    </div>
                  </div>
                </div>

                {/* Action CTA Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setQuickIngestQuery(group.category)}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs font-bold uppercase transition-all shadow-xs active:scale-95"
                    title="Abre la matriz Excel con todos los modelos de esta categoría"
                  >
                    <ArrowDownLeft size={14} />
                    <span>ABRIR MATRIZ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => printMasterCategoryPoster(group)}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] font-mono text-xs font-bold uppercase transition-all active:scale-95"
                    title="Imprime el cartel A4 con el QR maestro para el almacén"
                  >
                    <Printer size={14} />
                    <span>CARTEL A4</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MODE 2: INDIVIDUAL MODEL QRs ─────────────────────────────────── */}
      {viewMode === 'MODELS' && (
        <div className="flex flex-col gap-8">
          {filteredGroups.map(group => (
            <div key={group.category} className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--bg-sidebar)] border border-[var(--border)] rounded-xl">
                <span className="font-mono font-black text-sm uppercase">{group.category} ({group.models.length} modelos)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.models.map(m => {
                  const qrModelVal = getModelQRValue(m.name);
                  return (
                    <div
                      key={m.name}
                      ref={el => {
                        if (el) modelCardRefs.current.set(m.name, el);
                        else modelCardRefs.current.delete(m.name);
                      }}
                      className="border border-[var(--border)] bg-[var(--surface)] rounded-2xl p-4 flex flex-col gap-3 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-mono font-black text-sm uppercase truncate" title={m.name}>{m.name}</h4>
                        <span className={cn('text-[10px] font-mono font-bold px-2 py-0.5 rounded border', m.totalStock > 0 ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' : 'bg-red-500/10 text-red-500 border-red-500/30')}>
                          {m.totalStock} uds
                        </span>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-black/10 flex flex-col items-center justify-center my-1">
                        <QRCodeSVG value={qrModelVal} size={125} level="Q" includeMargin={false} />
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-auto">
                        <button
                          type="button"
                          onClick={() => setQuickIngestQuery(m.name)}
                          className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs font-bold uppercase transition-all"
                        >
                          <ArrowDownLeft size={12} /> INGRESAR
                        </button>
                        <button
                          type="button"
                          onClick={() => printModelLabel(group.category, m.name)}
                          className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-[var(--border)] hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] font-mono text-xs font-bold uppercase transition-all"
                        >
                          <Printer size={12} /> IMPRIMIR
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Quick Ingestion Matrix Modal ─────────────────────────────────── */}
      {quickIngestQuery && (
        <FamilyQRModal
          initialQuery={quickIngestQuery}
          products={products}
          stockLevels={stockLevels}
          opType="RECEPTION"
          onAdd={(items) => {
            handleIngestFromModal(items);
            setQuickIngestQuery(null);
          }}
          onClose={() => setQuickIngestQuery(null)}
        />
      )}
    </div>
  );
};
