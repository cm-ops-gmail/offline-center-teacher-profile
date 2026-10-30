'use client';
import Link from 'next/link';
import { useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@tenminuteschool/design-system';
import { DataGate } from '@/components/ui/data-gate';
import { Monogram, Pill, ProgramChip, SectionTitle } from '@/components/ui/primitives';
import { RatingSummary } from '@/features/opex/rating-summary';
import { RatingTabs } from '@/features/opex/rating-tabs';
import { OpexPanel } from '@/features/opex/opex-panel';
import { Detail, Kpis } from '@/features/dashboard/dashboard';
import { DashboardFilters } from '@/features/programs/dashboard-filters';
import { summarize } from '@/features/ratings/analytics';
import { useRatingsData } from '@/features/ratings/filters';
import { PROGRAMS, PROGRAM_BY_ID } from '@/features/ratings/programs';
import type { Teacher } from '@/features/ratings/types';
import { ManageProfile } from '@/features/teachers/manage-profile';
import { TeacherClasses } from '@/features/teachers/teacher-classes';
import { plural } from '@/lib/format';

export function TeacherProfile({ id, home = false }: { id: string; home?: boolean }) {
  return (
    <DataGate>
      {(data) => {
        const teacher = data.teachers.find((t) => t.id === id);
        if (!teacher || !data.batches.some((b) => b.teacherId === id)) return <NotFound />;
        return <Body id={id} teacher={teacher} home={home} />;
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

function Body({ id, teacher, home = false }: { id: string; teacher: Teacher; home?: boolean }) {
  const { data, filtered, filters, opexView, programmeView } = useRatingsData();
  const name = teacher.name;
  const profile = teacher.profile;
  const opex = opexView({ teacher: id });
  const programme = programmeView({ teacher: id });
  const all = useMemo(() => (data?.batches ?? []).filter((b) => b.teacherId === id), [data, id]);
  const view = filtered({ teacher: id });
  const s = useMemo(() => summarize(view), [view]);
  const programs = PROGRAMS.filter((p) => all.some((b) => b.program === p.id));
  const branches = [...new Set(all.map((b) => b.branch))];
  const remarks = view.filter((b) => b.remarks.length > 0);
  const round = filters.cls === 'first' ? 'First Rating' : 'Last Rating';
  // Classes: a batch is "upcoming" until its Last Rating is in, "past" afterwards.
  const upcoming = all.filter((b) => b.last == null);
  const past = all.filter((b) => b.last != null);

  return (
    <div className="flex flex-col gap-7">
      {!home && (
        <Link href="/teachers" className="rise -mb-3 inline-flex w-fit items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-3.5" /> All teachers
        </Link>
      )}

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Monogram name={name} src={profile?.imageUrl ?? null} size="lg" />
          <div>
            <p className="eyebrow mb-1.5">{teacher.code ?? 'Teacher'}</p>
            <h1 className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-lg font-bold sm:text-xl">
              {name}
              {profile && <Pill tone={profile.status === 'active' ? 'good' : 'warn'}>{profile.status === 'active' ? 'Active' : 'Inactive'}</Pill>}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13.5px] text-muted-foreground">
              {programs.map((p) => (
                <ProgramChip key={p.id} id={p.id} />
              ))}
              <span>·</span>
              <span>{branches.join(', ')}</span>
            </p>
          </div>
        </div>
        <ManageProfile teacher={teacher} />
      </header>

      <ProfileDetails teacher={teacher} />

      <RatingSummary teacher={id} interactive />
      <DashboardFilters lockedTeacher={id} />

      <RatingTabs
        upcoming={<TeacherClasses kind="upcoming" batches={all} />}
        past={<TeacherClasses kind="past" batches={all} />}
        upcomingCount={upcoming.length}
        pastCount={past.length}
        studentCount={view.length}
        opexCount={opex.length}
        programmeCount={programme.length}
        student={
          <>
      {view.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">No ratings match these filters. Try clearing one.</p>
      ) : (
        <>
          <SectionTitle title="Student rating" hint="Given by students on the paper forms, per batch." />
          <Kpis s={s} batches={view} cls={filters.cls} round={round} />
          <Detail batches={view} cls={filters.cls} showProgramTitles showTeacher={false} />
        </>
      )}

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
          </>
        }
        opex={<OpexPanel rows={opex} by="entries" />}
        programme={<OpexPanel team="programme" rows={programme} by="entries" />}
      />
    </div>
  );
}

/** The teacher's saved details, shown first on their page — before the rating cards. */
function ProfileDetails({ teacher }: { teacher: Teacher }) {
  const p = teacher.profile;
  const years = p?.yearsOfExperience;
  const fields: [string, string][] = [
    ['Designation', p?.designation ?? ''],
    ['Email', p?.email ?? ''],
    ['Phone', p?.phone ?? ''],
    ['Years of experience', years != null ? String(years) : ''],
    ['Address', p?.address ?? ''],
  ];
  return (
    <section className="rise card p-5 sm:p-6">
      <SectionTitle title="Profile" hint="Details kept by the program manager." />
      {p ? (
        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
              <dd className="mt-1 break-words text-sm text-foreground">{value || '—'}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">No details yet — add a designation, contact info, status and photo with <span className="font-medium text-foreground">Manage profile</span> (top right).</p>
      )}
    </section>
  );
}
