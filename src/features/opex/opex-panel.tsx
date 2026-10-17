'use client';
import { Fragment, useMemo } from 'react';
import { SectionTitle, StatTile } from '@/components/ui/primitives';
import { useRatingsData } from '@/features/ratings/filters';
import { sheet } from '@/components/ui/sheet-table';
import type { OpexRating } from '@/features/ratings/types';
import { fmt, plural } from '@/lib/format';
import { TEAMS, type Criterion, type TeamKey } from './teams';

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
export const opexAverage = (rows: OpexRating[]) => mean(rows.map((r) => r.avg));
const criterionAverages = (rows: OpexRating[], criteria: readonly Criterion[]) => criteria.map((_, i) => mean(rows.flatMap((r) => (r.scores[i] != null ? [r.scores[i] as number] : []))));

const day = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

/**
 * OpEx rating (given by the OpEx / ABM / AC team): headline numbers, the average of each of the six questions, then either
 * a breakdown by branch (`by="branch"`) or every individual rating (`by="entries"`).
 */
export function OpexPanel({ rows, by, team = 'opex' }: { rows: OpexRating[]; by: 'branch' | 'entries'; team?: TeamKey }) {
  const cfg = TEAMS[team];
  const criteria = cfg.criteria;
  const { filters } = useRatingsData();
  const only = criteria.findIndex((c) => c.short === filters.question); // -1 = all questions
  const shown = criteria.map((c, i) => ({ c, i })).filter(({ i }) => only < 0 || i === only);
  const avg = opexAverage(rows);
  const crit = useMemo(() => criterionAverages(rows, criteria), [rows, criteria]);
  const branches = useMemo(() => {
    const map = new Map<string, OpexRating[]>();
    rows.forEach((r) => (map.get(r.branch) ?? map.set(r.branch, []).get(r.branch)!).push(r));
    return [...map.entries()].map(([branch, rs]) => ({ branch, rs, avg: opexAverage(rs), teachers: new Set(rs.map((r) => r.teacherId)).size })).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));
  }, [rows]);
  const entries = useMemo(() => [...rows].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')), [rows]);

  return (
    <section className="rise flex flex-col gap-4">
      <SectionTitle title={cfg.title} hint={`${cfg.blurb} Separate from the students’ ratings.`} />
      {rows.length === 0 ? (
        <p className="card py-10 text-center text-sm text-muted-foreground">No {cfg.title.toLowerCase()}s in this view.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatTile hero label={only >= 0 ? `${team === 'opex' ? 'OpEx' : 'Programme team'} · ${criteria[only].short}` : team === 'opex' ? 'OpEx Average Rating' : 'Programme team Average'} value={fmt(avg)} sub="Out of 5" />
            <StatTile label="Ratings" value={rows.length} sub={`${plural(new Set(rows.map((r) => r.teacherId)).size, 'teacher')}`} />
            <StatTile label="Branches" value={branches.length} sub="In this view" />
          </div>

          <div className="card-hover overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13.5px]">
              <thead>
                <tr>
                  <th className={`${sheet.th} text-left`}>{team === 'opex' ? 'Question' : 'Criterion'}</th>
                  <th className={sheet.thAvg}>Average</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(({ c, i }) => (
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
                    <th className={sheet.thAvg}>Average</th>
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
                    <th className={`${sheet.th} text-left`}>{team === 'opex' ? 'Rated by' : 'Observed by'}</th>
                    {shown.map(({ c }) => (
                      <th key={c.short} className={sheet.th} title={c.question}>{c.short}</th>
                    ))}
                    <th className={sheet.thAvg}>{only >= 0 ? 'Score' : 'Average'}</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((r) => (
                    <Fragment key={r.id}>
                    <tr className="border-t border-border/70">
                      <td className="whitespace-nowrap px-3 py-2.5">{day(r.date)}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{r.branch}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{r.rater || '—'}</td>
                      {shown.map(({ i }) => (
                        <td key={i} className={sheet.td}>{r.scores[i] ?? '—'}</td>
                      ))}
                      <td className={`${sheet.tdAvg} text-[15px]`}>{fmt(r.avg)}</td>
                    </tr>
                    {(r.strengths || r.areas || r.remarks) && (
                      <tr>
                        <td colSpan={shown.length + 4} className="bg-muted/30 px-3 py-2.5 text-[12.5px] leading-relaxed">
                          <span className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
                            {r.strengths && <span><strong className="font-semibold">Strengths</strong><span className="block whitespace-pre-line text-muted-foreground">{r.strengths}</span></span>}
                            {r.areas && <span><strong className="font-semibold">Areas of development</strong><span className="block whitespace-pre-line text-muted-foreground">{r.areas}</span></span>}
                            {r.remarks && <span className="sm:col-span-2"><strong className="font-semibold">Remarks</strong><span className="block whitespace-pre-line text-muted-foreground">{r.remarks}</span></span>}
                          </span>
                        </td>
                      </tr>
                    )}
                    </Fragment>
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
