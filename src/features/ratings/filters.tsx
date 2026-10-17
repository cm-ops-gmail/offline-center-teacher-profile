'use client';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useRatings } from './api';
import { applyCriterion } from './criteria';
import { isProgramId } from './programs';
import type { BatchRecord, OpexRating, ProgramId, Rating, RatingsPayload } from './types';

/** Which rating round to look at: both, only the First Rating rows, or only the Last Rating rows. */
export type RatingClass = 'all' | 'first' | 'last';

export interface Filters {
  program: ProgramId | 'all';
  branch: string | 'all';
  level: string | 'all';
  batch: string | 'all';
  teacher: string | 'all';
  /** One criterion (e.g. "Communication Skills") to look at instead of the overall rating. */
  criterion: string | 'all';
  cls: RatingClass;
  /** Date range (YYYY-MM-DD, inclusive); '' = open-ended. Applies to the date each First / Last Rating was given. */
  from: string;
  to: string;
}

type FilterKey = keyof Filters;

/** URL query-string names (`cls` is called `class` in the URL). */
const PARAM: Record<FilterKey, string> = { program: 'program', branch: 'branch', level: 'level', batch: 'batch', teacher: 'teacher', criterion: 'criterion', cls: 'class', from: 'from', to: 'to' };

/** Changing one filter invalidates the ones that depend on it (batch codes like "A1" repeat across branches and teachers). */
const CLEARS: Partial<Record<FilterKey, FilterKey[]>> = {
  program: ['level', 'batch', 'teacher', 'criterion'],
  branch: ['batch', 'teacher'],
  level: ['batch'],
  teacher: ['batch'],
};

interface Ctx {
  data: RatingsPayload | undefined;
  error: Error | undefined;
  isLoading: boolean;
  isValidating: boolean;
  refresh: () => Promise<unknown>;
  filters: Filters;
  setFilter: (key: FilterKey, value: string) => void;
  reset: () => void;
  /** Batches after applying programme / branch / level (used by the overview, teachers and branches screens). */
  batches: BatchRecord[];
  /** Every filter applied (programme optionally fixed by the screen), with the Class filter already applied. */
  filtered: (lock?: { program?: ProgramId; teacher?: string; /** filters to ignore (the comparison screen ignores Teacher and Batch) */ skip?: FilterKey[] }) => BatchRecord[];
  branches: string[];
  /** OpEx ratings narrowed by Branch, Teacher, Programme (teachers who teach it) and the date range. */
  opexView: (lock?: { program?: ProgramId; teacher?: string }) => OpexRating[];
}

const RatingsContext = createContext<Ctx | null>(null);

/** Keeps only the requested rating round; batches without it drop out. */
export function applyClass(batches: BatchRecord[], cls: RatingClass): BatchRecord[] {
  if (cls === 'first') return batches.filter((b) => b.first).map((b) => ({ ...b, last: null }));
  if (cls === 'last') return batches.filter((b) => b.last).map((b) => ({ ...b, first: null }));
  return batches;
}

const isDay = (v: string | null) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Keeps only the ratings given inside the date range; a batch with none left drops out. Undated ratings never match a range. */
export function applyDates(batches: BatchRecord[], from: string, to: string): BatchRecord[] {
  if (!from && !to) return batches;
  const inside = (r: Rating | null) => (r && r.date && (!from || r.date >= from) && (!to || r.date <= to) ? r : null);
  return batches.flatMap((b) => {
    const first = inside(b.first);
    const last = inside(b.last);
    return first || last ? [{ ...b, first, last }] : [];
  });
}

/** True when a batch passes every filter except the ones listed in `skip` (used to build cascading option lists). */
export function matches(b: BatchRecord, f: Filters, skip: FilterKey[] = []): boolean {
  const on = (k: FilterKey) => !skip.includes(k);
  return (
    (!on('program') || f.program === 'all' || b.program === f.program) &&
    (!on('branch') || f.branch === 'all' || b.branch === f.branch) &&
    (!on('level') || f.level === 'all' || b.level === f.level) &&
    (!on('batch') || f.batch === 'all' || b.batch === f.batch) &&
    (!on('teacher') || f.teacher === 'all' || b.teacherId === f.teacher)
  );
}

