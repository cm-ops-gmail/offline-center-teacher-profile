import 'server-only';
import { aggregate, isValidScore, ROUND_LABEL, studentAverage, validateResponses } from '@/features/collect/aggregate';
import type { PublishPlan, PublishResult, Score, Selection, SheetView } from '@/features/collect/types';
import { compact, formatBatch, formatName, formatPlace, fromList } from '@/features/collect/normalize';
import { PROGRAM_BY_ID, type ProgramDef } from '@/features/ratings/programs';
import { AppError, cleanName, clearRatingsCache, getLookups, getRatings, rest, selectAll, teacherKey, type MasterRow, type StudentRow } from './db';

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
 * Two tables are involved:
 *  - student_responses: every student's answers land here FIRST, one row per student.
 *  - master_ratings: the batch averages computed from those rows (what the dashboard reads).
 */

const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
const normId = (s: unknown) => norm(s).replace(/[^a-z0-9]/g, '');

function validate(input: PublishInput) {
  const { selection: sel } = input;
  if (!(sel.program in PROGRAM_BY_ID)) throw new AppError(400, 'Unknown programme.');
  if (!sel.branch.trim() || !sel.batch.trim() || !sel.teacherName.trim()) throw new AppError(400, 'Pick the teacher, branch and batch first.');
  if (sel.round !== 'first' && sel.round !== 'last') throw new AppError(400, 'Pick First Rating or Last Rating.');
  if (PROGRAM_BY_ID[sel.program].hasLevel && !sel.level) throw new AppError(400, 'Pick the level for this programme.');
  const problem = validateResponses(input.responses);
  if (problem) throw new AppError(400, problem);
}

/** Does this row belong to this teacher + branch + batch (+ level)? The round is filtered in the query. */
function sameBatch(r: { instructor_name: string; branch: string; level: string | null; batch: string }, sel: { branch: string; batch: string; level: string | null }, wantTeacher: string, hasLevel: boolean) {
  return (
    Boolean(r.instructor_name) &&
    teacherKey(cleanName(r.instructor_name).name) === wantTeacher &&
    normId(r.branch) === normId(sel.branch) &&
    normId(r.batch) === normId(sel.batch) &&
    (!hasLevel || normId(r.level) === normId(sel.level))
  );
}

/** Columns of a programme's student rows, in display order (used for the read-back grid). */
export function responseHeaders(def: ProgramDef): string[] {
  return ['instructor_name', 'branch', ...(def.hasLevel ? ['level'] : []), 'batch', 'class', 'Users Rated', ...def.criteria, 'Average Rating', 'Feedback', 'Form date', 'Source file', 'submitted_at', 'submission_id', 'Rating date'];
}
export function masterHeaders(def: ProgramDef): string[] {
  return ['instructor_name', 'branch', ...(def.hasLevel ? ['level'] : []), 'batch', 'class', ...def.criteria, 'Average Rating', 'Remarks', 'Rating date'];
}

/** Today in Bangladesh (the centre's timezone), as YYYY-MM-DD. */
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
const ratedOnOf = (sel: Selection) => (sel.ratedOn && /^\d{4}-\d{2}-\d{2}$/.test(sel.ratedOn) && !Number.isNaN(Date.parse(sel.ratedOn)) ? sel.ratedOn : today());

const cellText = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const round2 = (n: number) => Math.round(n * 100) / 100;

function studentCells(def: ProgramDef, r: StudentRow): string[] {
  return [r.instructor_name, r.branch, ...(def.hasLevel ? [r.level ?? ''] : []), r.batch, ROUND_LABEL[r.class], cellText(r.users_rated), ...def.criteria.map((_, i) => cellText(r.scores?.[i])), cellText(r.average_rating), r.feedback, r.form_date, r.source_file, r.submitted_at, r.submission_id, cellText(r.rated_on)];
}
function masterCells(def: ProgramDef, r: MasterRow): string[] {
  return [r.instructor_name, r.branch, ...(def.hasLevel ? [r.level ?? ''] : []), r.batch, ROUND_LABEL[r.class], ...def.criteria.map((_, i) => cellText(r.scores?.[i])), cellText(r.average_rating), r.remarks, cellText(r.rated_on)];
}

interface Ctx {
  sel: Selection;
  def: ProgramDef;
  critValues: (number | null)[];
  average: number | null;
  /** The master row to update, or null to add a new one. */
  masterId: number | null;
  replaceIds: number[];
  existingCount: number;
  mode: 'add' | 'replace';
}

