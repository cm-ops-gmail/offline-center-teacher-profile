'use client';
import { FilterX } from 'lucide-react';
import { Button } from '@tenminuteschool/design-system';
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

/** One row above the content; scopes every chart, stat and table below it. */
export function FilterBar({ show = ['program', 'branch'], lockedProgram }: { show?: ('program' | 'branch' | 'level')[]; lockedProgram?: string }) {
  const { filters, setFilter, reset, branches, data } = useRatingsData();
  const levels = [...new Set((data?.batches ?? []).map((b) => b.level).filter((l): l is string => !!l))];
  const active = (show.includes('program') && filters.program !== 'all') || (show.includes('branch') && filters.branch !== 'all') || (show.includes('level') && filters.level !== 'all') || !!filters.from || !!filters.to;

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
      <span className="eyebrow mr-1">Showing</span>
      {show.includes('program') && !lockedProgram && (
        <Select label="Programme" value={filters.program} onChange={(v) => setFilter('program', v)} options={[{ value: 'all', label: 'All programmes' }, ...PROGRAMS.map((p) => ({ value: p.id, label: p.label }))]} />
      )}
      {show.includes('branch') && <Select label="Branch" value={filters.branch} onChange={(v) => setFilter('branch', v)} options={[{ value: 'all', label: 'All branches' }, ...branches.map((b) => ({ value: b, label: b }))]} />}
      {show.includes('level') && levels.length > 0 && <Select label="Level" value={filters.level} onChange={(v) => setFilter('level', v)} options={[{ value: 'all', label: 'All levels' }, ...levels.map((l) => ({ value: l, label: l }))]} />}
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
