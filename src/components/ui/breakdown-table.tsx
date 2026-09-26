import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { sheet } from '@/components/ui/sheet-table';
import { fmt, plural } from '@/lib/format';

export interface BreakdownRow {
  key: string;
  label: ReactNode;
  batches: number;
  first: number | null;
  last: number | null;
  /** Average of the batch ratings — the main number. */
  rating: number | null;
}

/** Averages for each group (programme, branch, teacher…). Clicking a row drills into that group's data. */
export function BreakdownTable({ head, rows, onSelect }: { head: string; rows: BreakdownRow[]; onSelect?: (key: string) => void }) {
  return (
    <div className="card-hover overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-[14px]">
        <thead>
          <tr>
            <th className={`${sheet.th} text-left`}>{head}</th>
            <th className={sheet.th}>Batches</th>
            <th className={sheet.th}>Avg First Rating</th>
            <th className={sheet.th}>Avg Last Rating</th>
            <th className={sheet.thAvg}>Average Rating</th>
            {onSelect && <th className={`${sheet.th} w-10`} aria-label="Open" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} onClick={onSelect ? () => onSelect(r.key) : undefined} className={`border-t border-border/70 transition-colors ${onSelect ? 'cursor-pointer hover:bg-accent/50' : ''}`}>
              <td className="px-3 py-3 font-medium">
                {onSelect ? (
                  <button type="button" onClick={(e) => { e.stopPropagation(); onSelect(r.key); }} className="text-left hover:underline">
                    {r.label}
                  </button>
                ) : (
                  r.label
                )}
              </td>
              <td className={`${sheet.td} text-muted-foreground`} title={plural(r.batches, 'batch', 'batches')}>
                {r.batches}
              </td>
              <td className={`${sheet.td} text-muted-foreground`}>{fmt(r.first)}</td>
              <td className={sheet.td}>{fmt(r.last)}</td>
              <td className={`${sheet.tdAvg} text-[15px]`}>{fmt(r.rating)}</td>
              {onSelect && (
                <td className="pr-2 text-muted-foreground">
                  <ChevronRight className="size-4" />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
