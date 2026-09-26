'use client';
import Link from 'next/link';
import { useMemo } from 'react';
import { MousePointerClick } from 'lucide-react';
import { DataGate } from '@/components/ui/data-gate';
import { BreakdownTable, type BreakdownRow } from '@/components/ui/breakdown-table';
import { SheetSummary } from '@/components/ui/sheet-summary';
import { PageHeader, ProgramChip, SectionTitle, StatTile } from '@/components/ui/primitives';
import { byBranch, byProgram, byTeacher, groupBy, type Group } from '@/features/ratings/analytics';
import { useRatingsData } from '@/features/ratings/filters';
import { PROGRAMS, PROGRAM_BY_ID } from '@/features/ratings/programs';
import type { BatchRecord, ProgramId } from '@/features/ratings/types';
import { fmt, plural } from '@/lib/format';
import { summarize } from '@/features/ratings/analytics';
import { BatchTable } from '@/features/programs/batch-table';
import { DashboardFilters } from '@/features/programs/dashboard-filters';
import { TeacherComparison } from '@/features/compare/teacher-comparison';
import { BatchesInfo, RatingInfo, RoundInfo } from './kpi-info';

export function Dashboard({ lockedProgram }: { lockedProgram?: ProgramId }) {
  return <DataGate>{() => <Body lockedProgram={lockedProgram} />}</DataGate>;
}

const toRows = (groups: Group[], label: (g: Group) => BreakdownRow['label'] = (g) => g.label): BreakdownRow[] =>
  groups
    .map((g) => ({ key: g.key, label: label(g), batches: g.summary.batches, first: g.summary.avgFirst, last: g.summary.avgLast, rating: g.summary.rating }))
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

function Body({ lockedProgram }: { lockedProgram?: ProgramId }) {
  const { filtered, filters, setFilter } = useRatingsData();
  const batches = filtered({ program: lockedProgram });
  const s = useMemo(() => summarize(batches), [batches]);
  const def = lockedProgram ? PROGRAM_BY_ID[lockedProgram] : null;
  const cls = filters.cls;
  const round = cls === 'first' ? 'First Rating' : 'Last Rating';

  // Drill-down = the reader has picked something. Until then the dashboard shows averages only.
  const drilled = (!lockedProgram && filters.program !== 'all') || filters.branch !== 'all' || filters.level !== 'all' || filters.teacher !== 'all' || filters.batch !== 'all' || cls !== 'all';

  const today = useMemo(() => new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }), []);
  const scopeText = [
    !lockedProgram && filters.program !== 'all' ? PROGRAM_BY_ID[filters.program].label : null,
    filters.teacher !== 'all' ? batches[0]?.teacherName : null,
    filters.branch !== 'all' ? filters.branch : null,
    filters.level !== 'all' ? filters.level : null,
    filters.batch !== 'all' ? `Batch ${filters.batch}` : null,
    filters.criterion !== 'all' ? filters.criterion : null,
    cls !== 'all' ? `${round} only` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow={
          def ? (
            <span className="inline-flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: def.color }} /> Programme
            </span>
          ) : (
            today
          )
        }
        title={def ? def.label : 'Teacher'}
        emphasis={def ? 'ratings' : 'performance'}
        description={
          drilled ? (
            <>
              {scopeText || 'Everything'} — {plural(s.teachers, 'teacher')}, {plural(s.batches, 'batch', 'batches')}.
            </>
          ) : (
            <>
              A batch’s rating is the average of its <strong className="font-medium text-foreground">First</strong> and <strong className="font-medium text-foreground">Last</strong> Rating. The Average Rating below adds up every batch’s rating and divides by the number of batches.
              {filters.criterion !== 'all' && (
                <>
                  {' '}
                  Every number here is for the criterion <strong className="font-medium text-foreground">“{filters.criterion}”</strong> only.
                </>
              )}
            </>
          )
        }
      />
      <DashboardFilters lockedProgram={lockedProgram} />

      {s.batches === 0 ? (
        <p className="py-16 text-center text-muted-foreground">No ratings match these filters. Try clearing one.</p>
      ) : (
        <>
          <Kpis s={s} batches={batches} cls={cls} round={round} />
          {drilled ? <Detail batches={batches} cls={cls} showProgramTitles={!lockedProgram} /> : <Averages batches={batches} lockedProgram={lockedProgram} onPick={setFilter} />}
        </>
      )}
    </div>
  );
}

