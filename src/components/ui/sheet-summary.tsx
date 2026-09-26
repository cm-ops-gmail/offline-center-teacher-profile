import { Delta } from '@/components/ui/primitives';
import { ClassPill, classKinds, sheet } from '@/components/ui/sheet-table';
import { mean } from '@/features/ratings/analytics';
import { columnsFor } from '@/features/ratings/criteria';
import type { RatingClass } from '@/features/ratings/filters';
import type { BatchRecord, ProgramId } from '@/features/ratings/types';
import { fmt, plural } from '@/lib/format';

/**
 * The sheet's own layout: class · five criteria · Average Rating.
 * One row per rating round, holding the average across every batch in the current selection.
 * "Average Rating" is the mean of the batches' own Average Rating — the main number.
 */
export function SheetSummary({ batches, program, cls = 'all', criterion = 'all' }: { batches: BatchRecord[]; program: ProgramId; cls?: RatingClass; /** Show only this criterion's column (the Criterion filter) */ criterion?: string }) {
  const columns = columnsFor(program, criterion);
  const rows = classKinds(cls).map((kind) => {
    const ratings = batches.flatMap((b) => (b[kind] ? [b[kind]!] : []));
    return {
      kind,
      n: ratings.length,
      criteria: columns.map((_, i) => mean(ratings.flatMap((r) => (r.scores[i] != null ? [r.scores[i]!] : [])))),
      avg: mean(ratings.map((r) => r.avg)),
    };
  });
  // Change compares like with like: only batches that have both a First and a Last Rating.
  const paired = batches.filter((b) => b.first && b.last);
  const change = {
    n: paired.length,
    criteria: columns.map((_, i) => mean(paired.flatMap((b) => (b.first!.scores[i] != null && b.last!.scores[i] != null ? [b.last!.scores[i]! - b.first!.scores[i]!] : [])))),
    avg: mean(paired.map((b) => b.last!.avg - b.first!.avg)),
  };
  const showChange = cls === 'all' && paired.length > 0;

  return (
    <div className="card-hover overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-[14px]">
        <thead>
          <tr>
            <th className={`${sheet.th} text-left`}>Class</th>
            {columns.map((c) => (
              <th key={c} className={sheet.th}>
                {c}
              </th>
            ))}
            <th className={sheet.thAvg}>{criterion === 'all' ? 'Average Rating' : `Average · ${criterion}`}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.kind} className="border-b border-border/70">
              <td className="min-w-44 px-3 py-3">
                <ClassPill kind={r.kind} />
                <span className="mt-1 block whitespace-nowrap pl-1 text-[12px] text-muted-foreground">{plural(r.n, 'batch', 'batches')}</span>
              </td>
              {r.criteria.map((v, i) => (
                <td key={i} className={sheet.td}>
                  {fmt(v)}
                </td>
              ))}
              <td className={`${sheet.tdAvg} text-[15px]`}>{fmt(r.avg)}</td>
            </tr>
          ))}
          {showChange && (
            <tr className="bg-muted/30 text-[13px]">
              <td className="min-w-44 px-3 py-2.5 font-medium text-muted-foreground">
                Change
                <span className="block whitespace-nowrap text-[12px] font-normal">{plural(change.n, 'batch', 'batches')} with both</span>
              </td>
              {change.criteria.map((v, i) => (
                <td key={i} className={sheet.td}>
                  <Delta value={v} />
                </td>
              ))}
              <td className={`${sheet.td} font-semibold`}>
                <Delta value={change.avg} />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
