import { ExternalLink } from 'lucide-react';
import { Button } from '@tenminuteschool/design-system';
import { ClassPill } from '@/components/ui/sheet-table';
import { cn } from '@/lib/utils';
import type { SheetView } from './types';

function letter(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

const isNumber = (v: string) => v !== '' && /^-?\d+(\.\d+)?$/.test(v);

/** A Google-Sheets-style read-only grid: column letters, row numbers, the sheet's own header row and values. */
export function SheetGrid({ view, title, subtitle, maxHeight = 380 }: { view: SheetView; title: string; subtitle: string; maxHeight?: number }) {
  const heads = view.headers.map((h) => h.toLowerCase());
  const highlighted = view.rows.filter((r) => r.highlight).length;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold">{title}</h3>
          <p className="text-[12.5px] text-muted-foreground">{subtitle}</p>
        </div>
        <Button asChild size="sm" variant="outline">
          <a href={view.url} target="_blank" rel="noreferrer" className="gap-1.5">
            Open in Google Sheets <ExternalLink className="size-3.5" />
          </a>
        </Button>
      </div>

      <div className="overflow-auto rounded-lg border border-border bg-background" style={{ maxHeight }}>
        <table className="min-w-full border-collapse text-[13px]">
          <thead className="sticky top-0 z-10">
            {/* column letters */}
            <tr className="bg-muted/80 text-[11px] text-muted-foreground">
              <th className="sticky left-0 z-20 w-11 border border-border/70 bg-muted" />
              {view.headers.map((_, i) => (
                <th key={i} className="border border-border/70 px-2 py-0.5 font-normal">
                  {letter(i)}
                </th>
              ))}
            </tr>
            {/* the sheet's own header row (row 1) */}
            <tr>
              <th className="sticky left-0 z-20 border border-border/70 bg-muted text-center text-[11px] font-normal text-muted-foreground">1</th>
              {view.headers.map((h, i) => (
                <th key={i} className={cn('min-w-[4.25rem] max-w-[9rem] border border-border/70 px-1.5 py-1.5 text-center text-[12px] font-semibold leading-tight', heads[i] === 'average rating' ? 'bg-[color-mix(in_oklab,var(--good)_25%,var(--background))]' : 'bg-[color-mix(in_oklab,var(--foreground)_14%,var(--background))]')}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.rows.map((r) => (
              <tr key={r.row} className={cn(r.highlight && 'bg-[color-mix(in_oklab,var(--gold)_20%,var(--background))]')}>
                <td className={cn('sticky left-0 z-10 border border-border/70 px-1 text-center text-[11px] tabular text-muted-foreground', r.highlight ? 'bg-[color-mix(in_oklab,var(--gold)_45%,var(--background))] font-semibold text-foreground' : 'bg-muted')}>
                  {r.row}
                  {r.highlight && <span className="block text-[9px] font-bold uppercase leading-none tracking-wide">new</span>}
                </td>
                {r.cells.map((v, i) => {
                  const h = heads[i];
                  const isClass = h === 'class' && (v === 'First Rating' || v === 'Last Rating');
                  return (
                    <td key={i} className={cn('max-w-[10rem] border border-border/70 px-1.5 py-1', h === 'instructor_name' && 'max-w-none whitespace-nowrap', isNumber(v) || isClass ? 'text-center tabular' : 'text-left', h === 'average rating' && 'bg-[color-mix(in_oklab,var(--good)_9%,transparent)] font-bold')} title={v.length > 20 ? v : undefined}>
                      {isClass ? <ClassPill kind={v === 'First Rating' ? 'first' : 'last'} /> : <span className={cn(v.length > 20 && h !== 'instructor_name' && 'block truncate')}>{v}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
            {view.rows.length === 0 && (
              <tr>
                <td colSpan={view.headers.length + 1} className="px-3 py-6 text-center text-muted-foreground">
                  No rows found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {highlighted > 0 && view.rows.length > highlighted && <p className="text-[12px] text-muted-foreground">Highlighted rows were just saved; the others were already there for this batch.</p>}
    </section>
  );
}
