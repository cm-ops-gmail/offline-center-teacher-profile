'use client';
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useRatings } from './api';
import { applyCriterion } from './criteria';
import { isProgramId } from './programs';
import type { BatchRecord, ProgramId, RatingsPayload } from './types';

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
}

type FilterKey = keyof Filters;

/** URL query-string names (`cls` is called `class` in the URL). */
const PARAM: Record<FilterKey, string> = { program: 'program', branch: 'branch', level: 'level', batch: 'batch', teacher: 'teacher', criterion: 'criterion', cls: 'class' };

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
}

const RatingsContext = createContext<Ctx | null>(null);

/** Keeps only the requested rating round; batches without it drop out. */
export function applyClass(batches: BatchRecord[], cls: RatingClass): BatchRecord[] {
  if (cls === 'first') return batches.filter((b) => b.first).map((b) => ({ ...b, last: null }));
  if (cls === 'last') return batches.filter((b) => b.last).map((b) => ({ ...b, first: null }));
  return batches;
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
      if (value === 'all') next.delete(PARAM[key]);
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

  const { program, branch, level, batch, teacher, criterion, cls } = filters;

  const batches = useMemo(() => (data ? data.batches.filter((b) => matches(b, { program, branch, level, batch: 'all', teacher: 'all', criterion: 'all', cls: 'all' })) : []), [data, program, branch, level]);

  const filtered = useCallback(
    (lock?: { program?: ProgramId; teacher?: string; skip?: FilterKey[] }) => {
      if (!data) return [];
      const skip = lock?.skip ?? [];
      const f: Filters = { program: lock?.program ?? program, branch, level, batch: skip.includes('batch') ? 'all' : batch, teacher: lock?.teacher ?? (skip.includes('teacher') ? 'all' : teacher), criterion, cls };
      return applyCriterion(applyClass(data.batches.filter((b) => matches(b, f)), cls), criterion);
    },
    [data, program, branch, level, batch, teacher, criterion, cls],
  );

  const branches = useMemo(() => [...new Set((data?.batches ?? []).map((b) => b.branch))].sort(), [data]);

  const value = useMemo(
    () => ({ data, error, isLoading, isValidating, refresh, filters: { program, branch, level, batch, teacher, criterion, cls }, setFilter, reset, batches, filtered, branches }),
    [data, error, isLoading, isValidating, refresh, program, branch, level, batch, teacher, criterion, cls, setFilter, reset, batches, filtered, branches],
  );
  return <RatingsContext.Provider value={value}>{children}</RatingsContext.Provider>;
}

export function useRatingsData() {
  const ctx = useContext(RatingsContext);
  if (!ctx) throw new Error('useRatingsData must be used inside <RatingsProvider>');
  return ctx;
}
