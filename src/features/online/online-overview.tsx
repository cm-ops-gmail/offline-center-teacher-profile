'use client';
import Link from 'next/link';
import { PageHeader, SectionTitle } from '@/components/ui/primitives';
import { OnlineCards } from './online-cards';
import { OnlineChip } from './online-classes';
import { ONLINE_PROGRAMS, useOnlineTeachers, type OnlineProgramId } from './data';
import { fmt } from '@/lib/format';

/** The Online Teacher segment's landing page: the headline cards, then the numbers by programme. */
export function OnlineOverview() {
  const teachers = useOnlineTeachers();
  const byProgramme = (Object.keys(ONLINE_PROGRAMS) as OnlineProgramId[]).map((id) => {
    const group = teachers.filter((t) => t.programmes.includes(id));
    const n = group.length || 1;
    return {
      id,
      teachers: group.length,
      classes: group.reduce((a, t) => a + t.totalClasses, 0),
      style: group.reduce((a, t) => a + t.teachingStyle, 0) / n,
      duration: group.reduce((a, t) => a + t.avgDuration, 0) / n,
      attendance: group.reduce((a, t) => a + t.avgAttendance, 0) / n,
      watch: group.reduce((a, t) => a + t.avgWatchTime, 0) / n,
    };
  });

  return (
    <div className="flex flex-col gap-7">
      <PageHeader eyebrow="Online" title="The" emphasis="online teachers" description="Everything the online teachers are doing: classes taken, how students rate their teaching style, and how the classes are watched." />

      <OnlineCards teachers={teachers} />

      <section className="flex flex-col gap-3">
        <SectionTitle title="By programme" hint="Click a teacher on the Teachers screen to open their classes." />
        <div className="card-hover overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13.5px]">
            <thead className="bg-muted/60 text-left text-[12px] text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-medium">Programme</th>
                <th className="px-3 py-2.5 text-right font-medium">Teachers</th>
                <th className="px-3 py-2.5 text-right font-medium">Classes</th>
                <th className="px-3 py-2.5 text-right font-medium">Teaching Style</th>
                <th className="px-3 py-2.5 text-right font-medium">Avg Duration</th>
                <th className="px-3 py-2.5 text-right font-medium">Avg Attendance</th>
                <th className="px-3 py-2.5 text-right font-medium">Avg Watch Time</th>
              </tr>
            </thead>
            <tbody>
              {byProgramme.map((p) => (
                <tr key={p.id} className="border-t border-border/70 transition-colors hover:bg-accent/40">
                  <td className="px-3 py-2.5">
                    <OnlineChip id={p.id} />
                  </td>
                  <td className="tabular px-3 py-2.5 text-right">{p.teachers}</td>
                  <td className="tabular px-3 py-2.5 text-right font-bold">{p.classes}</td>
                  <td className="tabular px-3 py-2.5 text-right">{fmt(p.style)}</td>
                  <td className="tabular px-3 py-2.5 text-right text-muted-foreground">{fmt(p.duration, 1)} h</td>
                  <td className="tabular px-3 py-2.5 text-right text-muted-foreground">{fmt(p.attendance, 0)}%</td>
                  <td className="tabular px-3 py-2.5 text-right text-muted-foreground">{fmt(p.watch, 0)} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-[13px] text-muted-foreground">
        Open the <Link href="/online/teachers" className="font-medium text-foreground underline underline-offset-2">teachers list</Link> to dive into any teacher, or{' '}
        <Link href="/online/compare" className="font-medium text-foreground underline underline-offset-2">compare two teachers</Link>.
      </p>
    </div>
  );
}
