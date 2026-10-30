'use client';
import { useState } from 'react';
import { PageHeader, SectionTitle } from '@/components/ui/primitives';
import { SearchSelect } from '@/components/ui/search-select';
import { OnlineChip } from './online-classes';
import { useOnlineTeachers, type OnlineTeacher } from './data';
import { cn } from '@/lib/utils';

interface Row {
  label: string;
  of: (t: OnlineTeacher) => number;
  format: (v: number) => string;
  /** Higher is better (true) or lower is better (false). */
  good: 'high' | 'low';
}

const ROWS: Row[] = [
  { label: 'Total Classes', of: (t) => t.totalClasses, format: (v) => String(v), good: 'high' },
  { label: 'Teaching Style', of: (t) => t.teachingStyle, format: (v) => v.toFixed(2), good: 'high' },
  { label: 'Avg Duration', of: (t) => t.avgDuration, format: (v) => `${v.toFixed(1)} h`, good: 'high' },
  { label: 'Avg Attendance', of: (t) => t.avgAttendance, format: (v) => `${v.toFixed(0)}%`, good: 'high' },
  { label: 'Avg Watch Time', of: (t) => t.avgWatchTime, format: (v) => `${v.toFixed(0)} min`, good: 'high' },
];

/** Pick two online teachers and see their numbers side by side — the stronger cell is shaded. */
export function OnlineCompare() {
  const teachers = useOnlineTeachers();
  const options = teachers.map((t) => ({ value: t.id, label: `${t.name} — ${t.designation}` }));
  const [a, setA] = useState(teachers[1]?.id ?? 'all');
  const [b, setB] = useState(teachers[0]?.id ?? 'all');
  const A = teachers.find((t) => t.id === a);
  const B = teachers.find((t) => t.id === b);

  return (
    <div className="flex flex-col gap-7">
      <PageHeader eyebrow="Online" title="Compare" emphasis="teachers" description="Pick two online teachers and see their teaching numbers side by side. The stronger cell in each row is shaded." />

      <div className="grid gap-4 sm:grid-cols-2">
        <SearchSelect label="First teacher" value={a} onChange={setA} options={options} allLabel="Pick a teacher" searchPlaceholder="Search teachers…" />
        <SearchSelect label="Second teacher" value={b} onChange={setB} options={options} allLabel="Pick a teacher" searchPlaceholder="Search teachers…" />
      </div>

      {A && B && A !== B ? (
        <section className="flex flex-col gap-3">
          <SectionTitle title={`${A.name} vs ${B.name}`} hint="The teaching numbers of each teacher." />
          <div className="card-hover overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13.5px]">
              <thead className="bg-muted/60 text-left text-[12px] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Metric</th>
                  <th className="px-3 py-2.5 text-right font-medium">{A.name}</th>
                  <th className="px-3 py-2.5 text-right font-medium">{B.name}</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => {
                  const av = row.of(A);
                  const bv = row.of(B);
                  const aWins = row.good === 'high' ? av > bv + 1e-9 : av < bv - 1e-9;
                  const bWins = row.good === 'high' ? bv > av + 1e-9 : bv < av - 1e-9;
                  return (
                    <tr key={row.label} className="border-t border-border/70 transition-colors hover:bg-accent/40">
                      <td className="px-3 py-2.5 font-medium">{row.label}</td>
                      <td className={cn('tabular px-3 py-2.5 text-right', aWins && 'bg-[color-mix(in_oklab,var(--good)_9%,var(--background))] font-bold')}>{row.format(av)}</td>
                      <td className={cn('tabular px-3 py-2.5 text-right', bWins && 'bg-[color-mix(in_oklab,var(--good)_9%,var(--background))] font-bold')}>{row.format(bv)}</td>
                    </tr>
                  );
                })}
                <tr className="border-t border-border/70">
                  <td className="px-3 py-2.5 font-medium">Programmes</td>
                  <td className="px-3 py-2.5">
                    <span className="flex flex-wrap justify-end gap-x-3 gap-y-1">
                      {A.programmes.map((p) => (
                        <OnlineChip key={p} id={p} className="text-[12.5px]" />
                      ))}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex flex-wrap justify-end gap-x-3 gap-y-1">
                      {B.programmes.map((p) => (
                        <OnlineChip key={p} id={p} className="text-[12.5px]" />
                      ))}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <p className="py-10 text-center text-muted-foreground">Pick two different teachers to compare them.</p>
      )}
    </div>
  );
}
