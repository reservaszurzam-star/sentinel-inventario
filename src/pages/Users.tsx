import React, { useState } from 'react';
import { useAppContext } from '../store/AppContext';
import { ModuleInfo } from '../components/ModuleInfo';
import {
  Plus, Trash2, Edit2, ShieldCheck, TrendingUp, Settings,
  Warehouse, Mail, Users as UsersIcon, Lock, Bell, X, Truck, Radio,
  CheckCircle2, AlertTriangle, Shield
} from 'lucide-react';
import { UserWithPassword, Role, NotificationSubscriber } from '../types';
import { canEdit, Permission } from '../lib/permissions';
import { TutorialModal, USERS_TUTORIAL_STEPS } from '../components/TutorialModal';

const ROLE_LABELS: Record<Role, string> = {
  ADMIN_GENERAL: 'Admin General',
  CEO: 'CEO',
  ADMINISTRADOR: 'Administrador',
  JEFE_ALMACEN: 'Jefe Almacén',
  DESPACHADOR: 'Despachador',
  LIVEX: 'Livex',
};

const ROLE_BADGE_STYLE: Record<Role, { bg: string; text: string; border: string }> = {
  ADMIN_GENERAL: { bg: 'bg-slate-900 dark:bg-slate-100', text: 'text-white dark:text-slate-900', border: 'border-slate-800' },
  CEO: { bg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-500/30' },
  ADMINISTRADOR: { bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-500/30' },
  JEFE_ALMACEN: { bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-500/30' },
  DESPACHADOR: { bg: 'bg-teal-500/10 text-teal-600 dark:text-teal-400', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-500/30' },
  LIVEX: { bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-500/30' },
};

const ROLE_ABBR: Record<Role, string> = {
  ADMIN_GENERAL: 'AG',
  CEO: 'CEO',
  ADMINISTRADOR: 'AD',
  JEFE_ALMACEN: 'JA',
  DESPACHADOR: 'DE',
  LIVEX: 'LX',
};

const RoleIcon = ({ role, size = 14 }: { role: Role; size?: number }) => {
  if (role === 'ADMIN_GENERAL') return <ShieldCheck size={size} />;
  if (role === 'CEO') return <TrendingUp size={size} />;
  if (role === 'ADMINISTRADOR') return <Settings size={size} />;
  if (role === 'DESPACHADOR') return <Truck size={size} />;
  if (role === 'LIVEX') return <Radio size={size} />;
  return <Warehouse size={size} />;
};

const PERM_LABEL: Record<Permission, string> = { full: 'TOTAL', view: 'VER', none: '-' };
const PERM_STYLE: Record<Permission, string> = {
  full: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 shadow-xs font-semibold',
  view: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30 font-medium',
  none: 'bg-[var(--surface-alt)]/40 text-[var(--ink)]/25 border-transparent opacity-60',
};

const MODULE_GROUPS: { label: string; modules: { key: string; label: string }[] }[] = [
  {
    label: 'Principal',
    modules: [
      { key: 'dashboard', label: 'Dashboard' },
      { key: 'analysis', label: 'Análisis' },
      { key: 'reports', label: 'Reportes' },
    ],
  },
  {
    label: 'Almacén',
    modules: [
      { key: 'inventory', label: 'Inventario' },
      { key: 'reservations', label: 'Reservas' },
      { key: 'locations', label: 'Ubicaciones' },
      { key: 'warehouse-map', label: 'Mapa Almacén' },
      { key: 'labels', label: 'Etiquetas QR' },
      { key: 'livex-feed', label: 'Livex' },
    ],
  },
  {
    label: 'Operaciones',
    modules: [
      { key: 'operations', label: 'Operaciones' },
      { key: 'adjustments', label: 'Ajustes' },
      { key: 'purchase-orders', label: 'Órdenes OC' },
      { key: 'history', label: 'Historial' },
      { key: 'operation-history', label: 'Auditoría Sistema' },
    ],
  },
  {
    label: 'Administración',
    modules: [
      { key: 'contacts', label: 'Contactos' },
      { key: 'users', label: 'Usuarios' },
    ],
  },
];

const emptyForm = { username: '', password: '', email: '', role: 'JEFE_ALMACEN' as Role, active: true };

type Tab = 'usuarios' | 'permisos' | 'notificaciones';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'usuarios', label: 'Usuarios', icon: UsersIcon },
  { id: 'permisos', label: 'Matriz de Permisos', icon: Lock },
  { id: 'notificaciones', label: 'Alertas por Email', icon: Bell },
];

export const Users: React.FC = () => {
  const {
    users, addUser, updateUser, deleteUser, currentUser,
    rolePermissions, updateRolePermission,
    notificationSubscribers, addSubscriber, updateSubscriber, deleteSubscriber,
  } = useAppContext();

  const [activeTab, setActiveTab] = useState<Tab>('usuarios');
  const [showTutorial, setShowTutorial] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<UserWithPassword | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [userError, setUserError] = useState('');
  const [userSubmitting, setUserSubmitting] = useState(false);

  const [showSubModal, setShowSubModal] = useState(false);
  const [editingSub, setEditingSub] = useState<NotificationSubscriber | null>(null);
  const [subForm, setSubForm] = useState({ name: '', email: '', active: true });
  const [confirmDeleteSub, setConfirmDeleteSub] = useState<string | null>(null);
  const [subError, setSubError] = useState('');

  const isAdmin = canEdit(currentUser.role, 'users');
  const isAdminGeneral = currentUser.role === 'ADMIN_GENERAL';
  const roles: Role[] = ['ADMIN_GENERAL', 'CEO', 'ADMINISTRADOR', 'JEFE_ALMACEN', 'DESPACHADOR', 'LIVEX'];

  const openAdd = () => { setEditing(null); setForm(emptyForm); setUserError(''); setShowModal(true); };
  const openEdit = (u: UserWithPassword) => {
    setEditing(u);
    setForm({ username: u.username, password: '', email: u.email || '', role: u.role, active: u.active });
    setUserError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError('');
    if (!form.username) { setUserError('El nombre de usuario es obligatorio.'); return; }
    if (!editing && !form.email) { setUserError('El email es obligatorio para crear un usuario.'); return; }
    if (!editing && !form.password) { setUserError('La contraseña es obligatoria.'); return; }
    setUserSubmitting(true);
    try {
      if (editing) await updateUser({ ...editing, ...form, password: editing.password }, form.password || undefined);
      else await addUser(form);
      setShowModal(false);
    } catch (err) {
      setUserError(err instanceof Error ? err.message : 'Error al guardar el usuario');
    } finally {
      setUserSubmitting(false);
    }
  };

  const handleDelete = (id: string) => { if (id === 'u1') return; deleteUser(id); setConfirmDelete(null); };

  const openAddSub = () => { setEditingSub(null); setSubForm({ name: '', email: '', active: true }); setSubError(''); setShowSubModal(true); };
  const openEditSub = (s: NotificationSubscriber) => {
    setEditingSub(s);
    setSubForm({ name: s.name, email: s.email, active: s.active });
    setSubError('');
    setShowSubModal(true);
  };

  const handleSubmitSub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subForm.name.trim() || !subForm.email.trim()) return;
    try {
      if (editingSub) await updateSubscriber({ id: editingSub.id, ...subForm });
      else await addSubscriber(subForm);
      setShowSubModal(false);
    } catch (err) {
      setSubError(err instanceof Error ? err.message : 'Error al guardar');
    }
  };

  const handleDeleteSub = async (id: string) => {
    try { await deleteSubscriber(id); setConfirmDeleteSub(null); }
    catch { setConfirmDeleteSub(null); }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-12 animate-fade-in">
      <TutorialModal open={showTutorial} onClose={() => setShowTutorial(false)} steps={USERS_TUTORIAL_STEPS} title="Usuarios" />

      {/* Module Header */}
      <ModuleInfo
        number="12"
        title="Usuarios & Permisos"
        description="Administración de cuentas de acceso, matriz de permisos RBAC y distribución de alertas por email."
        onTutorial={() => setShowTutorial(true)}
      />

      {/* Modern Segmented Navigation Tabs */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex p-1.5 bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl shadow-xs gap-1.5 w-full sm:w-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-mono text-[11px] font-bold tracking-wider uppercase transition-all duration-200 flex-1 sm:flex-initial
                  ${isActive
                    ? 'bg-[var(--ink)] text-[var(--ink-inv)] shadow-sm'
                    : 'text-[var(--ink)]/60 hover:text-[var(--ink)] hover:bg-[var(--surface-alt)]'
                  }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
                {tab.id === 'usuarios' && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold
                    ${isActive ? 'bg-[var(--surface-alt)] text-[var(--ink)]' : 'bg-[var(--ink)]/5 text-[var(--ink)]/60'}`}>
                    {users.length}
                  </span>
                )}
                {tab.id === 'notificaciones' && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono font-bold
                    ${isActive ? 'bg-[var(--surface-alt)] text-[var(--ink)]' : 'bg-[var(--ink)]/5 text-[var(--ink)]/60'}`}>
                    {notificationSubscribers.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {activeTab === 'usuarios' && isAdmin && (
          <button
            onClick={openAdd}
            className="modern-btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-xs"
          >
            <Plus size={15} />
            <span>Nuevo Usuario</span>
          </button>
        )}

        {activeTab === 'notificaciones' && isAdminGeneral && (
          <button
            onClick={openAddSub}
            className="modern-btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-xs"
          >
            <Plus size={15} />
            <span>Nuevo Destinatario</span>
          </button>
        )}
      </div>

      {/* Main Container Card */}
      <div className="modern-card p-6 md:p-8 rounded-3xl">

        {/* Tab 1: Usuarios */}
        {activeTab === 'usuarios' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-soft)]">
              <div>
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--ink)]">Usuarios del Sistema</h3>
                <p className="font-mono text-[10px] text-[var(--ink)]/40 mt-0.5">
                  {users.filter(u => u.active).length} activos de {users.length} registrados
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
              {users.map(u => {
                const badge = ROLE_BADGE_STYLE[u.role];
                return (
                  <div
                    key={u.id}
                    className={`group relative flex flex-col justify-between p-5 rounded-2xl border transition-all duration-200
                      ${u.active
                        ? 'bg-[var(--surface)] border-[var(--border-soft)] hover:border-[var(--ink)]/30 hover:shadow-md'
                        : 'bg-[var(--surface-alt)]/50 border-[var(--border-soft)] opacity-60'
                      }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${badge.border} ${badge.bg} ${badge.text}`}>
                            <RoleIcon role={u.role} size={18} />
                          </div>
                          <div>
                            <span className="font-mono font-bold text-sm text-[var(--ink)] block truncate">
                              {u.username}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[9px] font-bold border ${badge.border} ${badge.bg} ${badge.text}`}>
                                {ROLE_LABELS[u.role]}
                              </span>
                            </div>
                          </div>
                        </div>

                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[9px] font-semibold
                          ${u.active
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                          }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${u.active ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                          {u.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>

                      {u.email ? (
                        <div className="flex items-center gap-1.5 text-[var(--ink)]/60 font-mono text-[11px] truncate bg-[var(--surface-alt)]/50 px-2.5 py-1.5 rounded-lg border border-[var(--border-soft)]">
                          <Mail size={12} className="shrink-0 text-[var(--ink)]/40" />
                          <span className="truncate">{u.email}</span>
                        </div>
                      ) : (
                        <div className="text-[var(--ink)]/30 font-mono text-[11px] italic px-1">Sin email registrado</div>
                      )}
                    </div>

                    {isAdmin && u.id !== 'u1' && (
                      <div className="flex items-center justify-end gap-1.5 pt-4 mt-3 border-t border-[var(--border-soft)]">
                        <button
                          onClick={() => openEdit(u)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-[10px] font-bold text-[var(--ink)]/70 hover:text-[var(--ink)] bg-[var(--surface-alt)] hover:bg-[var(--ink)]/10 transition-colors"
                        >
                          <Edit2 size={12} />
                          <span>Editar</span>
                        </button>
                        <button
                          onClick={() => setConfirmDelete(u.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 size={12} />
                          <span>Eliminar</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Matriz de Permisos */}
        {activeTab === 'permisos' && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
              <Shield className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={18} />
              <div>
                <p className="font-mono text-xs font-bold text-amber-900 dark:text-amber-200">
                  Control de Acceso Basado en Roles (RBAC)
                </p>
                <p className="font-mono text-[10px] text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                  Haz clic en cualquier celda para alternar el nivel de acceso (TOTAL → VER → SIN ACCESO). Los cambios se aplican en tiempo real.
                </p>
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block data-table-container rounded-2xl border border-[var(--border-soft)] shadow-sm overflow-hidden">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-[var(--border-soft)] bg-[var(--surface-alt)]/60">
                    <th className="text-left py-3.5 px-4 font-mono text-[10px] font-bold tracking-wider uppercase text-[var(--ink)]/50 w-52">
                      Módulo del Sistema
                    </th>
                    {roles.map(r => {
                      const badge = ROLE_BADGE_STYLE[r];
                      return (
                        <th key={r} className="py-3 px-3 text-center min-w-[110px]">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-lg border ${badge.border} ${badge.bg} ${badge.text}`}>
                            <RoleIcon role={r} size={12} />
                            <span>{ROLE_LABELS[r].toUpperCase()}</span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-soft)]">
                  {MODULE_GROUPS.map(group => (
                    <React.Fragment key={group.label}>
                      <tr className="bg-[var(--surface-alt)]/30">
                        <td colSpan={roles.length + 1} className="py-2.5 px-4">
                          <span className="font-mono text-[10px] font-black tracking-widest uppercase text-[var(--ink)]/40">
                            • {group.label}
                          </span>
                        </td>
                      </tr>
                      {group.modules.map(mod => (
                        <tr key={mod.key} className="hover:bg-[var(--surface-alt)]/40 transition-colors">
                          <td className="py-2.5 px-4 font-medium text-[var(--ink)]">
                            {mod.label}
                          </td>
                          {roles.map(r => {
                            const perm: Permission = (rolePermissions[r]?.[mod.key] ?? 'none') as Permission;
                            const isEditable = isAdmin && r !== 'ADMIN_GENERAL';
                            const cycle: Permission[] = ['none', 'view', 'full'];
                            return (
                              <td key={r} className="text-center py-2 px-2">
                                <button
                                  onClick={() => {
                                    if (!isEditable) return;
                                    updateRolePermission(r, mod.key, cycle[(cycle.indexOf(perm) + 1) % cycle.length]);
                                  }}
                                  disabled={!isEditable}
                                  className={`w-20 py-1.5 rounded-lg border text-[10px] font-mono tracking-wider transition-all duration-150
                                    ${PERM_STYLE[perm]}
                                    ${isEditable
                                      ? 'cursor-pointer hover:scale-105 active:scale-95 hover:shadow-xs'
                                      : 'cursor-default'
                                    }`}
                                >
                                  {PERM_LABEL[perm]}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="lg:hidden space-y-4">
              {MODULE_GROUPS.map(group => (
                <div key={group.label} className="space-y-2">
                  <div className="font-mono text-[10px] font-black tracking-wider uppercase text-[var(--ink)]/40 px-1">
                    • {group.label}
                  </div>
                  <div className="space-y-2">
                    {group.modules.map(mod => (
                      <div key={mod.key} className="border border-[var(--border-soft)] bg-[var(--surface)] p-3.5 rounded-xl">
                        <div className="font-mono text-xs font-bold text-[var(--ink)] mb-2.5">
                          {mod.label}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {roles.map(r => {
                            const perm: Permission = (rolePermissions[r]?.[mod.key] ?? 'none') as Permission;
                            const isEditable = isAdmin && r !== 'ADMIN_GENERAL';
                            const cycle: Permission[] = ['none', 'view', 'full'];
                            const badge = ROLE_BADGE_STYLE[r];
                            return (
                              <button
                                key={r}
                                onClick={() => {
                                  if (!isEditable) return;
                                  updateRolePermission(r, mod.key, cycle[(cycle.indexOf(perm) + 1) % cycle.length]);
                                }}
                                disabled={!isEditable}
                                className={`flex items-center justify-between gap-1.5 p-2 rounded-xl border transition-all
                                  ${isEditable ? 'active:scale-95' : 'cursor-default'}
                                  ${perm === 'none'
                                    ? 'border-[var(--border-soft)] bg-[var(--surface-alt)]/30'
                                    : 'border-[var(--border-soft)] bg-[var(--surface)]'
                                  }`}
                              >
                                <div className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${badge.border} ${badge.bg} ${badge.text}`}>
                                  <RoleIcon role={r} size={10} />
                                  <span>{ROLE_ABBR[r]}</span>
                                </div>
                                <span className={`font-mono text-[9px] px-2 py-0.5 rounded-md border ${PERM_STYLE[perm]}`}>
                                  {PERM_LABEL[perm]}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Permissions Legend */}
            <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-[var(--border-soft)]">
              {(['full', 'view', 'none'] as Permission[]).map(p => (
                <div key={p} className="flex items-center gap-2">
                  <span className={`font-mono text-[10px] px-2.5 py-1 rounded-lg border ${PERM_STYLE[p]}`}>
                    {PERM_LABEL[p]}
                  </span>
                  <span className="font-mono text-[10px] text-[var(--ink)]/50 uppercase tracking-wider">
                    {p === 'full' ? 'Acceso Total' : p === 'view' ? 'Solo Lectura' : 'Sin Acceso'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Alertas por Email */}
        {activeTab === 'notificaciones' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-soft)]">
              <div>
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--ink)]">Destinatarios de Alertas</h3>
                <p className="font-mono text-[10px] text-[var(--ink)]/40 mt-0.5">
                  Reciben copia automática de cada orden de compra y comprobante de despacho/recepción
                </p>
              </div>
            </div>

            {notificationSubscribers.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="w-12 h-12 rounded-2xl bg-[var(--surface-alt)] flex items-center justify-center text-[var(--ink)]/30">
                  <Mail size={24} />
                </div>
                <div>
                  <h4 className="font-mono text-sm font-bold text-[var(--ink)]">No hay destinatarios registrados</h4>
                  <p className="font-mono text-[11px] text-[var(--ink)]/40 mt-0.5 max-w-sm">
                    Agrega emails para que reciban avisos automáticos de recepciones y despachos.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
                {notificationSubscribers.map(s => (
                  <div
                    key={s.id}
                    className={`flex flex-col justify-between p-5 rounded-2xl border transition-all duration-200
                      ${s.active
                        ? 'bg-[var(--surface)] border-[var(--border-soft)] hover:shadow-md'
                        : 'bg-[var(--surface-alt)]/50 border-[var(--border-soft)] opacity-60'
                      }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0">
                            <Mail size={16} />
                          </div>
                          <div>
                            <span className="font-mono font-bold text-sm text-[var(--ink)] block truncate">
                              {s.name}
                            </span>
                            <span className="font-mono text-[11px] text-[var(--ink)]/50 truncate block mt-0.5">
                              {s.email}
                            </span>
                          </div>
                        </div>

                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[9px] font-semibold
                          ${s.active
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                          }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.active ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                          {s.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                    </div>

                    {isAdminGeneral && (
                      <div className="flex items-center justify-end gap-1.5 pt-3 mt-3 border-t border-[var(--border-soft)]">
                        <button
                          onClick={() => openEditSub(s)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-[10px] font-bold text-[var(--ink)]/70 hover:text-[var(--ink)] bg-[var(--surface-alt)] hover:bg-[var(--ink)]/10 transition-colors"
                        >
                          <Edit2 size={12} />
                          <span>Editar</span>
                        </button>
                        <button
                          onClick={() => setConfirmDeleteSub(s.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 size={12} />
                          <span>Eliminar</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Modal Usuario */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
            <div className="px-6 py-4.5 border-b border-[var(--border-soft)] flex justify-between items-center bg-[var(--surface-alt)]/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[var(--ink)] text-[var(--ink-inv)] flex items-center justify-center">
                  <UsersIcon size={16} />
                </div>
                <div>
                  <h3 className="font-mono font-bold text-sm text-[var(--ink)]">
                    {editing ? 'Editar Usuario' : 'Nuevo Usuario'}
                  </h3>
                  <p className="font-mono text-[10px] text-[var(--ink)]/40">
                    {editing ? 'Modifica los datos y credenciales' : 'Registra un nuevo usuario en el sistema'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-[var(--ink)]/40 hover:text-[var(--ink)] hover:bg-[var(--surface-alt)] rounded-xl transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {userError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 font-mono text-xs">
                  <AlertTriangle size={15} className="shrink-0" />
                  <span>{userError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]/60">
                  Nombre de Usuario *
                </label>
                <input
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="ej. jsmith"
                  className="input-technical rounded-xl text-xs py-2.5"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]/60">
                  Correo Electrónico {editing ? '(opcional)' : '*'}
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="usuario@empresa.com"
                  className="input-technical rounded-xl text-xs py-2.5"
                  required={!editing}
                />
              </div>

              <div className="space-y-1">
                <label className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]/60">
                  Contraseña {editing ? '(dejar vacío para no cambiar)' : '*'}
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder={editing ? '••••••••' : '••••••••'}
                    className="input-technical rounded-xl text-xs py-2.5 pr-14"
                    required={!editing}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] font-bold text-[var(--ink)]/40 hover:text-[var(--ink)] transition-colors"
                  >
                    {showPass ? 'OCULTAR' : 'VER'}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]/60">
                  Rol y Permisos
                </label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}
                  className="input-technical rounded-xl text-xs py-2.5 cursor-pointer"
                >
                  {roles.map(r => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="active"
                  checked={form.active}
                  onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="active" className="font-mono text-xs font-semibold text-[var(--ink)] cursor-pointer select-none">
                  Cuenta Activa
                </label>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-[var(--border-soft)]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={userSubmitting}
                  className="flex-1 py-2.5 rounded-xl border border-[var(--border-soft)] hover:bg-[var(--surface-alt)] font-mono text-xs font-bold text-[var(--ink)]/70 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={userSubmitting}
                  className="flex-1 modern-btn-primary py-2.5 rounded-xl text-xs shadow-xs"
                >
                  {userSubmitting ? 'Guardando...' : (editing ? 'Guardar Cambios' : 'Crear Usuario')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Destinatario de Alertas */}
      {showSubModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in">
            <div className="px-6 py-4 border-b border-[var(--border-soft)] flex justify-between items-center bg-[var(--surface-alt)]/50">
              <div className="flex items-center gap-2">
                <Mail size={16} className="text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-mono font-bold text-sm text-[var(--ink)]">
                  {editingSub ? 'Editar Destinatario' : 'Nuevo Destinatario'}
                </h3>
              </div>
              <button
                onClick={() => setShowSubModal(false)}
                className="p-1.5 text-[var(--ink)]/40 hover:text-[var(--ink)] hover:bg-[var(--surface-alt)] rounded-xl transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitSub} className="p-6 space-y-4">
              {subError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 font-mono text-xs">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>{subError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]/60">
                  Nombre Completo *
                </label>
                <input
                  value={subForm.name}
                  onChange={e => setSubForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="ej. Gerencia Operaciones"
                  className="input-technical rounded-xl text-xs py-2.5"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--ink)]/60">
                  Correo Electrónico *
                </label>
                <input
                  type="email"
                  value={subForm.email}
                  onChange={e => setSubForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="almacen@empresa.com"
                  className="input-technical rounded-xl text-xs py-2.5"
                  required
                />
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="sub-active"
                  checked={subForm.active}
                  onChange={e => setSubForm(f => ({ ...f, active: e.target.checked }))}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="sub-active" className="font-mono text-xs font-semibold text-[var(--ink)] cursor-pointer select-none">
                  Recepción Activa
                </label>
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-[var(--border-soft)]">
                <button
                  type="button"
                  onClick={() => setShowSubModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[var(--border-soft)] hover:bg-[var(--surface-alt)] font-mono text-xs font-bold text-[var(--ink)]/70 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 modern-btn-primary py-2.5 rounded-xl text-xs shadow-xs"
                >
                  {editingSub ? 'Guardar' : 'Agregar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminación Usuario */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-3xl shadow-2xl p-6 max-w-sm w-full space-y-4 animate-scale-in">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
              <Trash2 size={24} />
            </div>
            <div>
              <h4 className="font-mono font-bold text-sm text-[var(--ink)]">¿Eliminar este usuario?</h4>
              <p className="font-mono text-xs text-[var(--ink)]/50 mt-1">
                Esta acción no se puede deshacer y revocará sus permisos de acceso inmediatamente.
              </p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-[var(--border-soft)] hover:bg-[var(--surface-alt)] font-mono text-xs font-bold text-[var(--ink)]/70 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-2.5 rounded-xl font-mono text-xs font-bold transition-colors shadow-xs"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminación Destinatario */}
      {confirmDeleteSub && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-3xl shadow-2xl p-6 max-w-sm w-full space-y-4 animate-scale-in">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
              <Trash2 size={24} />
            </div>
            <div>
              <h4 className="font-mono font-bold text-sm text-[var(--ink)]">¿Eliminar destinatario?</h4>
              <p className="font-mono text-xs text-[var(--ink)]/50 mt-1">
                Dejará de recibir alertas y notificaciones por correo electrónico.
              </p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setConfirmDeleteSub(null)}
                className="flex-1 py-2.5 rounded-xl border border-[var(--border-soft)] hover:bg-[var(--surface-alt)] font-mono text-xs font-bold text-[var(--ink)]/70 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteSub(confirmDeleteSub)}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-2.5 rounded-xl font-mono text-xs font-bold transition-colors shadow-xs"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
