'use client';
import { CalendarDays } from 'lucide-react';
import { Pill } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { ONLINE_PROGRAMS, type OnlineClass, type OnlineProgramId } from './data';

/** Colour dot + label, like the offline ProgramChip. */
export function OnlineChip({ id, className }: { id: OnlineProgramId; className?: string }) {
  const p = ONLINE_PROGRAMS[id];
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-foreground/85', className)}>
      <span className="size-2.5 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden />
      {p.label}
    </span>
  );
}

/** YYYY-MM-DD → "15 Jan 2026". */
const day = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** A list of online classes — one teacher's (upcoming / past) or every teacher's upcoming schedule (showTeacher).
 *  Same columns as the class system: Topic (with its date and time), Status, Program, Course, Type. */
export function OnlineClasses({ kind, classes, showTeacher = false }: { kind: 'upcoming' | 'past'; classes: (OnlineClass & { teacherName?: string })[]; showTeacher?: boolean }) {
  const upcoming = kind === 'upcoming';
  const rows = [...classes].sort((a, b) => (upcoming ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
  const cols = showTeacher ? 6 : 5;

  return (
    <div className="card-hover overflow-x-auto">
      <table className="w-full min-w-[760px] text-[13.5px]">
        <thead className="bg-muted/60 text-left text-[12px] text-muted-foreground">
          <tr>
            {showTeacher && <th className="px-3 py-2.5 font-medium">Teacher</th>}
            <th className="px-3 py-2.5 font-medium">Topic</th>
            <th className="px-3 py-2.5 font-medium">Status</th>
            <th className="px-3 py-2.5 font-medium">Program</th>
            <th className="px-3 py-2.5 font-medium">Course</th>
            <th className="px-3 py-2.5 font-medium">Type</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={cols} className="px-3 py-10 text-center text-muted-foreground">
                {upcoming ? 'No upcoming classes match these filters.' : 'No past classes match these filters.'}
              </td>
            </tr>
          )}
          {rows.map((c) => (
            <tr key={`${c.teacherName ?? ''}${c.id}`} className="border-t border-border/70 align-top transition-colors hover:bg-accent/40">
              {showTeacher && <td className="whitespace-nowrap px-3 py-3 font-medium">{c.teacherName}</td>}
              <td className="max-w-[320px] px-3 py-3">
                <div className="font-medium leading-snug">{c.topic}</div>
                <div className="tabular mt-1 inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] text-muted-foreground">
                  <CalendarDays className="size-3.5 shrink-0" aria-hidden />
                  {day(c.date)} · {c.time}
                </div>
              </td>
              <td className="px-3 py-3">
                <Pill tone={upcoming ? 'good' : 'neutral'}>{upcoming ? 'Scheduled' : 'Completed'}</Pill>
              </td>
              <td className="max-w-[260px] px-3 py-3">
                <span className="inline-flex items-start gap-1.5 leading-snug">
                  <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: ONLINE_PROGRAMS[c.programme].color }} aria-hidden />
                  {c.programName}
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{c.course}</td>
              <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{c.type}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
