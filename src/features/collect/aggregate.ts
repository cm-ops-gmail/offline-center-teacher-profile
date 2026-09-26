import type { Aggregate, FormHeader, Score, Selection } from './types';

export const CRITERIA_COUNT = 5;
export const ROUND_LABEL = { first: 'First Rating', last: 'Last Rating' } as const;

export const round2 = (v: number): number => Math.round(v * 100) / 100;
const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

export const isValidScore = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5;

/**
 * Averages many students' forms into one master-sheet row.
 *  - Each criterion = mean of the students who answered it (a blank answer is ignored, not counted as 0).
 *  - Average Rating = mean of the five criterion averages, computed on the *rounded* values so it equals
 *    the sheet's own =AVERAGE(E:I) column exactly.
 */
export function aggregate(responses: { scores: Score[] }[]): Aggregate {
  const columns = Array.from({ length: CRITERIA_COUNT }, (_, i) => responses.map((r) => r.scores[i]).filter(isValidScore));
  const criteria = columns.map((xs) => (xs.length ? round2(mean(xs)) : null));
  const present = criteria.filter((v): v is number => v !== null);
  return { forms: responses.length, criteria, counts: columns.map((xs) => xs.length), average: present.length ? round2(mean(present)) : null };
}

/** One student's own average (for the Responses tab). */
export function studentAverage(scores: Score[]): number | null {
  const xs = scores.filter(isValidScore);
  return xs.length ? round2(mean(xs)) : null;
}

export function validateResponses(responses: { scores: Score[] }[]): string | null {
  if (responses.length === 0) return 'Add at least one form.';
  for (const [i, r] of responses.entries()) {
    if (r.scores.length !== CRITERIA_COUNT) return `Form ${i + 1} must have ${CRITERIA_COUNT} scores.`;
    if (r.scores.some((s) => s !== null && !isValidScore(s))) return `Form ${i + 1} has a score outside 1–5.`;
  }
  return null;
}

/* ---------------- header cross-check (OCR reads the header; the person's selection is the truth) ---------------- */

export type Check = 'match' | 'mismatch' | 'unread';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b[a-z]{2,4}\d{1,4}\b/g, ' ') // staff codes such as LCI004
    .split(/[^a-z]+/)
    .filter((w) => w.length > 1);

const PROGRAMME_WORDS: Record<string, RegExp> = { ielts: /ielts/i, ef: /foundation|\bef\b/i, sej: /spoken|\bsej\b|junior/i, assc: /ssc/i };

export interface HeaderCheck {
  programme: Check;
  branch: Check;
  batch: Check;
  teacher: Check;
  /** Anything that is a mismatch (not merely unread). */
  mismatches: string[];
}

export function checkHeader(h: FormHeader | null | undefined, sel: Pick<Selection, 'program' | 'branch' | 'batch' | 'teacherName'>): HeaderCheck {
  const cmp = (read: string | null | undefined, ok: (r: string) => boolean): Check => (!read || !read.trim() ? 'unread' : ok(read) ? 'match' : 'mismatch');

  const programme = cmp(h?.programme, (r) => PROGRAMME_WORDS[sel.program].test(r));
  const branch = cmp(h?.branch, (r) => {
    const a = norm(r);
    const b = norm(sel.branch);
    return a === b || (a.length >= 3 && (b.startsWith(a) || a.startsWith(b)));
  });
  const batch = cmp(h?.batch, (r) => norm(r) === norm(sel.batch));
  const teacher = cmp(h?.teacher, (r) => {
    const a = words(r);
    const b = words(sel.teacherName);
    if (!a.length || !b.length) return false;
    const [small, big] = a.length <= b.length ? [a, b] : [b, a];
    return small.filter((w) => big.some((x) => x === w || (w.length > 3 && (x.startsWith(w) || w.startsWith(x))))).length / small.length >= 0.5;
  });

  const mismatches = (Object.entries({ programme, branch, batch, teacher }) as [string, Check][]).filter(([, v]) => v === 'mismatch').map(([k]) => k);
  return { programme, branch, batch, teacher, mismatches };
}
