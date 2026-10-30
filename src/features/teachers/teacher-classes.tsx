'use client';
import { ProgramChip, Pill } from '@/components/ui/primitives';
import type { BatchRecord } from '@/features/ratings/types';

/**
 * A teacher's classes, derived from the batches they teach: **Upcoming** = a batch whose Last Rating is
 * still missing (classes still to come); **Past** = a batch that already had its Last Rating.
 */
export function TeacherClasses({ kind, batches }: { kind: 'upcoming' | 'past'; batches: BatchRecord[] }) {
  const upcoming = kind === 'upcoming';
  const rows = batches.filter((b) => (upcoming ? b.last == null : b.last != null));

  const empty = upcoming
    ? 'Every batch of this teacher already has its Last Rating — nothing upcoming right now.'
    : 'No completed classes yet — a batch moves here once its Last Rating is in.';

  return (
    <div className="card-hover overflow-x-auto">
      <table className="w-full min-w-[480px] text-[13.5px]">
        <thead className="bg-muted/60 text-left text-[12px] text-muted-foreground">
          <tr>
            <th className="px-3 py-2.5 font-medium">Programme</th>
            <th className="px-3 py-2.5 font-medium">Batch</th>
            <th className="px-3 py-2.5 font-medium">Branch</th>
            <th className="px-3 py-2.5 text-right font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-10 text-center text-muted-foreground">
                {empty}
              </td>
            </tr>
          )}
          {rows.map((b) => (
            <tr key={b.id} className="border-t border-border/70 transition-colors hover:bg-accent/40">
              <td className="px-3 py-2.5">
                <ProgramChip id={b.program} />
              </td>
              <td className="px-3 py-2.5 font-medium">{b.batch}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{b.branch}</td>
              <td className="px-3 py-2.5 text-right">
                <Pill tone={upcoming ? 'good' : 'neutral'}>{upcoming ? 'Ongoing' : 'Completed'}</Pill>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border/70 px-3 py-2.5 text-[12px] text-muted-foreground">
        {upcoming ? 'A batch moves from here to Past classes once its Last Rating is in.' : 'These batches have had their Last Rating, so their classes are done.'}
      </p>
    </div>
  );
}
