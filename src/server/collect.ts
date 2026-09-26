import 'server-only';
import crypto from 'node:crypto';
import { aggregate, isValidScore, ROUND_LABEL, studentAverage, validateResponses } from '@/features/collect/aggregate';
import type { PublishPlan, PublishResult, Score, Selection, SheetView } from '@/features/collect/types';
import { compact, formatBatch, formatName, formatPlace, fromList, looseKey } from '@/features/collect/normalize';
import { PROGRAM_BY_ID, type ProgramDef } from '@/features/ratings/programs';
import { cleanName, env, fetchRetry, getAccessToken, getLookups, getRatings, SheetsError, teacherKey, type AccessMode } from './sheets';

export interface PublishInput {
  selection: Selection;
  responses: { id: string; scores: Score[]; feedback: string; source: string; header: { date: string | null } | null }[];
  /** Must be true to replace a master row that already exists. */
  overwrite?: boolean;
  /**
   * What to do when student rows for this teacher + branch + batch + round are already saved:
   * 'add' keeps them and appends these (the average then covers everyone); 'replace' deletes them first.
   */
  mode?: 'add' | 'replace';
}

/*
 * Two spreadsheets are involved:
 *  - RESPONSES sheet (RESPONSES_SHEET_ID): every student's answers land here FIRST, one tab per programme,
 *    laid out like the per-batch "Users Rated" sheet (criteria as headers, an Average Rating per student).
 *  - MASTER sheet (GOOGLE_SHEET_ID): the batch averages computed from those rows.
 */

const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
const normId = (s: unknown) => norm(s).replace(/[^a-z0-9]/g, '');
const api = (id: string) => `https://sheets.googleapis.com/v4/spreadsheets/${id}`;
const q = (tab: string) => encodeURIComponent(`'${tab.replace(/'/g, "''")}'`);
const masterId = () => env('GOOGLE_SHEET_ID');
const responsesId = () => env('RESPONSES_SHEET_ID');

function colLetter(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

async function call<T>(token: string, url: string, init: RequestInit = {}, hint?: string): Promise<T> {
  const res = await fetchRetry(url, { ...init, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, cache: 'no-store' });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!res.ok) {
    const detail = json.error?.message ?? res.statusText;
    if ((res.status === 403 || res.status === 404) && hint) throw new SheetsError(res.status, `${hint} (${detail})`);
    throw new SheetsError([400, 403, 404].includes(res.status) ? res.status : 502, `Google Sheets: ${detail}`);
  }
  return json as T;
}

type Cell = string | number;
type Meta = { properties?: { title?: string }; sheets: { properties: { title: string; sheetId: number; gridProperties?: { rowCount?: number } } }[] };

/** Columns of a programme's tab in the RESPONSES sheet. */
export function responseColumns(def: ProgramDef) {
  const ids = ['instructor_name', 'branch', ...(def.hasLevel ? ['level'] : []), 'batch', 'class'];
  const usersRated = ids.length;
  const scoreStart = usersRated + 1;
  const avg = scoreStart + def.criteria.length;
  const headers = [...ids, 'Users Rated', ...def.criteria, 'Average Rating', 'Feedback', 'Form date', 'Source file', 'submitted_at', 'submission_id'];
  return { headers, usersRated, scoreStart, avg, feedback: avg + 1, hasLevel: def.hasLevel, last: headers.length - 1 };
}

/** How many blank rows in a row (blank instructor_name AND branch) mean "this is the end of the data". */
export const END_RUN = 10;

/**
 * 0-based index of the row where new data starts: the first row at or below row 2 whose next END_RUN rows are all
 * blank in both the instructor_name and branch columns. Rows past the end of the returned values count as blank.
 * (Blank rows scattered inside the data are skipped, however many, as long as they come in runs shorter than END_RUN.)
 */
export function findEndRow(rows: (string | number)[][], iName: number, iBranch: number, run = END_RUN): number {
  const blank = (r: number) => !String(rows[r]?.[iName] ?? '').trim() && !String(rows[r]?.[iBranch] ?? '').trim();
  for (let r = 1; r <= rows.length; r++) {
    if (!blank(r)) continue;
    let ok = true;
    for (let k = 1; k < run; k++) {
      if (!blank(r + k)) {
        ok = false;
        break;
      }
    }
    if (ok) return r;
  }
  return rows.length;
}

