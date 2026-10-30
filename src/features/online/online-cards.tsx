'use client';
import { StatTile } from '@/components/ui/primitives';
import { fmt } from '@/lib/format';
import { metricsOf, type OnlineClass } from './data';

/** The online segment's cards — Total Classes, Teaching Style, Avg Duration, Avg Attendance, Avg Watch Time — for whichever classes are in view. */
export function OnlineCards({ classes }: { classes: OnlineClass[] }) {
  const m = metricsOf(classes);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5" role="group" aria-label="Online teaching summary">
      <StatTile label="Total Classes" value={m.classes || '—'} sub="classes taken" />
      <StatTile label="Teaching Style" value={m.style != null ? fmt(m.style) : '—'} sub="average rating out of 5" />
      <StatTile label="Avg Duration" value={m.duration != null ? `${fmt(m.duration, 1)} h` : '—'} sub="per class" />
      <StatTile label="Avg Attendance" value={m.attendance != null ? `${fmt(m.attendance, 0)}%` : '—'} sub="of enrolled students" />
      <StatTile label="Avg Watch Time" value={m.watch != null ? `${fmt(m.watch, 0)} min` : '—'} sub="per class" />
    </div>
  );
}
