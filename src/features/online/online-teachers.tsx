'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Search } from 'lucide-react';
import { Input } from '@tenminuteschool/design-system';
import { Monogram, PageHeader, Pill } from '@/components/ui/primitives';
import { OnlineCards } from './online-cards';
import { OnlineChip } from './online-classes';
import { ONLINE_PROGRAMS, useOnlineTeachers, type OnlineProgramId, type OnlineTeacher } from './data';
import { fmt, plural } from '@/lib/format';
import { cn } from '@/lib/utils';

type Key = 'name' | 'classes' | 'style' | 'duration' | 'attendance' | 'watch';

export function OnlineTeachersPage() {
  const teachers = useOnlineTeachers();
  const [q, setQ] = useState('');
  const [programme, setProgramme] = useState<OnlineProgramId | 'all'>('all');
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: 'style', dir: -1 });

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = teachers.filter(
      (t) => (programme === 'all' || t.programmes.includes(programme)) && (!needle || `${t.name} ${t.designation}`.toLowerCase().includes(needle)),
    );
    const val = (t: OnlineTeacher) => (sort.key === 'name' ? t.name : sort.key === 'classes' ? t.totalClasses : sort.key === 'style' ? t.teachingStyle : sort.key === 'duration' ? t.avgDuration : sort.key === 'attendance' ? t.avgAttendance : t.avgWatchTime);
    return [...list].sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      return (typeof av === 'number' ? av - (bv as number) : String(av).localeCompare(String(bv))) * sort.dir;
    });
  }, [teachers, q, programme, sort]);

  const th = (label: string, key: Key, right = true) => (
    <th scope="col" aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'} className={cn('whitespace-nowrap px-3 py-2.5 font-medium', right && 'text-right')}>
      <button type="button" onClick={() => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === 'name' ? 1 : -1 }))} className={cn('inline-flex items-center gap-1 hover:text-foreground', sort.key === key && 'text-foreground', right && 'flex-row-reverse')}>
        {label}
        {sort.key === key && (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  );

  return (
    <div className="flex flex-col gap-7">
      <PageHeader eyebrow="Online" title="The" emphasis="online teachers" description={`${plural(rows.length, 'teacher')} in view. Teaching Style is the average rating students gave the teacher's style.`} />

      <OnlineCards teachers={rows} />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-xs flex-1 sm:max-w-xs sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or designation…" aria-label="Search online teachers" className="h-9 pl-9" />
          </div>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Programme filter">
            {(['all', ...Object.keys(ONLINE_PROGRAMS)] as (OnlineProgramId | 'all')[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setProgramme(id)}
                aria-pressed={programme === id}
                className={cn('rounded-full px-3 py-1.5 text-[13px] font-medium ring-1 ring-inset transition-colors', programme === id ? 'bg-foreground text-background ring-foreground' : 'bg-background text-muted-foreground ring-border hover:text-foreground')}
              >
                {id === 'all' ? 'All programmes' : ONLINE_PROGRAMS[id].label}
              </button>
            ))}
          </div>
        </div>

        <div className="card-hover overflow-x-auto">
          <table className="w-full min-w-[820px] text-[13.5px]">
            <thead className="bg-muted/60 text-left text-[12px] text-muted-foreground">
              <tr>
                {th('Teacher', 'name', false)}
                <th className="px-3 py-2.5 font-medium">Programmes</th>
                {th('Total Classes', 'classes')}
                {th('Teaching Style', 'style')}
                {th('Avg Duration', 'duration')}
                {th('Avg Attendance', 'attendance')}
                {th('Avg Watch Time', 'watch')}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                    No online teachers match.
                  </td>
                </tr>
              )}
              {rows.map((t) => (
                <tr key={t.id} className="border-t border-border/70 transition-colors hover:bg-accent/40">
                  <td className="px-3 py-2.5">
                    <Link href={`/online/teachers/${t.id}`} className="group flex items-center gap-3">
                      <Monogram name={t.name} src={t.photo} size="sm" />
                      <span>
                        <span className="flex items-center gap-2 font-medium group-hover:underline">
                          {t.name}
                          {t.status === 'inactive' && <Pill tone="warn" className="text-[10.5px]">Inactive</Pill>}
                        </span>
                        <span className="block text-[11.5px] text-muted-foreground">{t.designation}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex flex-wrap gap-x-3 gap-y-1">
                      {t.programmes.map((p) => (
                        <OnlineChip key={p} id={p} className="text-[12.5px]" />
                      ))}
                    </span>
                  </td>
                  <td className="tabular px-3 py-2.5 text-right">{t.totalClasses}</td>
                  <td className="tabular bg-[color-mix(in_oklab,var(--good)_9%,var(--background))] px-3 py-2.5 text-right font-bold">{fmt(t.teachingStyle)}</td>
                  <td className="tabular px-3 py-2.5 text-right text-muted-foreground">{fmt(t.avgDuration, 1)} h</td>
                  <td className="tabular px-3 py-2.5 text-right text-muted-foreground">{fmt(t.avgAttendance, 0)}%</td>
                  <td className="tabular px-3 py-2.5 text-right text-muted-foreground">{fmt(t.avgWatchTime, 0)} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
