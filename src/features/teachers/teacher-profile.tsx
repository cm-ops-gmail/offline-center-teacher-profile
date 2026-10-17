'use client';
import Link from 'next/link';
import { useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@tenminuteschool/design-system';
import { DataGate } from '@/components/ui/data-gate';
import { Monogram, ProgramChip, SectionTitle } from '@/components/ui/primitives';
import { OpexPanel } from '@/features/opex/opex-panel';
import { Detail, Kpis } from '@/features/dashboard/dashboard';
import { DashboardFilters } from '@/features/programs/dashboard-filters';
import { summarize } from '@/features/ratings/analytics';
import { useRatingsData } from '@/features/ratings/filters';
import { PROGRAMS, PROGRAM_BY_ID } from '@/features/ratings/programs';
import { plural } from '@/lib/format';

export function TeacherProfile({ id }: { id: string }) {
  return (
    <DataGate>
      {(data) => {
        const teacher = data.teachers.find((t) => t.id === id);
        if (!teacher || !data.batches.some((b) => b.teacherId === id)) return <NotFound />;
        return <Body id={id} name={teacher.name} code={teacher.code} />;
      }}
    </DataGate>
  );
}

function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <h1 className="text-lg font-bold">We couldn’t find that teacher</h1>
      <p className="max-w-sm text-sm text-muted-foreground">They may have been renamed in the sheet, or the link is out of date.</p>
      <Button asChild>
        <Link href="/teachers">Back to teachers</Link>
      </Button>
    </div>
  );
}

function Body({ id, name, code }: { id: string; name: string; code: string | null }) {
  const { data, filtered, filters, opexView } = useRatingsData();
  const opex = opexView({ teacher: id });
  const all = useMemo(() => (data?.batches ?? []).filter((b) => b.teacherId === id), [data, id]);
  const view = filtered({ teacher: id });
  const s = useMemo(() => summarize(view), [view]);
  const programs = PROGRAMS.filter((p) => all.some((b) => b.program === p.id));
  const branches = [...new Set(all.map((b) => b.branch))];
  const remarks = view.filter((b) => b.remarks.length > 0);
  const round = filters.cls === 'first' ? 'First Rating' : 'Last Rating';

  return (
    <div className="flex flex-col gap-7">
      <Link href="/teachers" className="rise -mb-3 inline-flex w-fit items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-3.5" /> All teachers
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Monogram name={name} size="lg" />
        <div>
          <p className="eyebrow mb-1.5">{code ?? 'Teacher'}</p>
          <h1 className="text-lg font-bold sm:text-xl">{name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13.5px] text-muted-foreground">
            {programs.map((p) => (
              <ProgramChip key={p.id} id={p.id} />
            ))}
            <span>·</span>
            <span>{branches.join(', ')}</span>
          </p>
        </div>
      </header>

      <DashboardFilters lockedTeacher={id} />

      {view.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">No ratings match these filters. Try clearing one.</p>
      ) : (
        <>
          <SectionTitle title="Student rating" hint="Given by students on the paper forms, per batch." />
          <Kpis s={s} batches={view} cls={filters.cls} round={round} />
          <Detail batches={view} cls={filters.cls} showProgramTitles showTeacher={false} />
        </>
      )}

      <OpexPanel rows={opex} by="entries" />

      {remarks.length > 0 && (
        <section className="rise card p-5 sm:p-6">
          <SectionTitle title="Remarks from the sheet" />
          <ul className="flex flex-col gap-2 text-[13.5px]">
            {remarks.map((b) => (
              <li key={b.id} className="italic text-muted-foreground">
                “{b.remarks.join(' · ')}” <span className="not-italic">— {PROGRAM_BY_ID[b.program].label}, {b.branch} {b.batch}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
