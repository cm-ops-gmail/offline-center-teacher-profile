'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, ExternalLink, FileText, Loader2, Plus, RotateCcw, Trash2, UploadCloud, X } from 'lucide-react';
import { Button, Input } from '@tenminuteschool/design-system';
import { DataGate } from '@/components/ui/data-gate';
import { PageHeader, Pill, SectionTitle } from '@/components/ui/primitives';
import { aggregate, checkHeader, ROUND_LABEL, type Check as HeaderState } from './aggregate';
import { compact, formatBatch, formatName, fromList, looseKey } from './normalize';
import { AccessKeyError, api, pool, prepareFile, setAccessKey, useLookups } from './client';
import { SheetGrid } from './sheet-view';
import { PROGRAMS, PROGRAM_BY_ID } from '@/features/ratings/programs';
import { useRatingsData } from '@/features/ratings/filters';
import type { ProgramId } from '@/features/ratings/types';
import type { PublishPlan, PublishResult, RatingRound, Score, StudentResponse } from './types';
import { fmt, plural } from '@/lib/format';
import { cn } from '@/lib/utils';

interface Row extends StudentResponse {
  thumb: string | null;
  jobId: string;
  /** The reviewer has looked at this form, so its flags no longer block saving. */
  checked: boolean;
  /** Order the file was added in, so forms stay in the order you uploaded them however fast each one is read. */
  seq: number;
}

interface Job {
  id: string;
  name: string;
  file: File | null;
  seq: number;
  status: 'queued' | 'reading' | 'done' | 'error';
  error?: string;
  forms: number;
}

const uid = () => Math.random().toString(36).slice(2, 9);
const bySeq = (a: Row, b: Row) => a.seq - b.seq;

export function CollectPage() {
  return <DataGate>{() => <Body />}</DataGate>;
}