/** Does this row (its identifying columns A … class) belong to this teacher + branch + batch + round? */
function keyMatcher(rc: ReturnType<typeof responseColumns>, sel: { branch: string; batch: string; level: string | null }, wantTeacher: string, wantClass: string) {
  const iBatch = rc.hasLevel ? 3 : 2;
  const iClass = rc.hasLevel ? 4 : 3;
  return (r: Cell[]) =>
    Boolean(r[0]) &&
    teacherKey(cleanName(String(r[0])).name) === wantTeacher &&
    normId(r[1]) === normId(sel.branch) &&
    normId(r[iBatch]) === normId(sel.batch) &&
    norm(r[iClass]) === wantClass &&
    (!rc.hasLevel || normId(r[2]) === normId(sel.level));
}

/**
 * Reads only what is needed from a student tab that grows all year (thousands of rows):
 *  1. the identifying columns (instructor_name … class) for EVERY row — a light read with no row limit;
 *  2. the full rows of the ones that match (plus the header row), in one batchGet.
 */
async function readMatchingRows(token: string, rid: string, tab: string, rc: ReturnType<typeof responseColumns>, match: (key: Cell[]) => boolean, render: 'UNFORMATTED_VALUE' | 'FORMATTED_VALUE') {
  const keys = (await call<{ values?: Cell[][] }>(token, `${api(rid)}/values/${q(tab)}!A:${colLetter(rc.usersRated - 1)}`)).values ?? [];
  const wanted: number[] = [];
  keys.forEach((r, i) => {
    if (i > 0 && match(r)) wanted.push(i + 1);
  });
  let runs: [number, number][] = [];
  for (const r of wanted) {
    const last = runs[runs.length - 1];
    if (last && r === last[1] + 1) last[1] = r;
    else runs.push([r, r]);
  }
  if (runs.length > 25) runs = [[wanted[0], wanted[wanted.length - 1]]]; // very fragmented: read the whole span at once
  const name = `'${tab.replace(/'/g, "''")}'`;
  const ranges = [`${name}!A1:${colLetter(rc.last)}1`, ...runs.map(([a, b]) => `${name}!A${a}:${colLetter(rc.last)}${b}`)];
  const res = await call<{ valueRanges?: { values?: Cell[][] }[] }>(token, `${api(rid)}/values:batchGet?${ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join('&')}&valueRenderOption=${render}`);
  const [head, ...bodies] = res.valueRanges ?? [];
  const want = new Set(wanted);
  const rows: { row: number; cells: Cell[] }[] = [];
  bodies.forEach((vr, idx) => (vr.values ?? []).forEach((cells, k) => {
    const row = runs[idx][0] + k;
    if (want.has(row)) rows.push({ row, cells });
  }));
  return { used: keys.length, header: head?.values?.[0] ?? [], rows };
}

function validate(input: PublishInput) {
  const { selection: sel } = input;
  if (!(sel.program in PROGRAM_BY_ID)) throw new SheetsError(400, 'Unknown programme.');
  if (!sel.branch.trim() || !sel.batch.trim() || !sel.teacherName.trim()) throw new SheetsError(400, 'Pick the teacher, branch and batch first.');
  if (sel.round !== 'first' && sel.round !== 'last') throw new SheetsError(400, 'Pick First Rating or Last Rating.');
  if (PROGRAM_BY_ID[sel.program].hasLevel && !sel.level) throw new SheetsError(400, 'Pick the level for this programme.');
  const problem = validateResponses(input.responses);
  if (problem) throw new SheetsError(400, problem);
}

