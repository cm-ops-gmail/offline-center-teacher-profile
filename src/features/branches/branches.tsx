'use client';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DataGate } from '@/components/ui/data-gate';
import { FilterBar } from '@/components/layout/filter-bar';
import { BreakdownTable } from '@/components/ui/breakdown-table';
import { PageHeader, SectionTitle } from '@/components/ui/primitives';
import { byBranch, summarize } from '@/features/ratings/analytics';
import { useRatingsData } from '@/features/ratings/filters';
import { PROGRAMS } from '@/features/ratings/programs';
import { OpexPanel } from '@/features/opex/opex-panel';
import { fmt, plural } from '@/lib/format';

export function BranchesPage() {
  return <DataGate>{() => <Body />}</DataGate>;
}

function Body() {
  const { batches, filters, opexView } = useRatingsData();
  const opex = opexView();
  const router = useRouter();
  const groups = useMemo(() => byBranch(batches).sort((a, b) => (b.summary.rating ?? 0) - (a.summary.rating ?? 0)), [batches]);
  const programs = PROGRAMS.filter((p) => filters.program === 'all' || p.id === filters.program);

  // Branch × programme grid: Average Rating of the batches in each cell, on a one-hue ramp.
  const cells = groups.map((g) => ({ g, per: programs.map((p) => ({ id: p.id, s: summarize(g.batches.filter((b) => b.program === p.id)) })) }));
  const all = cells.flatMap((c) => c.per.map((x) => x.s.rating)).filter((v): v is number => v !== null);
  const lo = all.length ? Math.min(...all) : 4;
  const hi = all.length ? Math.max(...all) : 5;
  const shade = (v: number) => {
    const t = hi === lo ? 1 : (v - lo) / (hi - lo);
    const strength = 10 + t * 68;
    return { background: `color-mix(in oklab, var(--primary) ${strength}%, var(--background))`, color: strength > 48 ? 'var(--primary-foreground)' : 'var(--foreground)' };
  };

  return (
    <div className="flex flex-col gap-7">
      <PageHeader eyebrow="Centres" title="Branch" emphasis="comparison" description={`${plural(groups.length, 'branch', 'branches')} in view. Small branches have few batches, so read their averages with care. Click a branch to see its ratings.`} />
      <FilterBar show={['program']} />

      <section className="rise">
        <SectionTitle title="Average Rating by branch" hint="Each batch’s rating (First and Last averaged), added up and divided by the number of batches." />
        <BreakdownTable
          head="Branch"
          rows={groups.map((g) => ({ key: g.key, label: g.label, batches: g.summary.batches, first: g.summary.avgFirst, last: g.summary.avgLast, rating: g.summary.rating }))}
          onSelect={(k) => router.push(`/?branch=${encodeURIComponent(k)}${filters.program !== 'all' ? `&program=${filters.program}` : ''}`)}
        />
      </section>

      <section className="rise card p-5 sm:p-6">
        <SectionTitle title="Average Rating by branch and programme" hint="Darker means higher; the number of batches sits beneath each score." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-separate border-spacing-1 text-center text-[13.5px]">
            <thead>
              <tr className="text-[12px] text-muted-foreground">
                <th className="px-2 py-1.5 text-left font-medium" />
                {programs.map((p) => (
                  <th key={p.id} className="px-2 py-1.5 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2 rounded-full" style={{ background: p.color }} />
                      {p.short}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cells.map(({ g, per }) => (
                <tr key={g.key}>
                  <th scope="row" className="whitespace-nowrap px-2 py-1.5 text-left font-medium">
                    {g.label}
                  </th>
                  {per.map((x) => (
                    <td key={x.id} className="rounded-md px-2 py-2" style={x.s.rating !== null ? shade(x.s.rating) : { background: 'var(--muted)', color: 'var(--muted-foreground)' }} title={x.s.rating !== null ? `${g.label} · ${x.id}: ${fmt(x.s.rating)} across ${x.s.batches} batches` : 'No ratings yet'}>
                      {x.s.rating !== null ? (
                        <>
                          <span className="tabular block font-semibold leading-tight">{fmt(x.s.rating)}</span>
                          <span className="block text-[11px] leading-tight opacity-75">{plural(x.s.batches, 'batch', 'batches')}</span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <OpexPanel rows={opex} by="branch" />
    </div>
  );
}
