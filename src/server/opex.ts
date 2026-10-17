import 'server-only';
import { OPEX_COUNT } from '@/features/opex/criteria';
import { compact, formatName, formatPlace } from '@/features/collect/normalize';
import { AppError, cleanName, clearRatingsCache, getLookups, getRatings, rest, selectAll, teacherKey, type OpexRow } from './db';

export interface OpexInput {
  branch: string;
  rater: string;
  /** YYYY-MM-DD */
  ratedOn: string;
  entries: { teacherName: string; scores: (number | null)[]; remarks?: string }[];
  /** Delete the same teacher's earlier rating from this branch in the same month first. */
  replaceExisting?: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const isScore = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5;

export async function saveOpex(input: OpexInput): Promise<{ saved: number; replaced: number }> {
  if (!Array.isArray(input.entries) || input.entries.length === 0) throw new AppError(400, 'Rate at least one teacher.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.ratedOn) || Number.isNaN(Date.parse(input.ratedOn))) throw new AppError(400, 'Pick the date of this rating.');
  if (!compact(input.branch)) throw new AppError(400, 'Pick the branch.');
  if (!compact(input.rater)) throw new AppError(400, 'Enter who is rating (OpEx / ABM / AC).');
  for (const e of input.entries) {
    if (!compact(e.teacherName)) throw new AppError(400, 'Every rating needs a teacher name.');
    if (!Array.isArray(e.scores) || e.scores.length !== OPEX_COUNT || !e.scores.every(isScore)) throw new AppError(400, `Answer all ${OPEX_COUNT} questions (1–5) for ${compact(e.teacherName)}.`);
  }

  // One spelling per place and per teacher: the one the database already uses.
  const lookups = await getLookups().catch(() => ({ branches: [] as string[] }));
  const wantBranch = compact(input.branch).toLowerCase();
  const branch = lookups.branches.find((b) => b.toLowerCase() === wantBranch) ?? formatPlace(input.branch);
  const known = new Map((await getRatings().catch(() => null))?.teachers.map((t) => [teacherKey(t.name), t.name]) ?? []);
  const nameOf = (raw: string) => {
    const { name } = cleanName(raw);
    return known.get(teacherKey(name)) ?? formatName(name);
  };

  const month = input.ratedOn.slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const inMonth = await selectAll<OpexRow>('opex_ratings', `select=*&rated_on=gte.${month}-01&rated_on=lte.${month}-${String(last).padStart(2, '0')}`);
  const clashes = new Set<number>();
  for (const e of input.entries) {
    const key = teacherKey(cleanName(nameOf(e.teacherName)).name);
    for (const r of inMonth) if (teacherKey(cleanName(r.instructor_name).name) === key && r.branch.trim().toLowerCase() === branch.toLowerCase()) clashes.add(r.id);
  }
  if (clashes.size && !input.replaceExisting) throw new AppError(409, 'ALREADY_RATED');
  if (clashes.size) await rest(`opex_ratings?id=in.(${[...clashes].join(',')})`, { method: 'DELETE' });

  await rest('opex_ratings', {
    method: 'POST',
    prefer: 'return=minimal',
    body: JSON.stringify(
      input.entries.map((e) => ({
        instructor_name: nameOf(e.teacherName),
        branch,
        rater: compact(input.rater),
        scores: e.scores,
        average_rating: round2((e.scores as number[]).reduce((a, b) => a + b, 0) / OPEX_COUNT),
        remarks: (e.remarks ?? '').slice(0, 1000),
        rated_on: input.ratedOn,
      })),
    ),
  });
  clearRatingsCache();
  return { saved: input.entries.length, replaced: clashes.size };
}
