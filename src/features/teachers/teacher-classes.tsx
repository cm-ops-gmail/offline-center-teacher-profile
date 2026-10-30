'use client';
import { ProgramChip, Pill } from '@/components/ui/primitives';
import type { BatchRecord } from '@/features/ratings/types';

/**
 * A teacher's classes, derived from the batches they teach: **Upcoming** = a batch whose Last Rating is
 * still missing (classes still to come); **Past** = a batch that already had its Last Rating.
 *
 * The Date and Time columns are DEMO values for now — the real class schedule will come from the class
 * system later. All demo values are derived deterministically from the batch id, so they are stable
 * between reloads. Past rows use the batch's real Last Rating date when one exists.
 */
export function TeacherClasses({ kind, batches }: { kind: 'upcoming' | 'past'; batches: BatchRecord[] }) {
  const upcoming = kind === 'upcoming';
  const rows = batches
    .filter((b) => (upcoming ? b.last == null : b.last != null))
    .map((b) => ({ b, date: classDate(b, upcoming), time: classTime(b) }))
    .sort((a, x) => (upcoming ? (a.date ?? '').localeCompare(x.date ?? '') : (x.date ?? '').localeCompare(a.date ?? '')));

  const empty = upcoming
    ? 'Every batch of this teacher already has its Last Rating — nothing upcoming right now.'
    : 'No completed classes yet — a batch moves here once its Last Rating is in.';

  return (
    <div className="card-hover overflow-x-auto">
      <table className="w-full min-w-[640px] text-[13.5px]">
        <thead className="bg-muted/60 text-left text-[12px] text-muted-foreground">
          <tr>
            <th className="px-3 py-2.5 font-medium">Programme</th>
            <th className="px-3 py-2.5 font-medium">Batch</th>
            <th className="px-3 py-2.5 font-medium">Branch</th>
            <th className="px-3 py-2.5 font-medium">Date</th>
            <th className="px-3 py-2.5 font-medium">Time</th>
            <th className="px-3 py-2.5 text-right font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                {empty}
              </td>
            </tr>
          )}
          {rows.map(({ b, date, time }) => (
            <tr key={b.id} className="border-t border-border/70 transition-colors hover:bg-accent/40">
              <td className="px-3 py-2.5">
                <ProgramChip id={b.program} />
              </td>
              <td className="px-3 py-2.5 font-medium">{b.batch}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{b.branch}</td>
              <td className="tabular px-3 py-2.5">{day(date)}</td>
              <td className="tabular px-3 py-2.5 text-muted-foreground">{time}</td>
              <td className="px-3 py-2.5 text-right">
                <Pill tone={upcoming ? 'good' : 'neutral'}>{upcoming ? 'Ongoing' : 'Completed'}</Pill>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border/70 px-3 py-2.5 text-[12px] text-muted-foreground">
        {upcoming ? 'A batch moves from here to Past classes once its Last Rating is in.' : 'These batches have had their Last Rating, so their classes are done.'}
        {' '}Dates and times are demo values until the class schedule is connected.
      </p>
    </div>
  );
}

/* ---------------- demo schedule (to be replaced by the real class system) ---------------- */

const SLOTS = ['09:00 AM', '11:00 AM', '01:30 PM', '04:00 PM', '06:30 PM'];

const hash = (s: string): number => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);

/** YYYY-MM-DD for the row, or null if unknown. */
function classDate(b: BatchRecord, upcoming: boolean): string | null {
  if (!upcoming) return b.last?.date ?? b.first?.date ?? null;
  // A stable "scheduled" day in the next two weeks, so the demo list looks like a real timetable.
  const d = new Date();
  d.setDate(d.getDate() + 1 + (Math.abs(hash(b.id)) % 14));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function classTime(b: BatchRecord): string {
  return SLOTS[Math.abs(hash(`${b.id}:t`)) % SLOTS.length];
}

/** YYYY-MM-DD → "15 Jan 2026" (— when unknown). */
const day = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
