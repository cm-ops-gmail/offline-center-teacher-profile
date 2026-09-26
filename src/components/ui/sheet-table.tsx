import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { RatingClass } from '@/features/ratings/filters';

/** Header / cell styles borrowed from the Google Sheet: grey header row, green "Average Rating" column, blue/purple class pills. */
export const sheet = {
  th: 'bg-muted px-3 py-3 text-center text-[12.5px] font-semibold leading-tight text-foreground border-b border-border',
  thAvg: 'px-3 py-3 text-center text-[12.5px] font-semibold leading-tight text-foreground border-b border-border bg-[color-mix(in_oklab,var(--good)_22%,var(--background))]',
  td: 'tabular px-3 py-2.5 text-center',
  tdAvg: 'tabular px-3 py-2.5 text-center font-bold bg-[color-mix(in_oklab,var(--good)_9%,var(--background))]',
};

export function ClassPill({ kind, children }: { kind: 'first' | 'last'; children?: ReactNode }) {
  return (
    <span
      className={cn('inline-block whitespace-nowrap rounded-full px-3 py-1 text-[13px] font-medium', kind === 'first' ? 'bg-[color-mix(in_oklab,var(--viz-1)_20%,var(--background))]' : 'bg-[color-mix(in_oklab,oklch(62%_0.14_310)_22%,var(--background))]')}
    >
      {children ?? (kind === 'first' ? 'First Rating' : 'Last Rating')}
    </span>
  );
}

export const classKinds = (cls: RatingClass): ('first' | 'last')[] => (cls === 'first' ? ['first'] : cls === 'last' ? ['last'] : ['first', 'last']);
