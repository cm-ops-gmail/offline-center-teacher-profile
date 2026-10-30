'use client';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@tenminuteschool/design-system';
import { Monogram, Pill, SectionTitle } from '@/components/ui/primitives';
import { OnlineCards } from './online-cards';
import { OnlineClasses, OnlineChip } from './online-classes';
import { ManageOnlineProfile } from './manage-online-profile';
import { useOnlineTeachers, type OnlineTeacher } from './data';
import { cn } from '@/lib/utils';

export function OnlineTeacherProfile({ id }: { id: string }) {
  const teachers = useOnlineTeachers();
  const teacher = teachers.find((t) => t.id === id);
  if (!teacher) return <NotFound />;
  return <Body teacher={teacher} />;
}

function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <h1 className="text-lg font-bold">We couldn’t find that online teacher</h1>
      <Button asChild>
        <Link href="/online/teachers">Back to online teachers</Link>
      </Button>
    </div>
  );
}

/** Upcoming classes | Past classes — in the URL as `?class=past` so a tab can be shared. */
function ClassTabs({ teacher }: { teacher: OnlineTeacher }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const active = params.get('class') === 'past' ? 'past' : 'upcoming';

  const go = (tab: 'upcoming' | 'past') => {
    const next = new URLSearchParams(params.toString());
    if (tab === 'upcoming') next.delete('class');
    else next.set('class', tab);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const tabs: { id: 'upcoming' | 'past'; label: string; count: number }[] = [
    { id: 'upcoming', label: 'Upcoming classes', count: teacher.upcoming.length },
    { id: 'past', label: 'Past classes', count: teacher.past.length },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" aria-label="Teacher view" className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            onClick={() => go(t.id)}
            className={cn('-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-[13.5px] font-medium transition-colors', active === t.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}
          >
            {t.label}
            <span className="tabular rounded-full bg-muted px-2 py-0.5 text-[11.5px] font-semibold">{t.count}</span>
          </button>
        ))}
      </div>
      <OnlineClasses key={active} kind={active} classes={active === 'upcoming' ? teacher.upcoming : teacher.past} />
    </div>
  );
}

function Body({ teacher }: { teacher: OnlineTeacher }) {
  const fields: [string, string][] = [
    ['Designation', teacher.designation],
    ['Email', teacher.email],
    ['Phone', teacher.phone],
    ['Years of experience', String(teacher.yearsOfExperience)],
    ['Address', teacher.address],
  ];

  return (
    <div className="flex flex-col gap-7">
      <Link href="/online/teachers" className="rise -mb-3 inline-flex w-fit items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-3.5" /> All online teachers
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Monogram name={teacher.name} src={teacher.photo} size="lg" />
          <div>
            <p className="eyebrow mb-1.5">Online teacher</p>
            <h1 className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-lg font-bold sm:text-xl">
              {teacher.name}
              <Pill tone={teacher.status === 'active' ? 'good' : 'warn'}>{teacher.status === 'active' ? 'Active' : 'Inactive'}</Pill>
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13.5px] text-muted-foreground">
              {teacher.programmes.map((p) => (
                <OnlineChip key={p} id={p} />
              ))}
            </p>
          </div>
        </div>
        <ManageOnlineProfile teacher={teacher} />
      </header>

      <section className="rise card p-5 sm:p-6">
        <SectionTitle title="Profile" hint="Details kept by the program manager." />
        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
              <dd className="mt-1 break-words text-sm text-foreground">{value || '—'}</dd>
            </div>
          ))}
        </dl>
      </section>

      <OnlineCards teachers={[teacher]} />
      <ClassTabs teacher={teacher} />
    </div>
  );
}
