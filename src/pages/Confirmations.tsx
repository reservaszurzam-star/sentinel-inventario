import React, { useState, useMemo } from 'react';
import { useAppContext } from '../store/AppContext';
import { Check, Clock, Search, X, ShieldAlert, Calendar, Filter, Package, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import type { Transaction } from '../types';

export const Confirmations: React.FC<{ txIds?: string[], reference?: string, onClose?: () => void }> = ({ txIds, reference, onClose }) => {
  const { transactions, products, confirmTransaction } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [isConfirming, setIsConfirming] = useState<string | null>(null);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  
  const [showFilters, setShowFilters] = useState(false);
  const [activeModelGroup, setActiveModelGroup] = useState<{
    groupId: string;
    modelName: string;
  } | null>(null);

  // Consider RECEPTION transactions for the active brand.
  const baseReceptions = useMemo(() => {
    let base = transactions.filter(t => t.type === 'RECEPTION' && t.status !== 'CANCELLED');
    if (txIds) {
      base = base.filter(t => txIds.includes(t.id));
    }
    return base.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, txIds]);

  // Apply Date Filter
  const pendingReceptions = useMemo(() => {
    return baseReceptions.filter(tx => {
      if (dateFrom || dateTo) {
        const d = new Date(tx.date);
        if (dateFrom && d < new Date(`${dateFrom}T00:00:00`)) return false;
        if (dateTo && d > new Date(`${dateTo}T23:59:59`)) return false;
      }
      return true;
    });
  }, [baseReceptions, dateFrom, dateTo]);

  // Extract unique models for the buttons
  const availableModels = useMemo(() => {
    const models = new Set<string>();
    pendingReceptions.forEach(tx => {
      const prod = products.find(p => p.id === tx.productId);
      if (prod?.name) models.add(prod.name);
    });
    return Array.from(models).sort();
  }, [pendingReceptions, products]);

  // Group by Comprobante (Reference + Date) and apply Model/Search filters
  const groupedReceptions = useMemo(() => {
    const map = new Map<string, {
      id: string;
      reference: string;
      date: Date;
      user: string;
      txs: Transaction[];
    }>();

    pendingReceptions.forEach(tx => {
      const prod = products.find(p => p.id === tx.productId);
      if (!prod) return;

      if (selectedModel && prod.name !== selectedModel) return;

      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        if (!prod.name.toLowerCase().includes(s) && 
            !(prod.code && prod.code.toLowerCase().includes(s)) &&
            !(prod.color && prod.color.toLowerCase().includes(s))) {
          return;
        }
      }

      const d = new Date(tx.date);
      const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const ref = tx.reference?.trim() || 'Sin Referencia';
      const key = `${ref}__${dayKey}`;

      if (!map.has(key)) {
        map.set(key, {
          id: key,
          reference: ref,
          date: d,
          user: tx.user,
          txs: []
        });
      }
      map.get(key)!.txs.push(tx);
    });
    return Array.from(map.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [pendingReceptions, products, selectedModel, searchTerm]);

  const activeModalData = useMemo(() => {
    if (!activeModelGroup) return null;
    const group = groupedReceptions.find(g => g.id === activeModelGroup.groupId);
    if (!group) return null;

    const txs = group.txs.filter(tx => {
      const prod = products.find(p => p.id === tx.productId);
      return prod && prod.name === activeModelGroup.modelName;
    });

    return {
      reference: group.reference,
      modelName: activeModelGroup.modelName,
      txs
    };
  }, [activeModelGroup, groupedReceptions, products]);

  // Auto-expand if there's only one group (e.g. opened from modal)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Automatically expand if there's only 1 group
  React.useEffect(() => {
    if (groupedReceptions.length === 1) {
      setExpandedGroups(new Set([groupedReceptions[0].id]));
    }
  }, [groupedReceptions]);

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = async (txId: string) => {
    try {
      setIsConfirming(txId);
      await confirmTransaction(txId, true);
    } catch (error) {
      console.error(error);
      alert('Error al confirmar');
    } finally {
      setIsConfirming(null);
    }
  };

  let content;
  if (baseReceptions.length === 0) {
    content = (
      <div className="flex flex-col items-center justify-center h-full opacity-60 mt-20 w-full relative">
        {onClose && (
          <button onClick={onClose} className="absolute top-0 right-0 p-2 border border-[var(--border)] hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-colors shrink-0 bg-[var(--surface)]">
            <X size={14} />
          </button>
        )}
        <ShieldAlert size={48} className="mb-4 text-emerald-500" />
        <h2 className="font-mono font-bold text-lg">TODO AL DÍA</h2>
        <p className="font-mono text-xs">No hay recepciones pendientes por confirmar</p>
      </div>
    );
  } else {
    content = (
      <div className="flex flex-col h-full gap-4 max-w-6xl mx-auto w-full">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center border-b border-[var(--border)] pb-4">
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tighter uppercase flex items-center gap-2">
              <Check size={20} className="text-emerald-500" /> 
              Confirmación de Prendas {reference && <span className="opacity-50">· {reference}</span>}
            </h1>
            <p className="font-mono text-[10px] opacity-60 uppercase tracking-widest mt-1">
              Validación física del inventario recepcionado
            </p>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-56 shrink-0">
              <input
                type="text"
                placeholder="BUSCAR PRENDA..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-9 pl-9 pr-8 text-[10px] font-mono font-bold uppercase tracking-wider focus:outline-none border border-[var(--border)] focus:border-[var(--ink)] transition-colors placeholder:opacity-30"
                style={{ background: 'var(--surface)', color: 'var(--ink)' }}
              />
              <Search size={14} className="absolute left-3 top-2.5 opacity-40" />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-2.5 opacity-40 hover:opacity-100">
                  <X size={14} />
                </button>
              )}
            </div>

            <button 
              onClick={() => setShowFilters(true)} 
              className={cn(
                "h-9 px-3 flex items-center gap-2 border border-[var(--border)] transition-colors shrink-0 font-mono text-[10px] font-bold uppercase",
                (dateFrom || dateTo || selectedModel) 
                  ? "bg-[var(--ink)] text-[var(--ink-inv)] border-[var(--ink)]" 
                  : "bg-[var(--surface)] hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] text-[var(--ink)]"
              )}
            >
              <Filter size={14} /> 
              Filtros {(dateFrom || dateTo || selectedModel) && " (Activos)"}
            </button>

            {onClose && (
              <button onClick={onClose} className="h-9 w-9 flex items-center justify-center border border-[var(--border)] hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-colors shrink-0 bg-[var(--surface)]">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Filters Modal (Ventana Emergente tipo Livex) */}
        {showFilters && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8 bg-black/80" onClick={() => setShowFilters(false)}>
            <div 
              className="w-full flex flex-col bg-[var(--bg)] border-2 border-[var(--border)] p-6 shadow-[8px_8px_0_var(--border)] max-w-lg animate-in zoom-in-95 duration-200" 
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-black uppercase tracking-wider flex items-center gap-2 text-[var(--ink)]">
                  <Filter size={16} /> Filtros Avanzados
                </h3>
                <button onClick={() => setShowFilters(false)} className="hover:bg-[var(--surface)] p-1.5 border border-transparent hover:border-[var(--border)] transition-colors">
                  <X size={16} />
                </button>
              </div>

              {/* Date Filters */}
              <div className="flex flex-col gap-3 mb-6">
                <span className="font-mono text-[10px] uppercase font-bold opacity-60 text-[var(--ink)]">Por Fecha de Recepción</span>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-[var(--surface)] p-3 border border-[var(--border)]">
                  <Calendar size={14} className="opacity-40 hidden sm:block" />
                  <div className="flex items-center gap-2 flex-1 border-b sm:border-b-0 sm:border-r border-[var(--border)]/50 pb-2 sm:pb-0 sm:pr-3">
                    <span className="font-mono text-[9px] uppercase opacity-40 w-10">Desde</span>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-transparent font-mono text-[11px] font-bold uppercase focus:outline-none w-full text-[var(--ink)]" />
                  </div>
                  <div className="flex items-center gap-2 flex-1 pt-1 sm:pt-0">
                    <span className="font-mono text-[9px] uppercase opacity-40 w-10">Hasta</span>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-transparent font-mono text-[11px] font-bold uppercase focus:outline-none w-full text-[var(--ink)]" />
                  </div>
                </div>
              </div>

              {/* Model Filters */}
              <div className="flex flex-col gap-3 mb-8">
                <span className="font-mono text-[10px] uppercase font-bold opacity-60 text-[var(--ink)]">Por Modelo de Prenda</span>
                <div className="flex flex-wrap gap-2 max-h-[40vh] overflow-y-auto hide-scrollbar pr-2 pb-2">
                  <button
                    onClick={() => setSelectedModel(null)}
                    className={cn("px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-wider rounded-full transition-all border", selectedModel === null ? "bg-[var(--ink)] text-[var(--ink-inv)] border-[var(--ink)] shadow-sm" : "bg-[var(--surface)] text-[var(--ink)] border-[var(--border)] hover:border-[var(--ink)]/50")}
                  >
                    TODOS LOS MODELOS
                  </button>
                  {availableModels.map(model => (
                    <button
                      key={model}
                      onClick={() => setSelectedModel(model)}
                      className={cn("px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-wider rounded-full transition-all border", selectedModel === model ? "bg-[var(--ink)] text-[var(--ink-inv)] border-[var(--ink)] shadow-sm" : "bg-[var(--surface)] text-[var(--ink)] border-[var(--border)] hover:border-[var(--ink)]/50")}
                    >
                      {model}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-3">
                <button onClick={() => { setDateFrom(''); setDateTo(''); setSelectedModel(null); }} className="px-4 py-3 border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--bg-card)] transition-colors font-mono text-[10px] font-bold uppercase">
                  Limpiar
                </button>
                <button onClick={() => setShowFilters(false)} className="flex-1 bg-[var(--ink)] text-[var(--ink-inv)] py-3 font-mono text-[11px] font-bold uppercase tracking-widest hover:opacity-90 transition-opacity">
                  Ver Resultados
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content List */}
        <div className="grid gap-4 mt-2 overflow-y-auto pr-2 pb-10" style={{ maxHeight: onClose ? 'calc(90vh - 200px)' : 'auto' }}>
          {groupedReceptions.length === 0 ? (
            <div className="text-center opacity-50 py-10 font-mono text-xs uppercase">
              No se encontraron comprobantes con estos filtros
            </div>
          ) : (
            groupedReceptions.map(group => {
              const totalQty = group.txs.reduce((sum, tx) => sum + tx.quantity, 0);
              const isExpanded = expandedGroups.has(group.id);
              const confirmedCount = group.txs.filter(tx => tx.isConfirmed).length;
              const isAllConfirmed = group.txs.length > 0 && confirmedCount === group.txs.length;

              return (
                <div key={group.id} className="flex flex-col border border-[var(--border)] bg-[var(--bg-card)] rounded-sm overflow-hidden shadow-sm transition-colors">
                  <div 
                    onClick={() => toggleGroup(group.id)}
                    className="flex justify-between items-center px-4 py-3 bg-[var(--surface)] hover:bg-[var(--bg-card)] cursor-pointer select-none group border-b border-transparent data-[expanded=true]:border-[var(--border)]/50 transition-colors"
                    data-expanded={isExpanded}
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm uppercase tracking-wider text-[var(--ink)]">
                          COMPROBANTE · {group.reference}
                        </span>
                        {isAllConfirmed && (
                          <div className="flex items-center gap-1 text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">
                            <Check size={10} />
                            <span className="font-mono text-[8px] font-bold uppercase tracking-wider">Listo</span>
                          </div>
                        )}
                      </div>
                      <span className="font-mono text-[10px] opacity-60">
                        {group.date.toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })} <span className="mx-1">•</span> Recibido por: <span className="font-bold">{group.user || 'Desconocido'}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-end">
                        <span className="font-mono text-[9px] uppercase opacity-50 tracking-widest">Total prendas</span>
                        <span className="font-black text-lg text-[var(--ink)]">+{totalQty}</span>
                      </div>
                      <div className={cn("text-[var(--ink)] opacity-30 group-hover:opacity-100 transition-all", isExpanded ? "rotate-180" : "rotate-0")}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="flex flex-col p-2 gap-1.5 bg-[var(--bg)] border-t border-[var(--border)]/30 animate-in slide-in-from-top-1 fade-in duration-200">
                      {(() => {
                        const modelGroups = new Map<string, Transaction[]>();
                        group.txs.forEach(tx => {
                          const prod = products.find(p => p.id === tx.productId);
                          if (!prod) return;
                          const name = prod.name;
                          if (!modelGroups.has(name)) modelGroups.set(name, []);
                          modelGroups.get(name)!.push(tx);
                        });

                        return Array.from(modelGroups.entries()).map(([modelName, txs]) => {
                          const totalQty = txs.reduce((sum, t) => sum + t.quantity, 0);
                          const confirmedCount = txs.filter(t => t.isConfirmed).length;
                          const totalCount = txs.length;

                          return (
                            <div 
                              key={modelName} 
                              className="flex items-center justify-between px-4 py-3 rounded-sm bg-[var(--surface)] border border-[var(--border)]/30 hover:bg-[var(--bg-card)] transition-colors cursor-pointer group/item"
                              onClick={() => setActiveModelGroup({ groupId: group.id, modelName })}
                            >
                              <div className="flex items-center gap-4">
                                <span className="font-mono text-[11px] uppercase font-bold text-[var(--ink)]">{modelName}</span>
                                {isAllConfirmed && (
                                  <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                                    <Check size={12} />
                                    <span className="font-mono text-[9px] font-bold uppercase tracking-wider">Listo</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-6">
                                <div className="flex flex-col items-end gap-0.5">
                                  <span className="font-mono font-black text-sm text-[var(--ink)]">+{totalQty} prendas</span>
                                  <span className={cn("font-mono text-[9px] font-bold tracking-wider", isAllConfirmed ? "text-emerald-600" : "opacity-50")}>
                                    Confirmados: {confirmedCount}/{totalCount}
                                  </span>
                                </div>
                                <div className="text-[var(--ink)] opacity-30 group-hover/item:opacity-100 transition-all group-hover/item:translate-x-1">
                                  <ChevronRight size={16} />
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // Model variants confirmation modal
  const variantsModal = activeModalData && (() => {
    const confirmedCount = activeModalData.txs.filter(t => t.isConfirmed).length;
    const totalCount = activeModalData.txs.length;
    const isAllConfirmed = totalCount > 0 && confirmedCount === totalCount;

    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 md:p-8 bg-black/80" onClick={() => setActiveModelGroup(null)}>
        <div 
          className="w-full flex flex-col bg-[var(--bg)] border-2 border-[var(--border)] p-0 shadow-[8px_8px_0_var(--border)] max-w-3xl max-h-[90vh] animate-in zoom-in-95 duration-200" 
          onClick={e => e.stopPropagation()}
        >
          <div className="flex justify-between items-center p-5 border-b border-[var(--border)] bg-[var(--surface)]">
            <div className="flex flex-col">
              <h3 className="font-black uppercase tracking-wider text-[var(--ink)] flex items-center gap-2 text-lg">
                <Package size={18} /> {activeModalData.modelName}
              </h3>
              <p className="font-mono text-[10px] opacity-60 uppercase tracking-widest mt-1">
                Comprobante: <span className="font-bold">{activeModalData.reference}</span>
                <span className="mx-2">•</span>
                Progreso: <span className={cn("font-bold", isAllConfirmed ? "text-emerald-500" : "text-[var(--ink)]")}>{confirmedCount}/{totalCount}</span>
              </p>
            </div>
            <button onClick={() => setActiveModelGroup(null)} className="hover:bg-[var(--bg-card)] p-2 border border-[var(--border)] transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="flex flex-col p-4 overflow-y-auto gap-2">
            {activeModalData.txs.map(tx => {
              const prod = products.find(p => p.id === tx.productId);
              if (!prod) return null;

              return (
                <div key={tx.id} className={cn("flex items-center justify-between px-4 py-3 rounded-sm border transition-colors", tx.isConfirmed ? "bg-emerald-500/5 border-emerald-500/20" : "bg-[var(--surface)] border-[var(--border)]/50 hover:bg-[var(--bg-card)]")}>
                  <div className="flex flex-col">
                    <span className="font-mono text-[11px] uppercase font-bold opacity-80">{prod.code}</span>
                    <span className="font-mono text-[12px] text-[var(--ink)] mt-0.5">
                      <span className="font-black">{prod.color || 'Sin color'}</span> 
                      <span className="mx-2 opacity-30">•</span> 
                      Talla: <span className="font-black">{prod.size || 'Unica'}</span>
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <span className="font-mono font-black text-lg text-[var(--ink)]">+{tx.quantity}</span>
                    {tx.isConfirmed ? (
                      <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-500/10 px-4 py-2 rounded-sm border border-emerald-500/30 w-[120px] justify-center">
                        <Check size={16} />
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider">Confirmado</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleConfirm(tx.id)}
                        disabled={isConfirming === tx.id}
                        className={cn(
                          "flex items-center justify-center gap-1.5 px-4 py-2 rounded-sm border transition-all w-[120px]",
                          "border-[var(--ink)] bg-[var(--ink)] text-[var(--ink-inv)] hover:opacity-90 font-bold",
                          isConfirming === tx.id ? "opacity-50 animate-pulse cursor-not-allowed" : ""
                        )}
                        title="Confirmar recepción en físico"
                      >
                        <span className="font-mono text-[10px] uppercase tracking-wider">Confirmar</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  })();

  if (onClose) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/80" onClick={onClose}>
        <div
          className="w-full flex flex-col bg-[var(--bg)] border-2 border-[var(--border)] p-0 md:p-6"
          style={{ boxShadow: '8px 8px 0 var(--border)', maxWidth: '1000px', maxHeight: '95vh' }}
          onClick={e => e.stopPropagation()}
        >
          {content}
          {variantsModal}
        </div>
      </div>
    );
  }

  return (
    <>
      {content}
      {variantsModal}
    </>
  );
};
