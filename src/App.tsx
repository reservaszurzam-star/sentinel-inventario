import { useState, useEffect, ReactNode } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useAppContext } from './store/AppContext';
import { CartProvider } from './store/CartContext';
import { ThemeProvider, useTheme } from './store/ThemeContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Inventory } from './pages/Inventory';
import { Operations } from './pages/Operations';
import { History } from './pages/History';
import { Locations } from './pages/Locations';
import { ProductLocations } from './pages/ProductLocations';
import { Contacts } from './pages/Contacts';
import { Users } from './pages/Users';
import { PurchaseOrders } from './pages/PurchaseOrders';
import { Adjustments } from './pages/Adjustments';
import { Reports } from './pages/Reports';
import { Labels } from './pages/Labels';
import { WarehouseMap } from './pages/WarehouseMap';
import { OperationHistory } from './pages/OperationHistory';
import { LivexFeed } from './pages/LivexFeed';
import { ResetPassword } from './pages/ResetPassword';
import { StockViewer } from './pages/StockViewer';
import { LocationViewer } from './pages/LocationViewer';
import { PendingAccess } from './pages/PendingAccess';
import { QRs } from './pages/QRs';
import { GlobalScanner } from './components/GlobalScanner';
import { supabase } from './lib/supabase';
import { ErrorBoundary } from './components/ErrorBoundary';
import { canView } from './lib/permissions';
import { navItems } from './components/Layout';
import type { Session } from '@supabase/supabase-js';

function Guarded({ moduleId, fallback, children }: { moduleId: string; fallback: string; children: ReactNode }) {
  const { effectiveRole, rolePermissions } = useAppContext();
  if (!canView(effectiveRole, moduleId, rolePermissions)) return <Navigate to={fallback} replace />;
  return <>{children}</>;
}

function AppShell() {
  const { loading, effectiveRole, rolePermissions } = useAppContext();

  if (loading) return <SplashScreen label="CARGANDO SISTEMA..." />;

  const firstVisible = navItems.find(item => canView(effectiveRole, item.id, rolePermissions));
  if (!firstVisible) return <PendingAccess />;
  const homePath = `/${firstVisible.id}`;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to={homePath} replace />} />
        <Route path="/dashboard" element={<Guarded moduleId="dashboard" fallback={homePath}><Dashboard /></Guarded>} />
        <Route path="/inventory" element={<Guarded moduleId="inventory" fallback={homePath}><Inventory /></Guarded>} />
        <Route path="/locations" element={<Guarded moduleId="locations" fallback={homePath}><Locations /></Guarded>} />
        <Route path="/product-locations" element={<Guarded moduleId="product-locations" fallback={homePath}><ProductLocations /></Guarded>} />
        <Route path="/operations" element={<Guarded moduleId="operations" fallback={homePath}><Operations /></Guarded>} />
        <Route path="/history" element={<Guarded moduleId="history" fallback={homePath}><History /></Guarded>} />
        <Route path="/contacts" element={<Guarded moduleId="contacts" fallback={homePath}><Contacts /></Guarded>} />
        <Route path="/users" element={<Guarded moduleId="users" fallback={homePath}><Users /></Guarded>} />
        <Route path="/purchase-orders" element={<Guarded moduleId="purchase-orders" fallback={homePath}><PurchaseOrders /></Guarded>} />
        <Route path="/adjustments" element={<Guarded moduleId="adjustments" fallback={homePath}><Adjustments /></Guarded>} />
        <Route path="/qrs" element={<Guarded moduleId="qrs" fallback={homePath}><QRs /></Guarded>} />
        <Route path="/reports" element={<Guarded moduleId="reports" fallback={homePath}><Reports /></Guarded>} />
        <Route path="/labels" element={<Guarded moduleId="labels" fallback={homePath}><Labels /></Guarded>} />
        <Route path="/warehouse-map" element={<Guarded moduleId="warehouse-map" fallback={homePath}><WarehouseMap /></Guarded>} />
        <Route path="/operation-history" element={<Guarded moduleId="operation-history" fallback={homePath}><OperationHistory /></Guarded>} />
        <Route path="/livex-feed" element={<Guarded moduleId="livex-feed" fallback={homePath}><LivexFeed /></Guarded>} />
        <Route path="*" element={<Navigate to={homePath} replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppRoot />
    </ThemeProvider>
  );
}

function AppRoot() {
  return (
    <HashRouter>
      <ErrorBoundary>
        <AppProvider>
          <CartProvider>
            <AppContent />
          </CartProvider>
        </AppProvider>
      </ErrorBoundary>
    </HashRouter>
  );
}

function AppContent() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
      if (event === 'SIGNED_OUT') setRecoveryMode(false);
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (location.pathname.startsWith('/q/')) {
    return (
      <Routes>
        <Route path="/q/:model" element={<StockViewer session={session} />} />
      </Routes>
    );
  }

  if (location.pathname.startsWith('/l/')) {
    return (
      <Routes>
        <Route path="/l/:locationId" element={<LocationViewer />} />
      </Routes>
    );
  }

  if (session === undefined) return <SplashScreen />;
  if (recoveryMode) return <ResetPassword />;
  if (!session) return <Login />;

  return (
    <>
      <AppShell />
      <GlobalScanner />
    </>
  );
}

function SplashScreen({ label = 'INICIANDO...' }: { label?: string }) {
  const { theme } = useTheme();
  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col items-center justify-center gap-6">
      <div className="relative flex items-center justify-center">
        <div className="absolute w-24 h-24 border-2 border-[var(--border)]/20 rounded-full animate-ping" />
        <div className="absolute w-20 h-20 border border-[var(--border)]/10 rounded-full animate-pulse" />
        <div className="w-16 h-16 relative z-10 animate-pulse" style={{ animationDuration: '1.5s' }}>
          <img
            src={theme === 'dark' ? '/Zazu/zazu-logo/zazu-dark mode.png' : '/Zazu/zazu-logo/zazu-light mode.png'}
            alt="Zazu Express"
            className="w-16 h-16 object-contain"
          />
        </div>
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="font-mono font-black text-base tracking-[0.3em] text-[var(--ink)] uppercase">LOGIXZAZU</span>
        <span className="font-mono text-[9px] opacity-40 tracking-[0.4em] uppercase">{label}</span>
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-1.5 h-1.5 bg-[var(--ink)] rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.9s' }}
          />
        ))}
      </div>
    </div>
  );
}
