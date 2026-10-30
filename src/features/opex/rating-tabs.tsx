'use client';
import type { ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

type Tab = 'upcoming' | 'past' | 'student' | 'opex' | 'programme';
const LABEL: Record<Tab, string> = { upcoming: 'Upcoming classes', past: 'Past classes', student: 'Student rating', opex: 'OpEx rating', programme: 'Programme team rating' };
const IS_TAB = (v: string | null): v is Tab => v === 'upcoming' || v === 'past' || v === 'opex' || v === 'programme';

/** The open tab (from `?rating=`) and a function to switch it. Member / question filters reset on a switch because each team has its own. */
export function useRatingTab(): [Tab, (tab: Tab) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const raw = params.get('rating');
  const active: Tab = IS_TAB(raw) ? raw : 'student';
  const go = (tab: Tab) => {
    const next = new URLSearchParams(params.toString());
    if (tab === 'student') next.delete('rating');
    else next.set('rating', tab);
    next.delete('rater');
    next.delete('question');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  return [active, go];
}

/**
 * Upcoming classes | Past classes (teacher page only) | Student rating | OpEx rating | Programme team rating —
 * kept in the URL as `?rating=past` / `?rating=opex` / `?rating=programme` so a view can be shared.
 */
export function RatingTabs({
  student,
  opex,
  programme,
  upcoming,
  past,
  studentCount,
  opexCount,
  programmeCount,
  upcomingCount,
  pastCount,
}: {
  student: ReactNode;
  opex: ReactNode;
  programme: ReactNode;
  /** Teacher page only: the Upcoming / Past classes lists. */
  upcoming?: ReactNode;
  past?: ReactNode;
  studentCount?: number;
  opexCount: number;
  programmeCount: number;
  upcomingCount?: number;
  pastCount?: number;
}) {
  const [active, go] = useRatingTab();
  const counts: Record<Tab, number | undefined> = { upcoming: upcomingCount, past: pastCount, student: studentCount, opex: opexCount, programme: programmeCount };
  const tabs: Tab[] = [
    ...(upcoming != null ? (['upcoming'] as const) : []),
    ...(past != null ? (['past'] as const) : []),
    'student',
    'opex',
    'programme',
  ];
  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" aria-label="Teacher view" className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map((id) => (
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
        {active === 'upcoming' && upcoming != null ? upcoming : active === 'past' && past != null ? past : active === 'opex' ? opex : active === 'programme' ? programme : student}
      </div>
    </div>
  );
}
