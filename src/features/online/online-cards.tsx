'use client';
import { StatTile } from '@/components/ui/primitives';
import { fmt } from '@/lib/format';
import type { OnlineTeacher } from './data';

/** The online segment's cards: Total Classes, Teaching Style, Avg Duration, Avg Attendance, Avg Watch Time. */
export function OnlineCards({ teachers }: { teachers: OnlineTeacher[] }) {
  const n = teachers.length || 1;
  const totalClasses = teachers.reduce((a, t) => a + t.totalClasses, 0);
  const style = teachers.reduce((a, t) => a + t.teachingStyle, 0) / n;
  const duration = teachers.reduce((a, t) => a + t.avgDuration, 0) / n;
  const attendance = teachers.reduce((a, t) => a + t.avgAttendance, 0) / n;
  const watch = teachers.reduce((a, t) => a + t.avgWatchTime, 0) / n;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5" role="group" aria-label="Online teaching summary">
      <StatTile label="Total Classes" value={teachers.length ? totalClasses : '—'} sub="classes taken" />
      <StatTile label="Teaching Style" value={teachers.length ? fmt(style) : '—'} sub="average rating out of 5" />
      <StatTile label="Avg Duration" value={teachers.length ? `${fmt(duration, 1)} h` : '—'} sub="per class" />
      <StatTile label="Avg Attendance" value={teachers.length ? `${fmt(attendance, 0)}%` : '—'} sub="of enrolled students" />
      <StatTile label="Avg Watch Time" value={teachers.length ? `${fmt(watch, 0)} min` : '—'} sub="per class" />
    </div>
  );
}
