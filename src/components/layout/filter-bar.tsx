'use client';
import { FilterX } from 'lucide-react';
import { Button } from '@tenminuteschool/design-system';
import { SearchSelect } from '@/components/ui/search-select';
import { TEAMS, type TeamKey } from '@/features/opex/teams';
import { useRatingsData } from '@/features/ratings/filters';
import { PROGRAMS } from '@/features/ratings/programs';

export function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="inline-flex">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="field w-auto max-w-[16rem] font-medium">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** From / To date inputs, synced to the URL (?from=&to=). The range applies to the day each rating was given. */
export function DateRange() {
  const { filters, setFilter } = useRatingsData();
  return (
    <div className="inline-flex items-center gap-1.5" role="group" aria-label="Date range">
      <label className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground">
        From
        <input type="date" className="field w-auto font-medium" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilter('from', e.target.value)} />
      </label>
      <label className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground">
        To
        <input type="date" className="field w-auto font-medium" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilter('to', e.target.value)} />
      </label>
    </div>
  );
}

/** OpEx-tab filters: the OpEx / ABM / AC member who rated, and one of the six OpEx questions. Options follow the other filters. */
export function OpexFilters({ team }: { team: TeamKey }) {
  const { data, filters, setFilter } = useRatingsData();
  const cfg = TEAMS[team];
  const rows = ((team === 'opex' ? data?.opex : data?.programme) ?? []).filter((o) => (filters.branch === 'all' || o.branch === filters.branch) && (filters.teacher === 'all' || o.teacherId === filters.teacher));
  const raters = [...new Set([...rows.map((o) => o.rater).filter(Boolean), ...(filters.rater !== 'all' ? [filters.rater] : [])])].sort();
  return (
    <>
      <SearchSelect label={cfg.who} value={filters.rater} onChange={(v) => setFilter('rater', v)} allLabel={`All ${cfg.who.toLowerCase().replace('opex', 'OpEx').replace('programme', 'Programme')}s`} searchPlaceholder={`Search ${cfg.who}s…`} options={raters.map((r) => ({ value: r, label: r }))} className="w-60" dropdownWidth="w-[24rem]" />
      <SearchSelect label={team === 'opex' ? 'Question' : 'Criterion'} value={filters.question} onChange={(v) => setFilter('question', v)} allLabel={team === 'opex' ? 'All questions' : 'All criteria'} searchPlaceholder={team === 'opex' ? 'Search questions…' : 'Search criteria…'} options={cfg.criteria.map((c) => ({ value: c.short, label: c.short }))} className="w-60" dropdownWidth="w-[24rem]" />
    </>
  );
}

/** One row above the content; scopes every chart, stat and table below it. */
export function FilterBar({ show = ['program', 'branch'], lockedProgram, opexAware = false }: { show?: ('program' | 'branch' | 'level')[]; lockedProgram?: string; /** On a screen with Student / OpEx tabs: swap in the OpEx filters while the OpEx tab is open. */ opexAware?: boolean }) {
  const { filters, setFilter, reset, branches, data, ratingTab } = useRatingsData();
  const opex = opexAware && ratingTab !== 'student';
  const levels = [...new Set((data?.batches ?? []).map((b) => b.level).filter((l): l is string => !!l))];
  const active = (show.includes('program') && filters.program !== 'all') || (show.includes('branch') && filters.branch !== 'all') || (show.includes('level') && filters.level !== 'all') || !!filters.from || !!filters.to || (opex && (filters.rater !== 'all' || filters.question !== 'all'));

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
      <span className="eyebrow mr-1">Showing</span>
      {show.includes('program') && !lockedProgram && (
        <Select label="Programme" value={filters.program} onChange={(v) => setFilter('program', v)} options={[{ value: 'all', label: 'All programmes' }, ...PROGRAMS.map((p) => ({ value: p.id, label: p.label }))]} />
      )}
      {show.includes('branch') && <Select label="Branch" value={filters.branch} onChange={(v) => setFilter('branch', v)} options={[{ value: 'all', label: 'All branches' }, ...branches.map((b) => ({ value: b, label: b }))]} />}
      {!opex && show.includes('level') && levels.length > 0 && <Select label="Level" value={filters.level} onChange={(v) => setFilter('level', v)} options={[{ value: 'all', label: 'All levels' }, ...levels.map((l) => ({ value: l, label: l }))]} />}
      {opex && <OpexFilters team={ratingTab} />}
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
