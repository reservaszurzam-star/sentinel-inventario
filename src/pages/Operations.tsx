import React, { useState } from 'react';
import {
  ArrowDownLeft, ArrowRightLeft, FileText, BarChart2, Mail, CheckSquare, QrCode, ShieldOff,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { TransactionType } from '../types';
import { useAppContext } from '../store/AppContext';
import { Confirmations } from './Confirmations';
import { ModuleInfo } from '../components/ModuleInfo';
import { TutorialModal, OPERATIONS_TUTORIAL_STEPS } from '../components/TutorialModal';
import { CategoryQRsTab } from '../components/CategoryQRsTab';
import {
  ActiveOp,
  OptButton,
  OperationForm,
  WriteOffForm,
  BulletinsTab,
  TransactionLog,
  OperationsReport,
} from '../components/operations';

// Re-exports for backward compatibility
export {
  OperationForm,
  WriteOffForm,
  BulletinsTab,
  TransactionLog,
  OperationsReport,
} from '../components/operations';

export const Operations: React.FC = () => {
  const { effectiveRole } = useAppContext();
  const [activeOpt, setActiveOpt] = useState<ActiveOp>('RECEPTION');
  const [showTutorial, setShowTutorial] = useState(false);

  // Read sessionStorage filter set by Dashboard KPI cards
  const storedFilter = (() => {
    try { return JSON.parse(sessionStorage.getItem('operationsLogFilter') || 'null'); } catch { return null; }
  })();
  const [mainTab, setMainTab] = useState<'operations' | 'log' | 'reports' | 'bulletins' | 'confirmations' | 'category_qrs'>(
    storedFilter ? 'log' : 'operations'
  );

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 pb-8">
      <TutorialModal
        open={showTutorial}
        onClose={() => setShowTutorial(false)}
        steps={OPERATIONS_TUTORIAL_STEPS}
      />
      
      <ModuleInfo
        number="07"
        title="Operaciones"
        description="Registro de movimientos de stock: entradas, salidas y transferencias. Soporta múltiples productos por operación con control de firma y comprobantes."
        onTutorial={() => setShowTutorial(true)}
      />

      {/* Main tabs - Modern segmented control */}
      <div className="flex gap-1.5 p-1.5 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] backdrop-blur-md overflow-x-auto shadow-xs">
        <button
          type="button"
          onClick={() => setMainTab('operations')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer',
            mainTab === 'operations'
              ? 'bg-[var(--ink)] text-[var(--ink-inv)] shadow-xs'
              : 'text-[var(--ink)] opacity-60 hover:opacity-100 hover:bg-[var(--bg-card)]'
          )}
        >
          <ArrowRightLeft size={14} />
          OPERACIONES
        </button>
        <button
          type="button"
          onClick={() => setMainTab('log')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer',
            mainTab === 'log'
              ? 'bg-[var(--ink)] text-[var(--ink-inv)] shadow-xs'
              : 'text-[var(--ink)] opacity-60 hover:opacity-100 hover:bg-[var(--bg-card)]'
          )}
        >
          <FileText size={14} />
          HISTORIAL
        </button>
        <button
          type="button"
          onClick={() => setMainTab('reports')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer',
            mainTab === 'reports'
              ? 'bg-[var(--ink)] text-[var(--ink-inv)] shadow-xs'
              : 'text-[var(--ink)] opacity-60 hover:opacity-100 hover:bg-[var(--bg-card)]'
          )}
        >
          <BarChart2 size={14} />
          REPORTES
        </button>
        
        {effectiveRole === 'ADMIN_GENERAL' && (
          <button
            type="button"
            onClick={() => setMainTab('bulletins')}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer',
              mainTab === 'bulletins'
                ? 'bg-[var(--ink)] text-[var(--ink-inv)] shadow-xs'
                : 'text-[var(--ink)] opacity-60 hover:opacity-100 hover:bg-[var(--bg-card)]'
            )}
          >
            <Mail size={14} />
            COMPROBANTES
          </button>
        )}

        <button
          type="button"
          onClick={() => setMainTab('confirmations')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer',
            mainTab === 'confirmations'
              ? 'bg-[var(--ink)] text-[var(--ink-inv)] shadow-xs'
              : 'text-[var(--ink)] opacity-60 hover:opacity-100 hover:bg-[var(--bg-card)]'
          )}
        >
          <CheckSquare size={14} />
          CONFIRMACIÓN
        </button>

        <button
          type="button"
          onClick={() => setMainTab('category_qrs')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer',
            mainTab === 'category_qrs'
              ? 'bg-[var(--ink)] text-[var(--ink-inv)] shadow-xs'
              : 'text-[var(--ink)] opacity-60 hover:opacity-100 hover:bg-[var(--bg-card)]'
          )}
        >
          <QrCode size={14} />
          QR CATEGORÍAS
        </button>
      </div>

      {mainTab === 'operations' && (
        <>
          <div className="grid grid-cols-2 gap-3 bg-[var(--surface)] border border-[var(--border-soft)] p-3 rounded-2xl shadow-xs">
            <OptButton
              icon={<ArrowDownLeft size={18} />}
              label="RECEPCION"
              desc="Registra entrada de productos al stock. Suma al inventario total."
              active={activeOpt === 'RECEPTION'}
              onClick={() => setActiveOpt('RECEPTION')}
            />
            <OptButton
              icon={<ShieldOff size={18} />}
              label="BAJA / MERMA"
              desc="Registra prendas dadas de baja. Descuenta del inventario con motivo."
              active={activeOpt === 'WRITEOFF'}
              onClick={() => setActiveOpt('WRITEOFF')}
              accent="red"
            />
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-2xl p-6 lg:p-8 relative overflow-hidden shadow-xs backdrop-blur-md">
            <div className="absolute top-0 right-0 p-4 font-mono text-[100px] leading-none opacity-5 select-none pointer-events-none font-black">
              {activeOpt === 'RECEPTION' ? 'RX' : 'BJ'}
            </div>
            {activeOpt === 'WRITEOFF'
              ? <WriteOffForm key="writeoff" />
              : <OperationForm key={activeOpt} type={activeOpt as TransactionType} />
            }
          </div>
        </>
      )}

      {mainTab === 'log' && (
        <TransactionLog initialFilter={storedFilter} />
      )}

      {mainTab === 'reports' && (
        <div className="border border-[var(--border-soft)] bg-[var(--surface)] p-6 rounded-2xl shadow-xs backdrop-blur-md">
          <OperationsReport mode="ops" />
        </div>
      )}

      {effectiveRole === 'ADMIN_GENERAL' && mainTab === 'bulletins' && (
        <BulletinsTab mode="ops" />
      )}

      {mainTab === 'confirmations' && (
        <div className="border border-[var(--border-soft)] bg-[var(--bg-card)] p-6 rounded-2xl shadow-xs backdrop-blur-md h-full">
          <Confirmations />
        </div>
      )}

      {mainTab === 'category_qrs' && (
        <CategoryQRsTab />
      )}
    </div>
  );
};