export function Kpis({ s, batches, cls, round }: { s: ReturnType<typeof summarize>; batches: BatchRecord[]; cls: 'all' | 'first' | 'last'; round: string }) {
  const { filters } = useRatingsData();
  const crit = filters.criterion === 'all' ? undefined : filters.criterion;
  const ratingLabel = crit ? `Average · ${crit}` : 'Average Rating';
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cls === 'all' ? (
        <>
          <StatTile hero label={ratingLabel} value={fmt(s.rating)} sub={`Across ${plural(s.batches, 'batch', 'batches')} · out of 5`} info={<RatingInfo batches={batches} criterion={crit} />} infoAlign="start" />
          <StatTile label="Average First Rating" value={fmt(s.avgFirst)} sub={`${plural(s.withFirst, 'batch', 'batches')} with a First Rating`} info={<RoundInfo batches={batches} round="first" criterion={crit} />} infoAlign="start" />
          <StatTile label="Average Last Rating" value={fmt(s.avgLast)} sub={`${plural(s.withLast, 'batch', 'batches')} with a Last Rating · ${s.inProgress} still running`} info={<RoundInfo batches={batches} round="last" criterion={crit} />} />
          <StatTile label="Batches" value={s.batches} sub={`${plural(s.teachers, 'teacher')} · ${plural(s.branches, 'branch', 'branches')}`} info={<BatchesInfo batches={batches} />} />
        </>
      ) : (
        <>
          <StatTile hero label={`Average ${round}`} value={fmt(s.rating)} sub={`Across ${plural(s.batches, 'batch', 'batches')} · out of 5`} info={<RoundInfo batches={batches} round={round === 'First Rating' ? 'first' : 'last'} criterion={crit} />} infoAlign="start" />
          <StatTile label="Batches" value={s.batches} sub={`With a ${round}`} info={<BatchesInfo batches={batches} />} infoAlign="start" />
          <StatTile label="Teachers" value={s.teachers} sub="In this view" />
          <StatTile label="Branches" value={s.branches} sub="In this view" />
        </>
      )}
    </div>
  );
}

/** Default state: averages only. Every row is a way in — click one to see its data. */
function Averages({ batches, lockedProgram, onPick }: { batches: BatchRecord[]; lockedProgram?: ProgramId; onPick: (k: 'program' | 'branch' | 'teacher' | 'level', v: string) => void }) {
  const programRows = useMemo(
    () => toRows(byProgram(batches), (g) => <ProgramChip id={g.key as ProgramId} className="text-[14px] font-medium" />).sort((a, b) => PROGRAMS.findIndex((p) => p.id === a.key) - PROGRAMS.findIndex((p) => p.id === b.key)),
    [batches],
  );
  const branchRows = useMemo(() => toRows(byBranch(batches)), [batches]);
  const teacherRows = useMemo(() => toRows(byTeacher(batches)), [batches]);
  const levelRows = useMemo(() => toRows(groupBy(batches.filter((b) => b.level), (b) => b.level!)), [batches]);
  const { filters: current } = useRatingsData();
  const criterion = current.criterion;


  return (
    <>
      <p className="-mb-3 flex items-center gap-2 text-[13px] text-muted-foreground">
        <MousePointerClick className="size-4 text-gold" /> Click any row — or use the filters above — to see the ratings behind it.
      </p>

      {!lockedProgram && (
        <section className="rise">
          <SectionTitle title="By programme" />
          <BreakdownTable head="Programme" rows={programRows} onSelect={(k) => onPick('program', k)} />
        </section>
      )}
      <section className="rise">
        <SectionTitle title="By branch" />
        <BreakdownTable head="Branch" rows={branchRows} onSelect={(k) => onPick('branch', k)} />
      </section>
      {lockedProgram && levelRows.length > 0 && (
        <section className="rise">
          <SectionTitle title="By level" />
          <BreakdownTable head="Level" rows={levelRows} onSelect={(k) => onPick('level', k)} />
        </section>
      )}
      {lockedProgram && (
        <section className="rise">
          <SectionTitle title="By teacher" hint="Best average first." />
          <BreakdownTable head="Teacher" rows={teacherRows} onSelect={(k) => onPick('teacher', k)} />
        </section>
      )}
      {!lockedProgram && (
        <p className="text-[13.5px] text-muted-foreground">
          Looking for a person? <Link href="/teachers" className="font-medium text-foreground underline underline-offset-2">Browse all teachers</Link> and open any profile.
        </p>
      )}

      <TeacherComparison batches={batches} criterion={criterion} />
    </>
  );
}

/** Drill-down: the sheet's own columns — averages first, then every rating row — grouped by programme (criteria differ per programme). */
export function Detail({ batches, cls, showProgramTitles, showTeacher = true }: { batches: BatchRecord[]; cls: 'all' | 'first' | 'last'; showProgramTitles: boolean; showTeacher?: boolean }) {
  const { filters } = useRatingsData();
  const criterion = filters.criterion;
  const programs = PROGRAMS.filter((p) => batches.some((b) => b.program === p.id));
  return (
    <>
      {programs.map((p) => {
        const mine = batches.filter((b) => b.program === p.id);
        return (
          <section key={p.id} className="rise flex flex-col gap-4">
            {showProgramTitles && (
              <SectionTitle
                title={p.label}
                hint={`${plural(mine.length, 'batch', 'batches')} · Average Rating ${fmt(summarize(mine).rating)}`}
              />
            )}
            <SheetSummary batches={mine} program={p.id} cls={cls} criterion={criterion} />
            <BatchTable key={`${cls}-${criterion}-${p.id}`} batches={mine} program={p.id} cls={cls} showTeacher={showTeacher} criterion={criterion} />
          </section>
        );
      })}
    </>
  );
}
