import { PROGRAMS, PROGRAM_BY_ID } from './programs';
import type { BatchRecord, ProgramId, Rating } from './types';

export interface CriterionOption {
  name: string;
  /** The programmes whose forms ask this criterion (SEJ's criteria differ from IELTS / EF / After SSC). */
  programs: ProgramId[];
}

/** Every criterion in use, with the programmes that have it; limited to one programme when given. */
export function criterionOptions(program: ProgramId | 'all' = 'all'): CriterionOption[] {
  const map = new Map<string, ProgramId[]>();
  for (const p of PROGRAMS) {
    if (program !== 'all' && p.id !== program) continue;
    for (const c of p.criteria) map.set(c, [...(map.get(c) ?? []), p.id]);
  }
  return [...map].map(([name, programs]) => ({ name, programs }));
}

/** "IELTS, EF, After SSC" — for showing next to a criterion. */
export const programTags = (programs: ProgramId[]): string => programs.map((p) => PROGRAM_BY_ID[p].short).join(', ');

/**
 * Looks at the data through ONE criterion: every rating becomes that criterion's score, so all the existing
 * averages, tables and breakdowns simply work on it. Batches of programmes that do not ask the criterion drop out.
 */
export function applyCriterion(batches: BatchRecord[], name: string | 'all'): BatchRecord[] {
  if (name === 'all') return batches;
  return batches.flatMap((b) => {
    const i = PROGRAM_BY_ID[b.program].criteria.indexOf(name);
    if (i < 0) return [];
    const one = (r: Rating | null): Rating | null => (r && r.scores[i] != null ? { scores: [r.scores[i]], avg: r.scores[i] as number, date: r.date } : null);
    const first = one(b.first);
    const last = one(b.last);
    return first || last ? [{ ...b, first, last }] : [];
  });
}

/** Column headings to show for a programme: all five criteria, or just the chosen one. */
export function columnsFor(program: ProgramId, criterion: string | 'all'): string[] {
  return criterion === 'all' ? PROGRAM_BY_ID[program].criteria : [criterion];
}
