'use client';
import Link from 'next/link';
import { PageHeader, SectionTitle } from '@/components/ui/primitives';
import { OnlineCards } from './online-cards';
import { OnlineChip } from './online-classes';
import { metricsOf, ONLINE_PROGRAMS, SUBJECTS, useOnlineTeachers, type OnlineProgramId } from './data';
import { fmt } from '@/lib/format';

/** The Online Teacher segment's landing page: the headline cards, then the numbers by programme and subject. */
export function OnlineOverview() {
  const teachers = useOnlineTeachers();
  const allPast = teachers.flatMap((t) => t.past);

  const byProgramme = (Object.keys(ONLINE_PROGRAMS) as OnlineProgramId[]).map((id) => {
    const group = teachers.filter((t) => t.programmes.includes(id));
    const classes = allPast.filter((c) => c.programme === id);
    return { id, teachers: group.length, m: metricsOf(classes) };
  });

  const bySubject = SUBJECTS.map((s) => {
    const classes = allPast.filter((c) => c.subject === s);
    return { subject: s, teachers: teachers.filter((t) => t.subjects.includes(s)).length, m: metricsOf(classes) };
  });

  const table = (rows: { key: string; label: React.ReactNode; teachers: number; m: ReturnType<typeof metricsOf> }[]) => (
    <div className="card-hover overflow-x-auto">
      <table className="w-full min-w-[720px] text-[13.5px]">
        <thead className="bg-muted/60 text-left text-[12px] text-muted-foreground">
          <tr>
            <th className="px-3 py-2.5 font-medium">Name</th>
            <th className="px-3 py-2.5 text-right font-medium">Teachers</th>
            <th className="px-3 py-2.5 text-right font-medium">Classes</th>
            <th className="px-3 py-2.5 text-right font-medium">Teaching Style</th>
            <th className="px-3 py-2.5 text-right font-medium">Avg Duration</th>
            <th className="px-3 py-2.5 text-right font-medium">Avg Attendance</th>
            <th className="px-3 py-2.5 text-right font-medium">Avg Watch Time</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-border/70 transition-colors hover:bg-accent/40">
              <td className="px-3 py-2.5">{r.label}</td>
              <td className="tabular px-3 py-2.5 text-right">{r.teachers}</td>
              <td className="tabular px-3 py-2.5 text-right font-bold">{r.m.classes}</td>
              <td className="tabular px-3 py-2.5 text-right">{r.m.style != null ? fmt(r.m.style) : '—'}</td>
              <td className="tabular px-3 py-2.5 text-right text-muted-foreground">{r.m.duration != null ? `${fmt(r.m.duration, 1)} h` : '—'}</td>
              <td className="tabular px-3 py-2.5 text-right text-muted-foreground">{r.m.attendance != null ? `${fmt(r.m.attendance, 0)}%` : '—'}</td>
              <td className="tabular px-3 py-2.5 text-right text-muted-foreground">{r.m.watch != null ? `${fmt(r.m.watch, 0)} min` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="flex flex-col gap-7">
      <PageHeader eyebrow="Online" title="The" emphasis="online teachers" description="Everything the online teachers are doing: classes taken, how students rate their teaching style, and how the classes are watched." />

      <OnlineCards classes={allPast} />

      <section className="flex flex-col gap-3">
        <SectionTitle title="By programme" hint="Click a teacher on the Teachers screen to open their classes." />
        {table(byProgramme.map((p) => ({ key: p.id, label: <OnlineChip id={p.id} />, teachers: p.teachers, m: p.m })))}
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle title="By subject" />
        {table(bySubject.map((s) => ({ key: s.subject, label: s.subject, teachers: s.teachers, m: s.m })))}
      </section>

      <p className="text-[13px] text-muted-foreground">
        Open the <Link href="/online/teachers" className="font-medium text-foreground underline underline-offset-2">teachers list</Link> to dive into any teacher, or{' '}
        <Link href="/online/compare" className="font-medium text-foreground underline underline-offset-2">compare two teachers</Link>.
      </p>
    </div>
  );
}
