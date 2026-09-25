import React from 'react';
import { cn } from '../../lib/utils';

export interface OptButtonProps {
  icon: React.ReactNode;
  label: string;
  desc?: string;
  active: boolean;
  onClick: () => void;
  accent?: 'red' | 'default';
}

export const OptButton: React.FC<OptButtonProps> = ({ icon, label, desc, active, onClick, accent }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'flex flex-col items-center gap-1.5 p-3 sm:p-3.5 lg:p-4 rounded-2xl border transition-all duration-200 cursor-pointer text-center relative overflow-hidden',
      accent === 'red'
        ? active
          ? 'border-red-500/50 bg-red-600 text-white shadow-md shadow-red-600/20'
          : 'border-red-500/20 bg-red-500/5 text-red-600 dark:text-red-400 hover:bg-red-500/10 hover:border-red-500/40'
        : active
          ? 'border-blue-500/40 bg-blue-600 text-white shadow-md shadow-blue-600/20'
          : 'border-[var(--border-soft)] bg-[var(--surface)] text-[var(--ink)] opacity-75 hover:opacity-100 hover:bg-[var(--row-hover)] hover:border-[var(--border)]/40 shadow-xs'
    )}
  >
    <div className={cn('transition-transform', active ? 'scale-110' : 'opacity-80')}>{icon}</div>
    <span className="font-mono text-[10px] lg:text-[11px] tracking-wider font-bold uppercase mt-0.5">{label}</span>
    {desc && (
      <span className={cn(
        'hidden sm:block font-mono text-[8px] leading-tight text-center normal-case tracking-normal font-normal border-t pt-1.5 mt-0.5 w-full opacity-70',
        active ? 'border-white/20' : 'border-[var(--border-soft)]'
      )}>
        {desc}
      </span>
    )}
  </button>
);

export const FormGroup: React.FC<{ label: string; error?: string; children: React.ReactNode; className?: string }> = ({ label, error, children, className }) => (
  <div className={cn('flex flex-col gap-1.5', className)}>
    <label className={cn('font-mono text-[9px] font-bold tracking-widest uppercase', error ? 'text-red-600' : 'opacity-70')}>{label}</label>
    {children}
    {error && (
      <span className="font-mono text-[9px] font-bold text-red-600 uppercase mt-0.5 border border-red-500/20 px-2 py-0.5 bg-red-500/10 rounded-md w-fit tracking-wider">
        {error}
      </span>
    )}
  </div>
);

export const PreviewRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <tr className="border-b border-[var(--border-soft)]">
    <td className="py-2 pr-3 font-bold uppercase opacity-60 text-[9px] tracking-widest">{label}</td>
    <td className="py-2 pl-3 font-bold uppercase text-right">{value}</td>
  </tr>
);
