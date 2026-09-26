import 'server-only';
import crypto from 'node:crypto';
import { PROGRAMS, type ProgramDef } from '@/features/ratings/programs';
import type { BatchRecord, DataIssue, Rating, RatingsPayload, Teacher } from '@/features/ratings/types';

/* ------------------------------------------------------------------ *
 * Google auth (service account, no SDK) — the private key never leaves the server.
 * ------------------------------------------------------------------ */

export function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new SheetsError(500, `Missing environment variable ${name}. See .env.example.`);
  return v;
}

export class SheetsError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch with Google's recommended exponential backoff.
 *  - 429 ("too many requests", the per-minute quota): always retried — the request was refused, nothing happened.
 *  - 5xx and network errors: retried only for requests that are safe to repeat (GET / PUT). A POST that may have
 *    half-worked (an append) is never repeated blindly, so rows cannot be duplicated.
 * Waits 1s, 2s, 4s … up to 32s (plus a little jitter), or whatever `Retry-After` says.
 */
export async function fetchRetry(url: string, init: RequestInit = {}, tries = 6): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const repeatable = method === 'GET' || method === 'PUT';
  for (let attempt = 0; ; attempt++) {
    let res: Response | null = null;
    try {
      res = await fetch(url, init);
    } catch (e) {
      if (!repeatable || attempt >= tries - 1) throw e;
    }
    if (res && res.status !== 429 && !(res.status >= 500 && repeatable)) return res;
    if (attempt >= tries - 1) return res!;
    const hinted = Number(res?.headers.get('retry-after'));
    const wait = Number.isFinite(hinted) && hinted > 0 ? hinted * 1000 : Math.min(32_000, 1000 * 2 ** attempt) + Math.random() * 400;
    await sleep(wait);
  }
}

export type AccessMode = 'read' | 'write';
const SCOPES: Record<AccessMode, string> = { read: 'https://www.googleapis.com/auth/spreadsheets.readonly', write: 'https://www.googleapis.com/auth/spreadsheets' };
const tokenCache: Partial<Record<AccessMode, { token: string; expires: number }>> = {};

/** Read-only by default; 'write' is only ever requested by the form-upload publish step. */
export async function getAccessToken(mode: AccessMode = 'read'): Promise<string> {
  const cached = tokenCache[mode];
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;

  const clientEmail = env('GOOGLE_CLIENT_EMAIL');
  const privateKey = env('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n');
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned =
    b64({ alg: 'RS256', typ: 'JWT' }) +
    '.' +
    b64({
      iss: clientEmail,
      scope: SCOPES[mode],
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    });
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(privateKey).toString('base64url');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
    cache: 'no-store',
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new SheetsError(502, `Google sign-in failed: ${json.error_description ?? res.statusText}`);
  }
  tokenCache[mode] = { token: json.access_token, expires: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return json.access_token;
}