/** Works out exactly what would be written — never writes. `publish` re-plans right before saving. */
export async function planPublish(input: PublishInput): Promise<PublishPlan & { _ctx: Ctx }> {
  validate(input);
  const { selection: sel } = input;
  const def = PROGRAM_BY_ID[sel.program];
  const warnings: string[] = [];
  const wantTeacher = teacherKey(cleanName(sel.teacherName).name);
  const saveMode: 'add' | 'replace' = input.mode === 'replace' ? 'replace' : 'add';

  /* ---------- 1. student rows already saved for this batch and round ---------- */
  const [programStudents, programMaster] = await Promise.all([
    selectAll<StudentRow>('student_responses', `select=*&program=eq.${sel.program}`),
    selectAll<MasterRow>('master_ratings', `select=*&program=eq.${sel.program}`),
  ]);
  const matching = programStudents.filter((r) => r.class === sel.round && sameBatch(r, sel, wantTeacher, def.hasLevel));
  const existingSources = new Set(matching.map((r) => r.source_file).filter(Boolean));
  const existingScores = matching.map((r) => Array.from({ length: def.criteria.length }, (_, k) => (isValidScore(r.scores?.[k]) ? (r.scores[k] as number) : null)));
  const existingCount = matching.length;
  const replaceIds = saveMode === 'replace' ? matching.map((r) => r.id) : [];
  const duplicates = input.responses.filter((r) => existingSources.has(r.source)).length;
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

  /* ---------- 2. master row for this batch and round (if any) ---------- */
  const matches = programMaster.filter((r) => r.class === sel.round && sameBatch(r, sel, wantTeacher, def.hasLevel));
  if (matches.length > 1) warnings.push(`The database already has ${matches.length} rows for this batch and round (ids ${matches.map((r) => r.id).join(', ')}). Only the first will be updated — tidy the others.`);
  const existing = matches[0];

  /* ---------- 3. standardise: ONE spelling per teacher / branch / batch ---------- */
  const spellingIn = (values: string[]): string | null => {
    const counts = new Map<string, number>();
    for (const v of values) {
      const t = compact(v);
      if (t && teacherKey(cleanName(t).name) === wantTeacher) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null; // most used; ties keep the earliest
  };
  let known: string | null = spellingIn(programMaster.map((r) => r.instructor_name)) ?? spellingIn(programStudents.map((r) => r.instructor_name));
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
    if (compact(typed) !== now) changes.push(`${label} “${compact(typed)}” will be written as “${now}”${label === 'Teacher' && known ? ' (the spelling already used in the database)' : ''}.`);
  };
  said('Teacher', sel.teacherName, std.teacherName);
  said('Branch', sel.branch, std.branch);
  said('Batch', sel.batch, std.batch);
  if (sel.level && std.level) said('Level', sel.level, std.level);

  const agg = aggregate(counted);
  if (agg.counts.some((c) => c < agg.forms)) warnings.push(`Some questions were left blank on ${agg.forms - Math.min(...agg.counts)} form(s); those answers are left out of the average, not counted as zero.`);
  if (agg.forms < 5) warnings.push(`The average is based on only ${agg.forms} form${agg.forms === 1 ? '' : 's'}.`);

  const critValues = agg.criteria.map((v) => (v === null ? null : v));
  const before = existing ? def.criteria.map((_, i) => existing.scores?.[i] ?? ('' as const)) : null;
  if (existing) {
    const current = [existing.instructor_name, existing.branch, ...(def.hasLevel ? [existing.level ?? ''] : []), existing.batch];
    const next = [std.teacherName, std.branch, ...(def.hasLevel ? [std.level ?? ''] : []), std.batch];
    current.forEach((c, k) => {
      if (compact(c) !== next[k]) changes.push(`Row ${existing.id} currently says “${compact(c)}” — it will be tidied to “${next[k]}”.`);
    });
  }

  const plan: PublishPlan = {
    aggregate: agg,
    written: { teacher: std.teacherName, branch: std.branch, level: std.level, batch: std.batch, round: ROUND_LABEL[sel.round], changes },
    master: {
      tab: def.tab,
      action: existing ? 'update' : 'add',
      row: existing?.id ?? null,
      columns: [...def.criteria, 'Average Rating'],
      before: before ? [...before, avgOf(before)] : null,
      after: [...critValues.map((v) => v ?? ''), agg.average ?? ''],
    },
    responses: { spreadsheet: 'the database', tab: def.label, exists: true, existing: existingCount, duplicates, mode: saveMode, replace: replaceIds.length, add: input.responses.length, total: counted.length },
    warnings,
  };

  return { ...plan, _ctx: { sel: std, def, critValues, average: agg.average, masterId: existing?.id ?? null, replaceIds, existingCount, mode: saveMode } };
}

