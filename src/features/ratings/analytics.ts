import { PROGRAM_BY_ID } from './programs';
import type { BatchRecord, ProgramId } from './types';

export const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/**
 * A batch's own rating: the average of its First and Last Rating averages.
 * A batch that only has one round so far (or a Class filter showing one round) uses that round alone.
 */
export const batchRating = (b: BatchRecord): number | null => mean([b.first?.avg, b.last?.avg].filter((v): v is number => v != null));

export const delta = (b: BatchRecord): number | null => (b.first && b.last ? b.last.avg - b.first.avg : null);

/** The most recent rating we have for a batch. */
export const current = (b: BatchRecord): number | null => b.last?.avg ?? b.first?.avg ?? null;

export type BatchStatus = 'complete' | 'in-progress' | 'last-only';
export const statusOf = (b: BatchRecord): BatchStatus => (b.first && b.last ? 'complete' : b.first ? 'in-progress' : 'last-only');

export interface Summary {
  /** THE headline number: every batch's rating added up, divided by the number of batches. */
  rating: number | null;
  batches: number;
  teachers: number;
  branches: number;
  paired: number;
  inProgress: number;
  withFirst: number;
  withLast: number;
  avgFirst: number | null;
  avgLast: number | null;
  /** Mean of (last − first) over batches that have both. */
  avgDelta: number | null;
  /** Averages over the paired batches only, so first→last compares like with like. */
  pairedFirst: number | null;
  pairedLast: number | null;
  improved: number;
  declined: number;
  flat: number;
}

const EPS = 0.005;

export function summarize(batches: BatchRecord[]): Summary {
  const paired = batches.filter((b) => b.first && b.last);
  const deltas = paired.map((b) => delta(b)!);
  return {
    rating: mean(batches.map(batchRating).filter((v): v is number => v !== null)),
    batches: batches.length,
    teachers: new Set(batches.map((b) => b.teacherId)).size,
    branches: new Set(batches.map((b) => b.branch)).size,
    paired: paired.length,
    inProgress: batches.filter((b) => b.first && !b.last).length,
    withFirst: batches.filter((b) => b.first).length,
    withLast: batches.filter((b) => b.last).length,
    avgFirst: mean(batches.filter((b) => b.first).map((b) => b.first!.avg)),
    avgLast: mean(batches.filter((b) => b.last).map((b) => b.last!.avg)),
    avgDelta: mean(deltas),
    pairedFirst: mean(paired.map((b) => b.first!.avg)),
    pairedLast: mean(paired.map((b) => b.last!.avg)),
    improved: deltas.filter((d) => d > EPS).length,
    declined: deltas.filter((d) => d < -EPS).length,
    flat: deltas.filter((d) => Math.abs(d) <= EPS).length,
  };
}

export interface Group {
  key: string;
  label: string;
  summary: Summary;
  batches: BatchRecord[];
}

export function groupBy(batches: BatchRecord[], keyOf: (b: BatchRecord) => string, labelOf: (key: string, rows: BatchRecord[]) => string = (k) => k): Group[] {
  const map = new Map<string, BatchRecord[]>();
  for (const b of batches) {
    const k = keyOf(b);
    (map.get(k) ?? map.set(k, []).get(k)!).push(b);
  }
  return [...map.entries()].map(([key, rows]) => ({ key, label: labelOf(key, rows), summary: summarize(rows), batches: rows }));
}

export const byProgram = (batches: BatchRecord[]) => groupBy(batches, (b) => b.program, (k) => PROGRAM_BY_ID[k as ProgramId].label);
export const byBranch = (batches: BatchRecord[]) => groupBy(batches, (b) => b.branch);
export const byTeacher = (batches: BatchRecord[]) => groupBy(batches, (b) => b.teacherId, (_, rows) => rows[0].teacherName);

export interface CriterionRow {
  label: string;
  first: number | null;
  last: number | null;
}

/** Per-criterion averages, first vs last, for one program. */
export function criteriaProfile(batches: BatchRecord[], program: ProgramId): CriterionRow[] {
  const def = PROGRAM_BY_ID[program];
  const rows = batches.filter((b) => b.program === program);
  return def.criteria.map((label, i) => ({
    label,
    first: mean(rows.flatMap((b) => (b.first?.scores[i] != null ? [b.first.scores[i]!] : []))),
    last: mean(rows.flatMap((b) => (b.last?.scores[i] != null ? [b.last.scores[i]!] : []))),
  }));
}

export interface Bin {
  label: string;
  first: number;
  last: number;
}

/** 0.1-wide bands from 4.0 up to 4.9–4.99, plus a bin for a perfect 5.0 (very common, and worth seeing on its own). */
export function distribution(batches: BatchRecord[]): Bin[] {
  const bins: Bin[] = [...Array.from({ length: 10 }, (_, i) => ({ label: (4 + i / 10).toFixed(1), first: 0, last: 0 })), { label: '5.0', first: 0, last: 0 }];
  const put = (v: number, k: 'first' | 'last') => {
    const i = v >= 4.995 ? 10 : Math.min(9, Math.max(0, Math.floor((v - 4) * 10 + 1e-9)));
    bins[i][k]++;
  };
  for (const b of batches) {
    if (b.first) put(b.first.avg, 'first');
    if (b.last) put(b.last.avg, 'last');
  }
  return bins;
}

/** Axis floor: just under the lowest value (0.1 steps), so tightly-clustered ratings still separate visibly. */
export function axisFloor(values: (number | null)[]): number {
  const vs = values.filter((v): v is number => v !== null);
  if (!vs.length) return 4;
  const lo = Math.floor((Math.min(...vs) - 0.02) * 10) / 10;
  return Math.round(Math.min(4.9, Math.max(1, lo)) * 10) / 10;
}
