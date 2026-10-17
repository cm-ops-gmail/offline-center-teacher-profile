'use client';
import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Plus, X } from 'lucide-react';
import { Button } from '@tenminuteschool/design-system';
import { DataGate } from '@/components/ui/data-gate';
import { PageHeader, SectionTitle } from '@/components/ui/primitives';
import { SearchSelect } from '@/components/ui/search-select';
import { useLookups } from '@/features/collect/client';
import { formatName } from '@/features/collect/normalize';
import { useRatingsData } from '@/features/ratings/filters';
import { fmt, plural } from '@/lib/format';
import { cn } from '@/lib/utils';
import { TEAMS, type TeamKey } from './teams';

/** `teacherId` is 'all' until a teacher has been picked from the dropdown. */
type Entry = { key: string; teacherId: string; scores: (number | null)[]; remarks: string; strengths: string; areas: string };
const blank = (n: number): Entry => ({ key: Math.random().toString(36).slice(2, 9), teacherId: 'all', scores: Array(n).fill(null), remarks: '', strengths: '', areas: '' });
const todayIso = () => new Date().toLocaleDateString('en-CA');
const done = (e: Entry) => e.teacherId !== 'all' && e.scores.every((s) => s !== null);
const touched = (e: Entry) => e.teacherId !== 'all' || e.scores.some((s) => s !== null);

/** Entry screen for the OpEx team (six questions) or the Programme team (ten classroom-observation criteria). */
export function TeamRatingPage({ team }: { team: TeamKey }) {
  return <DataGate>{() => <Body team={team} />}</DataGate>;
}
export const OpexPage = () => <TeamRatingPage team="opex" />;
export const ProgrammeTeamPage = () => <TeamRatingPage team="programme" />;

