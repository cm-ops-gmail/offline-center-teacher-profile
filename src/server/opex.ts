import 'server-only';
import { TEAMS, type TeamKey } from '@/features/opex/teams';
import { compact, formatName, formatPlace } from '@/features/collect/normalize';
import { AppError, cleanName, clearRatingsCache, getLookups, getRatings, rest, selectAll, teacherKey, type OpexRow } from './db';

export interface OpexInput {
  branch: string;
  rater: string;
  /** YYYY-MM-DD */
  ratedOn: string;
  entries: { teacherName: string; scores: (number | null)[]; remarks?: string; strengths?: string; areas?: string }[];
  /** Delete the same teacher's earlier rating from this branch in the same month first. */
  replaceExisting?: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const isScore = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5;

const TABLE: Record<TeamKey, string> = { opex: 'opex_ratings', programme: 'programme_ratings' };

/** Saves one sitting of ratings by the OpEx team or the Programme team (they differ only in the table and the questions). */
export async function saveTeamRatings(team: TeamKey, input: OpexInput): Promise<{ saved: number; replaced: number }> {
  const cfg = TEAMS[team];
  const table = TABLE[team];
  const COUNT = cfg.criteria.length;
  if (!Array.isArray(input.entries) || input.entries.length === 0) throw new AppError(400, 'Rate at least one teacher.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.ratedOn) || Number.isNaN(Date.parse(input.ratedOn))) throw new AppError(400, 'Pick the date of this rating.');
  if (!compact(input.branch)) throw new AppError(400, 'Pick the branch.');
  if (!compact(input.rater)) throw new AppError(400, `Enter who is rating (${cfg.who}).`);
  for (const e of input.entries) {
    if (!compact(e.teacherName)) throw new AppError(400, 'Every rating needs a teacher name.');
    if (!Array.isArray(e.scores) || e.scores.length !== COUNT || !e.scores.every(isScore)) throw new AppError(400, `Answer all ${COUNT} questions (1–5) for ${compact(e.teacherName)}.`);
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
  const inMonth = await selectAll<OpexRow>(table, `select=*&rated_on=gte.${month}-01&rated_on=lte.${month}-${String(last).padStart(2, '0')}`);
  const clashes = new Set<number>();
  for (const e of input.entries) {
    const key = teacherKey(cleanName(nameOf(e.teacherName)).name);
    for (const r of inMonth) if (teacherKey(cleanName(r.instructor_name).name) === key && r.branch.trim().toLowerCase() === branch.toLowerCase()) clashes.add(r.id);
  }
  if (clashes.size && !input.replaceExisting) throw new AppError(409, 'ALREADY_RATED');
  if (clashes.size) await rest(`${table}?id=in.(${[...clashes].join(',')})`, { method: 'DELETE' });

  await rest(table, {
    method: 'POST',
    prefer: 'return=minimal',
    body: JSON.stringify(
      input.entries.map((e) => ({
        instructor_name: nameOf(e.teacherName),
        branch,
        rater: compact(input.rater),
        scores: e.scores,
        average_rating: round2((e.scores as number[]).reduce((a, b) => a + b, 0) / COUNT),
        remarks: (e.remarks ?? '').slice(0, 1000),
        ...(team === 'programme' ? { strengths: (e.strengths ?? '').slice(0, 2000), areas_of_development: (e.areas ?? '').slice(0, 2000) } : {}),
        rated_on: input.ratedOn,
      })),
    ),
  });
  clearRatingsCache();
  return { saved: input.entries.length, replaced: clashes.size };
}
