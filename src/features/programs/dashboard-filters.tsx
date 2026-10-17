'use client';
import { FilterX } from 'lucide-react';
import { Button } from '@tenminuteschool/design-system';
import { DateRange, OpexFilters, Select } from '@/components/layout/filter-bar';
import { SearchSelect } from '@/components/ui/search-select';
import { criterionOptions, programTags } from '@/features/ratings/criteria';
import { matches, useRatingsData, type RatingClass } from '@/features/ratings/filters';
import { PROGRAMS, PROGRAM_BY_ID } from '@/features/ratings/programs';
import type { ProgramId } from '@/features/ratings/types';

const CLASS_OPTIONS: { value: RatingClass; label: string }[] = [
  { value: 'all', label: 'First & Last rating' },
  { value: 'first', label: 'First Rating only' },
  { value: 'last', label: 'Last Rating only' },
];

/** Options for one dropdown: every value still reachable given the *other* filters, keeping the current pick visible. */
function optionsFor(all: string[], current: string): string[] {
  const set = new Set(all);
  if (current !== 'all') set.add(current);
  return [...set];
}

/**
 * Programme · Branch · Level · Teacher · Batch · Criterion · Class. Each list only offers values that still exist under the
 * other choices; Teacher, Batch and Criterion are searchable dropdowns. `hide` drops Teacher / Batch (the comparison screen picks its own teachers).
 */
