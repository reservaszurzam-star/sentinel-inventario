import React, { useState } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import { Search, Plus, Trash2, Edit2, History, X, AlertTriangle, Users, Building, Phone, Mail, FileText } from 'lucide-react';
import { Contact } from '../types';
import { format } from 'date-fns';
import { TutorialModal, CONTACTS_TUTORIAL_STEPS } from '../components/TutorialModal';

export const Contacts: React.FC = () => {
  const { contacts, addContact, updateContact, deleteContact, transactions, products } = useAppContext();
  const [showTutorial, setShowTutorial] = useState(false);
  const [historyContact, setHistoryContact] = useState<Contact | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  
  const [showModal, setShowModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<{type: 'SUPPLIER'|'CLIENT', name: string, document: string, phone: string, email: string}>({
    type: 'SUPPLIER', name: '', document: '', phone: '', email: ''
  });

  const filteredContacts = contacts.filter(c => {
    const searchMatch = c.name.toLowerCase().includes(search.toLowerCase()) || c.document.toLowerCase().includes(search.toLowerCase());
    const typeMatch = filterType === 'ALL' || c.type === filterType;
    return searchMatch && typeMatch;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.document) return;
    
    if (editingContact) {
      updateContact({ ...editingContact, ...formData });
    } else {
      addContact(formData);
    }
    
    setShowModal(false);
    setEditingContact(null);
    setFormData({ type: 'SUPPLIER', name: '', document: '', phone: '', email: '' });
  };

  const openEdit = (c: Contact) => {
    setEditingContact(c);
    setFormData({
      type: c.type,
      name: c.name,
      document: c.document,
      phone: c.phone || '',
      email: c.email || ''
    });
    setShowModal(true);
  };

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 pb-12">
      <TutorialModal open={showTutorial} onClose={() => setShowTutorial(false)} steps={CONTACTS_TUTORIAL_STEPS} title="Contactos" />
      
      {/* Modern Hero Module Header */}
      <ModuleInfo 
        number="11" 
        title="Directorio de Contactos" 
        description="Gestión integral de proveedores y clientes vinculados a las operaciones del almacén: datos de contacto, RUC/DNI y trazabilidad histórica de compras y despachos." 
        onTutorial={() => setShowTutorial(true)} 
      />

      {/* Modern Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl p-3.5 shadow-sm">
        <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-[var(--bg-input)] border border-[var(--border-soft)] px-3 py-2 text-xs font-bold text-[var(--ink)] rounded-xl focus:outline-none focus:border-blue-500 uppercase cursor-pointer"
          >
            <option value="ALL">TODOS LOS TIPOS</option>
            <option value="SUPPLIER">PROVEEDORES</option>
            <option value="CLIENT">CLIENTES</option>
          </select>

          <div className="relative flex-1 sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink)]/40 pointer-events-none" />
            <input 
              type="text" 
              placeholder="BUSCAR NOMBRE O RUC..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] pl-8 pr-3 py-2 text-xs font-semibold rounded-xl focus:outline-none focus:border-blue-500 uppercase placeholder:normal-case"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--ink)]/40 hover:text-[var(--ink)]">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        <button 
          onClick={() => {
            setEditingContact(null);
            setFormData({ type: 'SUPPLIER', name: '', document: '', phone: '', email: '' });
            setShowModal(true);
          }}
          className="modern-btn-primary px-4 py-2 text-xs flex items-center gap-1.5 uppercase shrink-0"
        >
          <Plus size={14} />
          <span>Nuevo Contacto</span>
        </button>
      </div>

      {/* Main Contacts Table */}
      <div className="data-table-container bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl overflow-hidden shadow-sm flex flex-col">
        <div className="grid grid-cols-[110px_minmax(160px,1.2fr)_130px_130px_minmax(160px,1fr)_110px] data-header sticky top-0 bg-[var(--bg-input)]/70 border-b border-[var(--border-soft)] py-2.5 px-3">
          <div className="text-[10px] font-bold uppercase text-[var(--ink)]/50">TIPO</div>
          <div className="text-[10px] font-bold uppercase text-[var(--ink)]/50">EMPRESA / CLIENTE</div>
          <div className="text-[10px] font-bold uppercase text-[var(--ink)]/50">RUC / DNI</div>
          <div className="text-[10px] font-bold uppercase text-[var(--ink)]/50">TELÉFONO</div>
          <div className="text-[10px] font-bold uppercase text-[var(--ink)]/50">CORREO</div>
          <div className="text-right text-[10px] font-bold uppercase text-[var(--ink)]/50 pr-2">ACCIONES</div>
        </div>
        
        <div className="overflow-y-auto">
          {filteredContacts.map(c => (
            <div key={c.id} className="grid grid-cols-[110px_minmax(160px,1.2fr)_130px_130px_minmax(160px,1fr)_110px] items-center py-3 px-3 border-b border-[var(--border-soft)]/50 hover:bg-[var(--bg-input)]/30 transition-colors text-xs">
              <div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${
                  c.type === 'SUPPLIER' 
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20' 
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                }`}>
                  {c.type === 'SUPPLIER' ? 'PROVEEDOR' : 'CLIENTE'}
                </span>
              </div>
              <div className="font-bold text-[var(--ink)] truncate pr-2 flex items-center gap-1.5">
                {c.type === 'SUPPLIER' ? <Building size={14} className="text-blue-500 shrink-0" /> : <Users size={14} className="text-emerald-500 shrink-0" />}
                <span className="truncate">{c.name}</span>
              </div>
              <div className="font-mono text-[11px] font-semibold text-[var(--ink)]/80">{c.document}</div>
              <div className="font-medium text-[var(--ink)]/70">{c.phone || '—'}</div>
              <div className="font-medium text-[var(--ink)]/70 truncate pr-2">{c.email || '—'}</div>
              <div className="flex items-center justify-end gap-1.5 pr-1">
                <button 
                  onClick={() => setHistoryContact(c)} 
                  title="Ver historial de operaciones" 
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 transition-colors cursor-pointer"
                >
                  <History size={14} />
                </button>
                <button 
                  onClick={() => openEdit(c)} 
                  title="Editar contacto" 
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--border-soft)] text-[var(--ink)]/70 hover:text-[var(--ink)] transition-colors cursor-pointer"
                >
                  <Edit2 size={14} />
                </button>
                <button 
                  onClick={() => setConfirmDeleteId(c.id)} 
                  title="Eliminar contacto" 
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-500/10 text-red-500 transition-colors cursor-pointer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {filteredContacts.length === 0 && (
            <div className="p-16 text-center text-xs font-semibold text-[var(--ink)]/50 uppercase tracking-wider">
              No hay contactos registrados con los criterios seleccionados
            </div>
          )}
        </div>
      </div>

      {/* History Modal */}
      {historyContact && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border-soft)] shadow-2xl rounded-3xl w-full max-w-2xl max-h-[82vh] flex flex-col overflow-hidden">
            <div className="border-b border-[var(--border-soft)] p-5 flex justify-between items-center bg-[var(--surface)] shrink-0">
              <div>
                <h2 className="text-base font-black text-[var(--ink)] tracking-tight">Historial de Operaciones</h2>
                <p className="text-xs text-[var(--ink)]/50 mt-0.5">{historyContact.name} · {historyContact.document} ({historyContact.type === 'SUPPLIER' ? 'Proveedor' : 'Cliente'})</p>
              </div>
              <button 
                onClick={() => setHistoryContact(null)} 
                className="p-2 hover:bg-[var(--border-soft)] rounded-full transition-colors text-[var(--ink)]/60 hover:text-[var(--ink)]"
              >
                <X size={18} />
              </button>
            </div>
            {(() => {
              const contactTxs = transactions
                .filter(tx => (tx as any).contactId === historyContact.id)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
              const totalReceptions = contactTxs.filter(t => t.type === 'RECEPTION').reduce((s, t) => s + t.quantity, 0);
              const totalDispatches = contactTxs.filter(t => t.type === 'DISPATCH').reduce((s, t) => s + t.quantity, 0);
              return (
                <>
                  <div className="grid grid-cols-3 gap-3 p-4 border-b border-[var(--border-soft)] bg-[var(--bg-input)]/30 shrink-0 text-xs">
                    <div className="bg-[var(--surface)] p-3 rounded-xl border border-[var(--border-soft)]">
                      <span className="text-[10px] uppercase font-bold text-[var(--ink)]/40 block">Recepciones</span>
                      <span className="text-base font-black text-emerald-500">{totalReceptions} u</span>
                    </div>
                    <div className="bg-[var(--surface)] p-3 rounded-xl border border-[var(--border-soft)]">
                      <span className="text-[10px] uppercase font-bold text-[var(--ink)]/40 block">Despachos</span>
                      <span className="text-base font-black text-rose-500">{totalDispatches} u</span>
                    </div>
                    <div className="bg-[var(--surface)] p-3 rounded-xl border border-[var(--border-soft)]">
                      <span className="text-[10px] uppercase font-bold text-[var(--ink)]/40 block">Total Movs</span>
                      <span className="text-base font-black text-[var(--ink)]">{contactTxs.length}</span>
                    </div>
                  </div>
                  <div className="overflow-y-auto flex-1 p-4">
                    {contactTxs.length === 0 ? (
                      <div className="p-12 text-center text-xs font-semibold text-[var(--ink)]/50 uppercase tracking-wider">
                        Sin movimientos registrados con este contacto
                      </div>
                    ) : (
                      <div className="rounded-xl border border-[var(--border-soft)] overflow-hidden">
                        <div className="grid grid-cols-[120px_90px_90px_minmax(120px,1fr)_80px] p-2.5 bg-[var(--bg-input)]/60 text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]/50 border-b border-[var(--border-soft)]">
                          <div>FECHA</div>
                          <div>TIPO</div>
                          <div>SKU</div>
                          <div>PRODUCTO</div>
                          <div className="text-right">CANT.</div>
                        </div>
                        {contactTxs.map(tx => {
                          const prod = products.find(p => p.id === tx.productId);
                          const typeStyle = tx.type === 'RECEPTION' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : tx.type === 'DISPATCH' ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' : 'bg-blue-500/10 text-blue-600 border border-blue-500/20';
                          return (
                            <div key={tx.id} className="grid grid-cols-[120px_90px_90px_minmax(120px,1fr)_80px] items-center py-2 px-3 border-b border-[var(--border-soft)]/40 last:border-none hover:bg-[var(--bg-input)]/20 transition-colors text-xs">
                              <div className="font-mono text-[11px] text-[var(--ink)]/70">{format(new Date(tx.date), 'dd/MM/yy HH:mm')}</div>
                              <div><span className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase ${typeStyle}`}>{tx.type}</span></div>
                              <div className="font-mono text-xs font-bold text-[var(--ink)]">{prod?.code || '—'}</div>
                              <div className="text-xs text-[var(--ink)]/80 truncate pr-2">{prod?.name || tx.reference}</div>
                              <div className="font-mono text-sm font-black text-right text-[var(--ink)]">{tx.quantity}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-red-500/20 shadow-2xl rounded-3xl w-full max-w-sm overflow-hidden">
            <div className="p-5 border-b border-[var(--border-soft)] flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <div>
                <h2 className="text-base font-black text-[var(--ink)] tracking-tight">Confirmar Eliminación</h2>
                <p className="text-xs text-[var(--ink)]/50 mt-0.5">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <p className="text-xs text-[var(--ink)]/80 leading-relaxed">
                ¿Estás seguro de que deseas eliminar este contacto del directorio?
              </p>
              <div className="flex justify-end gap-2.5 mt-2">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="modern-btn px-4 py-2 text-xs uppercase"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => { deleteContact(confirmDeleteId); setConfirmDeleteId(null); }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-xl transition-all uppercase"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New / Edit Contact Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSubmit} className="bg-[var(--surface)] border border-[var(--border-soft)] shadow-2xl rounded-3xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-[var(--border-soft)] flex justify-between items-center">
              <div>
                <h2 className="text-base font-black text-[var(--ink)] tracking-tight">
                  {editingContact ? 'Editar Contacto' : 'Nuevo Contacto'}
                </h2>
                <p className="text-xs text-[var(--ink)]/50 mt-0.5">Registra datos comerciales de la empresa o cliente</p>
              </div>
              <button 
                type="button"
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-[var(--border-soft)] rounded-full transition-colors text-[var(--ink)]/60 hover:text-[var(--ink)]"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]/50">Tipo de Relación *</label>
                <select 
                  value={formData.type}
                  onChange={e => setFormData({...formData, type: e.target.value as 'SUPPLIER'|'CLIENT'})}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3 py-2.5 text-xs font-semibold rounded-xl focus:outline-none focus:border-blue-500 uppercase cursor-pointer"
                >
                  <option value="SUPPLIER">PROVEEDOR</option>
                  <option value="CLIENT">CLIENTE</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]/50">Nombre / Razón Social *</label>
                <input 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3 py-2.5 text-xs font-semibold rounded-xl focus:outline-none focus:border-blue-500 uppercase"
                  placeholder="EJ: TEXTILES DEL SUR S.A.C."
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]/50">RUC / DNI *</label>
                <input 
                  value={formData.document}
                  onChange={e => setFormData({...formData, document: e.target.value})}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3 py-2.5 text-xs font-mono font-bold rounded-xl focus:outline-none focus:border-blue-500 uppercase"
                  placeholder="EJ: 20601234567"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]/50">Teléfono</label>
                  <input 
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3 py-2.5 text-xs font-mono font-semibold rounded-xl focus:outline-none focus:border-blue-500"
                    placeholder="999 888 777"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]/50">Correo Electrónico</label>
                  <input 
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-soft)] px-3 py-2.5 text-xs font-semibold rounded-xl focus:outline-none focus:border-blue-500"
                    placeholder="contacto@empresa.com"
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-2.5 pt-3 border-t border-[var(--border-soft)] mt-2">
                <button 
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="modern-btn px-4 py-2 text-xs uppercase"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="modern-btn-primary px-5 py-2 text-xs uppercase"
                >
                  Guardar Contacto
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
