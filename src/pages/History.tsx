import React, { useState } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { fmtLima } from '../lib/utils';
import { ChevronRight, ChevronDown, Download, CheckSquare, Square, Filter, X, FileText } from 'lucide-react';
import { TutorialModal, HISTORY_TUTORIAL_STEPS } from '../components/TutorialModal';

export const History: React.FC = () => {
    const { transactions, products, locations, contacts } = useAppContext();
    const [showTutorial, setShowTutorial] = useState(false);
    const [filterType, setFilterType] = useState('ALL');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [filterProduct, setFilterProduct] = useState('ALL');
    const [filterUser, setFilterUser] = useState('ALL');
    const [filterContact, setFilterContact] = useState('ALL');
    const [filterReference, setFilterReference] = useState('');
    const [dateRangePreset, setDateRangePreset] = useState('ALL_TIME');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [filterHasSignature, setFilterHasSignature] = useState(false);
    const [filterHasPhoto, setFilterHasPhoto] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const uniqueUsers = Array.from(new Set(transactions.map(tx => tx.user || 'OPERATOR_01')));

    const activeFilterCount = [
        filterType !== 'ALL', filterStatus !== 'ALL', filterProduct !== 'ALL',
        filterUser !== 'ALL', filterContact !== 'ALL', filterReference.trim() !== '',
        dateRangePreset !== 'ALL_TIME', filterHasSignature, filterHasPhoto,
    ].filter(Boolean).length;

    const filteredTransactions = transactions.filter(tx => {
        if (filterType !== 'ALL' && tx.type !== filterType) return false;
        if (filterStatus !== 'ALL' && tx.status !== filterStatus) return false;
        if (filterProduct !== 'ALL' && tx.productId !== filterProduct) return false;
        const txUser = tx.user || 'OPERATOR_01';
        if (filterUser !== 'ALL' && txUser !== filterUser) return false;
        if (filterContact !== 'ALL' && tx.contactId !== filterContact) return false;
        if (filterReference.trim() && !tx.reference?.toLowerCase().includes(filterReference.toLowerCase())) return false;
        if (filterHasSignature && !tx.signature) return false;
        if (filterHasPhoto && !(tx as any).photo) return false;
        if (dateFrom && new Date(tx.date) < new Date(dateFrom)) return false;
        if (dateTo) {
            const dTo = new Date(dateTo);
            dTo.setHours(23, 59, 59, 999);
            if (new Date(tx.date) > dTo) return false;
        }
        return true;
    });

    const resetFilters = () => {
        setFilterType('ALL');
        setFilterStatus('ALL');
        setFilterProduct('ALL');
        setFilterUser('ALL');
        setFilterContact('ALL');
        setFilterReference('');
        setDateRangePreset('ALL_TIME');
        setDateFrom('');
        setDateTo('');
        setFilterHasSignature(false);
        setFilterHasPhoto(false);
    };

    const toggleSelect = (id: string) => {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelected(next);
    };

    const allSelected = filteredTransactions.length > 0 && filteredTransactions.every(tx => selected.has(tx.id));
    const someSelected = selected.size > 0;

    const toggleSelectAll = () => {
        if (allSelected) {
            const next = new Set(selected);
            filteredTransactions.forEach(tx => next.delete(tx.id));
            setSelected(next);
        } else {
            const next = new Set(selected);
            filteredTransactions.forEach(tx => next.add(tx.id));
            setSelected(next);
        }
    };

    const handleDatePreset = (preset: string) => {
        setDateRangePreset(preset);
        if (preset === 'ALL_TIME') {
            setDateFrom('');
            setDateTo('');
        } else if (preset === 'LAST_7_DAYS') {
            const d = new Date();
            d.setDate(d.getDate() - 7);
            setDateFrom(d.toISOString().split('T')[0]);
            setDateTo('');
        } else if (preset === 'THIS_MONTH') {
            const d = new Date();
            d.setDate(1);
            setDateFrom(d.toISOString().split('T')[0]);
            setDateTo('');
        }
    };

    const toggleExpand = (id: string) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedRows(newExpanded);
    };

    const exportToCSV = () => {
        const toExport = someSelected
            ? filteredTransactions.filter(tx => selected.has(tx.id))
            : filteredTransactions;
        const headers = ["ID", "Fecha", "Tipo", "Estado", "SKU", "Producto", "Color", "Talla", "Cantidad", "Origen", "Destino", "Contacto", "Usuario", "Referencia"];

        const rows = toExport.map(tx => {
            const product = products.find(p => p.id === tx.productId);
            const fromLoc = locations.find(l => l.id === tx.fromLocationId);
            const toLoc = locations.find(l => l.id === tx.toLocationId);
            const contact = contacts.find(c => c.id === tx.contactId);
            return [
                tx.id,
                fmtLima(tx.date, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                tx.type,
                tx.status,
                product?.code || tx.productId,
                product?.name || '',
                product?.color || '',
                product?.size || '',
                tx.quantity,
                fromLoc?.name || '',
                toLoc?.name || '',
                contact?.name || '',
                tx.user || 'OPERATOR_01',
                tx.reference,
            ];
        });

        const csvContent = [
            headers.join(","),
            ...rows.map(r => r.map(field => `"${String(field).replace(/"/g, '""')}"`).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `transacciones_${new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' }).replace(/-/g, '')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 pb-12">
            <TutorialModal open={showTutorial} onClose={() => setShowTutorial(false)} steps={HISTORY_TUTORIAL_STEPS} title="Historial" />
            
            {/* Modern Hero Module Header */}
            <ModuleInfo 
                number="08" 
                title="Historial de Transacciones" 
                description="Registro inmutable de todas las operaciones del almacén: recepciones, despachos y traslados. Consulta con filtros avanzados y genera comprobantes de operación." 
                onTutorial={() => setShowTutorial(true)} 
            />

            {/* Action & Filter Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl p-3.5 shadow-sm">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[var(--ink)]/60">
                        {filteredTransactions.length} {filteredTransactions.length === 1 ? 'operación registrada' : 'operaciones registradas'}
                    </span>
                    {someSelected && (
                        <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-500/10 px-2.5 py-0.5 rounded-full">
                            {selected.size} seleccionadas
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={exportToCSV}
                        className="modern-btn px-3.5 py-2 text-xs flex items-center gap-1.5"
                    >
                        <Download size={14} /> 
                        <span>{someSelected ? `Exportar (${selected.size})` : 'Exportar CSV'}</span>
                    </button>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer ${
                            showFilters 
                                ? 'bg-blue-600 text-white' 
                                : 'modern-btn'
                        }`}
                    >
                        <Filter size={14} />
                        <span>Filtros</span>
                        {activeFilterCount > 0 && (
                            <span className="bg-red-500 text-white font-black text-[9px] rounded-full w-4 h-4 flex items-center justify-center leading-none ml-0.5">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Collapsible Filter Panel */}
            {showFilters && (
                <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-3xl p-5 shadow-sm flex flex-col gap-4 animate-in fade-in duration-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Tipo Operación</label>
                            <select 
                                value={filterType} 
                                onChange={e => setFilterType(e.target.value)}
                                className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3 py-2 text-xs font-semibold rounded-xl focus:outline-none focus:border-blue-500 cursor-pointer"
                            >
                                <option value="ALL">TODAS LAS OPERACIONES</option>
                                <option value="RECEPTION">RECEPCIÓN (ENTRADA)</option>
                                <option value="DISPATCH">DESPACHO (SALIDA)</option>
                                <option value="TRANSFER">TRASLADO INTERNO</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Estado</label>
                            <select 
                                value={filterStatus} 
                                onChange={e => setFilterStatus(e.target.value)}
                                className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3 py-2 text-xs font-semibold rounded-xl focus:outline-none focus:border-blue-500 cursor-pointer"
                            >
                                <option value="ALL">TODOS LOS ESTADOS</option>
                                <option value="COMPLETED">COMPLETADO</option>
                                <option value="PENDING">PENDIENTE</option>
                                <option value="CANCELLED">CANCELADO</option>
                                <option value="PREPARING">PREPARANDO</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Producto SKU</label>
                            <select 
                                value={filterProduct} 
                                onChange={e => setFilterProduct(e.target.value)}
                                className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3 py-2 text-xs font-semibold rounded-xl focus:outline-none focus:border-blue-500 cursor-pointer"
                            >
                                <option value="ALL">TODOS LOS PRODUCTOS</option>
                                {products.map(p => (
                                    <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Usuario Operador</label>
                            <select 
                                value={filterUser} 
                                onChange={e => setFilterUser(e.target.value)}
                                className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3 py-2 text-xs font-semibold rounded-xl focus:outline-none focus:border-blue-500 cursor-pointer"
                            >
                                <option value="ALL">TODOS LOS USUARIOS</option>
                                {uniqueUsers.map(u => (
                                    <option key={u} value={u}>{u}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 items-end">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Contacto</label>
                            <select
                                value={filterContact}
                                onChange={e => setFilterContact(e.target.value)}
                                className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3 py-2 text-xs font-semibold rounded-xl focus:outline-none focus:border-blue-500 cursor-pointer"
                            >
                                <option value="ALL">TODOS LOS CONTACTOS</option>
                                {contacts.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-[var(--ink)]/50 uppercase tracking-wider">Referencia / Guía</label>
                            <input
                                type="text"
                                value={filterReference}
                                onChange={e => setFilterReference(e.target.value)}
                                placeholder="Buscar código o referencia..."
                                className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3 py-2 text-xs font-semibold rounded-xl focus:outline-none focus:border-blue-500 uppercase placeholder:normal-case"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <button 
                                type="button" 
                                onClick={() => setFilterHasSignature(v => !v)}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                                    filterHasSignature 
                                        ? 'bg-blue-600 border-transparent text-white shadow-sm' 
                                        : 'bg-[var(--bg-input)] border-[var(--border-soft)] text-[var(--ink)]/70 hover:bg-[var(--border-soft)]'
                                }`}
                            >
                                {filterHasSignature ? <CheckSquare size={13} /> : <Square size={13} />} Con Firma
                            </button>
                            <button 
                                type="button" 
                                onClick={() => setFilterHasPhoto(v => !v)}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                                    filterHasPhoto 
                                        ? 'bg-blue-600 border-transparent text-white shadow-sm' 
                                        : 'bg-[var(--bg-input)] border-[var(--border-soft)] text-[var(--ink)]/70 hover:bg-[var(--border-soft)]'
                                }`}
                            >
                                {filterHasPhoto ? <CheckSquare size={13} /> : <Square size={13} />} Con Foto
                            </button>
                        </div>

                        <div className="flex justify-end">
                            <button 
                                onClick={resetFilters}
                                className="modern-btn px-4 py-2 text-xs uppercase"
                            >
                                Limpiar Filtros
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-[var(--border-soft)] items-center">
                        <div className="flex items-center gap-1.5 bg-[var(--bg-input)] p-1 rounded-xl border border-[var(--border-soft)] overflow-x-auto w-full sm:w-auto">
                            <button type="button" onClick={() => handleDatePreset('ALL_TIME')} className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${dateRangePreset === 'ALL_TIME' ? 'bg-[var(--surface)] text-[var(--ink)] shadow-sm' : 'text-[var(--ink)]/50 hover:text-[var(--ink)]'}`}>TODO</button>
                            <button type="button" onClick={() => handleDatePreset('LAST_7_DAYS')} className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${dateRangePreset === 'LAST_7_DAYS' ? 'bg-[var(--surface)] text-[var(--ink)] shadow-sm' : 'text-[var(--ink)]/50 hover:text-[var(--ink)]'}`}>ÚLTIMOS 7 DÍAS</button>
                            <button type="button" onClick={() => handleDatePreset('THIS_MONTH')} className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${dateRangePreset === 'THIS_MONTH' ? 'bg-[var(--surface)] text-[var(--ink)] shadow-sm' : 'text-[var(--ink)]/50 hover:text-[var(--ink)]'}`}>ESTE MES</button>
                            <button type="button" onClick={() => handleDatePreset('CUSTOM')} className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${dateRangePreset === 'CUSTOM' ? 'bg-[var(--surface)] text-[var(--ink)] shadow-sm' : 'text-[var(--ink)]/50 hover:text-[var(--ink)]'}`}>PERSONALIZADO</button>
                        </div>
                        {dateRangePreset === 'CUSTOM' && (
                            <div className="flex items-center gap-2">
                                <input 
                                    type="date" 
                                    value={dateFrom}
                                    onChange={e => setDateFrom(e.target.value)}
                                    className="bg-[var(--bg-input)] border border-[var(--border-soft)] px-3 py-1.5 text-xs font-semibold rounded-xl focus:outline-none focus:border-blue-500"
                                />
                                <span className="text-xs text-[var(--ink)]/50">—</span>
                                <input 
                                    type="date" 
                                    value={dateTo}
                                    onChange={e => setDateTo(e.target.value)}
                                    className="bg-[var(--bg-input)] border border-[var(--border-soft)] px-3 py-1.5 text-xs font-semibold rounded-xl focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Main Data Table */}
            <div className="data-table-container bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl overflow-hidden shadow-sm flex flex-col">
                <div className="grid grid-cols-[36px_40px_130px_100px_minmax(180px,1fr)_75px_minmax(110px,1fr)_minmax(110px,1fr)_110px_100px] data-header sticky top-0 bg-[var(--bg-input)]/70 border-b border-[var(--border-soft)] py-2.5">
                    <div className="flex items-center justify-center cursor-pointer" onClick={toggleSelectAll}>
                        {allSelected ? <CheckSquare size={14} className="text-blue-600" /> : <Square size={14} className="text-[var(--ink)]/40" />}
                    </div>
                    <div></div>
                    <div className="text-[10px] font-bold uppercase text-[var(--ink)]/50">FECHA</div>
                    <div className="text-[10px] font-bold uppercase text-[var(--ink)]/50">TIPO</div>
                    <div className="text-[10px] font-bold uppercase text-[var(--ink)]/50">PRODUCTO / MODELO</div>
                    <div className="text-right text-[10px] font-bold uppercase text-[var(--ink)]/50 pr-2">CANT.</div>
                    <div className="text-[10px] font-bold uppercase text-[var(--ink)]/50 pl-2">ORIGEN</div>
                    <div className="text-[10px] font-bold uppercase text-[var(--ink)]/50">DESTINO</div>
                    <div className="text-[10px] font-bold uppercase text-[var(--ink)]/50">CONTACTO</div>
                    <div className="text-[10px] font-bold uppercase text-[var(--ink)]/50">REFERENCIA</div>
                </div>

                <div className="overflow-y-auto">
                    {filteredTransactions.map(tx => {
                        const product = products.find(p => p.id === tx.productId);
                        const fromLoc = locations.find(l => l.id === tx.fromLocationId);
                        const toLoc = locations.find(l => l.id === tx.toLocationId);
                        const isExpanded = expandedRows.has(tx.id);

                        let badgeStyle = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20';
                        if (tx.type === 'RECEPTION') badgeStyle = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
                        else if (tx.type === 'DISPATCH') badgeStyle = 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20';
                        else if (tx.type === 'TRANSFER') badgeStyle = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';

                        const contact = contacts.find(c => c.id === tx.contactId);
                        const modelParts = [product?.color, product?.size].filter(Boolean).join(' · ');

                        return (
                            <React.Fragment key={tx.id}>
                                <div
                                    className={`grid grid-cols-[36px_40px_130px_100px_minmax(180px,1fr)_75px_minmax(110px,1fr)_minmax(110px,1fr)_110px_100px] items-center py-2.5 px-1 border-b border-[var(--border-soft)]/50 hover:bg-[var(--bg-input)]/40 transition-colors cursor-pointer select-none text-xs ${isExpanded ? 'bg-[var(--bg-input)]/30 border-b-transparent' : ''} ${selected.has(tx.id) ? '!bg-blue-500/10' : ''}`}
                                    onClick={() => toggleExpand(tx.id)}
                                >
                                    <div className="flex justify-center" onClick={e => { e.stopPropagation(); toggleSelect(tx.id); }}>
                                        {selected.has(tx.id) ? <CheckSquare size={14} className="text-blue-600" /> : <Square size={14} className="text-[var(--ink)]/30" />}
                                    </div>
                                    <div className="flex justify-center text-[var(--ink)]/40">
                                        {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                                    </div>
                                    <div className="font-mono text-[11px] text-[var(--ink)]/70 font-semibold">
                                        {fmtLima(tx.date, { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })}
                                    </div>
                                    <div>
                                        <span className={`text-[9px] uppercase font-bold tracking-wider py-0.5 px-2 rounded-md ${badgeStyle}`}>
                                            {tx.type === 'RECEPTION' ? 'RECEP.' : tx.type === 'DISPATCH' ? 'DESP.' : 'TRANSF.'}
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                                        <span className="font-bold text-[var(--ink)] truncate">{product?.name || '—'}</span>
                                        <span className="font-mono text-[10px] text-[var(--ink)]/50 truncate">
                                            {product?.code}{modelParts ? ` · ${modelParts}` : ''}
                                        </span>
                                    </div>
                                    <div className={`font-mono text-right text-sm font-black pr-2 ${tx.type === 'DISPATCH' ? 'text-violet-600 dark:text-violet-400' : tx.type === 'RECEPTION' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                        {tx.type === 'DISPATCH' ? '-' : tx.type === 'RECEPTION' ? '+' : ''}{tx.quantity}
                                    </div>
                                    <div className="font-medium text-[var(--ink)]/70 truncate pl-2">
                                        {fromLoc?.name || '—'}
                                    </div>
                                    <div className="font-medium text-[var(--ink)]/70 truncate">
                                        {toLoc?.name || '—'}
                                    </div>
                                    <div className="font-medium text-[var(--ink)]/70 truncate">
                                        {contact?.name || '—'}
                                    </div>
                                    <div className="font-mono font-semibold text-[var(--ink)]/70 truncate">
                                        {tx.reference}
                                    </div>
                                </div>
                                {isExpanded && (
                                    <div className="bg-[var(--bg-input)]/25 border-b border-[var(--border-soft)] p-5 pl-[48px] animate-in fade-in duration-150">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]/40">Operador</span>
                                                <span className="text-xs font-bold font-mono text-[var(--ink)]">{tx.user || 'OPERATOR_01'}</span>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]/40">Ubicación Origen</span>
                                                <span className="text-xs font-semibold text-[var(--ink)]">{fromLoc ? fromLoc.name : (tx.fromLocationId ? 'N/A' : '—')}</span>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]/40">Ubicación Destino</span>
                                                <span className="text-xs font-semibold text-[var(--ink)]">{toLoc ? toLoc.name : (tx.toLocationId ? 'N/A' : '—')}</span>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]/40">Estado de Operación</span>
                                                <span className={`text-xs font-bold ${
                                                    tx.status === 'COMPLETED' ? 'text-emerald-500' :
                                                    tx.status === 'PREPARING' ? 'text-blue-500' :
                                                    tx.status === 'CANCELLED' ? 'text-red-500' :
                                                    'text-amber-500'
                                                }`}>
                                                    {tx.status}
                                                </span>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]/40">ID Transacción</span>
                                                <span className="text-[11px] font-mono font-bold text-[var(--ink)] bg-[var(--surface)] px-2 py-1 rounded-lg border border-[var(--border-soft)] w-fit truncate max-w-full" title={tx.id}>
                                                    {tx.id}
                                                </span>
                                            </div>
                                            {tx.contactId && (
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]/40">
                                                        {tx.type === 'RECEPTION' ? 'Proveedor' : 'Cliente / Receptor'}
                                                    </span>
                                                    <span className="text-xs font-bold text-[var(--ink)] truncate">
                                                        {contacts.find(c => c.id === tx.contactId)?.name || '—'}
                                                    </span>
                                                </div>
                                            )}
                                            {tx.serialNumber && (
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]/40">Lote / Serie</span>
                                                    <span className="text-xs font-mono font-bold text-[var(--ink)]">{tx.serialNumber}</span>
                                                </div>
                                            )}
                                            <div className="flex items-center justify-start md:justify-end">
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const ticktHTML = `
                                                            <div style="font-family: monospace; font-size: 12px; width: 300px; padding: 20px; border: 1px solid black; margin: auto;">
                                                                <h2 style="text-align: center; margin-bottom: 20px;">TICKET DE OPERACION</h2>
                                                                <p><strong>ID:</strong> ${tx.id}</p>
                                                                <p><strong>TIPO:</strong> ${tx.type}</p>
                                                                <p><strong>FECHA:</strong> ${fmtLima(tx.date, { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit' })}</p>
                                                                <hr style="border:1px dashed black; margin: 10px 0;" />
                                                                <p><strong>MERCADERIA:</strong> ${product?.name || '---'}</p>
                                                                <p><strong>CODIGO:</strong> ${product?.code || '---'}</p>
                                                                <p><strong>CANTIDAD:</strong> ${tx.type === 'DISPATCH' ? '-' : '+'}${tx.quantity}</p>
                                                                <hr style="border:1px dashed black; margin: 10px 0;" />
                                                                <p><strong>ORIGEN:</strong> ${fromLoc?.name || '---'}</p>
                                                                <p><strong>DESTINO:</strong> ${toLoc?.name || '---'}</p>
                                                                <p><strong>REFERENCIA:</strong> ${tx.reference}</p>
                                                                ${tx.serialNumber ? `<p><strong>LOTE/SERIE:</strong> ${tx.serialNumber}</p>` : ''}
                                                                <p><strong>OPERADOR:</strong> ${tx.user || 'OPERATOR_01'}</p>
                                                                ${tx.signature ? `<div style="text-align:center; margin-top:20px;">
                                                                    <p><strong>FIRMA:</strong></p>
                                                                    <img src="${tx.signature}" style="max-height: 60px; max-width: 200px;" />
                                                                </div>` : ''}
                                                            </div>
                                                        `;
                                                        
                                                        const printWindow = window.open('', '_blank');
                                                        if (printWindow) {
                                                            printWindow.document.write('<html><head><title>Ticket PDF</title></head><body onload="window.print();window.close()">' + ticktHTML + '</body></html>');
                                                            printWindow.document.close();
                                                        }
                                                    }}
                                                    className="modern-btn-primary px-3.5 py-2 text-xs flex items-center gap-1.5 uppercase"
                                                >
                                                    <FileText size={14} />
                                                    <span>Ticket PDF</span>
                                                </button>
                                            </div>
                                            {tx.signature && (
                                                <div className="flex flex-col gap-1.5 col-span-full pt-2">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]/40">Firma Digital Registrada</span>
                                                    <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-xl p-2.5 inline-block w-fit shadow-sm">
                                                        <img src={tx.signature} alt="Firma de la operación" className="h-16 object-contain" />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </React.Fragment>
                        );
                    })}
                    {filteredTransactions.length === 0 && (
                        <div className="p-16 text-center text-xs font-semibold text-[var(--ink)]/50 uppercase tracking-wider">
                            No existen registros con los filtros seleccionados
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
