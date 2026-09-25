import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, ArrowLeftRight, PackageSearch, History, Menu, MapPin, Layers, Users, ShoppingCart, SlidersHorizontal, FileBarChart, QrCode, UserCircle, LayoutGrid, ScrollText, LogOut, ClipboardList, RefreshCw, Boxes, Sun, Moon, Radio, Eye, ChevronsUpDown, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { useAppContext, Brand } from '../store/AppContext';
import { useTheme } from '../store/ThemeContext';
import { canView } from '../lib/permissions';
import type { Role } from '../types';

type NavItem = {
  id: string;
  label: string;
  icon: React.ElementType;
};

const BRAND_ABBR: Record<string, string> = { OVERSHARK: 'OS', BRAVOS: 'BU', BOX_PRIME: 'BP' };
const BRAND_NAME: Record<string, string> = { OVERSHARK: 'OVERSHARK', BRAVOS: 'BRAVOS URBAN', BOX_PRIME: 'BOX PRIME' };
const BRAND_LEGAL: Record<string, string> = { OVERSHARK: 'OVERSHARK PERU S.A.C.', BRAVOS: 'BRAVOS URBAN CO.', BOX_PRIME: 'BOX PRIME PERU' };
const BRAND_ICON: Record<string, string> = { OVERSHARK: '/icon-marca/over-icon.png', BRAVOS: '/icon-marca/brav-icon.png', BOX_PRIME: '/icon-marca/box.icon.png' };

interface BrandMeta {
  id: Brand;
  name: string;
  legal: string;
  icon: string;
  badge: string;
  color: string;
}

const BRANDS_LIST: BrandMeta[] = [
  {
    id: 'OVERSHARK',
    name: 'OVERSHARK',
    legal: 'Overshark Perú S.A.C.',
    icon: '/icon-marca/over-icon.png',
    badge: 'HQ',
    color: '#0284c7'
  },
  {
    id: 'BRAVOS',
    name: 'BRAVOS URBAN',
    legal: 'Bravos Urban Co.',
    icon: '/icon-marca/brav-icon.png',
    badge: 'URBAN',
    color: '#f59e0b'
  },
  {
    id: 'BOX_PRIME',
    name: 'BOX PRIME',
    legal: 'Box Prime Perú',
    icon: '/icon-marca/box.icon.png',
    badge: 'PRIME',
    color: '#8b5cf6'
  },
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN_GENERAL: 'ADMIN GENERAL',
  CEO: 'CEO',
  ADMINISTRADOR: 'ADMINISTRADOR',
  JEFE_ALMACEN: 'JEFE ALMACÉN',
  DESPACHADOR: 'DESPACHADOR',
  LIVEX: 'LIVEX',
};

const VIEW_AS_ROLES: Role[] = ['ADMIN_GENERAL', 'CEO', 'ADMINISTRADOR', 'JEFE_ALMACEN', 'DESPACHADOR', 'LIVEX'];

