import { batchRating, delta, mean } from '../ratings/analytics';
import { columnsFor } from '../ratings/criteria';
import { PROGRAMS, PROGRAM_BY_ID } from '../ratings/programs';
import type { BatchRecord, ProgramId } from '../ratings/types';

export interface TeacherStats {
  batches: number;
  programs: { id: ProgramId; batches: number }[];
  branches: string[];
  /** Average Rating: every batch's rating (First and Last averaged) added up ÷ number of batches. */
  rating: number | null;
  avgFirst: number | null;
  avgLast: number | null;
  /** Mean of (Last − First) over batches that have both. */
  avgDelta: number | null;
  paired: number;
  improved: number;
  declined: number;
  /** Batches with a First Rating but no Last Rating yet. */
  awaiting: number;
  best: { rating: number; label: string } | null;
  worst: { rating: number; label: string } | null;
  /** Average Rating within each programme. */
  byProgram: Partial<Record<ProgramId, { rating: number | null; batches: number }>>;
  /** Per programme: the score on each criterion (First and Last averaged per batch, then over batches). */
  byCriterion: Partial<Record<ProgramId, (number | null)[]>>;
}

const EPS = 0.005;

/** A batch's score on the i-th shown column: the average of its First and Last score there. */
export function columnRating(b: BatchRecord, i: number): number | null {
  const xs = [b.first?.scores[i], b.last?.scores[i]].filter((v): v is number => v != null);
  return xs.length ? xs.reduce((a, c) => a + c, 0) / xs.length : null;
}

const label = (b: BatchRecord) => `${PROGRAM_BY_ID[b.program].short} · ${b.branch} · ${b.batch}`;

/** Everything the comparison shows for one teacher. `criterion` matches the Criterion filter (one column instead of five). */
export function teacherStats(batches: BatchRecord[], criterion: string | 'all' = 'all'): TeacherStats {
  const rated = batches.flatMap((b) => {
    const r = batchRating(b);
    return r === null ? [] : [{ b, r }];
  });
  const pairedDeltas = batches.map(delta).filter((d): d is number => d !== null);
  const best = rated.length ? rated.reduce((m, x) => (x.r > m.r ? x : m)) : null;
  const worst = rated.length ? rated.reduce((m, x) => (x.r < m.r ? x : m)) : null;

  const programs = PROGRAMS.filter((p) => batches.some((b) => b.program === p.id));
  const byProgram: TeacherStats['byProgram'] = {};
  const byCriterion: TeacherStats['byCriterion'] = {};
  for (const p of programs) {
    const mine = batches.filter((b) => b.program === p.id);
    byProgram[p.id] = { rating: mean(mine.map(batchRating).filter((v): v is number => v !== null)), batches: mine.length };
    byCriterion[p.id] = columnsFor(p.id, criterion).map((_, i) => mean(mine.map((b) => columnRating(b, i)).filter((v): v is number => v !== null)));
  }

  return {
    batches: batches.length,
    programs: programs.map((p) => ({ id: p.id, batches: batches.filter((b) => b.program === p.id).length })),
    branches: [...new Set(batches.map((b) => b.branch))].sort(),
    rating: mean(rated.map((x) => x.r)),
    avgFirst: mean(batches.flatMap((b) => (b.first ? [b.first.avg] : []))),
    avgLast: mean(batches.flatMap((b) => (b.last ? [b.last.avg] : []))),
    avgDelta: mean(pairedDeltas),
    paired: pairedDeltas.length,
    improved: pairedDeltas.filter((d) => d > EPS).length,
    declined: pairedDeltas.filter((d) => d < -EPS).length,
    awaiting: batches.filter((b) => b.first && !b.last).length,
    best: best ? { rating: best.r, label: label(best.b) } : null,
    worst: worst ? { rating: worst.r, label: label(worst.b) } : null,
    byProgram,
    byCriterion,
  };
}