interface Ctx {
  token: string;
  /** The selection with every value in its canonical spelling — what actually gets written. */
  sel: Selection;
  def: ProgramDef;
  iCrit: number[];
  lo: number;
  hi: number;
  block: number[];
  identityValues: Cell[];
  iAvg: number;
  avgIsFormula: boolean;
  rowIndex: number;
  critValues: Cell[];
  respTab: string;
  respSheetId: number | null;
  replaceRows: number[];
  respUsedRows: number;
  masterRowCount: number | null;
  masterSheetId: number;
  existing: boolean;
  mode: 'add' | 'replace';
  existingCount: number;
}

/**
 * Works out exactly what would be written — never writes. 'read' access is enough (used for the preview);
 * `publish` re-plans with 'write' access right before saving.
 */
export async function planPublish(input: PublishInput, mode: AccessMode = 'read'): Promise<PublishPlan & { _ctx: Ctx }> {
  validate(input);
  const { selection: sel } = input;
  const def = PROGRAM_BY_ID[sel.program];
  const token = await getAccessToken(mode);
  const warnings: string[] = [];
  const wantTeacher = teacherKey(cleanName(sel.teacherName).name);
  const wantClass = ROUND_LABEL[sel.round].toLowerCase();

  /* ---------- 1. RESPONSES sheet (where the students' rows go first) ---------- */
  const respMeta = await call<Meta>(token, `${api(responsesId())}?fields=properties.title,sheets.properties(title,sheetId)`, {}, `Cannot open the responses sheet — share it with ${process.env.GOOGLE_CLIENT_EMAIL} as an Editor and check RESPONSES_SHEET_ID`);
  const respTab = def.label;
  const respTabMeta = respMeta.sheets.find((s) => s.properties.title === respTab);
  const rc = responseColumns(def);
  const saveMode: 'add' | 'replace' = input.mode === 'replace' ? 'replace' : 'add';
  const matchingRows: number[] = [];
  const existingScores: Score[][] = [];
  const existingSources = new Set<string>();
  const respTeacherSpellings: string[] = [];
  let respUsedRows = 0;
  if (respTabMeta) {
    const found = await readMatchingRows(token, responsesId(), respTab, rc, keyMatcher(rc, sel, wantTeacher, wantClass), 'UNFORMATTED_VALUE');
    respUsedRows = found.used;
    for (const { row, cells: r } of found.rows) {
      matchingRows.push(row);
      respTeacherSpellings.push(String(r[0]));
      existingScores.push(Array.from({ length: def.criteria.length }, (_, k) => (isValidScore(r[rc.scoreStart + k]) ? (r[rc.scoreStart + k] as number) : null)));
      const src = String(r[rc.avg + 3] ?? '');
      if (src) existingSources.add(src);
    }
  }
  const replaceRows = saveMode === 'replace' ? matchingRows : [];
  const duplicates = input.responses.filter((r) => existingSources.has(r.source)).length;
  const existingCount = matchingRows.length;
  // The batch average always covers every student that will be saved for this batch and round.
  const counted = saveMode === 'add' ? [...existingScores.map((scores) => ({ scores })), ...input.responses] : input.responses;
  if (existingCount > 0) {
    warnings.push(
      saveMode === 'add'
        ? `${existingCount} student row${existingCount === 1 ? ' is' : 's are'} already saved for this batch and round. These ${input.responses.length} will be added, so the average covers all ${counted.length}.`
        : `The ${existingCount} student row${existingCount === 1 ? '' : 's'} already saved for this batch and round will be deleted and replaced by these ${input.responses.length}.`,
    );
  }
  if (duplicates > 0 && saveMode === 'add') warnings.push(`${duplicates} of these forms come from files that are already saved (same file name). If you are re-uploading the same forms, choose "Replace" instead so nobody is counted twice.`);

  /* ---------- 2. MASTER sheet: locate columns, the existing row (if any), or the first empty template row ---------- */
  const meta = await call<Meta>(token, `${api(masterId())}?fields=sheets.properties(title,sheetId,gridProperties.rowCount)`);
  const masterMeta = meta.sheets.find((s) => s.properties.title === def.tab);
  if (!masterMeta) throw new SheetsError(404, `The master sheet has no tab called "${def.tab}".`);
  const master = (await call<{ values?: Cell[][] }>(token, `${api(masterId())}/values/${q(def.tab)}!A:Z?valueRenderOption=FORMULA`)).values ?? [];
  const header = (master[0] ?? []).map((h) => norm(h));
  const at = (name: string) => header.indexOf(norm(name));
  const need = (name: string) => {
    const i = at(name);
    if (i < 0) throw new SheetsError(500, `The "${def.tab}" tab has no "${name}" column.`);
    return i;
  };
  const iName = need('instructor_name');
  const iBranch = need('branch');
  const iBatch = need('batch');
  const iClass = need('class');
  const iLevel = def.hasLevel ? need('level') : -1;
  const iAvg = at('average rating');
  const iCrit = def.criteria.map((c, k) => {
    const i = at(c);
    return i >= 0 ? i : iClass + 1 + k; // fall back to "the five columns after class"
  });
  const identity = [iName, iBranch, ...(iLevel >= 0 ? [iLevel] : []), iBatch, iClass];
  const block = [...identity, ...iCrit];
  const lo = Math.min(...block);
  const hi = Math.max(...block);
  if (hi - lo + 1 !== block.length) throw new SheetsError(500, `The columns of "${def.tab}" are not in the expected order, so it cannot be filled automatically.`);

  const matches: number[] = [];
  master.forEach((row, r) => {
    if (r === 0) return;
    const cell = (i: number) => String(row[i] ?? '').trim();
    if (block.every((i) => cell(i) === '')) return; // a blank / template row: cannot be a match
    if (
      cell(iName) &&
      teacherKey(cleanName(cell(iName)).name) === wantTeacher &&
      normId(cell(iBranch)) === normId(sel.branch) &&
      normId(cell(iBatch)) === normId(sel.batch) &&
      norm(cell(iClass)) === wantClass &&
      (iLevel < 0 || normId(cell(iLevel)) === normId(sel.level))
    ) {
      matches.push(r);
    }
  });
  // Where new rows go: the END of the data. A blank row (or a few) in the middle is NOT the end — the end is the
  // first row that is followed by END_RUN rows all blank in instructor_name and branch.
  const endRow = findEndRow(master, iName, iBranch);
  const skippedBlank = master.slice(1, endRow).filter((r) => !String(r?.[iName] ?? '').trim() && !String(r?.[iBranch] ?? '').trim()).length;
  if (matches.length > 1) warnings.push(`The master sheet already has ${matches.length} rows for this batch and round (rows ${matches.map((r) => r + 1).join(', ')}). Only the first will be updated — tidy the others in the sheet.`);

  /* ---------- 3. standardise: ONE spelling per teacher / branch / batch, in every sheet ---------- */
  const spellingIn = (values: unknown[]): string | null => {
    const counts = new Map<string, number>();
    for (const v of values) {
      const t = compact(String(v ?? ''));
      if (t && teacherKey(cleanName(t).name) === wantTeacher) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null; // most used; ties keep the earliest
  };
  let known: string | null = spellingIn(master.slice(1).map((r) => r[iName])) ?? spellingIn(respTeacherSpellings);
  if (!known) {
    try {
      known = (await getRatings()).teachers.find((t) => teacherKey(cleanName(t.sheetName).name) === wantTeacher)?.sheetName ?? null;
    } catch {
      /* the dashboard data is only a hint; fall through to formatting */
    }
  }
  const lookups = await getLookups().catch(() => ({ branches: [] as string[], batches: [] as string[], levels: ['Beginner', 'Intermediate', 'Advance'] }));
  const std: Selection = {
    ...sel,
    teacherName: known ?? formatName(sel.teacherName),
    branch: fromList(sel.branch, lookups.branches) ?? formatPlace(sel.branch),
    level: sel.level ? (fromList(sel.level, lookups.levels) ?? formatPlace(sel.level)) : null,
    batch: fromList(sel.batch, lookups.batches) ?? formatBatch(sel.batch),
  };
  const changes: string[] = [];
  const said = (label: string, typed: string, now: string) => {
    if (compact(typed) !== now) changes.push(`${label} “${compact(typed)}” will be written as “${now}”${label === 'Teacher' && known ? ' (the spelling already used in the sheet)' : ''}.`);
  };
  said('Teacher', sel.teacherName, std.teacherName);
  said('Branch', sel.branch, std.branch);
  said('Batch', sel.batch, std.batch);
  if (sel.level && std.level) said('Level', sel.level, std.level);

  const agg = aggregate(counted);
  if (agg.counts.some((c) => c < agg.forms)) warnings.push(`Some questions were left blank on ${agg.forms - Math.min(...agg.counts)} form(s); those answers are left out of the average, not counted as zero.`);
  if (agg.forms < 5) warnings.push(`The average is based on only ${agg.forms} form${agg.forms === 1 ? '' : 's'}.`);

  const critValues = agg.criteria.map((v) => (v === null ? '' : v));
  const existingRow = matches[0];
  const action = existingRow !== undefined ? 'update' : 'add';
  const rowIndex = existingRow ?? endRow;
  const before = existingRow !== undefined ? iCrit.map((i) => (master[existingRow][i] ?? '') as Cell) : null;
  const identityValues: Cell[] = [std.teacherName, std.branch, ...(iLevel >= 0 ? [std.level ?? ''] : []), std.batch, ROUND_LABEL[sel.round]];
  if (existingRow !== undefined) {
    identity.forEach((col, k) => {
      const current = compact(String(master[existingRow][col] ?? ''));
      if (current !== String(identityValues[k])) changes.push(`Row ${existingRow + 1} currently says “${current}” — it will be tidied to “${identityValues[k]}”.`);
    });
  }
  if (existingRow === undefined && skippedBlank > 0) changes.push(`${skippedBlank} blank row${skippedBlank === 1 ? '' : 's'} in the middle of the sheet ${skippedBlank === 1 ? 'was' : 'were'} skipped — the new row goes at the end, at row ${rowIndex + 1}.`);
  const avgCell = iAvg >= 0 ? String(master[rowIndex]?.[iAvg] ?? '') : '';

  const plan: PublishPlan = {
    aggregate: agg,
    written: { teacher: std.teacherName, branch: std.branch, level: std.level, batch: std.batch, round: ROUND_LABEL[sel.round], changes },
    master: {
      tab: def.tab,
      gid: masterMeta.properties.sheetId,
      action,
      row: rowIndex + 1,
      columns: [...def.criteria, 'Average Rating'],
      before: before ? [...before, avgOf(before)] : null,
      after: [...critValues, agg.average ?? ''],
    },
    responses: { spreadsheet: respMeta.properties?.title ?? 'Responses sheet', tab: respTab, exists: Boolean(respTabMeta), existing: existingCount, duplicates, mode: saveMode, replace: replaceRows.length, add: input.responses.length, total: counted.length },
    warnings,
  };

  return {
    ...plan,
    _ctx: { token, sel: std, def, iCrit, lo, hi, block, identityValues, iAvg, avgIsFormula: avgCell.startsWith('='), rowIndex, critValues, respTab, respSheetId: respTabMeta?.properties.sheetId ?? null, replaceRows, respUsedRows, masterRowCount: masterMeta.properties.gridProperties?.rowCount ?? null, masterSheetId: masterMeta.properties.sheetId, existing: action === 'update', mode: saveMode, existingCount },
  };
}

function avgOf(values: Cell[]): Cell {
  const xs = values.filter((v): v is number => typeof v === 'number');
  return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : '';
}

export async function previewPublish(input: PublishInput): Promise<PublishPlan> {
  const { _ctx, ...plan } = await planPublish(input, 'read');
  void _ctx;
  return plan;
}

/** Text that a spreadsheet could mistake for a formula stays text: the whole row is written RAW. */
/*
 * ---- One save per programme at a time ----
 * Two people saving into the same programme at the same instant would each pick the same "end of the data" row and one
 * would silently overwrite the other (or delete the wrong student rows after the other shifted them). So saves for a
 * programme wait their turn:
 *   1. in this server process: a simple queue;
 *   2. across servers (e.g. serverless, several instances): a lock row appended to a "_locks" tab in the responses sheet.
 *      Google appends rows atomically, so the earliest un-released, un-expired row is the holder. A lock that is never
 *      released (a crashed server) expires by itself after `ttlMs`.
 * Different programmes use different keys, so they never wait on each other.
 */
export const lockOptions = { enabled: true, inProcess: true, sheet: true, ttlMs: 120_000, pollMs: 1200, maxWaitMs: 90_000 };
const chains = new Map<string, Promise<void>>();
const LOCK_TAB = '_locks';
let lockTabKnown = false;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function acquireSheetLock(token: string, key: string): Promise<() => Promise<void>> {
  const RID = responsesId();
  if (!lockTabKnown) {
    const meta = await call<Meta>(token, `${api(RID)}?fields=sheets.properties(title,sheetId)`);
    if (!meta.sheets.some((s) => s.properties.title === LOCK_TAB)) {
      try {
        await call(token, `${api(RID)}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests: [{ addSheet: { properties: { title: LOCK_TAB, gridProperties: { frozenRowCount: 1 } } } }] }) });
        await call(token, `${api(RID)}/values/${q(LOCK_TAB)}!A1?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values: [['lock_key', 'token', 'acquired_at_ms', 'status']] }) });
      } catch {
        /* another server created it first */
      }
    }
    lockTabKnown = true;
  }
  const mine = crypto.randomUUID();
  const appended = await call<{ updates?: { updatedRange?: string } }>(token, `${api(RID)}/values/${q(LOCK_TAB)}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: 'POST', body: JSON.stringify({ values: [[key, mine, Date.now(), 'held']] }) });
  const myRow = Number(/!\$?[A-Z]+\$?(\d+)/.exec(appended.updates?.updatedRange ?? '')?.[1]);
  const release = async () => {
    if (myRow) await call(token, `${api(RID)}/values/${q(LOCK_TAB)}!D${myRow}?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values: [['released']] }) });
  };
  const deadline = Date.now() + lockOptions.maxWaitMs;
  for (;;) {
    const rows = (await call<{ values?: Cell[][] }>(token, `${api(RID)}/values/${q(LOCK_TAB)}!A:D`)).values ?? [];
    const now = Date.now();
    const holder = rows
      .map((r, i) => ({ row: i + 1, key: String(r[0] ?? ''), tok: String(r[1] ?? ''), ts: Number(r[2]), st: String(r[3] ?? '') }))
      .filter((x) => x.row > 1 && x.key === key && x.st === 'held' && now - x.ts < lockOptions.ttlMs)
      .sort((a, b) => a.row - b.row)[0];
    if (!holder || holder.tok === mine) return release;
    if (Date.now() > deadline) {
      await release().catch(() => {});
      throw new SheetsError(409, 'BUSY: another save for this programme is still in progress. Please press Save again in a few seconds.');
    }
    await pause(lockOptions.pollMs + Math.random() * 400);
  }
}

