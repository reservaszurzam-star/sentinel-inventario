import React, { useState, useMemo } from 'react';
import { useAppContext } from '../store/AppContext';
import { Check, Clock, Search, X, ShieldAlert, Calendar, Filter, Package, ChevronRight, CheckCircle2 } from 'lucide-react';
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
      <div className="flex flex-col items-center justify-center p-12 text-center relative w-full modern-card rounded-3xl">
        {onClose && (
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 p-2 text-[var(--ink)]/40 hover:text-[var(--ink)] hover:bg-[var(--surface-alt)] rounded-xl transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        )}
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
          <CheckCircle2 size={32} />
        </div>
        <h2 className="font-mono font-bold text-lg text-[var(--ink)]">Todo al día</h2>
        <p className="font-mono text-xs text-[var(--ink)]/50 mt-1 max-w-sm">
          No hay recepciones pendientes por confirmar físicamente en este momento.
        </p>
      </div>
    );
  } else {
    content = (
      <div className="flex flex-col h-full gap-5 w-full">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center pb-2">
          <div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight text-[var(--ink)] flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                <Check size={18} />
              </div>
              <span>Confirmación de Prendas</span>
              {reference && <span className="font-mono text-sm font-normal text-[var(--ink)]/50">· {reference}</span>}
            </h2>
            <p className="font-mono text-xs text-[var(--ink)]/50 mt-1">
              Validación y cotejo físico del inventario recepcionado en almacén
            </p>
          </div>
          
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <div className="relative w-full sm:w-64 shrink-0">
              <input
                type="text"
                placeholder="Buscar prenda, modelo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-technical rounded-xl text-xs py-2 pl-9 pr-8"
              />
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink)]/40" />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--ink)]/40 hover:text-[var(--ink)] p-0.5 rounded"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <button 
              onClick={() => setShowFilters(true)} 
              className={cn(
                "h-9 px-3.5 flex items-center gap-2 rounded-xl transition-all duration-150 shrink-0 font-mono text-xs font-semibold shadow-xs",
                (dateFrom || dateTo || selectedModel) 
                  ? "bg-[var(--ink)] text-[var(--ink-inv)] shadow-sm" 
                  : "bg-[var(--surface)] hover:bg-[var(--surface-alt)] border border-[var(--border-soft)] text-[var(--ink)]"
              )}
            >
              <Filter size={14} /> 
              <span>Filtros</span>
              {(dateFrom || dateTo || selectedModel) && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
              )}
            </button>

            {onClose && (
              <button 
                onClick={onClose} 
                className="h-9 w-9 flex items-center justify-center rounded-xl border border-[var(--border-soft)] hover:bg-[var(--surface-alt)] text-[var(--ink)]/60 hover:text-[var(--ink)] transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Filters Modal */}
        {showFilters && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowFilters(false)}>
            <div 
              className="w-full flex flex-col bg-[var(--surface)] border border-[var(--border-soft)] rounded-3xl p-6 shadow-2xl max-w-lg animate-scale-in" 
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-5 pb-3 border-b border-[var(--border-soft)]">
                <h3 className="font-mono text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-[var(--ink)]">
                  <Filter size={16} /> Filtros de Confirmación
                </h3>
                <button 
                  onClick={() => setShowFilters(false)} 
                  className="p-1.5 text-[var(--ink)]/40 hover:text-[var(--ink)] hover:bg-[var(--surface-alt)] rounded-xl transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Date Filters */}
              <div className="space-y-2 mb-5">
                <span className="font-mono text-[10px] uppercase font-bold text-[var(--ink)]/50 tracking-wider">Por Fecha de Recepción</span>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-[9px] uppercase text-[var(--ink)]/40">Desde</label>
                    <input 
                      type="date" 
                      value={dateFrom} 
                      onChange={e => setDateFrom(e.target.value)} 
                      className="input-technical rounded-xl text-xs py-2 px-3" 
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-[9px] uppercase text-[var(--ink)]/40">Hasta</label>
                    <input 
                      type="date" 
                      value={dateTo} 
                      onChange={e => setDateTo(e.target.value)} 
                      className="input-technical rounded-xl text-xs py-2 px-3" 
                    />
                  </div>
                </div>
              </div>

              {/* Model Filters */}
              <div className="space-y-2 mb-6">
                <span className="font-mono text-[10px] uppercase font-bold text-[var(--ink)]/50 tracking-wider">Por Modelo de Prenda</span>
                <div className="flex flex-wrap gap-1.5 max-h-[35vh] overflow-y-auto pr-1 pb-1">
                  <button
                    onClick={() => setSelectedModel(null)}
                    className={cn(
                      "px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all border", 
                      selectedModel === null 
                        ? "bg-[var(--ink)] text-[var(--ink-inv)] border-transparent shadow-xs" 
                        : "bg-[var(--surface-alt)] text-[var(--ink)]/70 border-[var(--border-soft)] hover:text-[var(--ink)]"
                    )}
                  >
                    Todos los Modelos
                  </button>
                  {availableModels.map(model => (
                    <button
                      key={model}
                      onClick={() => setSelectedModel(model)}
                      className={cn(
                        "px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all border", 
                        selectedModel === model 
                          ? "bg-[var(--ink)] text-[var(--ink-inv)] border-transparent shadow-xs" 
                          : "bg-[var(--surface-alt)] text-[var(--ink)]/70 border-[var(--border-soft)] hover:text-[var(--ink)]"
                      )}
                    >
                      {model}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-2.5 pt-3 border-t border-[var(--border-soft)]">
                <button 
                  onClick={() => { setDateFrom(''); setDateTo(''); setSelectedModel(null); }} 
                  className="px-4 py-2.5 rounded-xl border border-[var(--border-soft)] hover:bg-[var(--surface-alt)] font-mono text-xs font-bold text-[var(--ink)]/70 transition-colors"
                >
                  Limpiar
                </button>
                <button 
                  onClick={() => setShowFilters(false)} 
                  className="flex-1 modern-btn-primary py-2.5 rounded-xl text-xs shadow-xs"
                >
                  Aplicar Filtros
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content List */}
        <div className="grid gap-3.5 overflow-y-auto pr-1 pb-4" style={{ maxHeight: onClose ? 'calc(90vh - 200px)' : 'auto' }}>
          {groupedReceptions.length === 0 ? (
            <div className="text-center text-[var(--ink)]/40 py-12 font-mono text-xs uppercase bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl">
              No se encontraron comprobantes con los filtros seleccionados
            </div>
          ) : (
            groupedReceptions.map(group => {
              const totalQty = group.txs.reduce((sum, tx) => sum + tx.quantity, 0);
              const isExpanded = expandedGroups.has(group.id);
              const confirmedCount = group.txs.filter(tx => tx.isConfirmed).length;
              const isAllConfirmed = group.txs.length > 0 && confirmedCount === group.txs.length;

              return (
                <div 
                  key={group.id} 
                  className="flex flex-col border border-[var(--border-soft)] bg-[var(--surface)] rounded-2xl overflow-hidden shadow-xs hover:border-[var(--ink)]/20 transition-all duration-150"
                >
                  <div 
                    onClick={() => toggleGroup(group.id)}
                    className="flex justify-between items-center px-5 py-4 cursor-pointer select-none group hover:bg-[var(--surface-alt)]/50 transition-colors"
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-bold text-sm text-[var(--ink)]">
                          COMPROBANTE · {group.reference}
                        </span>
                        {isAllConfirmed && (
                          <div className="flex items-center gap-1 text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-mono text-[9px] font-bold">
                            <Check size={11} />
                            <span>Completado</span>
                          </div>
                        )}
                      </div>
                      <span className="font-mono text-xs text-[var(--ink)]/50 mt-0.5">
                        {group.date.toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })} <span className="mx-1">•</span> Recibido por: <span className="font-semibold text-[var(--ink)]/70">{group.user || 'Desconocido'}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-5">
                      <div className="flex flex-col items-end">
                        <span className="font-mono text-[10px] uppercase text-[var(--ink)]/40 tracking-wider">Total prendas</span>
                        <span className="font-mono font-bold text-base text-[var(--ink)]">+{totalQty}</span>
                      </div>
                      <div className={cn("text-[var(--ink)]/40 group-hover:text-[var(--ink)] transition-transform duration-200", isExpanded ? "rotate-180" : "rotate-0")}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="flex flex-col p-3 gap-2 bg-[var(--surface-alt)]/40 border-t border-[var(--border-soft)] animate-fade-in">
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
                          const isModelComplete = totalCount > 0 && confirmedCount === totalCount;

                          return (
                            <div 
                              key={modelName} 
                              className="flex items-center justify-between px-4 py-3 rounded-xl bg-[var(--surface)] border border-[var(--border-soft)] hover:border-[var(--ink)]/20 hover:shadow-xs transition-all cursor-pointer group/item"
                              onClick={() => setActiveModelGroup({ groupId: group.id, modelName })}
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-xs font-bold text-[var(--ink)]">{modelName}</span>
                                {isModelComplete && (
                                  <div className="flex items-center gap-1 text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-mono text-[9px] font-bold">
                                    <Check size={10} />
                                    <span>Listo</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-5">
                                <div className="flex flex-col items-end">
                                  <span className="font-mono font-bold text-xs text-[var(--ink)]">+{totalQty} prendas</span>
                                  <span className={cn("font-mono text-[10px] font-medium", isModelComplete ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-[var(--ink)]/50")}>
                                    Confirmados: {confirmedCount}/{totalCount}
                                  </span>
                                </div>
                                <div className="text-[var(--ink)]/30 group-hover/item:text-[var(--ink)] group-hover/item:translate-x-0.5 transition-all">
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
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 md:p-8 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setActiveModelGroup(null)}>
        <div 
          className="w-full flex flex-col bg-[var(--surface)] border border-[var(--border-soft)] rounded-3xl p-0 shadow-2xl max-w-3xl max-h-[90vh] overflow-hidden animate-scale-in" 
          onClick={e => e.stopPropagation()}
        >
          <div className="flex justify-between items-center p-5 border-b border-[var(--border-soft)] bg-[var(--surface-alt)]/50">
            <div className="flex flex-col">
              <h3 className="font-mono font-bold text-base text-[var(--ink)] flex items-center gap-2">
                <Package size={18} className="text-[var(--ink)]/60" /> 
                <span>{activeModalData.modelName}</span>
              </h3>
              <p className="font-mono text-xs text-[var(--ink)]/50 mt-0.5">
                Comprobante: <span className="font-bold text-[var(--ink)]/80">{activeModalData.reference}</span>
                <span className="mx-2">•</span>
                Progreso: <span className={cn("font-bold", isAllConfirmed ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--ink)]")}>{confirmedCount}/{totalCount} confirmados</span>
              </p>
            </div>
            <button 
              onClick={() => setActiveModelGroup(null)} 
              className="p-1.5 text-[var(--ink)]/40 hover:text-[var(--ink)] hover:bg-[var(--surface-alt)] rounded-xl transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex flex-col p-5 overflow-y-auto gap-2.5">
            {activeModalData.txs.map(tx => {
              const prod = products.find(p => p.id === tx.productId);
              if (!prod) return null;

              return (
                <div 
                  key={tx.id} 
                  className={cn(
                    "flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-150", 
                    tx.isConfirmed 
                      ? "bg-emerald-500/5 border-emerald-500/20" 
                      : "bg-[var(--surface)] border-[var(--border-soft)] hover:border-[var(--ink)]/20 hover:shadow-xs"
                  )}
                >
                  <div className="flex flex-col">
                    <span className="font-mono text-xs font-bold text-[var(--ink)]/80">{prod.code}</span>
                    <span className="font-mono text-xs text-[var(--ink)]/60 mt-0.5">
                      <span className="font-semibold text-[var(--ink)]">{prod.color || 'Sin color'}</span> 
                      <span className="mx-2 opacity-30">•</span> 
                      Talla: <span className="font-semibold text-[var(--ink)]">{prod.size || 'Única'}</span>
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-5">
                    <span className="font-mono font-bold text-base text-[var(--ink)]">+{tx.quantity}</span>
                    {tx.isConfirmed ? (
                      <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-500/10 px-3.5 py-1.5 rounded-xl border border-emerald-500/20 w-[120px] justify-center">
                        <Check size={14} />
                        <span className="font-mono text-xs font-bold">Listo</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleConfirm(tx.id)}
                        disabled={isConfirming === tx.id}
                        className={cn(
                          "modern-btn-primary flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl w-[120px] text-xs shadow-xs",
                          isConfirming === tx.id ? "opacity-50 animate-pulse cursor-not-allowed" : ""
                        )}
                        title="Confirmar recepción en físico"
                      >
                        <Check size={13} />
                        <span>Confirmar</span>
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
        <div
          className="w-full flex flex-col bg-[var(--surface)] border border-[var(--border-soft)] rounded-3xl p-6 shadow-2xl max-w-4xl max-h-[92vh] overflow-hidden animate-scale-in"
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