async function fetchSheet(sheetId: string): Promise<{ title: string; tabs: Map<string, string[][]> }> {
  const token = await getAccessToken();
  const headers = { authorization: `Bearer ${token}` };
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;

  const ranges = PROGRAMS.map((p) => `ranges=${encodeURIComponent(`'${p.tab}'`)}`).join('&');
  const [valuesRes, metaRes] = await Promise.all([
    fetchRetry(`${base}/values:batchGet?${ranges}&valueRenderOption=FORMATTED_VALUE`, { headers, cache: 'no-store' }),
    fetchRetry(`${base}?fields=properties.title`, { headers, cache: 'no-store' }),
  ]);

  if (!valuesRes.ok) {
    const body = (await valuesRes.json().catch(() => ({}))) as { error?: { message?: string } };
    const detail = body.error?.message ?? valuesRes.statusText;
    if (valuesRes.status === 403 || valuesRes.status === 404) {
      throw new SheetsError(
        valuesRes.status,
        `Cannot read the sheet (${detail}). Share it with ${process.env.GOOGLE_CLIENT_EMAIL} as a Viewer and check GOOGLE_SHEET_ID.`,
      );
    }
    throw new SheetsError(502, `Google Sheets error: ${detail}`);
  }

  const values = (await valuesRes.json()) as { valueRanges: { range: string; values?: string[][] }[] };
  const meta = (await metaRes.json().catch(() => ({}))) as { properties?: { title?: string } };
  const tabs = new Map<string, string[][]>();
  PROGRAMS.forEach((p, i) => tabs.set(p.id, values.valueRanges[i]?.values ?? []));
  return { title: meta.properties?.title ?? 'Teacher Performance', tabs };
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

function num(v: string | undefined): number | null {
  if (v == null) return null;
  const t = v.trim();
  if (t === '' || t.startsWith('#')) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

interface ParsedTab {
  records: BatchRecord[];
  rowsRead: number;
}

function parseTab(program: ProgramDef, rows: string[][], teacherIds: Map<string, string>, codes: Map<string, Set<string>>, names: Map<string, string>, spellings: Map<string, Map<string, number>>, issues: DataIssue[]): ParsedTab {
  if (rows.length === 0) return { records: [], rowsRead: 0 };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name.toLowerCase());
  const iName = col('instructor_name');
  const iBranch = col('branch');
  const iLevel = col('level');
  const iBatch = col('batch');
  const iClass = col('class');
  const iAvg = col('average rating');
  const iRemarks = col('remarks');
  const iCriteria = program.criteria.map((c) => col(c));

  const byKey = new Map<string, BatchRecord[]>();
  const records: BatchRecord[] = [];
  let emptyRows = 0;
  let noScores = 0;
  let missingBranch = 0;
  let duplicates = 0;
  let rowsRead = 0;

  for (const row of rows.slice(1)) {
    const cell = (i: number) => (i >= 0 ? (row[i] ?? '').trim() : '');
    const rawName = cell(iName);
    const cls = cell(iClass).toLowerCase();
    // Trailing template rows: a formula fills "Average Rating" with #DIV/0! but nothing else exists.
    if (!rawName && !cls) {
      if (row.some((c) => c.trim() !== '')) emptyRows++;
      continue;
    }
    rowsRead++;
    if (!rawName) continue;

    const slot = cls.includes('first') ? 'first' : cls.includes('last') ? 'last' : null;
    if (!slot) continue;

    const scores = iCriteria.map((i) => num(row[i]));
    const present = scores.filter((s): s is number => s !== null);
    const sheetAvg = num(row[iAvg]);
    const avg = sheetAvg ?? (present.length ? Math.round(mean(present) * 100) / 100 : null);
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

    const branch = cell(iBranch) || 'Unspecified';
    if (!cell(iBranch)) missingBranch++;
    const level = program.hasLevel ? cell(iLevel) || null : null;
    const batch = cell(iBatch) || '—';
    const rating: Rating = { scores, avg };
    const remark = cell(iRemarks);

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
  if (emptyRows) issues.push({ kind: 'empty-rows', program: P, count: emptyRows, message: `${emptyRows} blank template rows (showing #DIV/0!) were ignored.` });
  if (noScores) issues.push({ kind: 'no-scores', program: P, count: noScores, message: `${noScores} rating row${noScores > 1 ? 's have' : ' has'} no scores yet, so ${noScores > 1 ? 'they were' : 'it was'} skipped.` });
  if (missingBranch) issues.push({ kind: 'missing-branch', program: P, count: missingBranch, message: `${missingBranch} row${missingBranch > 1 ? 's have' : ' has'} no branch and are grouped as "Unspecified".` });
  if (duplicates) issues.push({ kind: 'duplicate-rating', program: P, count: duplicates, message: `${duplicates} extra rating${duplicates > 1 ? 's' : ''} for a batch that already had one — kept as separate batch entries.` });

  return { records, rowsRead };
}

/* ------------------------------------------------------------------ */

export async function loadRatings(): Promise<RatingsPayload> {
  const sheetId = env('GOOGLE_SHEET_ID');
  const { title, tabs } = await fetchSheet(sheetId);

  const issues: DataIssue[] = [];
  const teacherIds = new Map<string, string>();
  const codes = new Map<string, Set<string>>();
  const names = new Map<string, string>();
  const spellings = new Map<string, Map<string, number>>();
  const batches: BatchRecord[] = [];
  const tabStats: RatingsPayload['tabs'] = [];

  for (const program of PROGRAMS) {
    const { records, rowsRead } = parseTab(program, tabs.get(program.id) ?? [], teacherIds, codes, names, spellings, issues);
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
      // The spelling used most often in the master sheet (e.g. "LCI004 - SIRAZUM MUNIRA"), so new rows match existing ones.
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

  return {
    syncedAt: new Date().toISOString(),
    sheetTitle: title,
    sheetUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
    batches,
    teachers,
    issues,
    tabs: tabStats,
  };
}

/* Small in-memory cache so a page full of widgets doesn't hammer the Sheets quota. */
const TTL_MS = 5 * 60 * 1000;
let cache: { at: number; data: RatingsPayload } | null = null;
let inflight: Promise<RatingsPayload> | null = null;

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


/* ---------- dropdown lists for the "Upload forms" screen (the workbook's own Data Validation tab) ---------- */
export interface Lookups {
  branches: string[];
  batches: string[];
  levels: string[];
}
let lookupCache: { at: number; data: Lookups } | null = null;

export async function getLookups(): Promise<Lookups> {
  if (lookupCache && Date.now() - lookupCache.at < 10 * 60_000) return lookupCache.data;
  const token = await getAccessToken('read');
  const id = env('GOOGLE_SHEET_ID');
  const res = await fetchRetry(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent("'Data Validation'!B2:D300")}`, { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
  const json = (await res.json().catch(() => ({}))) as { values?: string[][] };
  const col = (i: number) => [...new Set((json.values ?? []).map((r) => (r[i] ?? '').trim()).filter(Boolean))];
  const data: Lookups = {
    branches: col(0),
    batches: col(2).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    levels: ['Beginner', 'Intermediate', 'Advance'],
  };
  lookupCache = { at: Date.now(), data };
  return data;
}
