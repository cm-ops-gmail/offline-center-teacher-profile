'use client';
import type { ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

/** Two tabs — Student rating | OpEx rating — kept in the URL as `?rating=opex` so a view can be shared. */
export function RatingTabs({ student, opex, studentCount, opexCount }: { student: ReactNode; opex: ReactNode; studentCount?: number; opexCount: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const active = params.get('rating') === 'opex' ? 'opex' : 'student';

  const go = (tab: 'student' | 'opex') => {
    const next = new URLSearchParams(params.toString());
    if (tab === 'opex') next.set('rating', 'opex');
    else next.delete('rating');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const tab = (id: 'student' | 'opex', label: string, count?: number) => (
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
      {label}
      {count !== undefined && <span className="tabular rounded-full bg-muted px-2 py-0.5 text-[11.5px] font-semibold">{count}</span>}
    </button>
  );

  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" aria-label="Rating type" className="flex gap-1 border-b border-border">
        {tab('student', 'Student rating', studentCount)}
        {tab('opex', 'OpEx rating', opexCount)}
      </div>
      <div role="tabpanel" id="rating-panel" aria-labelledby={`tab-${active}`} className="flex flex-col gap-7">
        {active === 'opex' ? opex : student}
      </div>
    </div>
  );
}