function Body() {
  const { data } = useRatingsData();
  const { data: lookups, error: lookupError } = useLookups();

  // ---- 1. batch details (chosen once for the whole pile) ----
  const [program, setProgram] = useState<ProgramId>('ielts');
  const [branch, setBranch] = useState('');
  const [level, setLevel] = useState('');
  const [batch, setBatch] = useState('');
  const [teacher, setTeacher] = useState('');
  const [round, setRound] = useState<RatingRound>('first');
  const def = PROGRAM_BY_ID[program];

  // ---- 2/3. forms ----
  const [jobs, setJobs] = useState<Job[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const seqRef = useRef(0);
  const [onlyCheck, setOnlyCheck] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const [needKey, setNeedKey] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');

  // ---- 4. save ----
  const [plan, setPlan] = useState<PublishPlan | null>(null);
  const [saving, setSaving] = useState<'idle' | 'checking' | 'saving'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState<PublishResult | null>(null);
  const [saveMode, setSaveMode] = useState<'add' | 'replace'>('add');

  const selection = useMemo(() => ({ program, branch, level: def.hasLevel ? level || null : null, batch, teacherName: teacher.trim(), round }), [program, branch, def.hasLevel, level, batch, teacher, round]);
  const detailsReady = Boolean(branch && batch.trim() && teacher.trim() && (!def.hasLevel || level));

  const teacherNames = useMemo(() => (data?.teachers ?? []).map((t) => t.sheetName), [data]);
  const nameKey = (n: string) => looseKey(n.replace(/^\s*[A-Za-z]{2,5}\d{1,4}\s*[-–—]\s*/, ''));
  const knownTeacher = teacherNames.some((n) => nameKey(n) === nameKey(teacher));
  /** On leaving a field: same spelling as the sheet already uses, or a tidy format for something new. */
  const tidyTeacher = () => {
    if (!teacher.trim()) return;
    setTeacher(teacherNames.find((n) => nameKey(n) === nameKey(teacher)) ?? formatName(teacher));
  };
  const tidyBatch = () => {
    if (batch.trim()) setBatch(fromList(batch, lookups?.batches ?? []) ?? formatBatch(batch));
  };

  // A form with no ticks and no feedback (e.g. one of 30 blank forms that was never filled in) is left out of everything.
  const isEmptyForm = (r: Row) => r.scores.every((s) => s === null) && !r.feedback.trim();
  const usable = useMemo(() => rows.filter((r) => !isEmptyForm(r)), [rows]);
  const emptyCount = rows.length - usable.length;
  const agg = useMemo(() => aggregate(usable), [usable]);
  const checks = useMemo(() => new Map(rows.map((r) => [r.id, checkHeader(r.header, selection)])), [rows, selection]);
  const needsCheck = (r: Row) => !r.checked && (r.flags.length > 0 || (checks.get(r.id)?.mismatches.length ?? 0) > 0);
  const toCheck = rows.filter(needsCheck).length;
  const busy = jobs.some((j) => j.status === 'queued' || j.status === 'reading');
  const mismatchCount = rows.filter((r) => (checks.get(r.id)?.mismatches.length ?? 0) > 0).length;

  // Warn before losing an unsaved pile.
  useEffect(() => {
    if (rows.length === 0 || saved) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [rows.length, saved]);

  const resetPlan = () => {
    setPlan(null);
    setSaveError(null);
  };

  /* ---------------- reading files ---------------- */
  const readJob = useCallback(async (job: Job) => {
    setJobs((j) => j.map((x) => (x.id === job.id ? { ...x, status: 'reading', error: undefined } : x)));
    try {
      const prepared = await prepareFile(job.file!);
      const thumb = prepared.type.startsWith('image/') ? URL.createObjectURL(prepared) : null;
      const body = new FormData();
      body.append('file', prepared, job.name);
      body.append('id', job.id);
      const { responses } = await api<{ responses: StudentResponse[] }>('/api/collect/ocr', { method: 'POST', body });
      setRows((r) => [...r.filter((x) => x.jobId !== job.id), ...responses.map((x) => ({ ...x, thumb, jobId: job.id, checked: false, seq: job.seq }))].sort(bySeq));
      setJobs((j) => j.map((x) => (x.id === job.id ? { ...x, status: 'done', forms: responses.length, error: responses.length ? undefined : 'No evaluation form found in this file.' } : x)));
    } catch (e) {
      if (e instanceof AccessKeyError) setNeedKey(true);
      setJobs((j) => j.map((x) => (x.id === job.id ? { ...x, status: 'error', error: (e as Error).message } : x)));
    }
  }, []);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const list = [...files];
      if (!list.length) return;
      resetPlan();
      setSaved(null);
      const created: Job[] = list.map((f) => ({ id: uid(), name: f.name, file: f, seq: seqRef.current++, status: 'queued', forms: 0 }));
      setJobs((j) => [...j, ...created]);
      void pool(created, 3, readJob);
    },
    [readJob],
  );

  const retry = (job: Job) => void readJob(job);

  /* ---------------- editing ---------------- */
  const patch = (id: string, fn: (r: Row) => Row) => {
    resetPlan();
    setRows((rs) => rs.map((r) => (r.id === id ? fn(r) : r)));
  };
  const setScore = (id: string, q: number, v: Score) =>
    patch(id, (r) => ({ ...r, scores: r.scores.map((s, i) => (i === q ? v : s)), flags: r.flags.filter((f) => !f.startsWith(`Q${q + 1}:`)) }));
  const remove = (id: string) => {
    resetPlan();
    setRows((rs) => rs.filter((r) => r.id !== id));
  };
  /** Adds `count` blank forms to fill in by hand, then scrolls to the first of them. */
  const addByHand = (count = 1) => {
    resetPlan();
    const made: Row[] = Array.from({ length: count }, () => ({ id: uid(), scores: [null, null, null, null, null] as Score[], feedback: '', flags: [], header: null, source: 'Entered by hand', thumb: null, jobId: 'manual', checked: true, seq: 1_000_000 + seqRef.current++ }));
    setRows((rs) => [...rs, ...made].sort(bySeq));
    setTimeout(() => document.getElementById(`form-${made[0].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };
  const setScores = (id: string, scores: Score[]) => patch(id, (r) => ({ ...r, scores, flags: [] }));
  const clearAll = () => {
    resetPlan();
    setJobs([]);
    setRows([]);
    setSaved(null);
  };

  /* ---------------- saving ---------------- */
  const payload = (mode: 'add' | 'replace' = saveMode) => ({ selection, mode, responses: usable.map((r) => ({ id: r.id, scores: r.scores, feedback: r.feedback, source: r.source, header: r.header ? { date: r.header.date } : null })) });

  const check = async (mode: 'add' | 'replace' = saveMode) => {
    setSaveError(null);
    setSaving('checking');
    try {
      const res = await api<{ plan: PublishPlan }>('/api/collect/publish', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...payload(mode), dryRun: true }) });
      setPlan(res.plan);
    } catch (e) {
      if (e instanceof AccessKeyError) setNeedKey(true);
      setSaveError((e as Error).message);
    } finally {
      setSaving('idle');
    }
  };

  const save = async () => {
    setSaveError(null);
    setSaving('saving');
    try {
      const res = await api<PublishResult>('/api/collect/publish', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...payload(), overwrite: true }) });
      setSaved(res);
      setPlan(null);
    } catch (e) {
      if (e instanceof AccessKeyError) setNeedKey(true);
      setSaveError((e as Error).message);
    } finally {
      setSaving('idle');
    }
  };

  const shown = onlyCheck ? rows.filter(needsCheck) : rows;
  const dragRef = useRef<HTMLLabelElement>(null);
  const [drag, setDrag] = useState(false);

  /* ---------------- saved ---------------- */
  if (saved) {
    const sv = saved.view;
    const newRows = sv?.students.rows.filter((r) => r.highlight) ?? [];
    const rowRange = newRows.length ? (newRows.length === 1 ? `row ${newRows[0].row}` : `rows ${newRows[0].row}–${newRows[newRows.length - 1].row}`) : '';
    const mRow = sv?.master.rows.find((r) => r.highlight)?.row;
    return (
      <div className="flex flex-col gap-7">
        <PageHeader eyebrow="Collect" title="Saved to" emphasis="the sheets" description="This is read back from Google Sheets just now, so what you see below is exactly what is in the sheets. Refresh the dashboard to see it there too." />
        <section className="rise flex flex-col gap-6 card p-5 sm:p-6">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] font-medium">
            <CheckCircle2 className="size-5 text-good" />
            {plural(saved.plan.aggregate.forms, 'student')} averaged — Average Rating <strong className="tabular">{fmt(saved.plan.aggregate.average)}</strong>
            <span className="text-[13px] font-normal text-muted-foreground">
              ({saved.plan.written.teacher} · {saved.plan.written.branch} · Batch {saved.plan.written.batch} · {saved.plan.written.round})
            </span>
          </p>

          {sv ? (
            <>
              <SheetGrid view={sv.students} title="1 · Student sheet" subtitle={`${sv.students.spreadsheet} › “${sv.students.tab}” tab — ${plural(newRows.length, 'new row')}${rowRange ? ` (${rowRange})` : ''} for this batch and round`} maxHeight={340} />
              <SheetGrid view={sv.master} title="2 · Master sheet" subtitle={`“${sv.master.tab}” tab — ${mRow ? `the highlighted row ${mRow} is the batch average that was just written` : 'the batch average'}`} maxHeight={260} />
            </>
          ) : (
            <>
              <p className="text-[13.5px] text-muted-foreground">The save went through, but the sheets could not be read back just now. Open them to check:</p>
              <PlanTable plan={saved.plan} />
            </>
          )}

          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <a href={saved.masterUrl} target="_blank" rel="noreferrer" className="gap-2">
                Open master row <ExternalLink className="size-4" />
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={saved.responsesUrl} target="_blank" rel="noreferrer" className="gap-2">
                Open student rows <ExternalLink className="size-4" />
              </a>
            </Button>
            <Button variant="ghost" onClick={clearAll}>
              Upload another batch
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <PageHeader eyebrow="Collect" title="Upload" emphasis="forms" description="Photograph or scan a batch’s paper forms. Each is read, you check it, and the batch average goes into the sheet." />

      {lookupError && <Banner tone="bad">Could not load the branch and batch lists: {lookupError}</Banner>}
      {lookups && !lookups.ocrConfigured && <Banner tone="warn">Reading forms is not switched on yet. Add <code className="font-mono text-[12.5px]">GEMINI_API_KEY</code> to the <code className="font-mono text-[12.5px]">.env</code> file and restart the server. You can still enter forms by hand below.</Banner>}
      {needKey && (
        <Banner tone="warn">
          <span className="flex flex-wrap items-center gap-2">
            Enter the access key:
            <Input value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} type="password" className="h-8 w-48" aria-label="Access key" />
            <Button
              size="sm"
              onClick={() => {
                setAccessKey(keyDraft);
                setNeedKey(false);
                jobs.filter((j) => j.status === 'error' && j.file).forEach(retry);
              }}
            >
              Save key
            </Button>
          </span>
        </Banner>
      )}

      {/* 1 ── batch details */}
      <Step n={1} title="Which batch are these forms for?" hint="Pick this once for the whole pile. The header on each form is read and checked against your choice.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Programme">
            <select
              value={program}
              onChange={(e) => {
                setProgram(e.target.value as ProgramId);
                setLevel('');
                resetPlan();
              }}
              className={selectCls}
            >
              {PROGRAMS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Branch">
            <select value={branch} onChange={(e) => { setBranch(e.target.value); resetPlan(); }} className={selectCls}>
              <option value="">Choose…</option>
              {(lookups?.branches ?? []).map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </Field>
          {def.hasLevel && (
            <Field label="Level">
              <select value={level} onChange={(e) => { setLevel(e.target.value); resetPlan(); }} className={selectCls}>
                <option value="">Choose…</option>
                {(lookups?.levels ?? ['Beginner', 'Intermediate', 'Advance']).map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Batch">
            <Input value={batch} onChange={(e) => { setBatch(e.target.value); resetPlan(); }} onBlur={tidyBatch} list="batch-list" placeholder="e.g. A1" className="h-9" />
            <datalist id="batch-list">{(lookups?.batches ?? []).map((b) => <option key={b} value={b} />)}</datalist>
          </Field>
          <Field label="Teacher" className="xl:col-span-1">
            <Input value={teacher} onChange={(e) => { setTeacher(e.target.value); resetPlan(); }} onBlur={tidyTeacher} list="teacher-list" placeholder="Start typing a name…" className="h-9" />
            <datalist id="teacher-list">{teacherNames.map((n) => <option key={n} value={n} />)}</datalist>
            {teacher.trim() && !knownTeacher && <p className="mt-1 text-[12px] text-muted-foreground">Not in the sheet yet — will be added as “{formatName(teacher)}”.</p>}
          </Field>
          <Field label="Which round is this?">
            <div role="group" aria-label="Rating round" className="flex rounded-lg border border-input p-0.5">
              {(['first', 'last'] as const).map((r) => (
                <button key={r} type="button" aria-pressed={round === r} onClick={() => { setRound(r); resetPlan(); }} className={cn('h-8 flex-1 rounded-md text-[13.5px] font-medium transition-colors', round === r ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                  {ROUND_LABEL[r]}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </Step>

      {/* 2 ── upload */}
      <Step n={2} title="Add the forms" hint="Photos (JPG, PNG, WebP) or PDFs — one or many at a time. A PDF with many pages is fine.">
        <label
          ref={dragRef}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
          className={cn('flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors', drag ? 'border-primary bg-accent' : 'border-border hover:bg-accent/40')}
        >
          <UploadCloud className="size-7 text-muted-foreground" />
          <span className="text-[15px] font-medium">Drop photos or PDFs here, or click to choose</span>
          <span className="text-[12.5px] text-muted-foreground">Good light, the whole form in frame, held flat. Nothing leaves your control: you check every form before it is saved.</span>
          <input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
        </label>

        {jobs.length > 0 && (
          <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
            {jobs.map((j) => (
              <li key={j.id} className="flex items-center gap-2.5 rounded-lg border border-border/70 px-3 py-2 text-[13px]">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{j.name}</span>
                {j.status === 'reading' && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Reading" />}
                {j.status === 'queued' && <span className="text-muted-foreground">waiting</span>}
                {j.status === 'done' && !j.error && <span className="flex items-center gap-1 text-good"><Check className="size-4" />{plural(j.forms, 'form')}</span>}
                {j.status === 'done' && j.error && <span className="text-critical" title={j.error}>no form found</span>}
                {j.status === 'error' && (
                  <span className="flex items-center gap-2 text-critical">
                    <span className="max-w-56 truncate" title={j.error}>{j.error}</span>
                    <button type="button" onClick={() => retry(j)} className="inline-flex items-center gap-1 text-foreground underline" aria-label={`Retry ${j.name}`}><RotateCcw className="size-3.5" />retry</button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Step>

      {/* 3 ── review */}
      <Step
        n={3}
        title="Check what was read"
        hint="Each card is one student. Tap a number to correct a tick. Anything the reader was unsure about is marked."
        right={
          <div className="flex flex-wrap items-center gap-2">
            {toCheck > 0 && (
              <>
                <label className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                  <input type="checkbox" checked={onlyCheck} onChange={(e) => setOnlyCheck(e.target.checked)} /> Only forms to check
                </label>
                <Button size="sm" variant="outline" onClick={() => setRows((rs) => rs.map((r) => ({ ...r, checked: true })))}>
                  Mark all checked
                </Button>
              </>
            )}
            {rows.length > 0 && <ManualAdd onAdd={addByHand} compact />}
            {rows.length > 0 && (
              <Button size="sm" variant="ghost" onClick={clearAll} className="text-muted-foreground">
                Start over
              </Button>
            )}
          </div>
        }
      >
        {rows.length === 0 ? (
          busy ? (
            <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">Reading your forms…</p>
          ) : (
            <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
              <p className="text-sm font-semibold">Forms you add will appear here</p>
              <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">Upload photos above, or fill the forms in by hand: type how many students there are and that many blank forms appear.</p>
              <div className="mt-4 flex justify-center">
                <ManualAdd onAdd={addByHand} />
              </div>
            </div>
          )
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-muted-foreground">
              {plural(rows.length, 'form')}
              {emptyCount > 0 && <> · <span title="Forms with no ticks and no feedback are not saved">{emptyCount} still empty (left out)</span></>}
              {toCheck > 0 ? <> · <strong className="font-medium text-foreground">{toCheck} to check</strong></> : ' · all checked'}
              {mismatchCount > 0 && <> · {plural(mismatchCount, 'form')} whose header does not match your choices above</>}
            </p>
            {shown.map((r, idx) => (
              <FormCard
                key={r.id}
                n={rows.indexOf(r) + 1}
                row={r}
                check={checks.get(r.id)!}
                criteria={def.criteria}
                flagged={needsCheck(r)}
                onScore={(q, v) => setScore(r.id, q, v)}
                onFeedback={(v) => patch(r.id, (x) => ({ ...x, feedback: v }))}
                onChecked={() => patch(r.id, (x) => ({ ...x, checked: true }))}
                onRemove={() => remove(r.id)}
                onZoom={() => r.thumb && setZoom(r.thumb)}
                onScores={(sc) => setScores(r.id, sc)}
                nextId={shown[idx + 1]?.id}
                idx={idx}
              />
            ))}
          </div>
        )}
      </Step>

      {/* 4 ── result */}
      <Step n={4} title="The batch average" hint="Every criterion is averaged across all the forms, then the five are averaged into the Average Rating.">
        {usable.length === 0 ? (
          <p className="text-sm text-muted-foreground">{rows.length > 0 ? 'Every form is still empty — fill in at least one to see the average.' : 'Nothing to average yet.'}</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
            <div className="card-hover overflow-x-auto">
              <table className="w-full min-w-[520px] text-[14px]">
                <thead>
                  <tr className="bg-muted text-[12.5px]">
                    <th className="px-3 py-2.5 text-left font-semibold">Class</th>
                    {def.criteria.map((c) => (
                      <th key={c} className="px-3 py-2.5 text-center font-semibold leading-tight">{c}</th>
                    ))}
                    <th className="bg-[color-mix(in_oklab,var(--good)_22%,var(--background))] px-3 py-2.5 text-center font-semibold">Average Rating</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-3 py-3 font-medium">{ROUND_LABEL[round]}<span className="block text-[12px] font-normal text-muted-foreground">{plural(agg.forms, 'form')}</span></td>
                    {agg.criteria.map((v, i) => (
                      <td key={i} className="tabular px-3 py-3 text-center">
                        {fmt(v)}
                        {agg.counts[i] < agg.forms && <span className="block text-[11px] text-muted-foreground">{agg.counts[i]} answered</span>}
                      </td>
                    ))}
                    <td className="tabular bg-[color-mix(in_oklab,var(--good)_9%,var(--background))] px-3 py-3 text-center text-[17px] font-bold">{fmt(agg.average)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="flex flex-col items-start justify-center gap-2 lg:items-end">
              <Button size="lg" disabled={!detailsReady || usable.length === 0 || toCheck > 0 || busy || saving !== 'idle'} onClick={() => check()} className="gap-2">
                {saving === 'checking' && <Loader2 className="size-4 animate-spin" />}
                Check &amp; save to sheet
              </Button>
              <p className="max-w-64 text-[12px] text-muted-foreground lg:text-right">
                {!detailsReady ? 'Fill in step 1 first.' : toCheck > 0 ? `${plural(toCheck, 'form')} still to check.` : busy ? 'Still reading files…' : 'You will see exactly what changes before anything is written.'}
              </p>
            </div>
          </div>
        )}

        {saveError && <Banner tone="bad" className="mt-4">{saveError}</Banner>}

        {plan && (
          <div className="mt-5 flex flex-col gap-4 rounded-xl border border-border bg-muted/30 p-5">
            <h3 className="text-sm font-bold">This is what will be saved</h3>
            {plan.responses.existing > 0 && (
              <fieldset className="flex flex-col gap-2 rounded-lg border border-border bg-background p-4" disabled={saving !== 'idle'}>
                <legend className="px-1 text-[13px] font-medium">
                  {plural(plan.responses.existing, 'student row')} already saved for this batch and round. What should happen to them?
                </legend>
                {([
                  ['add', `Add these ${plan.responses.add} to the ${plan.responses.existing} already saved`, `The batch average will cover all ${plan.responses.existing + plan.responses.add} students.`],
                  ['replace', `Replace the ${plan.responses.existing} already saved with these ${plan.responses.add}`, 'Use this if you are uploading the same forms again.'],
                ] as const).map(([value, label, note]) => (
                  <label key={value} className={cn('flex cursor-pointer items-start gap-2.5 rounded-md border p-3 text-[13.5px]', saveMode === value ? 'border-primary bg-accent/50' : 'border-border')}>
                    <input
                      type="radio"
                      name="save-mode"
                      className="mt-1"
                      checked={saveMode === value}
                      onChange={() => {
                        setSaveMode(value);
                        void check(value);
                      }}
                    />
                    <span>
                      <span className="font-medium">{label}</span>
                      <span className="block text-[12.5px] text-muted-foreground">{note}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            )}
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-background px-4 py-3 text-[13.5px]">
              <p>
                Will be written as <strong>{plan.written.teacher}</strong> · {plan.written.branch}
                {plan.written.level ? ` · ${plan.written.level}` : ''} · Batch <strong>{plan.written.batch}</strong> · {plan.written.round}
              </p>
              {plan.written.changes.map((c) => (
                <p key={c} className="flex items-start gap-1.5 text-[12.5px] text-muted-foreground">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-good" />
                  {c}
                </p>
              ))}
            </div>
            <PlanTable plan={plan} />
            <p className="-mt-1 text-[12.5px] text-muted-foreground">
              Batch average from <strong className="font-medium text-foreground">{plural(plan.responses.total, 'student')}</strong>
              {plan.responses.mode === 'add' && plan.responses.existing > 0 ? ` (${plan.responses.existing} saved + ${plan.responses.add} new)` : ''}.
            </p>
            <ul className="flex flex-col gap-1.5 text-[13.5px]">
              <li>
                {plan.master.action === 'update' ? (
                  <>The <strong>{ROUND_LABEL[round]}</strong> row for this batch <strong>already exists</strong> (row {plan.master.row} of “{plan.master.tab}”). Its five scores will be <strong>updated</strong> with the new average.</>
                ) : (
                  <>A <strong>new row</strong> will be added at row {plan.master.row} of “{plan.master.tab}”.</>
                )}
              </li>
              <li>
                {plural(plan.responses.add, 'student row')} will be saved first in the “{plan.responses.tab}” tab of <strong>{plan.responses.spreadsheet}</strong>
                {plan.responses.exists ? '' : ' (the tab will be created)'}
                {plan.responses.replace > 0 && <>, deleting the {plan.responses.replace} saved earlier for this batch</>}.
              </li>
              {plan.warnings.map((w) => (
                <li key={w} className="flex gap-2 text-[color:var(--critical-text)]"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{w}</li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button onClick={save} disabled={saving !== 'idle'} className="gap-2">
                {saving === 'saving' && <Loader2 className="size-4 animate-spin" />}
                {plan.responses.existing > 0 ? (plan.responses.mode === 'add' ? 'Add and save' : 'Replace and save') : plan.master.action === 'update' ? 'Replace and save' : 'Save to Google Sheet'}
              </Button>
              <Button variant="ghost" onClick={resetPlan}>Cancel</Button>
            </div>
          </div>
        )}
      </Step>

      {zoom && (
        <div role="dialog" aria-modal="true" aria-label="Form photo" className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setZoom(null)} onKeyDown={(e) => e.key === 'Escape' && setZoom(null)} tabIndex={-1}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="Scanned form" className="max-h-full max-w-full rounded-lg bg-white object-contain" />
          <button type="button" className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-background" aria-label="Close" onClick={() => setZoom(null)}>
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- pieces ---------------------------------------------------------------- */

const selectCls = 'field';

function Step({ n, title, hint, right, children }: { n: number; title: string; hint?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rise card p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{n}</span>
          <SectionTitle title={title} hint={hint} />
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-[12.5px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Banner({ tone, className, children }: { tone: 'warn' | 'bad'; className?: string; children: React.ReactNode }) {
  return (
    <div role="alert" className={cn('flex items-start gap-2.5 rounded-lg border px-4 py-3 text-[13.5px]', tone === 'warn' ? 'border-[color-mix(in_oklab,var(--warning)_55%,transparent)] bg-[color-mix(in_oklab,var(--warning)_15%,transparent)]' : 'border-[color-mix(in_oklab,var(--critical)_45%,transparent)] bg-[color-mix(in_oklab,var(--critical)_9%,transparent)]', className)}>
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

const CHECK_LABEL: Record<string, string> = { programme: 'Form', branch: 'Branch', batch: 'Batch', teacher: 'Teacher' };

function HeaderChips({ row, check }: { row: Row; check: ReturnType<typeof checkHeader> }) {
  const read: Record<string, string | null | undefined> = { programme: row.header?.programme, branch: row.header?.branch, batch: row.header?.batch, teacher: row.header?.teacher };
  return (
    <div className="flex flex-wrap gap-1.5">
      {(['branch', 'batch', 'teacher', 'programme'] as const).map((k) => {
        const state: HeaderState = check[k];
        return (
          <span
            key={k}
            title={read[k] ? `Read on the form: “${read[k]}”` : 'Not filled in on the form'}
            className={cn(
              'inline-flex max-w-52 items-center gap-1 truncate rounded-full border px-2 py-0.5 text-[11.5px]',
              state === 'match' && 'border-[color-mix(in_oklab,var(--good)_40%,transparent)] text-good',
              state === 'mismatch' && 'border-[color-mix(in_oklab,var(--critical)_50%,transparent)] bg-[color-mix(in_oklab,var(--critical)_9%,transparent)] text-critical',
              state === 'unread' && 'border-border text-muted-foreground',
            )}
          >
            {state === 'match' ? <Check className="size-3" /> : state === 'mismatch' ? <AlertTriangle className="size-3" /> : null}
            {CHECK_LABEL[k]}
            {state === 'mismatch' && read[k] ? `: “${read[k]}”` : state === 'unread' ? ' — blank' : ''}
          </span>
        );
      })}
    </div>
  );
}

function FormCard({ n, row, check, criteria, flagged, onScore, onScores, onFeedback, onChecked, onRemove, onZoom, nextId, idx }: { n: number; row: Row; check: ReturnType<typeof checkHeader>; criteria: string[]; flagged: boolean; onScore: (q: number, v: Score) => void; onScores: (s: Score[]) => void; onFeedback: (v: string) => void; onChecked: () => void; onRemove: () => void; onZoom: () => void; nextId?: string; idx: number }) {
  const [quick, setQuick] = useState('');
  return (
    <article id={`form-${row.id}`} className={cn('scroll-mt-20 rounded-lg border p-4', flagged ? 'border-[color-mix(in_oklab,var(--warning)_70%,transparent)] bg-[color-mix(in_oklab,var(--warning)_7%,transparent)]' : 'border-border')} style={{ animationDelay: `${Math.min(idx, 8) * 20}ms` }}>
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex w-24 shrink-0 flex-col items-center gap-1.5">
          {row.thumb ? (
            <button type="button" onClick={onZoom} className="overflow-hidden rounded-md border border-border" aria-label={`Enlarge form ${n}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={row.thumb} alt={`Form ${n}`} className="h-28 w-24 object-cover object-top" />
            </button>
          ) : (
            <span className="grid h-28 w-24 place-items-center rounded-md border border-dashed border-border text-muted-foreground"><FileText className="size-6" /></span>
          )}
          <span className="tabular text-[12px] font-medium">Student {n}</span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {row.header && <HeaderChips row={row} check={check} />}
          <label className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
            <span className="font-medium text-foreground">Quick entry</span>
            <input
              id={`quick-${row.id}`}
              value={quick}
              inputMode="numeric"
              autoComplete="off"
              maxLength={criteria.length}
              placeholder="54545"
              aria-label={`Type the ${criteria.length} ticks for student ${n}, e.g. 54545`}
              onChange={(e) => {
                const digits = e.target.value.replace(/[^1-5]/g, '').slice(0, criteria.length);
                setQuick(digits);
                onScores(Array.from({ length: criteria.length }, (_, i) => (digits[i] ? Number(digits[i]) : null)));
                if (digits.length === criteria.length && nextId) document.getElementById(`quick-${nextId}`)?.focus();
              }}
              className="field w-28 font-mono tracking-[0.35em]"
            />
            <span>type the {criteria.length} ticks in a row (1–5) — it jumps to the next form</span>
          </label>
          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
            {criteria.map((c, q) => (
              <div key={c} className="flex items-center justify-between gap-2">
                <span className="min-w-0 text-[12.5px] leading-tight text-muted-foreground" title={c}>
                  <span className="mr-1 font-medium text-foreground">Q{q + 1}</span>
                  <span className="hidden 2xl:inline">{c}</span>
                </span>
                <div role="group" aria-label={`Question ${q + 1} score`} className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={row.scores[q] === v}
                      onClick={() => onScore(q, row.scores[q] === v ? null : v)}
                      className={cn('tabular grid size-7 place-items-center rounded-md border text-[13px] font-medium transition-colors', row.scores[q] === v ? 'border-primary bg-primary text-primary-foreground' : row.scores[q] === null ? 'border-[color-mix(in_oklab,var(--critical)_45%,transparent)] hover:bg-accent' : 'border-border hover:bg-accent')}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <textarea
            value={row.feedback}
            onChange={(e) => onFeedback(e.target.value)}
            rows={2}
            placeholder="Additional feedback (as written on the form)"
            aria-label={`Feedback, student ${n}`}
            className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-[13.5px] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
          />
          {(row.flags.length > 0 || check.mismatches.length > 0) && (
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-[color:var(--critical-text)]">
              {row.flags.map((f) => (
                <li key={f} className="flex items-center gap-1"><AlertTriangle className="size-3.5" />{f}</li>
              ))}
              {check.mismatches.length > 0 && <li className="flex items-center gap-1"><AlertTriangle className="size-3.5" />Header differs from your choices: {check.mismatches.join(', ')}</li>}
            </ul>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          {flagged && (
            <Button size="sm" variant="outline" onClick={onChecked} className="gap-1.5">
              <Check className="size-3.5" /> It’s correct
            </Button>
          )}
          {!flagged && (row.flags.length > 0 || check.mismatches.length > 0) && <Pill tone="good">checked</Pill>}
          <Button size="sm" variant="ghost" onClick={onRemove} className="gap-1.5 text-muted-foreground" aria-label={`Remove student ${n}`}>
            <Trash2 className="size-3.5" /> Remove
          </Button>
        </div>
      </div>
    </article>
  );
}

function PlanTable({ plan }: { plan: PublishPlan }) {
  const { master } = plan;
  return (
    <div className="card-hover overflow-x-auto bg-background">
      <table className="w-full min-w-[520px] text-[13.5px]">
        <thead>
          <tr className="bg-muted text-[12.5px]">
            <th className="px-3 py-2 text-left font-semibold" />
            {master.columns.map((c) => (
              <th key={c} className={cn('px-3 py-2 text-center font-semibold leading-tight', c === 'Average Rating' && 'bg-[color-mix(in_oklab,var(--good)_22%,var(--background))]')}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {master.before && (
            <tr className="text-muted-foreground">
              <td className="px-3 py-2">Now in sheet</td>
              {master.before.map((v, i) => (
                <td key={i} className="tabular px-3 py-2 text-center">{typeof v === 'number' ? v.toFixed(2) : v || '—'}</td>
              ))}
            </tr>
          )}
          <tr className="font-medium">
            <td className="px-3 py-2">{master.before ? 'Will become' : 'New row'}</td>
            {master.after.map((v, i) => (
              <td key={i} className={cn('tabular px-3 py-2 text-center', i === master.after.length - 1 && 'bg-[color-mix(in_oklab,var(--good)_9%,var(--background))] font-bold')}>{typeof v === 'number' ? v.toFixed(2) : v || '—'}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** "How many students?" — type a number and that many blank forms appear to fill in. */
function ManualAdd({ onAdd, compact }: { onAdd: (count: number) => void; compact?: boolean }) {
  const [text, setText] = useState('');
  const n = Number(text);
  const valid = Number.isInteger(n) && n >= 1 && n <= 200;
  const submit = () => {
    if (!valid) return;
    onAdd(n);
    setText('');
  };
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <span className={compact ? 'hidden sm:inline' : 'font-medium text-foreground'}>{compact ? 'Add by hand' : 'How many students?'}</span>
        <input
          type="number"
          min={1}
          max={200}
          inputMode="numeric"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. 30"
          aria-label="Number of forms to add"
          className="field w-24 text-center tabular"
        />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={!valid} className="gap-1.5">
        <Plus className="size-3.5" /> {valid ? `Add ${n} form${n === 1 ? '' : 's'}` : 'Add forms'}
      </Button>
      {text !== '' && !valid && <span className="text-[12px] text-critical">Enter a whole number from 1 to 200.</span>}
    </form>
  );
}
