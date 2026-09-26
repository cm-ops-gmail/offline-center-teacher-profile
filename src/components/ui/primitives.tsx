import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Info, Minus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@tenminuteschool/design-system';
import { cn } from '@/lib/utils';
import { fmtDelta, initials } from '@/lib/format';
import { CountUp } from './count-up';
import { PROGRAM_BY_ID } from '@/features/ratings/programs';
import type { ProgramId } from '@/features/ratings/types';

export function PageHeader({ eyebrow, title, emphasis, description, actions, className }: { eyebrow?: ReactNode; title: string; emphasis?: string; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <header className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="max-w-3xl">
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="text-lg font-bold text-foreground sm:text-xl">
          {title}
          {emphasis && <> {emphasis}</>}
        </h1>
        {description && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SectionTitle({ title, hint, right }: { title: string; hint?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-bold text-foreground">{title}</h2>
        {hint && <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

/** Change from first to last rating. Colour is never the only cue: icon + signed number + accessible label. */
export function Delta({ value, className, showZero = true }: { value: number | null; className?: string; showZero?: boolean }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  const up = value > 0.005;
  const down = value < -0.005;
  if (!up && !down && !showZero) return null;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return (
    <span
      className={cn('tabular inline-flex items-center gap-0.5 whitespace-nowrap font-medium', up && 'text-good', down && 'text-critical', !up && !down && 'text-muted-foreground', className)}
      aria-label={up ? `Improved by ${fmtDelta(value)}` : down ? `Declined by ${fmtDelta(-value)}` : 'No change'}
    >
      <Icon className="size-3.5" aria-hidden />
      {fmtDelta(value)}
    </span>
  );
}

export function StatTile({ label, value, sub, hero, info, infoAlign = 'end', className, children }: { label: string; value: ReactNode; sub?: ReactNode; hero?: boolean; /** Explanation shown in a popover when the small “i” is clicked. */ info?: ReactNode; /** Which side the popover opens towards (tiles on the left open rightwards). */ infoAlign?: 'start' | 'end'; className?: string; children?: ReactNode }) {
  return (
    <div className={cn('card card-lift flex flex-col justify-between gap-3 p-3.5 sm:p-4', className)}>
      <p className={cn('text-xs font-medium text-muted-foreground', info && 'pr-7')}>{label}</p>
      {info && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`How is “${label}” calculated?`}
              className="absolute right-2.5 top-2.5 z-10 grid size-6 place-items-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=open]:bg-muted data-[state=open]:text-foreground"
            >
              <Info size={14} />
            </button>
          </PopoverTrigger>
          <PopoverContent align={infoAlign} collisionPadding={12} className="max-h-[75vh] w-[22rem] max-w-[92vw] overflow-y-auto p-4">
            {info}
          </PopoverContent>
        </Popover>
      )}
      <div>
        <p className={cn('font-bold leading-none tabular-nums tracking-tight', hero ? 'text-3xl sm:text-4xl' : 'text-xl sm:text-2xl')}>{typeof value === 'string' || typeof value === 'number' ? <CountUp value={value} /> : value}</p>
        {sub && <div className="mt-2 text-xs leading-snug text-muted-foreground">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

export function ProgramChip({ id, className }: { id: ProgramId; className?: string }) {
  const p = PROGRAM_BY_ID[id];
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-foreground/85', className)}>
      <span className="size-2.5 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden />
      {p.label}
    </span>
  );
}

export function Monogram({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-muted font-semibold text-muted-foreground',
        size === 'sm' && 'size-8 text-xs',
        size === 'md' && 'size-9 text-sm',
        size === 'lg' && 'size-14 text-lg',
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function Pill({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'warn' | 'good'; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
        tone === 'neutral' && 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-white/10 dark:text-slate-300 dark:ring-white/15',
        tone === 'warn' && 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/25',
        tone === 'good' && 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-muted', className)} />;
}
