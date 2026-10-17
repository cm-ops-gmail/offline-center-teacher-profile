import 'server-only';
import { PROGRAMS } from '@/features/ratings/programs';
import type { BatchRecord, DataIssue, OpexRating, ProgramId, Rating, RatingsPayload, Teacher } from '@/features/ratings/types';
import type { ProgramDef } from '@/features/ratings/programs';

/* ------------------------------------------------------------------ *
 * Supabase (PostgREST over fetch, no SDK) — keys never leave the server.
 * ------------------------------------------------------------------ */

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new AppError(500, `Missing environment variable ${name}. See .env.example.`);
  return v;
}

/** The secret key (bypasses row-level security) when provided, otherwise the publishable key. */
const apiKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY || env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
const baseUrl = () => env('NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One PostgREST request. Reads (GET) are retried on 429 / 5xx; writes are never repeated blindly. */
export async function rest<T = unknown>(path: string, init: RequestInit & { prefer?: string } = {}): Promise<T> {
  const { prefer, ...opts } = init;
  const method = (opts.method ?? 'GET').toUpperCase();
  for (let attempt = 0; ; attempt++) {
    let res: Response | null = null;
    try {
      res = await fetch(`${baseUrl()}/rest/v1/${path}`, {
        ...opts,
        headers: { apikey: apiKey(), 'content-type': 'application/json', ...(prefer ? { prefer } : {}), ...opts.headers },
        cache: 'no-store',
      });
    } catch (e) {
      if (method !== 'GET' || attempt >= 3) throw new AppError(502, `Could not reach the database: ${e instanceof Error ? e.message : 'network error'}`);
    }
    if (res && !(method === 'GET' && (res.status === 429 || res.status >= 500)) ) return parse<T>(res);
    if (attempt >= 3) return parse<T>(res!);
    await sleep(500 * 2 ** attempt);
  }
}

async function parse<T>(res: Response): Promise<T> {
  if (res.ok) return (res.status === 204 ? undefined : await res.json().catch(() => undefined)) as T;
  const body = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
  if (body.code === 'PGRST205') throw new AppError(500, 'The database tables do not exist yet. Run supabase/schema.sql in the Supabase SQL editor, then npm run db:seed.');
  if (res.status === 401 || res.status === 403 || body.code === '42501') throw new AppError(500, `The database refused access (${body.message ?? res.statusText}). Re-run supabase/schema.sql so the access policies exist, or check the Supabase key.`);
  throw new AppError(502, `Database error: ${body.message ?? res.statusText}`);
}

/** Every row of a query, paged 1000 at a time (PostgREST's default cap). */
export async function selectAll<T>(table: string, query = ''): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const page = await rest<T[]>(`${table}?${query}${query ? '&' : ''}order=id.asc`, { headers: { range: `${from}-${from + 999}`, 'range-unit': 'items' } });
    out.push(...page);
    if (page.length < 1000) return out;
  }
}

/* ------------------------------------------------------------------ *
 * Row shapes
 * ------------------------------------------------------------------ */

export interface MasterRow {
  id: number;
  program: ProgramId;
  instructor_name: string;
  branch: string;
  level: string | null;
  batch: string;
  class: 'first' | 'last';
  scores: (number | null)[];
  average_rating: number | null;
  remarks: string;
  rated_on: string | null;
}

export interface StudentRow {
  id: number;
  program: ProgramId;
  instructor_name: string;
  branch: string;
  level: string | null;
  batch: string;
  class: 'first' | 'last';
  users_rated: number | null;
  scores: (number | null)[];
  average_rating: number | null;
  feedback: string;
  form_date: string;
  source_file: string;
  submitted_at: string;
  submission_id: string;
  rated_on: string | null;
}

export interface OpexRow {
  id: number;
  strengths?: string;
  areas_of_development?: string;
  instructor_name: string;
  branch: string;
  rater: string;
  scores: (number | null)[];
  average_rating: number | null;
  remarks: string;
  rated_on: string | null;
}

/* ------------------------------------------------------------------ *
 * Normalisation
 * ------------------------------------------------------------------ */

const CODE_PREFIX = /^\s*([A-Za-z]{2,5}\d{1,4})\s*[-–—]\s*/;

export function cleanName(raw: string): { name: string; code: string | null } {
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  const m = collapsed.match(CODE_PREFIX);
  const code = m ? m[1].toUpperCase() : null;
  let name = collapsed.replace(CODE_PREFIX, '').trim();
  // "SIRAZUM MUNIRA" / "QUAZI AZMAIN HAQUE" → Title Case; leave mixed-case names alone.
  if (name && name === name.toUpperCase()) {
    name = name.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
  }
  return { name, code };
}