async function withProgrammeLock<T>(token: string, key: string, fn: () => Promise<T>): Promise<T> {
  if (!lockOptions.enabled) return fn();
  let done: () => void = () => {};
  let previous: Promise<void> = Promise.resolve();
  if (lockOptions.inProcess) {
    previous = chains.get(key) ?? Promise.resolve();
    const mine = new Promise<void>((r) => (done = r));
    chains.set(key, previous.then(() => mine));
  }
  await previous;
  try {
    const release = lockOptions.sheet ? await acquireSheetLock(token, key) : null;
    try {
      return await fn();
    } finally {
      if (release) await release().catch(() => {});
    }
  } finally {
    done();
  }
}

export async function publish(input: PublishInput): Promise<PublishResult> {
  validate(input);
  const token = await getAccessToken('write');
  return withProgrammeLock(token, `prog:${input.selection.program}`, () => publishLocked(input));
}

async function publishLocked(input: PublishInput): Promise<PublishResult> {
  const { _ctx: c, ...plan } = await planPublish(input, 'write');
  if (c.existingCount > 0 && input.mode === undefined) throw new SheetsError(409, 'MODE_REQUIRED');
  if (c.existing && !input.overwrite) throw new SheetsError(409, 'OVERWRITE_REQUIRED');
  const sel = c.sel;
  const token = c.token;
  const RID = responsesId();
  const MID = masterId();
  const rc = responseColumns(c.def);
  const submissionId = `sub_${Date.now().toString(36)}`;
  const now = new Date().toISOString();

  /* ---- 1. RESPONSES sheet first: create the programme's tab (header + formatting) if it does not exist yet ---- */
  let respSheetId = c.respSheetId;
  let usedRows = c.respUsedRows;
  if (respSheetId === null) {
    respSheetId = Math.floor(Math.random() * 1_000_000_000) + 1000;
    await call(token, `${api(RID)}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          { addSheet: { properties: { sheetId: respSheetId, title: c.respTab, gridProperties: { frozenRowCount: 1 } } } },
          { repeatCell: { range: { sheetId: respSheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.72, green: 0.72, blue: 0.72 }, horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE', wrapStrategy: 'WRAP', textFormat: { bold: true } } }, fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,wrapStrategy,textFormat)' } },
        ],
      }),
    });
    await call(token, `${api(RID)}/values/${q(c.respTab)}!A1?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values: [rc.headers] }) });
    usedRows = 1;
  }

  /* ---- 2. a re-upload replaces this batch's earlier student rows (bottom-up so row numbers stay valid) ---- */
  if (c.replaceRows.length) {
    await call(token, `${api(RID)}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ requests: [...c.replaceRows].sort((a, b) => b - a).map((r) => ({ deleteDimension: { range: { sheetId: respSheetId, dimension: 'ROWS', startIndex: r - 1, endIndex: r } } })) }),
    });
    usedRows -= c.replaceRows.length;
  }

  /* ---- 3. one row per student, in the "Users Rated" layout (numbering carries on after rows already saved) ---- */
  const rows: Cell[][] = input.responses.map((r, i) => [
    sel.teacherName,
    sel.branch,
    ...(rc.hasLevel ? [sel.level ?? ''] : []),
    sel.batch,
    ROUND_LABEL[sel.round],
    (c.mode === 'add' ? c.existingCount : 0) + i + 1,
    ...r.scores.map((s) => (isValidScore(s) ? s : '')),
    studentAverage(r.scores) ?? '', // placeholder; replaced by a live =AVERAGE formula just below
    r.feedback.slice(0, 2000),
    r.header?.date ?? '',
    r.source,
    now,
    submissionId,
  ]);
  const appended = await call<{ updates?: { updatedRange?: string } }>(token, `${api(RID)}/values/${q(c.respTab)}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: 'POST', body: JSON.stringify({ values: rows }) });
  const m = /!\$?[A-Z]+\$?(\d+)/.exec(appended.updates?.updatedRange ?? '');
  const firstNew = m ? Number(m[1]) : usedRows + 1;

  // Average Rating per student as a live formula (blank answers are skipped by AVERAGE), so hand edits in the sheet update it.
  const s0 = colLetter(rc.scoreStart);
  const s1 = colLetter(rc.scoreStart + c.def.criteria.length - 1);
  const formulas = rows.map((_, i) => [`=IFERROR(AVERAGE(${s0}${firstNew + i}:${s1}${firstNew + i}),"")`]);
  await call(token, `${api(RID)}/values/${q(c.respTab)}!${colLetter(rc.avg)}${firstNew}:${colLetter(rc.avg)}${firstNew + rows.length - 1}?valueInputOption=USER_ENTERED`, { method: 'PUT', body: JSON.stringify({ values: formulas }) });

  /* ---- 4. MASTER row: an existing row only gets its five criteria replaced; a new row gets everything ---- */
  const r1 = c.rowIndex + 1;
  const tab = c.def.tab;
  if (c.masterRowCount !== null && r1 > c.masterRowCount) {
    // the end of the data is at the very bottom of the grid: add room first, or the write would be refused
    await call(token, `${api(MID)}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests: [{ appendDimension: { sheetId: c.masterSheetId, dimension: 'ROWS', length: r1 - c.masterRowCount + 50 } }] }) });
  }
  // New row or update: write identity (teacher/branch/[level]/batch/class) + the five scores as one block, so an
  // existing row that was typed inconsistently ("FAHAD") is tidied to the canonical spelling at the same time.
  const span = new Array<Cell>(c.hi - c.lo + 1).fill('');
  const identityIdx = c.block.slice(0, c.block.length - c.iCrit.length);
  identityIdx.forEach((col, k) => (span[col - c.lo] = c.identityValues[k]));
  c.iCrit.forEach((col, k) => (span[col - c.lo] = c.critValues[k]));
  await call(token, `${api(MID)}/values/${q(tab)}!${colLetter(c.lo)}${r1}:${colLetter(c.hi)}${r1}?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values: [span] }) });
  // Keep the sheet's own Average Rating formula; only add one if the row has none.
  if (c.iAvg >= 0 && !c.avgIsFormula) {
    const first = colLetter(Math.min(...c.iCrit));
    const last = colLetter(Math.max(...c.iCrit));
    await call(token, `${api(MID)}/values/${q(tab)}!${colLetter(c.iAvg)}${r1}?valueInputOption=USER_ENTERED`, { method: 'PUT', body: JSON.stringify({ values: [[`=AVERAGE(${first}${r1}:${last}${r1})`]] }) });
  }

  const masterUrl = `https://docs.google.com/spreadsheets/d/${MID}/edit`;
  const responsesUrl = `https://docs.google.com/spreadsheets/d/${RID}/edit#gid=${respSheetId}&range=A${firstNew}`;

  /* ---- 5. read both sheets back, exactly as they look now: proves the save and lets the screen show it ---- */
  let view: PublishResult['view'];
  try {
    const pad = (row: Cell[] | undefined, n: number) => Array.from({ length: n }, (_, i) => String(row?.[i] ?? ''));
    const wantKey = teacherKey(cleanName(sel.teacherName).name);
    const wantClassLabel = ROUND_LABEL[sel.round].toLowerCase();

    const st = await readMatchingRows(token, RID, c.respTab, rc, keyMatcher(rc, sel, wantKey, wantClassLabel), 'FORMATTED_VALUE');
    const studentRows = st.rows.map(({ row, cells }) => ({ row, cells: pad(cells, rc.headers.length), highlight: String(cells[rc.last] ?? '') === submissionId }));

    const mv = (await call<{ values?: Cell[][] }>(token, `${api(MID)}/values/${q(tab)}!A:Z?valueRenderOption=FORMATTED_VALUE`)).values ?? [];
    const mh = (mv[0] ?? []).map((h) => norm(h));
    const width = Math.max(c.hi + 1, c.iAvg + 2, mh.lastIndexOf('remarks') + 1);
    const mi = (n: string) => mh.indexOf(n);
    const masterRows = mv
      .map((r, i) => ({ r, i }))
      .filter(({ r, i }) => i > 0 && (i === c.rowIndex || (teacherKey(cleanName(String(r[mi('instructor_name')] ?? '')).name) === wantKey && normId(r[mi('branch')]) === normId(sel.branch) && normId(r[mi('batch')]) === normId(sel.batch) && (!rc.hasLevel || normId(r[mi('level')]) === normId(sel.level)))))
      .map(({ r, i }) => ({ row: i + 1, cells: pad(r, width), highlight: i === c.rowIndex }));

    view = {
      students: { spreadsheet: plan.responses.spreadsheet, tab: c.respTab, url: responsesUrl, headers: pad(st.header, rc.headers.length), rows: studentRows },
      master: { spreadsheet: 'Master sheet', tab, url: `${masterUrl}#gid=${plan.master.gid}&range=A${r1}`, headers: pad(mv[0], width), rows: masterRows },
    } satisfies { students: SheetView; master: SheetView };
  } catch {
    view = undefined; // the save itself succeeded; only the preview of it is unavailable
  }

  return { plan, view, sheetUrl: masterUrl, masterUrl: `${masterUrl}#gid=${plan.master.gid}&range=A${r1}`, responsesUrl };
}
