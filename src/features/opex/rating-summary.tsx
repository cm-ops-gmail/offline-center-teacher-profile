'use client';
import { useMemo } from 'react';
import { summarize } from '@/features/ratings/analytics';
import { useRatingsData } from '@/features/ratings/filters';
import type { OpexRating, ProgramId } from '@/features/ratings/types';
import { fmt, plural } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useRatingTab } from './rating-tabs';

const avgOf = (rows: OpexRating[]) => (rows.length ? rows.reduce((a, r) => a + r.avg, 0) / rows.length : null);

/**
 * Three summary cards above the filters: average Student rating, average OpEx rating, average Programme team rating — for
 * whatever is in view (programme, branch, teacher, dates…). On screens that have the tabs, a card opens its tab.
 */
export function RatingSummary({ program, teacher, interactive = false }: { program?: ProgramId; teacher?: string; interactive?: boolean }) {
  const { filtered, opexView, programmeView } = useRatingsData();
  const [tab, go] = useRatingTab();
  const lock = { program, teacher };
  const student = filtered(lock);
  const s = useMemo(() => summarize(student), [student]);
  const opex = opexView(lock);
  const programme = programmeView(lock);

  const cards = [
    { id: 'student' as const, label: 'Student rating', value: s.rating, sub: s.batches ? `${plural(s.batches, 'batch', 'batches')} · ${plural(s.teachers, 'teacher')}` : 'No ratings in view' },
    { id: 'opex' as const, label: 'OpEx rating', value: avgOf(opex), sub: opex.length ? `${plural(opex.length, 'rating')} · ${plural(new Set(opex.map((o) => o.teacherId)).size, 'teacher')}` : 'No ratings in view' },
    { id: 'programme' as const, label: 'Programme team rating', value: avgOf(programme), sub: programme.length ? `${plural(programme.length, 'observation')} · ${plural(new Set(programme.map((o) => o.teacherId)).size, 'teacher')}` : 'No ratings in view' },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" role="group" aria-label="Rating summary">
      {cards.map((c) => {
        const body = (
          <>
            <span className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              {c.label}
              <span className="text-[11px]">out of 5</span>
            </span>
            <span className="tabular text-3xl font-bold leading-none">{fmt(c.value)}</span>
            <span className="text-[12.5px] text-muted-foreground">{c.sub}</span>
          </>
        );
        const cls = cn('card flex flex-col gap-3 p-4 text-left sm:p-5', interactive && tab === c.id && 'ring-2 ring-primary');
        return interactive ? (
          <button key={c.id} type="button" onClick={() => go(c.id)} aria-pressed={tab === c.id} className={cn(cls, 'card-lift cursor-pointer transition-shadow')}>
            {body}
          </button>
        ) : (
          <div key={c.id} className={cls}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
