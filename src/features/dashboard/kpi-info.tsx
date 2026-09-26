'use client';
import type { ReactNode } from 'react';
import { batchRating, groupBy } from '@/features/ratings/analytics';
import { PROGRAMS, PROGRAM_BY_ID } from '@/features/ratings/programs';
import type { BatchRecord, ProgramId } from '@/features/ratings/types';
import { fmt, plural } from '@/lib/format';

/* Explanations shown in the "i" popover on each tile. Every number is computed from the batches in view. */

export function Title({ children }: { children: ReactNode }) {
  return <h4 className="mb-2.5 text-sm font-bold">{children}</h4>;
}

export function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-2.5 text-[13px] leading-snug">
      <span className="mt-px grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{n}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </li>
  );
}

export function Formula({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 rounded-md bg-muted px-3 py-2 text-[13px] font-semibold tabular-nums">{children}</p>;
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="mt-3 border-t border-border pt-2.5 text-xs leading-relaxed text-muted-foreground">{children}</p>;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Average Rating = every batch's rating (First and Last averaged) added up ÷ number of batches. */
export function RatingInfo({ batches, criterion }: { batches: BatchRecord[]; criterion?: string }) {
  const ratings = batches.map(batchRating).filter((v): v is number => v !== null);
  const total = sum(ratings);
  const both = batches.filter((b) => b.first && b.last).length;
  const firstOnly = batches.filter((b) => b.first && !b.last).length;
  const lastOnly = batches.filter((b) => !b.first && b.last).length;
  const ex = batches.find((b) => b.first && b.last);

  return (
    <div>
      <Title>{criterion ? `How the average for “${criterion}” is worked out` : 'How the Average Rating is worked out'}</Title>
      <ol className="space-y-3">
        <Step n={1}>
          <strong className="font-semibold">{criterion ? `Each batch gets its own “${criterion}” score:` : 'Each batch gets its own rating:'}</strong> the average of its First Rating and its Last Rating{criterion ? ' for that criterion' : ''}.
          {ex && (
            <Formula>
              {ex.branch} · {ex.batch}: ({fmt(ex.first!.avg)} + {fmt(ex.last!.avg)}) ÷ 2 = {fmt(batchRating(ex))}
            </Formula>
          )}
        </Step>
        <Step n={2}>
          <strong className="font-semibold">Add up every batch’s rating and divide by the number of batches.</strong>
          <Formula>
            {total.toFixed(2)} ÷ {ratings.length} {ratings.length === 1 ? 'batch' : 'batches'} = {ratings.length ? fmt(total / ratings.length) : '—'}
          </Formula>
        </Step>
      </ol>
      <Note>
        Of these {plural(batches.length, 'batch', 'batches')}: <strong className="font-medium text-foreground">{both}</strong> have both ratings (averaged); <strong className="font-medium text-foreground">{firstOnly}</strong> have only a First Rating, so that one is used on its own
        {lastOnly > 0 && (
          <>
            ; <strong className="font-medium text-foreground">{lastOnly}</strong> have only a Last Rating
          </>
        )}
        . {criterion ? `Each First or Last score is what students ticked for “${criterion}”; programmes that don’t ask it are left out.` : 'A First or Last Rating is the sheet’s “Average Rating” for that row, itself the average of the five criteria.'}
      </Note>
    </div>
  );
}

/** Average First / Last Rating = the sum of those ratings ÷ how many batches have one. */
export function RoundInfo({ batches, round, criterion }: { batches: BatchRecord[]; round: 'first' | 'last'; criterion?: string }) {
  const label = round === 'first' ? 'First Rating' : 'Last Rating';
  const xs = batches.flatMap((b) => (b[round] ? [b[round]!.avg] : []));
  const total = sum(xs);
  const missing = batches.length - xs.length;

  return (
    <div>
      <Title>How the Average {label} is worked out</Title>
      <ol className="space-y-3">
        <Step n={1}>
          <strong className="font-semibold">Each batch has one {label}:</strong> {criterion ? `its score on “${criterion}” on that row of the sheet.` : 'the “Average Rating” on that row of the sheet, which is the average of its five criteria.'}
        </Step>
        <Step n={2}>
          <strong className="font-semibold">Add them up and divide by the number of batches that have one.</strong>
          <Formula>
            {total.toFixed(2)} ÷ {xs.length} {xs.length === 1 ? 'batch' : 'batches'} = {xs.length ? fmt(total / xs.length) : '—'}
          </Formula>
        </Step>
      </ol>
      {missing > 0 && (
        <Note>
          {plural(missing, 'batch', 'batches')} {missing === 1 ? 'has' : 'have'} no {label} {round === 'last' ? 'yet (still running)' : 'recorded'} and {missing === 1 ? 'is' : 'are'} left out of this average.
        </Note>
      )}
    </div>
  );
}

function Chips({ items }: { items: [string, number][] }) {
  return (
    <p className="mt-0.5 flex flex-wrap gap-x-2.5 gap-y-0.5 pl-4 text-xs text-muted-foreground">
      {items.map(([name, n]) => (
        <span key={name}>
          {name} <strong className="font-semibold tabular-nums text-foreground">{n}</strong>
        </span>
      ))}
    </p>
  );
}

/** Batches: how many, and how they split by programme and by branch. */
export function BatchesInfo({ batches }: { batches: BatchRecord[] }) {
  const programs = groupBy(batches, (b) => b.program).sort((a, b) => PROGRAMS.findIndex((p) => p.id === a.key) - PROGRAMS.findIndex((p) => p.id === b.key));
  const branches = groupBy(batches, (b) => b.branch).sort((a, b) => b.batches.length - a.batches.length);
  const split = (rows: BatchRecord[], by: (b: BatchRecord) => string, label?: (k: string) => string): [string, number][] =>
    groupBy(rows, by)
      .sort((a, b) => b.batches.length - a.batches.length)
      .map((g) => [label ? label(g.key) : g.key, g.batches.length]);

  return (
    <div>
      <Title>
        {plural(batches.length, 'batch', 'batches')} · {plural(branches.length, 'branch', 'branches')} · {plural(programs.length, 'programme')}
      </Title>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">A batch is one teacher’s batch (like A1) in one branch, in one programme. Its First and Last Rating together count as one batch.</p>

      <p className="eyebrow mb-1.5">By programme</p>
      <ul className="mb-4 space-y-2">
        {programs.map((g) => (
          <li key={g.key}>
            <div className="flex items-center justify-between gap-2 text-[13px] font-medium">
              <span className="flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ background: PROGRAM_BY_ID[g.key as ProgramId].color }} aria-hidden />
                {PROGRAM_BY_ID[g.key as ProgramId].label}
              </span>
              <span className="tabular-nums">{g.batches.length}</span>
            </div>
            <Chips items={split(g.batches, (b) => b.branch)} />
          </li>
        ))}
      </ul>

      <p className="eyebrow mb-1.5">By branch</p>
      <ul className="space-y-2">
        {branches.map((g) => (
          <li key={g.key}>
            <div className="flex items-center justify-between gap-2 text-[13px] font-medium">
              <span>{g.label}</span>
              <span className="tabular-nums">{g.batches.length}</span>
            </div>
            <Chips items={split(g.batches, (b) => b.program, (k) => PROGRAM_BY_ID[k as ProgramId].label)} />
          </li>
        ))}
      </ul>
    </div>
  );
}
