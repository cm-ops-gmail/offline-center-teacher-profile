'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@tenminuteschool/design-system';
import { PageHeader, SectionTitle } from '@/components/ui/primitives';
import { OnlineCards } from './online-cards';
import { OnlineClasses } from './online-classes';
import { OnlineDateRange } from './online-class-details';
import { inDateRange, ONLINE_PROGRAMS, useOnlineTeachers, type OnlineClass, type OnlineProgramId } from './data';

/** The Online Teacher segment's landing page: the headline cards, then every teacher's upcoming classes with programme / subject filters. */
export function OnlineOverview() {
  const teachers = useOnlineTeachers();
  const [programme, setProgramme] = useState<OnlineProgramId | 'all'>('all');
  const [subject, setSubject] = useState<string | 'all'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // The cards follow the date range too.
  const allPast = useMemo(() => teachers.flatMap((t) => t.past).filter((c) => inDateRange(c, from, to)), [teachers, from, to]);

  // Every teacher's upcoming classes, tagged with the teacher, narrowed by the filters, soonest first.
  const subjectOptions = useMemo(() => [...new Set(teachers.flatMap((t) => [...t.past, ...t.upcoming].map((c) => c.subject)))].sort(), [teachers]);
  const upcoming = useMemo(
    () =>
      teachers
        .flatMap((t) => t.upcoming.map((c) => ({ ...c, teacherName: t.name })))
        .filter((c) => (programme === 'all' || c.programme === programme) && (subject === 'all' || c.subject === subject) && inDateRange(c, from, to))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [teachers, programme, subject, from, to],
  );

  return (
    <div className="flex flex-col gap-7">
      <PageHeader eyebrow="Online" title="The" emphasis="online teachers" description="Everything the online teachers are doing: classes taken, how students rate their teaching style, and how the classes are watched." />

      <OnlineCards classes={allPast} />

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionTitle title="Upcoming classes" hint="Every online teacher's schedule, soonest first." />
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid w-44 gap-1.5">
              <Label htmlFor="ov-programme">Programme</Label>
              <Select value={programme} onValueChange={(v) => setProgramme(v === 'all' ? 'all' : (v as OnlineProgramId))}>
                <SelectTrigger id="ov-programme" className="h-9 w-full">
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
            <div className="grid w-44 gap-1.5">
              <Label htmlFor="ov-subject">Subject</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger id="ov-subject" className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All subjects</SelectItem>
                  {subjectOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <OnlineDateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
          </div>
        </div>
        <OnlineClasses kind="upcoming" classes={upcoming as OnlineClass[]} showTeacher />
        {(programme !== 'all' || subject !== 'all' || from || to) && (
          <p className="text-xs text-muted-foreground">
            Filtered to {programme === 'all' ? 'all programmes' : ONLINE_PROGRAMS[programme].label} · {subject === 'all' ? 'all subjects' : subject}
            {(from || to) && ` · ${from || 'start'} to ${to || 'onward'}`}. Set the filters back to “All” and clear the dates to see everything.
          </p>
        )}
      </section>

      <p className="text-[13px] text-muted-foreground">
        Open the <Link href="/online/teachers" className="font-medium text-foreground underline underline-offset-2">teachers list</Link> to dive into any teacher, or{' '}
        <Link href="/online/compare" className="font-medium text-foreground underline underline-offset-2">compare two teachers</Link>.
      </p>
    </div>
  );
}