function Body({ team }: { team: TeamKey }) {
  const cfg = TEAMS[team];
  const COUNT = cfg.criteria.length;
  const existing = (d: typeof data) => (team === 'opex' ? d?.opex : d?.programme) ?? [];
  const { data, refresh } = useRatingsData();
  const { data: lookups } = useLookups();
  const [branch, setBranch] = useState('');
  const [rater, setRater] = useState('');
  const [ratedOn, setRatedOn] = useState(todayIso);
  const [entries, setEntries] = useState<Entry[]>(() => [blank(COUNT)]);
  const [replace, setReplace] = useState(true);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ saved: number; replaced: number } | null>(null);

  const branches = useMemo(() => [...new Set([...(lookups?.branches ?? []), ...(data?.batches ?? []).map((b) => b.branch), ...existing(data).map((o) => o.branch)])].filter((b) => b !== 'Unspecified').sort(), [lookups, data]);
  const raters = useMemo(() => [...new Set(existing(data).filter((o) => !branch || o.branch === branch).map((o) => o.rater).filter(Boolean))], [data, branch]);
  /** Every teacher the app knows (student ratings and earlier team ratings), with the branches they appear in. */
  const pool = useMemo(() => {
    const map = new Map<string, { name: string; branches: Set<string> }>();
    const add = (id: string, name: string, b: string) => (map.get(id) ?? map.set(id, { name, branches: new Set() }).get(id)!).branches.add(b);
    (data?.teachers ?? []).forEach((t) => map.set(t.id, { name: t.name, branches: new Set() }));
    (data?.batches ?? []).forEach((b) => add(b.teacherId, b.teacherName, b.branch));
    existing(data).forEach((o) => add(o.teacherId, o.teacherName, o.branch));
    return map;
  }, [data]);
  const month = ratedOn.slice(0, 7);

  const optionsFor = (e: Entry) =>
    [...pool]
      .filter(([id]) => id === e.teacherId || !entries.some((x) => x.teacherId === id))
      // this branch's teachers first, then everyone else
      .sort(([, a], [, b]) => Number(b.branches.has(branch)) - Number(a.branches.has(branch)) || a.name.localeCompare(b.name))
      .map(([id, t]) => ({ value: id, label: t.branches.size ? `${t.name} · ${[...t.branches].sort().join(', ')}` : t.name }));
  const pickBranch = (b: string) => {
    setBranch(b);
    setEntries([blank(COUNT)]);
    setState('idle');
  };

  const nameOf = (e: Entry) => pool.get(e.teacherId)?.name ?? '';
  const alreadyRated = (e: Entry) => e.teacherId !== 'all' && existing(data).some((o) => o.branch === branch && o.teacherId === e.teacherId && (o.date ?? '').startsWith(month));

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
      const res = await fetch('/api/opex', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ team, branch, rater, ratedOn, replaceExisting: replace, entries: ready.map((e) => ({ teacherName: nameOf(e), scores: e.scores, remarks: e.remarks, strengths: e.strengths, areas: e.areas })) }) });
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

  if (data && !(team === 'opex' ? data.opexReady : data.programmeReady)) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader eyebrow="Collect" title={cfg.title} />
        <p className="card p-5 text-sm">The table for this rating doesn’t exist yet. Run <code>{team === 'opex' ? 'supabase/add-opex.sql' : 'supabase/add-programme-team.sql'}</code> in the Supabase SQL editor, then reload.</p>
      </div>
    );
  }

  if (state === 'saved' && result) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader eyebrow="Collect" title={cfg.title} emphasis="saved" />
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
      <PageHeader eyebrow="Collect" title={cfg.title} description={`${cfg.blurb} This is separate from the students’ ratings.`} />

      <section className="card grid gap-4 p-5 sm:grid-cols-3 sm:p-6">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-muted-foreground">Branch</span>
          <select className="field" value={branch} onChange={(e) => pickBranch(e.target.value)}>
            <option value="">Choose a branch…</option>
            {branches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-muted-foreground">{team === 'opex' ? 'Rated by (OpEx / ABM / AC)' : 'Observed by (Programme team)'}</span>
          <input className="field" value={rater} onChange={(e) => setRater(e.target.value)} onBlur={() => setRater(formatName(rater))} list="rater-list" placeholder={team === 'opex' ? 'e.g. Md Raju Ahmmed' : 'Your name'} />
          <datalist id="rater-list">{raters.map((r) => <option key={r} value={r} />)}</datalist>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-muted-foreground">{cfg.dateLabel}</span>
          <input type="date" className="field" value={ratedOn} max={todayIso()} onChange={(e) => setRatedOn(e.target.value)} />
        </label>
      </section>

      {branch && (
        <section className="flex flex-col gap-4">
          <SectionTitle title="Teachers" hint={<>Select a teacher, then tick 1–5 for every question (1 = poorest, 5 = best). Use “Add another teacher” to rate the next one. <strong className="font-medium text-foreground">{plural(ready.length, 'teacher')}</strong> ready to save.</>} />
          {entries.map((e) => (
            <article key={e.key} className={cn('card flex flex-col gap-3 p-4 sm:p-5', touched(e) && !done(e) && 'ring-1 ring-[color:var(--warning)]')}>
              <div className="flex flex-wrap items-center gap-3">
                <SearchSelect label="Teacher" value={e.teacherId} onChange={(v) => set(e.key, { teacherId: v })} allLabel="Select a teacher…" searchPlaceholder="Search teachers…" options={optionsFor(e)} className="w-80" dropdownWidth="w-[26rem]" />
                {done(e) && <span className="tabular rounded-full bg-[color-mix(in_oklab,var(--good)_18%,var(--background))] px-2.5 py-1 text-[12.5px] font-bold">Avg {fmt((e.scores as number[]).reduce((a, b) => a + b, 0) / COUNT)}</span>}
                {done(e) && alreadyRated(e) && <span className="flex items-center gap-1 text-[12.5px] text-[color:var(--critical-text)]"><AlertTriangle className="size-3.5" /> already rated this month</span>}
                {touched(e) && !done(e) && <span className="text-[12.5px] text-muted-foreground">{e.teacherId === 'all' ? 'select a teacher' : `answer all ${COUNT} questions`}</span>}
                <button type="button" className="ml-auto text-muted-foreground hover:text-foreground" aria-label="Remove" onClick={() => setEntries((es) => (es.length > 1 ? es.filter((x) => x.key !== e.key) : [blank(COUNT)]))}><X className="size-4" /></button>
              </div>
              <div className="grid gap-x-6 gap-y-2.5 lg:grid-cols-2">
                {cfg.criteria.map((c, q) => (
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
              {team === 'programme' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12.5px] font-medium text-muted-foreground">Strengths (one per line)</span>
                    <textarea className="field min-h-24 py-2" value={e.strengths} onChange={(ev) => set(e.key, { strengths: ev.target.value })} placeholder={'1. Interactive\n2. Creates inclusive opportunity'} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12.5px] font-medium text-muted-foreground">Areas of development (one per line)</span>
                    <textarea className="field min-h-24 py-2" value={e.areas} onChange={(ev) => set(e.key, { areas: ev.target.value })} placeholder={'1. TTT should be decreased\n2. Should include pre-video instruction'} />
                  </label>
                </div>
              )}
              <input className="field h-9" value={e.remarks} onChange={(ev) => set(e.key, { remarks: ev.target.value })} placeholder={team === 'programme' ? 'Detailed remarks (optional)' : 'Remark (optional)'} aria-label="Remark" />
            </article>
          ))}
          <div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEntries((es) => [...es, blank(COUNT)])}><Plus className="size-4" /> Add another teacher</Button>
          </div>

          {clashes.length > 0 && (
            <label className="flex items-start gap-2 text-[13.5px]">
              <input type="checkbox" className="mt-1" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
              <span>{plural(clashes.length, 'teacher')} already rated for {branch} this month ({clashes.map(nameOf).join(', ')}). Replace the earlier rating so nobody is counted twice.</span>
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