/** Identity key: "Sk. Sara Jahan" and "Sk Sara Jahan" are the same person. */
export function teacherKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.'’\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

interface ParsedProgram {
  records: BatchRecord[];
  rowsRead: number;
}

function parseProgram(program: ProgramDef, rows: MasterRow[], teacherIds: Map<string, string>, codes: Map<string, Set<string>>, names: Map<string, string>, spellings: Map<string, Map<string, number>>, issues: DataIssue[]): ParsedProgram {
  const byKey = new Map<string, BatchRecord[]>();
  const records: BatchRecord[] = [];
  let noScores = 0;
  let missingBranch = 0;
  let duplicates = 0;

  for (const row of rows) {
    const rawName = row.instructor_name.trim();
    if (!rawName) continue;
    const slot = row.class;

    const scores = program.criteria.map((_, i) => row.scores?.[i] ?? null);
    const present = scores.filter((s): s is number => s !== null);
    const avg = row.average_rating ?? (present.length ? Math.round(mean(present) * 100) / 100 : null);
    if (avg === null) {
      noScores++;
      continue;
    }

    const { name, code } = cleanName(rawName);
    const key = teacherKey(name);
    if (!teacherIds.has(key)) teacherIds.set(key, slug(name) || key);
    if (!names.has(key) || name.length > (names.get(key)?.length ?? 0)) names.set(key, name);
    const spelled = rawName.replace(/\s+/g, ' ').trim();
    const seen = spellings.get(key) ?? spellings.set(key, new Map()).get(key)!;
    seen.set(spelled, (seen.get(spelled) ?? 0) + 1);
    if (code) {
      if (!codes.has(key)) codes.set(key, new Set());
      codes.get(key)!.add(code);
    }

    const branch = row.branch.trim() || 'Unspecified';
    if (!row.branch.trim()) missingBranch++;
    const level = program.hasLevel ? row.level?.trim() || null : null;
    const batch = row.batch.trim() || '—';
    const rating: Rating = { scores, avg, date: row.rated_on };
    const remark = row.remarks.trim();

    const groupKey = [key, branch, level ?? '', batch].join('|');
    const group = byKey.get(groupKey) ?? [];
    let target = group.find((r) => r[slot] === null);
    if (!target) {
      if (group.length > 0) duplicates++;
      target = {
        id: `${program.id}:${teacherIds.get(key)}:${slug(branch)}:${slug(level ?? '')}:${slug(batch)}${group.length ? `:${group.length + 1}` : ''}`,
        program: program.id,
        teacherId: teacherIds.get(key)!,
        teacherName: name,
        branch,
        level,
        batch,
        first: null,
        last: null,
        remarks: [],
      };
      group.push(target);
      byKey.set(groupKey, group);
      records.push(target);
    }
    target[slot] = rating;
    if (remark && !target.remarks.includes(remark)) target.remarks.push(remark);
  }

  const P = program.id;
  if (noScores) issues.push({ kind: 'no-scores', program: P, count: noScores, message: `${noScores} rating row${noScores > 1 ? 's have' : ' has'} no scores yet, so ${noScores > 1 ? 'they were' : 'it was'} skipped.` });
  if (missingBranch) issues.push({ kind: 'missing-branch', program: P, count: missingBranch, message: `${missingBranch} row${missingBranch > 1 ? 's have' : ' has'} no branch and are grouped as "Unspecified".` });
  if (duplicates) issues.push({ kind: 'duplicate-rating', program: P, count: duplicates, message: `${duplicates} extra rating${duplicates > 1 ? 's' : ''} for a batch that already had one — kept as separate batch entries.` });

  return { records, rowsRead: rows.length };
}

/* ------------------------------------------------------------------ */

