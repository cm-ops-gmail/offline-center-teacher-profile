'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { ClassPill, sheet } from '@/components/ui/sheet-table';
import { batchRating } from '@/features/ratings/analytics';
import { columnsFor } from '@/features/ratings/criteria';
import type { RatingClass } from '@/features/ratings/filters';
import { PROGRAM_BY_ID } from '@/features/ratings/programs';
import type { BatchRecord, ProgramId, Rating } from '@/features/ratings/types';
import { fmt, plural } from '@/lib/format';
import { cn } from '@/lib/utils';

/** One line of the sheet: a single First Rating or Last Rating for a batch. */
interface Line {
  key: string;
  batch: BatchRecord;
  kind: 'first' | 'last';
  rating: Rating;
}

type SortKey = 'teacher' | 'branch' | 'level' | 'batch' | 'batchRating' | 'class' | 'avg' | `c${number}`;
type Sort = { key: SortKey; dir: 1 | -1 } | null;

const text = (l: Line, k: SortKey): string | number | null => {
  if (k === 'teacher') return l.batch.teacherName;
  if (k === 'branch') return l.batch.branch;
  if (k === 'level') return l.batch.level ?? '';
  if (k === 'batch') return l.batch.batch;
  if (k === 'batchRating') return batchRating(l.batch);
  if (k === 'class') return l.kind === 'first' ? 0 : 1;
  if (k === 'avg') return l.rating.avg;
  return l.rating.scores[Number(k.slice(1))] ?? null;
};

const cmp = (a: string | number | null, b: string | number | null) => {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), undefined, { numeric: true });
};