export function DashboardFilters({ lockedProgram, lockedTeacher, hide = [] }: { lockedProgram?: ProgramId; lockedTeacher?: string; hide?: ('teacher' | 'batch')[] }) {
  const { data, filters, setFilter, reset, ratingTab } = useRatingsData();
  const program = lockedProgram ?? filters.program;
  // On a teacher's profile the list is limited to that teacher, and the Programme filter only appears if they teach more than one.
  const mine = (data?.batches ?? []).filter((b) => !lockedTeacher || b.teacherId === lockedTeacher);
  const teacherPrograms = new Set(mine.map((b) => b.program));
  const showProgram = !lockedProgram && (!lockedTeacher || teacherPrograms.size > 1);
  const rows = mine.filter((b) => program === 'all' || b.program === program);
  const f = { ...filters, program, teacher: lockedTeacher ?? filters.teacher };
  const under = (skip: (keyof typeof f)[]) => rows.filter((b) => matches(b, f, [...skip, 'program']));

  const showLevel = program === 'sej' ? true : program === 'all' ? lockedTeacher ? teacherPrograms.has('sej') : false : PROGRAM_BY_ID[program].hasLevel;
  const branches = optionsFor(under(['branch', 'batch', 'teacher']).map((b) => b.branch), filters.branch).sort();
  const levels = optionsFor(under(['level', 'batch']).flatMap((b) => (b.level ? [b.level] : [])), filters.level).sort();
  const teacherMap = new Map(under(['teacher', 'batch']).map((b) => [b.teacherId, b.teacherName]));
  if (filters.teacher !== 'all' && !teacherMap.has(filters.teacher)) teacherMap.set(filters.teacher, (data?.teachers ?? []).find((t) => t.id === filters.teacher)?.name ?? filters.teacher);
  const teachers = [...teacherMap.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const batches = optionsFor(under(['batch']).map((b) => b.batch), filters.batch).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const criteria = criterionOptions(program);
  const showTeacher = !lockedTeacher && !hide.includes('teacher');
  const showBatch = !hide.includes('batch');
  const active = (showProgram && filters.program !== 'all') || filters.branch !== 'all' || filters.level !== 'all' || (showTeacher && filters.teacher !== 'all') || (showBatch && filters.batch !== 'all') || filters.criterion !== 'all' || filters.cls !== 'all' || !!filters.from || !!filters.to;

  if (ratingTab === 'opex') {
    // OpEx tab: programme · branch · teacher · OpEx member · question · dates (no level / batch / class — OpEx has none)
    const base = (data?.opex ?? []).filter((o) => (!lockedTeacher || o.teacherId === lockedTeacher) && (program === 'all' || mine.some((b) => b.teacherId === o.teacherId)));
    const opexBranches = optionsFor(base.filter((o) => filters.teacher === 'all' || o.teacherId === filters.teacher).map((o) => o.branch), filters.branch).sort();
    const opexTeacherMap = new Map(base.filter((o) => filters.branch === 'all' || o.branch === filters.branch).map((o) => [o.teacherId, o.teacherName]));
    if (filters.teacher !== 'all' && !opexTeacherMap.has(filters.teacher)) opexTeacherMap.set(filters.teacher, (data?.teachers ?? []).find((t) => t.id === filters.teacher)?.name ?? filters.teacher);
    const opexTeachers = [...opexTeacherMap.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    const opexActive = (showProgram && filters.program !== 'all') || filters.branch !== 'all' || (showTeacher && filters.teacher !== 'all') || filters.rater !== 'all' || filters.question !== 'all' || !!filters.from || !!filters.to;
    return (
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
        <span className="eyebrow mr-1">Filter</span>
        {showProgram && <Select label="Programme" value={filters.program} onChange={(v) => setFilter('program', v)} options={[{ value: 'all', label: 'All programmes' }, ...PROGRAMS.map((p) => ({ value: p.id, label: p.label }))]} />}
        <Select label="Branch" value={filters.branch} onChange={(v) => setFilter('branch', v)} options={[{ value: 'all', label: 'All branches' }, ...opexBranches.map((b) => ({ value: b, label: b }))]} />
        {showTeacher && <SearchSelect label="Teacher" value={filters.teacher} onChange={(v) => setFilter('teacher', v)} allLabel="All teachers" options={opexTeachers.map(([id, name]) => ({ value: id, label: name }))} className="w-56" />}
        <OpexFilters />
        <DateRange />
        {opexActive && (
          <Button variant="ghost" size="sm" onClick={reset} className="h-9 gap-1.5 text-muted-foreground">
            <FilterX className="size-3.5" />
            Clear
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
      <span className="eyebrow mr-1">Filter</span>
      {showProgram && <Select label="Programme" value={filters.program} onChange={(v) => setFilter('program', v)} options={[{ value: 'all', label: 'All programmes' }, ...PROGRAMS.map((p) => ({ value: p.id, label: p.label }))]} />}
      <Select label="Branch" value={filters.branch} onChange={(v) => setFilter('branch', v)} options={[{ value: 'all', label: 'All branches' }, ...branches.map((b) => ({ value: b, label: b }))]} />
      {showLevel && <Select label="Level" value={filters.level} onChange={(v) => setFilter('level', v)} options={[{ value: 'all', label: 'All levels' }, ...levels.map((l) => ({ value: l, label: l }))]} />}
      {showTeacher && <SearchSelect label="Teacher" value={filters.teacher} onChange={(v) => setFilter('teacher', v)} allLabel="All teachers" options={teachers.map(([id, name]) => ({ value: id, label: name }))} className="w-56" />}
      {showBatch && <SearchSelect label="Batch" value={filters.batch} onChange={(v) => setFilter('batch', v)} allLabel="All batches" options={batches.map((b) => ({ value: b, label: `Batch ${b}` }))} className="w-40" dropdownWidth="w-60" />}
      <SearchSelect
        label="Criterion"
        value={filters.criterion}
        onChange={(v) => setFilter('criterion', v)}
        allLabel="All criteria"
        searchPlaceholder="Search criteria…"
        options={criteria.map((c) => ({ value: c.name, label: program === 'all' ? `${c.name} · ${programTags(c.programs)}` : c.name }))}
        className="w-64"
        dropdownWidth="w-[26rem]"
      />
      <Select label="Class" value={filters.cls} onChange={(v) => setFilter('cls', v)} options={CLASS_OPTIONS} />
      <DateRange />
      {active && (
        <Button variant="ghost" size="sm" onClick={reset} className="h-9 gap-1.5 text-muted-foreground">
          <FilterX className="size-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
}
