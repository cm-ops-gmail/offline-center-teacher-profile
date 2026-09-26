'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Search } from 'lucide-react';
import { Input } from '@tenminuteschool/design-system';
import { DataGate } from '@/components/ui/data-gate';
import { FilterBar } from '@/components/layout/filter-bar';
import { Monogram, PageHeader, ProgramChip } from '@/components/ui/primitives';
import { Kpis } from '@/features/dashboard/dashboard';
import { byTeacher, summarize } from '@/features/ratings/analytics';
import { useRatingsData } from '@/features/ratings/filters';
import { PROGRAMS } from '@/features/ratings/programs';
import type { ProgramId } from '@/features/ratings/types';
import { fmt, plural } from '@/lib/format';
import { cn } from '@/lib/utils';

type Key = 'name' | 'batches' | 'first' | 'last' | 'rating';

export function TeachersPage() {
  return <DataGate>{() => <Body />}</DataGate>;
}

function Body() {
  const { batches, data } = useRatingsData();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: 'rating', dir: -1 });
  const codes = useMemo(() => new Map((data?.teachers ?? []).map((t) => [t.id, t.code])), [data]);

  const rows = useMemo(() => {
    const list = byTeacher(batches).map((g) => ({
      id: g.key,
      name: g.label,
      code: codes.get(g.key) ?? null,
      programs: [...new Set(g.batches.map((b) => b.program))] as ProgramId[],
      ...g.summary,
      branchNames: [...new Set(g.batches.map((b) => b.branch))],
    }));
    const needle = q.trim().toLowerCase();
    const filtered = needle ? list.filter((r) => `${r.name} ${r.code ?? ''} ${r.branchNames.join(' ')}`.toLowerCase().includes(needle)) : list;
    const val = (r: (typeof list)[number]): string | number | null => (sort.key === 'name' ? r.name : sort.key === 'batches' ? r.batches : sort.key === 'first' ? r.avgFirst : sort.key === 'last' ? r.avgLast : r.rating);
    return filtered.sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      if (av === null) return 1;
      if (bv === null) return -1;
      return (typeof av === 'number' ? av - (bv as number) : String(av).localeCompare(String(bv))) * sort.dir;
    });
  }, [batches, codes, q, sort]);

  const th = (label: string, key: Key, right = true) => (
    <th scope="col" aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'} className={cn('whitespace-nowrap px-3 py-2.5 font-medium', right && 'text-right')}>
      <button type="button" onClick={() => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === 'name' ? 1 : -1 }))} className={cn('inline-flex items-center gap-1 hover:text-foreground', sort.key === key && 'text-foreground', right && 'flex-row-reverse')}>
        {label}
        {sort.key === key && (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  );

  return (
    <div className="flex flex-col gap-7">
      <PageHeader eyebrow="Faculty" title="The" emphasis="teachers" description={`${plural(rows.length, 'teacher')} in view. Average Rating adds up the rating of each of a teacher’s batches (its First and Last Rating averaged) and divides by the number of batches.`} />
      <FilterBar show={['program', 'branch']} />

      {batches.length > 0 && <Kpis s={summarize(batches)} batches={batches} cls="all" round="" />}

      <div className="flex flex-col gap-3">
        <div className="relative max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, code or branch…" aria-label="Search teachers" className="h-9 pl-9" />
        </div>
        <div className="card-hover overflow-x-auto">
          <table className="w-full min-w-[760px] text-[13.5px]">
            <thead className="bg-muted/60 text-left text-[12px] text-muted-foreground">
              <tr>
                {th('Teacher', 'name', false)}
                <th className="px-3 py-2.5 font-medium">Programmes</th>
                <th className="px-3 py-2.5 font-medium">Branches</th>
                {th('Batches', 'batches')}
                {th('Avg First', 'first')}
                {th('Avg Last', 'last')}
                {th('Average Rating', 'rating')}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                    No teachers match.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border/70 transition-colors hover:bg-accent/40">
                  <td className="px-3 py-2.5">
                    <Link href={`/teachers/${r.id}`} className="group flex items-center gap-3">
                      <Monogram name={r.name} size="sm" />
                      <span>
                        <span className="block font-medium group-hover:underline">{r.name}</span>
                        {r.code && <span className="block text-[11.5px] text-muted-foreground">{r.code}</span>}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex flex-wrap gap-x-3 gap-y-1">
                      {PROGRAMS.filter((p) => r.programs.includes(p.id)).map((p) => (
                        <ProgramChip key={p.id} id={p.id} className="text-[12.5px]" />
                      ))}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.branchNames.join(', ')}</td>
                  <td className="tabular px-3 py-2.5 text-right">{r.batches}</td>
                  <td className="tabular px-3 py-2.5 text-right text-muted-foreground">{fmt(r.avgFirst)}</td>
                  <td className="tabular px-3 py-2.5 text-right">{fmt(r.avgLast)}</td>
                  <td className="tabular bg-[color-mix(in_oklab,var(--good)_9%,var(--background))] px-3 py-2.5 text-right font-bold">{fmt(r.rating)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
