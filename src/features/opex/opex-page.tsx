'use client';
import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Plus, X } from 'lucide-react';
import { Button } from '@tenminuteschool/design-system';
import { DataGate } from '@/components/ui/data-gate';
import { PageHeader, SectionTitle } from '@/components/ui/primitives';
import { useLookups } from '@/features/collect/client';
import { formatName } from '@/features/collect/normalize';
import { useRatingsData } from '@/features/ratings/filters';
import { fmt, plural } from '@/lib/format';
import { cn } from '@/lib/utils';
import { OPEX_CRITERIA, OPEX_COUNT } from './criteria';

type Entry = { key: string; name: string; scores: (number | null)[]; remarks: string };
const blank = (name = ''): Entry => ({ key: Math.random().toString(36).slice(2, 9), name, scores: Array(OPEX_COUNT).fill(null), remarks: '' });
const todayIso = () => new Date().toLocaleDateString('en-CA');
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const done = (e: Entry) => e.scores.every((s) => s !== null);
const touched = (e: Entry) => e.scores.some((s) => s !== null);

export function OpexPage() {
  return <DataGate>{() => <Body />}</DataGate>;
}

function Body() {
  const { data, refresh } = useRatingsData();
  const { data: lookups } = useLookups();
  const [branch, setBranch] = useState('');
  const [rater, setRater] = useState('');
  const [ratedOn, setRatedOn] = useState(todayIso);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [replace, setReplace] = useState(true);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ saved: number; replaced: number } | null>(null);

  const branches = useMemo(() => [...new Set([...(lookups?.branches ?? []), ...(data?.batches ?? []).map((b) => b.branch), ...(data?.opex ?? []).map((o) => o.branch)])].filter((b) => b !== 'Unspecified').sort(), [lookups, data]);
  const raters = useMemo(() => [...new Set((data?.opex ?? []).filter((o) => !branch || o.branch === branch).map((o) => o.rater).filter(Boolean))], [data, branch]);
  const allTeachers = useMemo(() => (data?.teachers ?? []).map((t) => t.name), [data]);
  const month = ratedOn.slice(0, 7);

  /** Teachers of this branch: from their student ratings and from earlier OpEx ratings. */
  const roster = (b: string) => {
    const names = new Map<string, string>();
    (data?.batches ?? []).filter((x) => x.branch === b).forEach((x) => names.set(x.teacherId, x.teacherName));
    (data?.opex ?? []).filter((x) => x.branch === b).forEach((x) => names.set(x.teacherId, x.teacherName));
    return [...names.values()].sort((a, c) => a.localeCompare(c));
  };
  const pickBranch = (b: string) => {
    setBranch(b);
    setEntries(b ? roster(b).map((n) => blank(n)) : []);
    setState('idle');
  };

  const alreadyRated = (e: Entry) => !!e.name.trim() && (data?.opex ?? []).some((o) => o.branch === branch && norm(o.teacherName) === norm(e.name) && (o.date ?? '').startsWith(month));

  const ready = entries.filter(done);
  const partial = entries.filter((e) => touched(e) && !done(e));
  const clashes = ready.filter(alreadyRated);
  const set = (key: string, patch: Partial<Entry>) => setEntries((es) => es.map((e) => (e.key === key ? { ...e, ...patch } : e)));
  const score = (e: Entry, q: number, v: number) => set(e.key, { scores: e.scores.map((s, i) => (i === q ? (s === v ? null : v) : s)) });
  const canSave = !!branch && !!rater.trim() && !!ratedOn && ready.length > 0 && partial.length === 0 && state !== 'saving';

  const save = async () => {
    setState('saving');
    setError(null);
    try {
      const res = await fetch('/api/opex', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ branch, rater, ratedOn, replaceExisting: replace, entries: ready.map((e) => ({ teacherName: e.name, scores: e.scores, remarks: e.remarks })) }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error === 'ALREADY_RATED' ? 'Some teachers were already rated this month — tick “Replace” to overwrite them.' : (json.error ?? 'Could not save.'));
      setResult(json);
      setState('saved');
      await refresh();
    } catch (e) {
      setError((e as Error).message);
      setState('idle');
    }
  };

  if (data && !data.opexReady) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader eyebrow="Collect" title="OpEx" emphasis="rating" />
        <p className="card p-5 text-sm">The OpEx table doesn’t exist yet. Run <code>supabase/add-opex.sql</code> in the Supabase SQL editor, then reload.</p>
      </div>
    );
  }

  if (state === 'saved' && result) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader eyebrow="Collect" title="OpEx rating" emphasis="saved" />
        <section className="card flex flex-col gap-4 p-5 sm:p-6">
          <p className="flex items-center gap-2 text-[15px] font-medium">
            <CheckCircle2 className="size-5 text-good" /> {plural(result.saved, 'teacher rating')} saved for {branch} ({ratedOn}){result.replaced ? ` — ${plural(result.replaced, 'earlier rating')} replaced` : ''}.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => { setResult(null); pickBranch(branch); }}>Rate more teachers</Button>
            <Button variant="outline" onClick={() => { setResult(null); pickBranch(''); }}>Another branch</Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <PageHeader eyebrow="Collect" title="OpEx" emphasis="rating" description="OpEx / ABM / AC rate each teacher of their branch on six questions, once a month. This is separate from the students’ ratings." />

      <section className="card grid gap-4 p-5 sm:grid-cols-3 sm:p-6">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-muted-foreground">Branch</span>
          <select className="field" value={branch} onChange={(e) => pickBranch(e.target.value)}>
            <option value="">Choose a branch…</option>
            {branches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-muted-foreground">Rated by (OpEx / ABM / AC)</span>
          <input className="field" value={rater} onChange={(e) => setRater(e.target.value)} onBlur={() => setRater(formatName(rater))} list="rater-list" placeholder="e.g. Md Raju Ahmmed" />
          <datalist id="rater-list">{raters.map((r) => <option key={r} value={r} />)}</datalist>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-muted-foreground">Date of this rating</span>
          <input type="date" className="field" value={ratedOn} max={todayIso()} onChange={(e) => setRatedOn(e.target.value)} />
        </label>
      </section>

      {branch && (
        <section className="flex flex-col gap-4">
          <SectionTitle title="Teachers" hint={<>Tick 1–5 for every question. 1 = poorest, 5 = best. Leave a teacher untouched to skip them. <strong className="font-medium text-foreground">{plural(ready.length, 'teacher')}</strong> ready to save.</>} />
          {entries.length === 0 && <p className="card py-8 text-center text-sm text-muted-foreground">No teachers known for {branch} yet — add one below.</p>}
          {entries.map((e) => (
            <article key={e.key} className={cn('card flex flex-col gap-3 p-4 sm:p-5', touched(e) && !done(e) && 'ring-1 ring-[color:var(--warning)]')}>
              <div className="flex flex-wrap items-center gap-3">
                <input className="field h-9 w-64 font-semibold" value={e.name} onChange={(ev) => set(e.key, { name: ev.target.value })} list="opex-teachers" placeholder="Teacher name" aria-label="Teacher name" />
                {done(e) && <span className="tabular rounded-full bg-[color-mix(in_oklab,var(--good)_18%,var(--background))] px-2.5 py-1 text-[12.5px] font-bold">Avg {fmt((e.scores as number[]).reduce((a, b) => a + b, 0) / OPEX_COUNT)}</span>}
                {done(e) && alreadyRated(e) && <span className="flex items-center gap-1 text-[12.5px] text-[color:var(--critical-text)]"><AlertTriangle className="size-3.5" /> already rated this month</span>}
                {touched(e) && !done(e) && <span className="text-[12.5px] text-muted-foreground">answer all {OPEX_COUNT} questions</span>}
                <button type="button" className="ml-auto text-muted-foreground hover:text-foreground" aria-label="Remove" onClick={() => setEntries((es) => es.filter((x) => x.key !== e.key))}><X className="size-4" /></button>
              </div>
              <div className="grid gap-x-6 gap-y-2.5 lg:grid-cols-2">
                {OPEX_CRITERIA.map((c, q) => (
                  <div key={c.short} className="flex items-center justify-between gap-3">
                    <p className="min-w-0 text-[13px] leading-snug">
                      <span className="font-medium">{q + 1}. {c.short}</span>
                      <span className="block text-[11.5px] text-muted-foreground" title={c.question}>{c.scale}</span>
                    </p>
                    <div className="flex shrink-0 gap-1" role="group" aria-label={c.question}>
                      {[1, 2, 3, 4, 5].map((v) => (
                        <button key={v} type="button" aria-pressed={e.scores[q] === v} onClick={() => score(e, q, v)} className={cn('tabular grid size-8 place-items-center rounded-md border text-[13px] font-medium transition-colors', e.scores[q] === v ? 'border-primary bg-primary text-primary-foreground' : 'border-input text-muted-foreground hover:text-foreground')}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <input className="field h-9" value={e.remarks} onChange={(ev) => set(e.key, { remarks: ev.target.value })} placeholder="Remark (optional)" aria-label="Remark" />
            </article>
          ))}
          <datalist id="opex-teachers">{allTeachers.map((n) => <option key={n} value={n} />)}</datalist>
          <div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEntries((es) => [...es, blank()])}><Plus className="size-4" /> Add another teacher</Button>
          </div>

          {clashes.length > 0 && (
            <label className="flex items-start gap-2 text-[13.5px]">
              <input type="checkbox" className="mt-1" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
              <span>{plural(clashes.length, 'teacher')} already rated for {branch} this month ({clashes.map((c) => c.name).join(', ')}). Replace the earlier rating so nobody is counted twice.</span>
            </label>
          )}
          {error && <p className="flex items-start gap-2 text-[13.5px] text-[color:var(--critical-text)]"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{error}</p>}
          <div>
            <Button onClick={save} disabled={!canSave} className="gap-2">
              {state === 'saving' && <Loader2 className="size-4 animate-spin" />}
              Save {ready.length > 0 ? plural(ready.length, 'rating') : 'ratings'}
            </Button>
            {!rater.trim() && <span className="ml-3 text-[12.5px] text-muted-foreground">Enter who is rating first.</span>}
          </div>
        </section>
      )}
    </div>
  );
}