function Th({ label, k, sort, onSort, avg, left, gold }: { label: string; k: SortKey; sort: Sort; onSort: (k: SortKey) => void; avg?: boolean; left?: boolean; gold?: boolean }) {
  const active = sort?.key === k;
  return (
    <th scope="col" aria-sort={active ? (sort!.dir === 1 ? 'ascending' : 'descending') : 'none'} className={cn(avg ? sheet.thAvg : sheet.th, left && 'text-left', gold && 'bg-[color-mix(in_oklab,var(--gold)_28%,var(--background))]')}>
      <button type="button" onClick={() => onSort(k)} className="inline-flex items-center justify-center gap-1 rounded hover:opacity-70">
        {label}
        {active && (sort!.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  );
}

/** Mirrors the Google Sheet: instructor · branch · (level) · batch · class · five criteria · Average Rating · Remarks. */
export function BatchTable({ batches, program, showTeacher = true, cls = 'all', criterion = 'all' }: { batches: BatchRecord[]; program: ProgramId; showTeacher?: boolean; cls?: RatingClass; /** Show only this criterion's column (the Criterion filter) */ criterion?: string }) {
  const def = PROGRAM_BY_ID[program];
  const columns = columnsFor(program, criterion);
  // Highest average batch rating first (each batch's First and Last Rating together, First above Last).
  const [sort, setSort] = useState<Sort>({ key: 'batchRating', dir: -1 });

  const lines = useMemo<Line[]>(
    () =>
      batches.flatMap((b) =>
        (['first', 'last'] as const).flatMap((kind) => (b[kind] && (cls === 'all' || cls === kind) ? [{ key: `${b.id}:${kind}`, batch: b, kind, rating: b[kind]! }] : [])),
      ),
    [batches, cls],
  );
  const hasRemarks = lines.some((l) => l.batch.remarks.length > 0);

  const rows = useMemo(() => {
    // Ties (and a batch's own two rows) fall back to: teacher, branch, batch, First Rating above Last Rating.
    const base: SortKey[] = ['teacher', 'branch', 'level', 'batch', 'class'];
    return [...lines].sort((a, b) => {
      if (sort) {
        const c = cmp(text(a, sort.key), text(b, sort.key)) * sort.dir;
        if (c) return c;
      }
      for (const k of base) {
        const c = cmp(text(a, k), text(b, k));
        if (c) return c;
      }
      return 0;
    });
  }, [lines, sort]);

  const onSort = (key: SortKey) => setSort((s) => (s?.key !== key ? { key, dir: key === 'teacher' || key === 'branch' || key === 'batch' || key === 'level' || key === 'class' ? 1 : -1 } : s.dir === -1 && key !== 'teacher' ? { key, dir: 1 } : s.dir === 1 && (key === 'teacher' || key === 'branch' || key === 'batch' || key === 'level' || key === 'class') ? { key, dir: -1 } : null));

  return (
    <div className="flex flex-col gap-3">
      <div className="card-hover overflow-x-auto">
        <table className="w-full min-w-[1060px] border-collapse text-[13.5px]">
          <thead>
            <tr>
              {showTeacher && <Th label="instructor_name" k="teacher" sort={sort} onSort={onSort} left />}
              <Th label="branch" k="branch" sort={sort} onSort={onSort} />
              {def.hasLevel && <Th label="level" k="level" sort={sort} onSort={onSort} />}
              <Th label="batch" k="batch" sort={sort} onSort={onSort} />
              <Th label="Average batch rating" k="batchRating" sort={sort} onSort={onSort} gold />
              <Th label="class" k="class" sort={sort} onSort={onSort} />
              {columns.map((c, i) => (
                <Th key={c} label={c} k={`c${i}`} sort={sort} onSort={onSort} />
              ))}
              <Th label={criterion === 'all' ? 'Average Rating' : `Average · ${criterion}`} k="avg" sort={sort} onSort={onSort} avg />
              {hasRemarks && <th className={cn(sheet.th, 'text-left')}>Remarks</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={20} className="px-3 py-10 text-center text-muted-foreground">
                  No ratings match.
                </td>
              </tr>
            )}
            {rows.map((l, i) => {
              const newGroup = i === 0 || rows[i - 1].batch.id !== l.batch.id;
              return (
                <tr key={l.key} className={cn('transition-colors hover:bg-accent/40', newGroup ? 'border-t border-border' : 'border-t border-border/40')}>
                  {showTeacher && (
                    <td className="px-3 py-2.5 font-medium">
                      {newGroup ? (
                        <Link href={`/teachers/${l.batch.teacherId}`} className="hover:underline">
                          {l.batch.teacherName}
                        </Link>
                      ) : (
                        <span className="sr-only">{l.batch.teacherName}</span>
                      )}
                    </td>
                  )}
                  <td className={cn(sheet.td, 'text-muted-foreground')}>{newGroup ? l.batch.branch : <span className="sr-only">{l.batch.branch}</span>}</td>
                  {def.hasLevel && <td className={cn(sheet.td, 'text-muted-foreground')}>{newGroup ? l.batch.level ?? '—' : <span className="sr-only">{l.batch.level}</span>}</td>}
                  <td className={sheet.td}>{newGroup ? l.batch.batch : <span className="sr-only">{l.batch.batch}</span>}</td>
                  {newGroup &&
                    (() => {
                      // one merged cell for the batch: the average of its First and Last Rating
                      let span = 1;
                      while (rows[i + span]?.batch.id === l.batch.id) span++;
                      return (
                        <td rowSpan={span} className={cn(sheet.td, 'bg-[color-mix(in_oklab,var(--gold)_12%,transparent)] align-middle text-[15px] font-bold')}>
                          {fmt(batchRating(l.batch))}
                        </td>
                      );
                    })()}
                  <td className="px-3 py-2 text-center">
                    <ClassPill kind={l.kind} />
                  </td>
                  {columns.map((_, ci) => (
                    <td key={ci} className={sheet.td}>
                      {fmt(l.rating.scores[ci])}
                    </td>
                  ))}
                  <td className={sheet.tdAvg}>{fmt(l.rating.avg)}</td>
                  {hasRemarks && <td className="px-3 py-2.5 text-[12.5px] italic text-muted-foreground">{l.kind === 'first' || !l.batch.first ? l.batch.remarks.join(' · ') : ''}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[12px] text-muted-foreground">
        {plural(rows.length, 'rating row')} · {plural(new Set(rows.map((r) => r.batch.id)).size, 'batch', 'batches')} · {sort?.key === 'batchRating' ? (sort.dir === -1 ? 'highest batch rating first' : 'lowest batch rating first') : 'sorted by your choice'} · click a header to change
      </p>
    </div>
  );
}