export async function loadRatings(): Promise<RatingsPayload> {
  const [all, opexRows, programmeRows] = await Promise.all([
    selectAll<MasterRow>('master_ratings', 'select=*'),
    // the OpEx table is optional: the dashboard keeps working until it has been created
    selectAll<OpexRow>('opex_ratings', 'select=*').then((rows) => ({ rows, ready: true }), () => ({ rows: [] as OpexRow[], ready: false })),
    selectAll<OpexRow>('programme_ratings', 'select=*').then((rows) => ({ rows, ready: true }), () => ({ rows: [] as OpexRow[], ready: false })),
  ]);

  const issues: DataIssue[] = [];
  const teacherIds = new Map<string, string>();
  const codes = new Map<string, Set<string>>();
  const names = new Map<string, string>();
  const spellings = new Map<string, Map<string, number>>();
  const batches: BatchRecord[] = [];
  const tabStats: RatingsPayload['tabs'] = [];

  for (const program of PROGRAMS) {
    const { records, rowsRead } = parseProgram(program, all.filter((r) => r.program === program.id), teacherIds, codes, names, spellings, issues);
    batches.push(...records);
    tabStats.push({
      program: program.id,
      tab: program.tab,
      rowsRead,
      batches: records.length,
      teachers: new Set(records.map((r) => r.teacherId)).size,
    });
  }

  // Use the fullest spelling seen for every teacher.
  for (const b of batches) {
    const key = [...teacherIds.entries()].find(([, id]) => id === b.teacherId)?.[0];
    if (key) b.teacherName = names.get(key) ?? b.teacherName;
  }

  const teachers: Teacher[] = [...teacherIds.entries()]
    .map(([key, id]) => {
      const name = names.get(key) ?? key;
      const code = [...(codes.get(key) ?? [])][0] ?? null;
      // The spelling used most often in the data (e.g. "LCI004 - SIRAZUM MUNIRA"), so new rows match existing ones.
      const sheetName = [...(spellings.get(key) ?? [])].sort((a, b) => b[1] - a[1])[0]?.[0] ?? (code ? `${code} - ${name}` : name);
      return { id, name, code, sheetName };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const [key, set] of codes) {
    if (set.size > 1) issues.push({ kind: 'code-conflict', program: null, message: `${names.get(key)} appears with different staff codes: ${[...set].join(', ')}. They were treated as one person.` });
  }

  // Names that are a strict subset of another ("Masham Fahim" ⊂ "Khawja Masham Fahim") may be one person.
  const keys = [...names.keys()];
  for (const a of keys) {
    for (const b of keys) {
      if (a === b) continue;
      const ta = a.split(' ');
      const tb = b.split(' ');
      if (ta.length >= 2 && ta.length < tb.length && ta.every((t) => tb.includes(t))) {
        issues.push({ kind: 'possible-duplicate-teacher', program: null, message: `"${names.get(a)}" and "${names.get(b)}" may be the same teacher — they are counted separately.` });
      }
    }
  }

  const toRatings = (rows: OpexRow[]): OpexRating[] => rows.map((r) => {
    const { name } = cleanName(r.instructor_name);
    const scores = r.scores ?? [];
    const present = scores.filter((s): s is number => s !== null);
    return {
      id: r.id,
      teacherId: teacherIds.get(teacherKey(name)) ?? (slug(name) || teacherKey(name)),
      teacherName: names.get(teacherKey(name)) ?? name,
      branch: r.branch.trim() || 'Unspecified',
      rater: r.rater,
      scores,
      avg: r.average_rating ?? (present.length ? Math.round(mean(present) * 100) / 100 : 0),
      date: r.rated_on,
      remarks: r.remarks,
      strengths: r.strengths,
      areas: r.areas_of_development,
    };
  });

  const opex = toRatings(opexRows.rows);
  const ref = new URL(baseUrl()).hostname.split('.')[0];
  return {
    syncedAt: new Date().toISOString(),
    sheetTitle: 'Supabase database',
    sheetUrl: `https://supabase.com/dashboard/project/${ref}/editor`,
    batches,
    teachers,
    issues,
    tabs: tabStats,
    opex,
    opexReady: opexRows.ready,
    programme: toRatings(programmeRows.rows),
    programmeReady: programmeRows.ready,
  };
}

/* Small in-memory cache so a page full of widgets doesn't hit the database once per widget. Saving clears it. */
const TTL_MS = 60 * 1000;
let cache: { at: number; data: RatingsPayload } | null = null;
let inflight: Promise<RatingsPayload> | null = null;

export function clearRatingsCache() {
  cache = null;
  lookupCache = null;
}

export async function getRatings(force = false): Promise<RatingsPayload> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.data;
  inflight ??= loadRatings()
    .then((data) => {
      cache = { at: Date.now(), data };
      return data;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/* ---------- dropdown lists for the Student rating entry screen ---------- */
export interface Lookups {
  branches: string[];
  batches: string[];
  levels: string[];
}
let lookupCache: { at: number; data: Lookups } | null = null;

export async function getLookups(): Promise<Lookups> {
  if (lookupCache && Date.now() - lookupCache.at < 10 * 60_000) return lookupCache.data;
  const rows = await selectAll<{ kind: 'branch' | 'batch'; value: string }>('lookups', 'select=kind,value');
  const of = (kind: string) => [...new Set(rows.filter((r) => r.kind === kind).map((r) => r.value.trim()).filter(Boolean))];
  const data: Lookups = {
    branches: of('branch'),
    batches: of('batch').sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    levels: ['Beginner', 'Intermediate', 'Advance'],
  };
  lookupCache = { at: Date.now(), data };
  return data;
}
