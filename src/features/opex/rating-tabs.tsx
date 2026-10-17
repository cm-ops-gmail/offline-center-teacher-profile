'use client';
import type { ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

type Tab = 'student' | 'opex' | 'programme';
const LABEL: Record<Tab, string> = { student: 'Student rating', opex: 'OpEx rating', programme: 'Programme team rating' };

/** Student rating | OpEx rating | Programme team rating — kept in the URL as `?rating=opex` / `?rating=programme` so a view can be shared. */
export function RatingTabs({ student, opex, programme, studentCount, opexCount, programmeCount }: { student: ReactNode; opex: ReactNode; programme: ReactNode; studentCount?: number; opexCount: number; programmeCount: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const raw = params.get('rating');
  const active: Tab = raw === 'opex' || raw === 'programme' ? raw : 'student';

  const go = (tab: Tab) => {
    const next = new URLSearchParams(params.toString());
    if (tab === 'student') next.delete('rating');
    else next.set('rating', tab);
    // member and question filters belong to one team's questions, so they reset when the tab changes
    next.delete('rater');
    next.delete('question');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const counts: Record<Tab, number | undefined> = { student: studentCount, opex: opexCount, programme: programmeCount };
  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" aria-label="Rating type" className="flex flex-wrap gap-1 border-b border-border">
        {(['student', 'opex', 'programme'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={active === id}
            aria-controls="rating-panel"
            onClick={() => go(id)}
            className={cn('-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-[13.5px] font-medium transition-colors', active === id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}
          >
            {LABEL[id]}
            {counts[id] !== undefined && <span className="tabular rounded-full bg-muted px-2 py-0.5 text-[11.5px] font-semibold">{counts[id]}</span>}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="rating-panel" aria-labelledby={`tab-${active}`} className="flex flex-col gap-7">
        {active === 'opex' ? opex : active === 'programme' ? programme : student}
      </div>
    </div>
  );
}
