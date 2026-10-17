'use client';
import { DataGate } from '@/components/ui/data-gate';
import { PageHeader } from '@/components/ui/primitives';
import { DashboardFilters } from '@/features/programs/dashboard-filters';
import { useRatingsData } from '@/features/ratings/filters';
import { TeacherComparison } from './teacher-comparison';

export function ComparePage() {
  return <DataGate>{() => <Body />}</DataGate>;
}

function Body() {
  const { filtered, filters, opexView, programmeView } = useRatingsData();
  // Teacher and Batch filters are ignored here: this screen picks its own two teachers.
  const batches = filtered({ skip: ['teacher', 'batch'] });
  return (
    <div className="flex flex-col gap-7">
      <PageHeader eyebrow="Insights" title="Compare teachers" description="Pick two teachers and see their Student, OpEx and Programme team ratings, programmes and batches side by side. The filters narrow both teachers the same way." />
      <DashboardFilters hide={['teacher', 'batch']} />
      <TeacherComparison batches={batches} criterion={filters.criterion} opex={opexView({ teacher: 'all' })} programme={programmeView({ teacher: 'all' })} />
    </div>
  );
}
