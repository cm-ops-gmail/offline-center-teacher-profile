'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Search } from 'lucide-react';
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@tenminuteschool/design-system';
import { Monogram, PageHeader, Pill } from '@/components/ui/primitives';
import { OnlineCards } from './online-cards';
import { OnlineDateRange } from './online-class-details';
import { inDateRange, metricsOf, ONLINE_PROGRAMS, useOnlineTeachers, type OnlineProgramId, type OnlineTeacher } from './data';
import { fmt, plural } from '@/lib/format';
import { cn } from '@/lib/utils';

type Key = 'name' | 'classes' | 'style' | 'duration' | 'attendance' | 'watch';

export function OnlineTeachersPage() {
  const teachers = useOnlineTeachers();
  const [q, setQ] = useState('');
  const [programme, setProgramme] = useState<OnlineProgramId | 'all'>('all');
  const [teacherFilter, setTeacherFilter] = useState<string>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: 'style', dir: -1 });

  // Every number comes from the teachers' past classes, narrowed by the programme, teacher and date filters.
  const pastOf = (t: OnlineTeacher) => t.past.filter((c) => (programme === 'all' || c.programme === programme) && inDateRange(c, from, to));
  const inFilter = useMemo(() => teachers.filter((t) => (teacherFilter === 'all' || t.id === teacherFilter) && (programme === 'all' || t.programmes.includes(programme))), [teachers, teacherFilter, programme]);
  const classesInView = useMemo(() => inFilter.flatMap(pastOf), [inFilter, programme, from, to]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = inFilter
      .filter((t) => !needle || `${t.name} ${t.designation} ${t.subjects.join(' ')}`.toLowerCase().includes(needle))
      .map((t) => ({ t, m: metricsOf(pastOf(t)) }));
    const val = (r: (typeof list)[number]) => (sort.key === 'name' ? r.t.name : sort.key === 'classes' ? r.m.classes : sort.key === 'style' ? r.m.style : sort.key === 'duration' ? r.m.duration : sort.key === 'attendance' ? r.m.attendance : r.m.watch);
    return [...list].sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      if (av == null) return 1;
      if (bv == null) return -1;
      return (typeof av === 'number' ? av - (bv as number) : String(av).localeCompare(String(bv))) * sort.dir;
    });
  }, [inFilter, programme, q, sort, from, to]);

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

      <OnlineCards classes={classesInView} />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative max-w-xs flex-1 sm:max-w-xs sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, subject…" aria-label="Search online teachers" className="h-9 pl-9" />
          </div>
          <div className="grid w-44 gap-1.5">
            <Label htmlFor="tl-programme">Programme</Label>
            <Select value={programme} onValueChange={(v) => setProgramme(v === 'all' ? 'all' : (v as OnlineProgramId))}>
              <SelectTrigger id="tl-programme" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All programmes</SelectItem>
                {(Object.keys(ONLINE_PROGRAMS) as OnlineProgramId[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {ONLINE_PROGRAMS[p].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid w-52 gap-1.5">
            <Label htmlFor="tl-teacher">Teacher</Label>
            <Select value={teacherFilter} onValueChange={setTeacherFilter}>
              <SelectTrigger id="tl-teacher" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All teachers</SelectItem>
                {teachers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <OnlineDateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
        </div>

        <div className="card-hover overflow-x-auto">
          <table className="w-full min-w-[880px] text-[13.5px]">
            <thead className="bg-muted/60 text-left text-[12px] text-muted-foreground">
              <tr>
                {th('Teacher', 'name', false)}
                <th className="px-3 py-2.5 font-medium">Programmes</th>
                <th className="px-3 py-2.5 font-medium">Subjects</th>
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
                  <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                    No online teachers match.
                  </td>
                </tr>
              )}
              {rows.map(({ t, m }) => (
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
                  <td className="tabular px-3 py-2.5 text-muted-foreground" title={t.programmes.map((p) => ONLINE_PROGRAMS[p].label).join(', ')}>
                    {t.programmes.length}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{t.subjects.join(', ')}</td>
                  <td className="tabular px-3 py-2.5 text-right">{m.classes || '—'}</td>
                  <td className="tabular bg-[color-mix(in_oklab,var(--good)_9%,var(--background))] px-3 py-2.5 text-right font-bold">{m.style != null ? fmt(m.style) : '—'}</td>
                  <td className="tabular px-3 py-2.5 text-right text-muted-foreground">{m.duration != null ? `${fmt(m.duration, 1)} h` : '—'}</td>
                  <td className="tabular px-3 py-2.5 text-right text-muted-foreground">{m.attendance != null ? `${fmt(m.attendance, 0)}%` : '—'}</td>
                  <td className="tabular px-3 py-2.5 text-right text-muted-foreground">{m.watch != null ? `${fmt(m.watch, 0)} min` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
