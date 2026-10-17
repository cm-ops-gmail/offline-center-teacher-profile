'use client';
import { AlertCircle, CheckCircle2, ExternalLink, Info, RefreshCw } from 'lucide-react';
import { Button } from '@tenminuteschool/design-system';
import { DataGate } from '@/components/ui/data-gate';
import { PageHeader, Pill, ProgramChip, SectionTitle } from '@/components/ui/primitives';
import { useRatingsData } from '@/features/ratings/filters';
import type { DataIssue } from '@/features/ratings/types';
import { cn } from '@/lib/utils';

export function DataHealthPage() {
  return <DataGate>{(data) => <Body issues={data.issues} />}</DataGate>;
}

const NEEDS_LOOK: DataIssue['kind'][] = ['possible-duplicate-teacher', 'code-conflict', 'missing-branch', 'duplicate-rating', 'no-scores'];

function Body({ issues }: { issues: DataIssue[] }) {
  const { data, refresh, isValidating } = useRatingsData();
  if (!data) return null;
  const review = issues.filter((i) => NEEDS_LOOK.includes(i.kind));
  const info = issues.filter((i) => !NEEDS_LOOK.includes(i.kind));

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Source"
        title="Data"
        emphasis="health"
        description="What the dashboard read from the database, what it tidied up on the way, and what is worth a second look in the data itself."
        actions={
          <>
            <Button variant="outline" onClick={() => refresh()} disabled={isValidating} className="gap-2">
              <RefreshCw className={cn('size-4', isValidating && 'animate-spin')} /> Re-read data
            </Button>
            <Button asChild>
              <a href={data.sheetUrl} target="_blank" rel="noreferrer" className="gap-2">
                Open database <ExternalLink className="size-4" />
              </a>
            </Button>
          </>
        }
      />

      <section className="rise card p-5 sm:p-6">
        <SectionTitle title="Programmes read" hint={<>“{data.sheetTitle}” · synced {new Date(data.syncedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</>} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-[13.5px]">
            <thead className="text-left text-[12px] text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-3 font-medium">Programme</th>
                <th className="py-2 pr-3 font-medium">Source</th>
                <th className="py-2 pr-3 text-right font-medium">Rating rows</th>
                <th className="py-2 pr-3 text-right font-medium">Batches</th>
                <th className="py-2 text-right font-medium">Teachers</th>
              </tr>
            </thead>
            <tbody>
              {data.tabs.map((t) => (
                <tr key={t.program} className="border-b border-border/60 last:border-0">
                  <td className="py-2.5 pr-3">
                    <ProgramChip id={t.program} className="font-medium" />
                  </td>
                  <td className="py-2.5 pr-3 font-mono text-[12.5px] text-muted-foreground">{t.tab}</td>
                  <td className="tabular py-2.5 pr-3 text-right">{t.rowsRead}</td>
                  <td className="tabular py-2.5 pr-3 text-right">{t.batches}</td>
                  <td className="tabular py-2.5 text-right">{t.teachers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rise card p-5 sm:p-6">
        <SectionTitle title="Worth a look in the data" right={review.length ? <Pill tone="warn">{review.length}</Pill> : undefined} />
        {review.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-good" /> Nothing to fix — the data is consistent.
          </p>
        ) : (
          <ul className="flex flex-col">
            {review.map((i, k) => (
              <li key={k} className="flex items-start gap-3 border-b border-border/60 py-3 text-[13.5px] last:border-0">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-[color:var(--warning)]" />
                <span className="flex-1">{i.message}</span>
                {i.program && <ProgramChip id={i.program} className="text-[12px]" />}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rise card p-5 sm:p-6">
        <SectionTitle title="Tidied automatically" />
        <ul className="flex flex-col">
          {info.map((i, k) => (
            <li key={k} className="flex items-start gap-3 border-b border-border/60 py-3 text-[13.5px] last:border-0">
              <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span className="flex-1">{i.message}</span>
              {i.program && <ProgramChip id={i.program} className="text-[12px]" />}
            </li>
          ))}
        </ul>
      </section>

      <section className="rise card bg-muted/40 p-5 sm:p-6">
        <SectionTitle title="How the numbers are made" />
        <ul className="list-disc space-y-2 pl-5 text-[13.5px] leading-relaxed text-muted-foreground marker:text-gold">
          <li>
            A <strong className="font-medium text-foreground">batch</strong> is one teacher in one branch and batch code (and level, for SEJ). Its <em>First Rating</em> and <em>Last Rating</em> rows are paired.
          </li>
          <li>
            <strong className="font-medium text-foreground">Average Rating</strong> is the main number: each batch’s rating is the average of its First and Last Rating (just the one, if only one exists yet); the Average Rating adds up every batch’s rating and divides by the number of batches. <strong className="font-medium text-foreground">Change</strong> is last minus first, only where a batch has both.
          </li>
          <li>
            Teachers are matched by name with the staff-code prefix removed, so “LCI019 - Rifah Salsabil” and “Rifah Salsabil” are the same person.
          </li>
          <li>The data is read live and cached for one minute; “Refresh” always re-reads it.</li>
        </ul>
      </section>
    </div>
  );
}
