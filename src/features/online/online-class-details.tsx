'use client';
import type { ReactNode } from 'react';
import { CircleHelp, Clock, Eye, Images, MessagesSquare, Presentation, UserRoundPen, Users, UsersRound } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@tenminuteschool/design-system';
import { cn } from '@/lib/utils';
import { ONLINE_PROGRAMS, type OnlineClass } from './data';

/** Minutes → "01 h : 21 m : 00 s", like the class-recording page. */
const hms = (minutes: number) => {
  const total = Math.round(minutes * 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 3600))} h : ${pad(Math.floor((total % 3600) / 60))} m : ${pad(total % 60)} s`;
};

const day = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** One figure with a coloured left edge, as on the class-recording page. */
function Stat({ icon, value, label, accent, mono = false }: { icon: ReactNode; value: ReactNode; label: string; accent: string; mono?: boolean }) {
  return (
    <div className={cn('flex items-center gap-3 border-l-[3px] bg-background px-4 py-3', accent)}>
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className={cn('tabular text-[15px] font-semibold', mono && 'font-mono')}>{value}</div>
        <div className="text-[12px] text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

/** "View details" on a past class: the class-recording numbers — participants, duration, watch time, comments, doubts and ratings. */
export function OnlineClassDetails({ c }: { c: OnlineClass }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 whitespace-nowrap">
          View details
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="leading-snug">{c.topic}</DialogTitle>
          <DialogDescription className="flex flex-col gap-0.5">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 shrink-0 rounded-full" style={{ background: ONLINE_PROGRAMS[c.programme].color }} aria-hidden />
              {c.programName}
            </span>
            <span>
              {c.course} · {c.type} · {day(c.date)}, {c.time}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-xl border border-border">
          <div className="flex items-center gap-4 border-b border-border px-4 py-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-blue-500 text-white">
              <Users className="size-6" aria-hidden />
            </span>
            <div>
              <div className="tabular text-3xl font-semibold leading-none">{c.participants.toLocaleString('en-US')}</div>
              <div className="mt-1 text-[12.5px] text-muted-foreground">Total Participants</div>
            </div>
          </div>

          <div className="grid gap-px border-b border-border bg-border">
            <Stat mono icon={<Clock className="size-5 text-blue-500" />} value={hms(c.duration * 60)} label="Class Duration" accent="border-l-blue-500" />
            <Stat mono icon={<Eye className="size-5 text-violet-500" />} value={hms(c.watch)} label="Avg Watch Time" accent="border-l-violet-500" />
          </div>

          <div className="grid grid-cols-2 gap-px border-b border-border bg-border">
            <Stat icon={<MessagesSquare className="size-4 text-blue-500" />} value={c.comments.toLocaleString('en-US')} label="Total Comments" accent="border-l-blue-500" />
            <Stat icon={<CircleHelp className="size-4 text-rose-500" />} value={c.doubts} label="Total Doubts" accent="border-l-rose-500" />
            <Stat icon={<UsersRound className="size-4 text-cyan-500" />} value={c.uniqueCommenters.toLocaleString('en-US')} label="Unique Commenters" accent="border-l-cyan-500" />
            <Stat icon={<UserRoundPen className="size-4 text-amber-500" />} value={c.uniqueDoubters} label="Unique Doubters" accent="border-l-amber-500" />
          </div>

          <div className="px-4 pb-1 pt-3 text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">Ratings</div>
          <div className="divide-y divide-border">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="inline-flex items-center gap-2.5 font-medium">
                <Presentation className="size-4 text-muted-foreground" aria-hidden />
                Teaching Style
              </span>
              <span className="tabular text-lg font-semibold">{c.rating.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="inline-flex items-center gap-2.5 font-medium">
                <Images className="size-4 text-muted-foreground" aria-hidden />
                Class Slide
              </span>
              <span className="tabular text-lg font-semibold">{c.slideRating.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** From / To date inputs for the online pages — the offline DateRange, under a label like the other online filters. */
export function OnlineDateRange({ from, to, onFrom, onTo }: { from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void }) {
  return (
    <div className="grid gap-1.5" role="group" aria-label="Date range">
      <span className="text-sm font-medium leading-none">Date range</span>
      <div className="inline-flex flex-wrap items-center gap-1.5">
        <label className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground">
          From
          <input type="date" className="field h-9 w-auto font-medium" value={from} max={to || undefined} onChange={(e) => onFrom(e.target.value)} />
        </label>
        <label className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground">
          To
          <input type="date" className="field h-9 w-auto font-medium" value={to} min={from || undefined} onChange={(e) => onTo(e.target.value)} />
        </label>
      </div>
    </div>
  );
}