/** Loads the sheet once and shares it, plus the URL-synced filters, with every screen. */
export function RatingsProvider({ children }: { children: ReactNode }) {
  const { data, error, isLoading, isValidating, refresh } = useRatings();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const rawProgram = params.get('program') ?? 'all';
  const rawClass = params.get('class');
  const filters: Filters = {
    program: isProgramId(rawProgram) ? rawProgram : 'all',
    branch: params.get('branch') ?? 'all',
    level: params.get('level') ?? 'all',
    batch: params.get('batch') ?? 'all',
    teacher: params.get('teacher') ?? 'all',
    criterion: params.get('criterion') ?? 'all',
    cls: rawClass === 'first' || rawClass === 'last' ? rawClass : 'all',
    from: isDay(params.get('from')) ? params.get('from')! : '',
    to: isDay(params.get('to')) ? params.get('to')! : '',
  };

  const go = useCallback(
    (next: URLSearchParams) => {
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const setFilter = useCallback(
    (key: FilterKey, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value === 'all' || value === '') next.delete(PARAM[key]);
      else next.set(PARAM[key], value);
      (CLEARS[key] ?? []).forEach((k) => next.delete(PARAM[k]));
      go(next);
    },
    [params, go],
  );

  const reset = useCallback(() => {
    const next = new URLSearchParams(params.toString());
    Object.values(PARAM).forEach((k) => next.delete(k));
    go(next);
  }, [params, go]);

  const { program, branch, level, batch, teacher, criterion, cls, from, to } = filters;

  const batches = useMemo(() => (data ? applyDates(data.batches.filter((b) => matches(b, { program, branch, level, batch: 'all', teacher: 'all', criterion: 'all', cls: 'all', from, to })), from, to) : []), [data, program, branch, level, from, to]);

  const filtered = useCallback(
    (lock?: { program?: ProgramId; teacher?: string; skip?: FilterKey[] }) => {
      if (!data) return [];
      const skip = lock?.skip ?? [];
      const f: Filters = { program: lock?.program ?? program, branch, level, batch: skip.includes('batch') ? 'all' : batch, teacher: lock?.teacher ?? (skip.includes('teacher') ? 'all' : teacher), criterion, cls, from, to };
      return applyCriterion(applyDates(applyClass(data.batches.filter((b) => matches(b, f)), cls), from, to), criterion);
    },
    [data, program, branch, level, batch, teacher, criterion, cls, from, to],
  );

  const opexView = useCallback(
    (lock?: { program?: ProgramId; teacher?: string }) => {
      if (!data) return [];
      const prog = lock?.program ?? program;
      const who = lock?.teacher ?? teacher;
      const teachers = prog === 'all' ? null : new Set(data.batches.filter((b) => b.program === prog).map((b) => b.teacherId));
      return data.opex.filter(
        (o) => (branch === 'all' || o.branch === branch) && (who === 'all' || o.teacherId === who) && (!teachers || teachers.has(o.teacherId)) && (!from || (!!o.date && o.date >= from)) && (!to || (!!o.date && o.date <= to)),
      );
    },
    [data, program, branch, teacher, from, to],
  );

  const branches = useMemo(() => [...new Set((data?.batches ?? []).map((b) => b.branch))].sort(), [data]);

  const value = useMemo(
    () => ({ data, error, isLoading, isValidating, refresh, filters: { program, branch, level, batch, teacher, criterion, cls, from, to }, setFilter, reset, batches, filtered, branches, opexView }),
    [data, error, isLoading, isValidating, refresh, program, branch, level, batch, teacher, criterion, cls, from, to, setFilter, reset, batches, filtered, branches, opexView],
  );
  return <RatingsContext.Provider value={value}>{children}</RatingsContext.Provider>;
}

export function useRatingsData() {
  const ctx = useContext(RatingsContext);
  if (!ctx) throw new Error('useRatingsData must be used inside <RatingsProvider>');
  return ctx;
}