export const navItems: NavItem[] = [
  { id: 'dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
  { id: 'inventory', label: 'INVENTARIO', icon: PackageSearch },
  { id: 'locations', label: 'UBICACIONES', icon: MapPin },
  { id: 'product-locations', label: 'DISEÑO PRODUCTOS', icon: LayoutGrid },
  { id: 'warehouse-3d', label: 'RACKS 3D', icon: Boxes },
  { id: 'operations', label: 'OPERACIONES', icon: ArrowLeftRight },
  { id: 'adjustments', label: 'AJUSTES', icon: SlidersHorizontal },
  { id: 'purchase-orders', label: 'ÓRDENES OC', icon: ShoppingCart },
  { id: 'history', label: 'HISTORIAL', icon: History },
  { id: 'contacts', label: 'CONTACTOS', icon: UserCircle },
  { id: 'reports', label: 'REPORTES', icon: FileBarChart },
  { id: 'users', label: 'USUARIOS', icon: Users },
  { id: 'qrs', label: 'CÓDIGOS QR', icon: QrCode },
  { id: 'operation-history', label: 'HISTORIAL GENERAL', icon: ScrollText },
  { id: 'livex-feed', label: 'LIVEX', icon: Radio },
];

type NavItemWithNum = NavItem & { num: string };
const navItemsWithNum: NavItemWithNum[] = navItems.map((item, i) => ({
  ...item,
  num: String(i + 1).padStart(2, '0'),
}));

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [brandMenuOpen, setBrandMenuOpen] = useState(false);
  const brandMenuRef = useRef<HTMLDivElement>(null);
  const { activeBrand, setActiveBrand, currentUser, viewAsRole, setViewAsRole, effectiveRole, rolePermissions, refreshAll } = useAppContext();
  const { theme, toggle: toggleTheme } = useTheme();
  const location = useLocation();
  const isAdminGeneral = currentUser.role === 'ADMIN_GENERAL';

  const currentBrandObj = BRANDS_LIST.find(b => b.id === activeBrand) ?? BRANDS_LIST[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (brandMenuRef.current && !brandMenuRef.current.contains(e.target as Node)) {
        setBrandMenuOpen(false);
      }
    };
    if (brandMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [brandMenuOpen]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
  };

  useEffect(() => {
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, []);

  const visibleNav = navItemsWithNum
    .filter(item => canView(effectiveRole, item.id, rolePermissions))
    .map((item, i) => ({ ...item, num: String(i + 1).padStart(2, '0') }));
  const currentNavLabel = navItemsWithNum.find(n => location.pathname === `/${n.id}`)?.label ?? 'DASHBOARD';

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--ink)' }}>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border-soft)' }}
        className={cn(
          "fixed md:relative top-0 left-0 h-full flex-shrink-0 border-r flex flex-col z-40 transition-all duration-300 ease-in-out shadow-xs",
          sidebarOpen ? "translate-x-0 w-[260px]" : "-translate-x-full md:translate-x-0 w-[260px] md:w-18"
        )}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-[var(--border-soft)]">
          {sidebarOpen && (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-xl bg-[var(--surface)] border border-[var(--border-soft)] p-1 flex items-center justify-center shrink-0 shadow-xs">
                <img
                  src={theme === 'dark' ? '/Zazu/zazu-logo/zazu-dark mode.png' : '/Zazu/zazu-logo/zazu-light mode.png'}
                  alt="Zazu Express"
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="font-mono font-black tracking-tight text-sm uppercase truncate" style={{ color: 'var(--ink)' }}>
                {BRAND_NAME[activeBrand] ?? activeBrand}
              </span>
            </div>
          )}
          {!sidebarOpen && (
            <div className="hidden md:flex w-8 h-8 rounded-xl bg-[var(--surface)] border border-[var(--border-soft)] p-1 items-center justify-center mx-auto shadow-xs">
              <img
                src={theme === 'dark' ? '/Zazu/zazu-logo/zazu-dark mode.png' : '/Zazu/zazu-logo/zazu-light mode.png'}
                alt="Zazu Express"
                className="w-full h-full object-contain"
              />
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[var(--surface)] text-[var(--ink)] opacity-70 hover:opacity-100 transition-all shrink-0 cursor-pointer"
            title="Alternar barra lateral"
          >
            <Menu size={18} />
          </button>
        </div>

        <nav className="flex-1 py-4 px-2.5 flex flex-col gap-1 overflow-y-auto">
          {visibleNav.map((item) => (
            <NavLink
              key={item.id}
              to={`/${item.id}`}
              onClick={() => { if (window.innerWidth < 768) setSidebarOpen(false); }}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-150 outline-none border",
                isActive
                  ? "bg-blue-600/10 text-blue-600 dark:text-blue-400 font-bold border-blue-500/25 shadow-xs"
                  : "border-transparent opacity-65 hover:opacity-100 hover:bg-[var(--surface)] text-[var(--ink)]"
              )}
              title={item.label}
            >
              {({ isActive }) => (
                <>
                  <item.icon size={17} className={cn("flex-shrink-0 transition-transform", isActive ? "stroke-[2.5px] scale-105" : "")} />
                  {sidebarOpen && (
                    <span className="font-mono text-xs font-semibold uppercase tracking-wider whitespace-nowrap overflow-hidden flex items-center gap-2">
                      <span className={cn("text-[9px] font-black tabular-nums transition-opacity", isActive ? "opacity-60" : "opacity-35")}>
                        {item.num}
                      </span>
                      {item.label}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {sidebarOpen ? (
          <div className="p-3 flex flex-col gap-2 border-t border-[var(--border-soft)]">
            <div className="flex items-center justify-between px-0.5">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-60">
                  MARCA ACTIVA
                </span>
              </div>
              <span
                className="font-mono text-[8px] font-bold px-1.5 py-0.5 rounded tracking-wider"
                style={{
                  color: currentBrandObj.color,
                  background: `${currentBrandObj.color}15`,
                  border: `1px solid ${currentBrandObj.color}35`,
                }}
              >
                {currentBrandObj.badge}
              </span>
            </div>

            {/* Custom Brand Switcher Trigger */}
            <div className="relative" ref={brandMenuRef}>
              <button
                type="button"
                onClick={() => setBrandMenuOpen(prev => !prev)}
                className="w-full flex items-center justify-between p-2 rounded-xl transition-all duration-150 group text-left cursor-pointer border shadow-xs"
                style={{
                  background: 'var(--bg-card)',
                  borderColor: brandMenuOpen ? currentBrandObj.color : 'var(--border-soft)',
                  color: 'var(--ink)',
                }}
                title="Cambiar marca / almacén activo"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center p-1 shrink-0 bg-[var(--surface)] border border-[var(--border-soft)] shadow-xs">
                    <img
                      src={currentBrandObj.icon}
                      alt={currentBrandObj.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-mono text-xs font-black tracking-tight uppercase truncate">
                      {currentBrandObj.name}
                    </span>
                    <span className="font-mono text-[8px] opacity-50 uppercase truncate">
                      {currentBrandObj.legal}
                    </span>
                  </div>
                </div>
                <ChevronsUpDown size={14} className="opacity-50 group-hover:opacity-100 transition-opacity shrink-0 ml-1" />
              </button>

              {/* Dropdown Menu (opens upward) */}
              {brandMenuOpen && (
                <div
                  className="absolute bottom-full left-0 w-full mb-2 rounded-2xl shadow-2xl p-1.5 z-50 flex flex-col gap-1 border backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
                  style={{
                    background: 'var(--bg-card)',
                    borderColor: 'var(--border-soft)',
                    boxShadow: '0 12px 32px -4px rgba(0,0,0,0.3)',
                  }}
                >
                  <div className="px-2 py-1 text-[8px] font-mono font-bold uppercase tracking-widest opacity-50">
                    Seleccionar Almacén / Marca
                  </div>
                  {BRANDS_LIST.map(b => {
                    const isSelected = activeBrand === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          setActiveBrand(b.id);
                          setBrandMenuOpen(false);
                        }}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer border",
                          isSelected
                            ? "bg-blue-600/10 border-blue-500/30 text-blue-500 font-bold"
                            : "hover:bg-[var(--surface)] border-transparent text-[var(--ink)] opacity-70 hover:opacity-100"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-6 h-6 rounded-md flex items-center justify-center p-0.5 shrink-0 bg-[var(--surface)] border border-[var(--border-soft)]">
                            <img src={b.icon} alt={b.name} className="w-full h-full object-contain" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-mono text-[11px] font-bold tracking-tight uppercase truncate">
                              {b.name}
                            </span>
                            <span className="font-mono text-[8px] opacity-50 truncate">
                              {b.legal}
                            </span>
                          </div>
                        </div>
                        {isSelected && <Check size={14} className="text-blue-500 shrink-0 ml-1" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between px-0.5 mt-0.5">
              <span className="font-mono text-[8px] opacity-40 uppercase tracking-widest truncate">
                {currentBrandObj.legal}
              </span>
              <span className="font-mono text-[8px] font-bold px-1.5 py-0.2 rounded-full opacity-60 bg-[var(--border-soft)] text-[var(--ink)] shrink-0 ml-1">
                v3.2
              </span>
            </div>
          </div>
        ) : (
          <div className="p-2 border-t border-[var(--border-soft)] flex justify-center">
            <button
              onClick={() => setSidebarOpen(true)}
              title={`Marca activa: ${currentBrandObj.name}`}
              className="w-10 h-10 rounded-xl flex items-center justify-center p-1.5 hover:bg-[var(--bg-card)] border border-transparent hover:border-[var(--border-soft)] transition-all cursor-pointer"
            >
              <img src={currentBrandObj.icon} alt={currentBrandObj.name} className="w-full h-full object-contain" />
            </button>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden min-w-0">
        {/* Top Header */}
        <header
          className="h-14 md:h-16 flex items-center justify-between px-3 md:px-6 gap-2 border-b border-[var(--border-soft)] backdrop-blur-md"
          style={{ background: 'var(--bg-header)', color: 'var(--ink)' }}
        >
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <button
              className="md:hidden p-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] hover:bg-[var(--bg-card)] text-[var(--ink)] transition-colors shrink-0 cursor-pointer"
              onClick={() => setSidebarOpen(true)}
              title="Abrir menú lateral"
            >
              <Menu size={16} />
            </button>
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-xl bg-[var(--surface)] border border-[var(--border-soft)] p-1 flex items-center justify-center shrink-0 shadow-xs">
              <img
                src={BRAND_ICON[activeBrand] ?? '/icon-marca/over-icon.png'}
                alt={BRAND_NAME[activeBrand] ?? activeBrand}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex items-center gap-2 truncate">
              <span className="text-xs md:text-sm font-black tracking-tight uppercase truncate">
                {activeBrand.replace('_', ' ')}
              </span>
              <span className="text-xs opacity-30 font-mono hidden sm:inline">/</span>
              <span className="text-xs font-mono opacity-50 uppercase hidden sm:inline">Central_01</span>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap shrink-0 border border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              {currentNavLabel}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isAdminGeneral && (
              <div
                className="hidden md:flex items-center gap-1.5 border rounded-xl px-2.5 py-1 transition-all"
                style={{
                  borderColor: viewAsRole ? '#d97706' : 'var(--border-soft)',
                  background: viewAsRole ? '#d9770614' : 'var(--surface)',
                }}
                title="Ver la app como otro rol (solo cambia lo que se muestra, no tus permisos reales)"
              >
                <Eye size={13} style={{ color: viewAsRole ? '#d97706' : undefined, opacity: viewAsRole ? 1 : 0.6 }} />
                <select
                  value={viewAsRole ?? ''}
                  onChange={(e) => setViewAsRole(e.target.value ? (e.target.value as Role) : null)}
                  className="bg-transparent font-mono text-[9px] font-bold uppercase tracking-wider focus:outline-none cursor-pointer"
                  style={{ color: viewAsRole ? '#d97706' : 'var(--ink)' }}
                >
                  <option value="">VER COMO...</option>
                  {VIEW_AS_ROLES.map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-col items-end gap-0.5 px-2 hidden sm:flex">
              <span className="font-mono font-black text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink)' }}>
                {currentUser.username || '—'}
              </span>
              <span className="font-mono text-[9px] opacity-50 uppercase tracking-widest">
                {viewAsRole ? `VIENDO COMO: ${ROLE_LABELS[viewAsRole] ?? viewAsRole}` : (ROLE_LABELS[currentUser.role] ?? currentUser.role)}
              </span>
            </div>

            <button
              onClick={toggleTheme}
              title={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
              className="w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center border border-transparent hover:border-[var(--border-soft)] hover:bg-[var(--surface)] text-[var(--ink)] transition-all cursor-pointer"
            >
              {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              title="Actualizar registros"
              className="w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center border border-transparent hover:border-[var(--border-soft)] hover:bg-[var(--surface)] text-[var(--ink)] transition-all disabled:opacity-40 cursor-pointer"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              title="Cerrar sesión"
              className="w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center border border-transparent hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-500 text-[var(--ink)] opacity-70 hover:opacity-100 transition-all cursor-pointer"
            >
              <LogOut size={15} />
            </button>
          </div>
        </header>

        {/* Content Viewport */}
        <div className={cn(
          "flex-1 overflow-auto w-full transition-all",
          location.pathname === '/warehouse-3d'
            ? "p-2 md:p-3 max-w-none h-[calc(100vh-4rem)] flex flex-col overflow-hidden"
            : "p-4 md:p-6 lg:p-8 max-w-7xl mx-auto"
        )}>
          {children}
        </div>
      </main>
    </div>
  );
};
