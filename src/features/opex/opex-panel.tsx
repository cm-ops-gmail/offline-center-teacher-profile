'use client';
import { useMemo } from 'react';
import { SectionTitle, StatTile } from '@/components/ui/primitives';
import { sheet } from '@/components/ui/sheet-table';
import type { OpexRating } from '@/features/ratings/types';
import { fmt, plural } from '@/lib/format';
import { OPEX_CRITERIA } from './criteria';

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
export const opexAverage = (rows: OpexRating[]) => mean(rows.map((r) => r.avg));
const criterionAverages = (rows: OpexRating[]) => OPEX_CRITERIA.map((_, i) => mean(rows.flatMap((r) => (r.scores[i] != null ? [r.scores[i] as number] : []))));

const day = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

/**
 * OpEx rating (given by the OpEx / ABM / AC team): headline numbers, the average of each of the six questions, then either
 * a breakdown by branch (`by="branch"`) or every individual rating (`by="entries"`).
 */
export function OpexPanel({ rows, by, title = 'OpEx rating' }: { rows: OpexRating[]; by: 'branch' | 'entries'; title?: string }) {
  const avg = opexAverage(rows);
  const crit = useMemo(() => criterionAverages(rows), [rows]);
  const branches = useMemo(() => {
    const map = new Map<string, OpexRating[]>();
    rows.forEach((r) => (map.get(r.branch) ?? map.set(r.branch, []).get(r.branch)!).push(r));
    return [...map.entries()].map(([branch, rs]) => ({ branch, rs, avg: opexAverage(rs), teachers: new Set(rs.map((r) => r.teacherId)).size })).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));
  }, [rows]);
  const entries = useMemo(() => [...rows].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')), [rows]);

  return (
    <section className="rise flex flex-col gap-4">
      <SectionTitle title={title} hint="Given monthly by the OpEx / ABM / AC team on six questions, each scored 1–5 — separate from the students’ ratings above." />
      {rows.length === 0 ? (
        <p className="card py-10 text-center text-sm text-muted-foreground">No OpEx ratings in this view.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile hero label="OpEx Average Rating" value={fmt(avg)} sub="Out of 5" />
            <StatTile label="Ratings" value={rows.length} sub={`${plural(new Set(rows.map((r) => r.teacherId)).size, 'teacher')}`} />
            <StatTile label="Branches" value={branches.length} sub="In this view" />
          </div>

          <div className="card-hover overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13.5px]">
              <thead>
                <tr>
                  <th className={`${sheet.th} text-left`}>Question</th>
                  <th className={sheet.thAvg}>Average</th>
                </tr>
              </thead>
              <tbody>
                {OPEX_CRITERIA.map((c, i) => (
                  <tr key={c.short} className="border-t border-border/70">
                    <td className="px-3 py-2.5" title={c.question}>{c.short}</td>
                    <td className="w-64 px-3 py-2.5">
                      <span className="flex items-center gap-3">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <span className="block h-full rounded-full bg-primary" style={{ width: `${((crit[i] ?? 0) / 5) * 100}%` }} />
                        </span>
                        <span className="tabular w-10 text-right font-semibold">{fmt(crit[i])}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {by === 'branch' ? (
            <div className="card-hover overflow-x-auto">
              <table className="w-full min-w-[480px] text-[13.5px]">
                <thead>
                  <tr>
                    <th className={`${sheet.th} text-left`}>Branch</th>
                    <th className={sheet.th}>Teachers</th>
                    <th className={sheet.th}>Ratings</th>
                    <th className={sheet.thAvg}>OpEx Average</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.map((b) => (
                    <tr key={b.branch} className="border-t border-border/70">
                      <td className="px-3 py-2.5 font-medium">{b.branch}</td>
                      <td className={`${sheet.td} text-muted-foreground`}>{b.teachers}</td>
                      <td className={`${sheet.td} text-muted-foreground`}>{b.rs.length}</td>
                      <td className={`${sheet.tdAvg} text-[15px]`}>{fmt(b.avg)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card-hover overflow-x-auto">
              <table className="w-full min-w-[900px] text-[13px]">
                <thead>
                  <tr>
                    <th className={`${sheet.th} text-left`}>Date</th>
                    <th className={`${sheet.th} text-left`}>Branch</th>
                    <th className={`${sheet.th} text-left`}>Rated by</th>
                    {OPEX_CRITERIA.map((c) => (
                      <th key={c.short} className={sheet.th} title={c.question}>{c.short}</th>
                    ))}
                    <th className={sheet.thAvg}>Average</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((r) => (
                    <tr key={r.id} className="border-t border-border/70">
                      <td className="whitespace-nowrap px-3 py-2.5">{day(r.date)}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{r.branch}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{r.rater || '—'}</td>
                      {OPEX_CRITERIA.map((_, i) => (
                        <td key={i} className={sheet.td}>{r.scores[i] ?? '—'}</td>
                      ))}
                      <td className={`${sheet.tdAvg} text-[15px]`}>{fmt(r.avg)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