function avgOf(values: (number | string)[]): number | string {
  const xs = values.filter((v): v is number => typeof v === 'number');
  return xs.length ? round2(xs.reduce((a, b) => a + b, 0) / xs.length) : '';
}

export async function previewPublish(input: PublishInput): Promise<PublishPlan> {
  const { _ctx, ...plan } = await planPublish(input);
  void _ctx;
  return plan;
}

export async function publish(input: PublishInput): Promise<PublishResult> {
  validate(input);
  const { _ctx: c, ...plan } = await planPublish(input);
  if (c.existingCount > 0 && input.mode === undefined) throw new AppError(409, 'MODE_REQUIRED');
  if (c.masterId !== null && !input.overwrite) throw new AppError(409, 'OVERWRITE_REQUIRED');
  const { sel, def } = c;
  const submissionId = `sub_${Date.now().toString(36)}`;
  const now = new Date().toISOString();
  const ratedOn = ratedOnOf(sel);
  const identity = { program: sel.program, instructor_name: sel.teacherName, branch: sel.branch, level: def.hasLevel ? (sel.level ?? '') : null, batch: sel.batch, class: sel.round };

  /* ---- 1. a re-upload replaces this batch's earlier student rows ---- */
  if (c.replaceIds.length) await rest(`student_responses?id=in.(${c.replaceIds.join(',')})`, { method: 'DELETE' });

  /* ---- 2. one row per student (numbering carries on after rows already saved) ---- */
  const base = c.mode === 'add' ? c.existingCount : 0;
  const students = await rest<StudentRow[]>('student_responses', {
    method: 'POST',
    prefer: 'return=representation',
    body: JSON.stringify(
      input.responses.map((r, i) => ({
        ...identity,
        users_rated: base + i + 1,
        scores: r.scores.map((s) => (isValidScore(s) ? s : null)),
        average_rating: studentAverage(r.scores),
        feedback: r.feedback.slice(0, 2000),
        form_date: r.header?.date ?? '',
        source_file: r.source,
        submitted_at: now,
        submission_id: submissionId,
        rated_on: ratedOn,
      })),
    ),
  });

  /* ---- 3. the batch average: update the existing row's scores, or add a new row ---- */
  let masterRow: MasterRow;
  if (c.masterId !== null) {
    const [row] = await rest<MasterRow[]>(`master_ratings?id=eq.${c.masterId}`, { method: 'PATCH', prefer: 'return=representation', body: JSON.stringify({ ...identity, scores: c.critValues, average_rating: c.average, rated_on: ratedOn, updated_at: now }) });
    masterRow = row;
  } else {
    const [row] = await rest<MasterRow[]>('master_ratings', { method: 'POST', prefer: 'return=representation', body: JSON.stringify({ ...identity, scores: c.critValues, average_rating: c.average, remarks: '', rated_on: ratedOn }) });
    masterRow = row;
  }
  clearRatingsCache();

  /* ---- 4. read back what is now stored, so the screen shows the proof ---- */
  let view: PublishResult['view'];
  try {
    const wantKey = teacherKey(cleanName(sel.teacherName).name);
    const [allStudents, allMaster] = await Promise.all([
      selectAll<StudentRow>('student_responses', `select=*&program=eq.${sel.program}&class=eq.${sel.round}`),
      selectAll<MasterRow>('master_ratings', `select=*&program=eq.${sel.program}`),
    ]);
    const mine = new Set(students.map((s) => s.id));
    view = {
      students: { spreadsheet: 'Database', tab: 'student_responses', headers: responseHeaders(def), rows: allStudents.filter((r) => sameBatch(r, sel, wantKey, def.hasLevel)).map((r) => ({ row: r.id, cells: studentCells(def, r), highlight: mine.has(r.id) })) },
      master: { spreadsheet: 'Database', tab: 'master_ratings', headers: masterHeaders(def), rows: allMaster.filter((r) => sameBatch(r, sel, wantKey, def.hasLevel)).map((r) => ({ row: r.id, cells: masterCells(def, r), highlight: r.id === masterRow.id })) },
    } satisfies { students: SheetView; master: SheetView };
  } catch {
    view = undefined; // the save itself succeeded; only the preview of it is unavailable
  }

  return { plan: { ...plan, master: { ...plan.master, row: masterRow.id } }, view };
}
