import React from 'react';
import { HelpCircle } from 'lucide-react';

interface ModuleInfoProps {
  number?: string;
  title: string;
  description: string;
  badge?: string;
  icon?: React.ReactNode;
  onTutorial?: () => void;
  children?: React.ReactNode;
  className?: string;
}

export const ModuleInfo: React.FC<ModuleInfoProps> = ({
  number,
  title,
  description,
  badge = 'En línea',
  icon,
  onTutorial,
  children,
  className = '',
}) => (
  <div
    className={`rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 md:p-5 shadow-xs backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${className}`}
  >
    <div className="flex flex-col gap-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        {number && (
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-[var(--ink)]/8 text-[var(--ink)] border border-[var(--border-soft)]">
            MÓDULO {number}
          </span>
        )}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            {badge}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2.5 mt-0.5">
        {icon && <div className="text-[var(--ink)] shrink-0">{icon}</div>}
        <h1 className="text-xl md:text-2xl font-black tracking-tight text-[var(--ink)] uppercase">
          {title}
        </h1>
      </div>
      <p className="text-xs md:text-sm text-[var(--ink)]/65 font-medium leading-relaxed max-w-3xl">
        {description}
      </p>
    </div>

    {(onTutorial || children) && (
      <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
        {onTutorial && (
          <button
            type="button"
            onClick={onTutorial}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] text-[var(--ink)] text-xs font-bold font-mono tracking-wider uppercase transition-all shadow-xs cursor-pointer"
            title="Ver tutorial de uso"
          >
            <HelpCircle size={14} className="shrink-0" />
            <span className="hidden sm:inline">Tutorial</span>
          </button>
        )}
        {children}
      </div>
    )}
  </div>
);
