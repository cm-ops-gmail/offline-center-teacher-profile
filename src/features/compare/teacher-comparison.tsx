'use client';
import { useMemo, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Award, Building2, Info, Layers, ListChecks, Star, ThumbsDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@tenminuteschool/design-system';
import { SearchSelect } from '@/components/ui/search-select';
import { Monogram } from '@/components/ui/primitives';
import { batchRating } from '@/features/ratings/analytics';
import { PROGRAMS, PROGRAM_BY_ID } from '@/features/ratings/programs';
import type { BatchRecord, OpexRating, ProgramId } from '@/features/ratings/types';
import { Formula, Note, Title } from '@/features/dashboard/kpi-info';
import { fmt, plural } from '@/lib/format';
import { cn } from '@/lib/utils';
import { teacherStats, type TeacherStats } from './stats';

/** The two picked teachers live in the URL (?a=&b=) so a comparison can be shared as a link. */
function usePair() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const set = (key: 'a' | 'b', value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value === 'all') next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  return { a: params.get('a') ?? 'all', b: params.get('b') ?? 'all', set };
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const ratingsOf = (bs: BatchRecord[]) => bs.map(batchRating).filter((v): v is number => v !== null);
const tag = (b: BatchRecord) => `${PROGRAM_BY_ID[b.program].short} · ${b.branch} · ${b.batch}`;
const dot = (color: string) => <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />;

/** One number in the table, plus the explanation shown in its popover (worked out from THIS teacher's batches). */
interface Cell {
  text: ReactNode;
  value: number | null;
  /** Explanation for the popover under the value; omitted when there is nothing to explain. */
  info?: ReactNode;
}

interface Row {
  key: string;
  icon: typeof Star;
  label: string;
  cell: (s: TeacherStats, bs: BatchRecord[]) => Cell;
  /** Which way is "better", so the stronger teacher's cell can be marked. Omit for plain facts. */
  better?: 'higher' | 'lower';
}

/** "12 batches: IELTS 11, EF 1" style split, used by several popovers. */
function Split({ items }: { items: [string, number][] }) {
  return (
    <ul className="mt-1.5 space-y-1 text-[13px]">
      {items.map(([name, n]) => (
        <li key={name} className="flex items-center justify-between gap-3">
          <span>{name}</span>
          <strong className="tabular-nums">{n}</strong>
        </li>
      ))}
    </ul>
  );
}

const countBy = (bs: BatchRecord[], key: (b: BatchRecord) => string): [string, number][] => {
  const m = new Map<string, number>();
  for (const b of bs) m.set(key(b), (m.get(key(b)) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]);
};

/** The worked formula for an average of batch ratings: "sum ÷ n = result". */
function AverageInfo({ title, intro, values, note, unit = ['batch', 'batches'] }: { title: string; intro: ReactNode; values: number[]; note?: ReactNode; unit?: [string, string] }) {
  const total = sum(values);
  return (
    <div>
      <Title>{title}</Title>
      <p className="text-[13px] leading-snug">{intro}</p>
      <Formula>
        {total.toFixed(2)} ÷ {values.length} {values.length === 1 ? unit[0] : unit[1]} = {values.length ? fmt(total / values.length) : '—'}
      </Formula>
      {note && <Note>{note}</Note>}
    </div>
  );
}

/** A row for another team's average (OpEx / Programme team): their ratings of this teacher, added up and divided by how many there are. */
const teamRow = (key: string, label: string, who: string, unit: [string, string], rows: OpexRating[]): Row => ({
  key, icon: Star, label, better: 'higher',
  cell: (_s, bs) => {
    const mine = rows.filter((r) => r.teacherId === bs[0]?.teacherId);
    const values = mine.map((r) => r.avg);
    const avg = values.length ? sum(values) / values.length : null;
    return {
      text: avg === null ? '—' : (
        <span>
          <strong className="tabular-nums">{fmt(avg)}</strong>
          <span className="ml-1.5 text-xs text-muted-foreground">{plural(values.length, unit[0], unit[1])}</span>
        </span>
      ),
      value: avg,
      info: avg === null ? undefined : <AverageInfo title={label} intro={<>Every rating the {who} gave this teacher (within the date range and branch filters), added up and divided by how many there are.</>} values={values} unit={unit} />,
    };
  },
});

const OVERVIEW = (criterion: string, opex: OpexRating[], programme: OpexRating[]): Row[] => {
  const forCrit = criterion !== 'all' ? ` for “${criterion}”` : '';
  return [
    {
      key: 'programs', icon: Layers, label: 'Programmes',
      cell: (s, bs) => ({
        text: s.programs.length ? (
          <span className="flex flex-wrap justify-center gap-x-3 gap-y-1">
            {s.programs.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1.5">
                {dot(PROGRAM_BY_ID[p.id].color)}
                {PROGRAM_BY_ID[p.id].short} <strong className="tabular-nums">{p.batches}</strong>
              </span>
            ))}
          </span>
        ) : '—',
        value: null,
        info: (
          <div>
            <Title>Programmes {bs[0]?.teacherName ? `· ${bs[0].teacherName}` : ''}</Title>
            <p className="text-[13px] leading-snug">The programmes this teacher has batches in, and how many.</p>
            <Split items={s.programs.map((p) => [PROGRAM_BY_ID[p.id].label, p.batches])} />
          </div>
        ),
      }),
    },
    {
      key: 'branches', icon: Building2, label: 'Branches',
      cell: (s, bs) => ({
        text: s.branches.join(', ') || '—',
        value: null,
        info: (
          <div>
            <Title>Branches</Title>
            <p className="text-[13px] leading-snug">Where this teacher has batches, with the number of batches in each branch.</p>
            <Split items={countBy(bs, (b) => b.branch)} />
          </div>
        ),
      }),
    },
    {
      key: 'batches', icon: ListChecks, label: 'Batches',
      cell: (s, bs) => ({
        text: s.batches,
        value: null,
        info: (
          <div>
            <Title>{plural(s.batches, 'batch', 'batches')}</Title>
            <p className="text-[13px] leading-snug">A batch is this teacher’s batch (like A1) in one branch, in one programme. Its First and Last Rating together count as one.</p>
            <p className="eyebrow mt-3">By programme</p>
            <Split items={countBy(bs, (b) => PROGRAM_BY_ID[b.program].label)} />
          </div>
        ),
      }),
    },
    {
      key: 'rating', icon: Star, label: 'Average Rating', better: 'higher',
      cell: (s, bs) => ({
        text: fmt(s.rating),
        value: s.rating,
        info: <AverageInfo title="Average Rating" intro={<>Each batch’s rating{forCrit} is the average of its First and Last Rating. All of them are added up and divided by the number of batches.</>} values={ratingsOf(bs)} />,
      }),
    },
    teamRow('opex', 'Avg OpEx rating', 'OpEx team', ['rating', 'ratings'], opex),
    teamRow('programme', 'Avg Programme team rating', 'Programme team', ['observation', 'observations'], programme),
    {
      key: 'first', icon: Star, label: 'Avg First Rating', better: 'higher',
      cell: (s, bs) => ({
        text: fmt(s.avgFirst),
        value: s.avgFirst,
        info: <AverageInfo title="Average First Rating" intro={<>The First Ratings{forCrit} added up, divided by the number of batches that have one.</>} values={bs.flatMap((b) => (b.first ? [b.first.avg] : []))} />,
      }),
    },
    {
      key: 'last', icon: Star, label: 'Avg Last Rating', better: 'higher',
      cell: (s, bs) => ({
        text: fmt(s.avgLast),
        value: s.avgLast,
        info: (
          <AverageInfo
            title="Average Last Rating"
            intro={<>The Last Ratings{forCrit} added up, divided by the number of batches that have one.</>}
            values={bs.flatMap((b) => (b.last ? [b.last.avg] : []))}
            note={s.awaiting > 0 ? `${plural(s.awaiting, 'batch', 'batches')} still running (no Last Rating yet) ${s.awaiting === 1 ? 'is' : 'are'} left out.` : undefined}
          />
        ),
      }),
    },
    {
      key: 'best', icon: Award, label: 'Highest batch rating', better: 'higher',
      cell: (s, bs) => {
        const top = s.best ? bs.find((b) => tag(b) === s.best!.label && batchRating(b) === s.best!.rating) : undefined;
        return {
          text: s.best ? (
            <span>
              <strong className="tabular-nums">{fmt(s.best.rating)}</strong>
              <span className="block text-xs text-muted-foreground">{s.best.label}</span>
            </span>
          ) : '—',
          value: s.best?.rating ?? null,
          info: top ? <BatchInfo title="Highest batch rating" b={top} /> : undefined,
        };
      },
    },
    {
      key: 'worst', icon: ThumbsDown, label: 'Lowest batch rating', better: 'higher',
      cell: (s, bs) => {
        const low = s.worst ? bs.find((b) => tag(b) === s.worst!.label && batchRating(b) === s.worst!.rating) : undefined;
        return {
          text: s.worst ? (
            <span>
              <strong className="tabular-nums">{fmt(s.worst.rating)}</strong>
              <span className="block text-xs text-muted-foreground">{s.worst.label}</span>
            </span>
          ) : '—',
          value: s.worst?.rating ?? null,
          info: low ? <BatchInfo title="Lowest batch rating" b={low} note="A higher lowest rating means a steadier teacher." /> : undefined,
        };
      },
    },
  ];
};

function BatchInfo({ title, b, note }: { title: string; b: BatchRecord; note?: string }) {
  const both = b.first && b.last;
  return (
    <div>
      <Title>{title}</Title>
      <p className="text-[13px] leading-snug">{tag(b)}</p>
      <Formula>{both ? `(${fmt(b.first!.avg)} + ${fmt(b.last!.avg)}) ÷ 2 = ${fmt(batchRating(b))}` : `${fmt(batchRating(b))} (only a ${b.first ? 'First' : 'Last'} Rating so far)`}</Formula>
      <Note>{note ?? 'A batch’s rating is the average of its First and Last Rating.'}</Note>
    </div>
  );
}

/** Marks the stronger cell when the two values differ by more than rounding noise. */
function winner(a: number | null, b: number | null, better?: 'higher' | 'lower'): 'a' | 'b' | null {
  if (!better || a === null || b === null || Math.abs(a - b) < 0.005) return null;
  return (a > b) === (better === 'higher') ? 'a' : 'b';
}

function Value({ cell, label, who }: { cell: Cell; label: string; who: string }) {
  return (
    <span className="inline-flex items-center justify-center gap-1.5">
      {cell.text}
      {cell.info && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`How is “${label}” worked out for ${who}?`}
              className="grid size-5 shrink-0 place-items-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=open]:bg-muted data-[state=open]:text-foreground"
            >
              <Info size={13} />
            </button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="center" collisionPadding={12} className="max-h-[70vh] w-72 overflow-y-auto p-3.5">
            {cell.info}
          </PopoverContent>
        </Popover>
      )}
    </span>
  );
}

function Cells({ a, b, better, label, whoA, whoB }: { a: Cell | null; b: Cell | null; better?: 'higher' | 'lower'; label: string; whoA: string; whoB: string }) {
  const w = winner(a?.value ?? null, b?.value ?? null, better);
  const cls = (side: 'a' | 'b') => cn('px-3 py-3 text-center align-middle tabular-nums', w === side && 'bg-[color-mix(in_oklab,var(--good)_11%,transparent)] font-bold');
  const dash = <span className="text-muted-foreground">—</span>;
  return (
    <>
      <td className={cls('a')}>{a ? <Value cell={a} label={label} who={whoA} /> : dash}</td>
      <td className={cls('b')}>{b ? <Value cell={b} label={label} who={whoB} /> : dash}</td>
    </>
  );
}

function Section({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <tr>
      <td colSpan={3} className="border-y border-border bg-muted/50 px-3 py-2">
        <span className="eyebrow inline-flex items-center gap-2">
          {color && dot(color)}
          {children}
        </span>
      </td>
    </tr>
  );
}

function Head({ id, batches }: { id: string; batches: BatchRecord[] }) {
  const mine = batches.find((b) => b.teacherId === id);
  if (!mine) return <span className="text-sm font-normal text-muted-foreground">Pick a teacher</span>;
  return (
    <span className="flex flex-col items-center gap-2">
      <Monogram name={mine.teacherName} size="lg" />
      <span className="text-sm font-semibold">{mine.teacherName}</span>
    </span>
  );
}

/** Two teachers side by side: student, OpEx and Programme team ratings, programmes and batches. Each value explains itself in a popover. */
export function TeacherComparison({ batches, criterion = 'all', opex = [], programme = [] }: { batches: BatchRecord[]; criterion?: string; opex?: OpexRating[]; programme?: OpexRating[] }) {
  const { a, b, set } = usePair();

  const teachers = useMemo(() => {
    const map = new Map<string, string>();
    for (const x of batches) map.set(x.teacherId, x.teacherName);
    return [...map].sort((p, q) => p[1].localeCompare(q[1])).map(([value, label]) => ({ value, label }));
  }, [batches]);

  const bsA = useMemo(() => (a !== 'all' ? batches.filter((x) => x.teacherId === a) : []), [batches, a]);
  const bsB = useMemo(() => (b !== 'all' ? batches.filter((x) => x.teacherId === b) : []), [batches, b]);
  const statsA = useMemo(() => (bsA.length ? teacherStats(bsA, criterion) : null), [bsA, criterion]);
  const statsB = useMemo(() => (bsB.length ? teacherStats(bsB, criterion) : null), [bsB, criterion]);
  const whoA = bsA[0]?.teacherName ?? '';
  const whoB = bsB[0]?.teacherName ?? '';

  const programIds = PROGRAMS.map((p) => p.id).filter((id) => statsA?.byProgram[id] || statsB?.byProgram[id]);
  const chosen = statsA || statsB;
  const rows = useMemo(() => OVERVIEW(criterion, opex, programme), [criterion, opex, programme]);
  const subtitle = `Select two teachers to compare their ratings side by side.${criterion !== 'all' ? ` Showing “${criterion}” only.` : ''}`;

  return (
    <section className="card p-4 sm:p-5">
      {/* With nothing picked yet there is no table to carry the title, so it sits above the pickers. */}
      {!chosen && (
        <div className="mb-4">
          <h2 className="text-base font-bold">Teacher Comparison</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <SearchSelect label="First teacher" value={a} onChange={(v) => set('a', v)} allLabel="Select first teacher" searchPlaceholder="Search teachers…" options={teachers.filter((t) => t.value !== b)} dropdownWidth="w-[26rem]" />
        <SearchSelect label="Second teacher" value={b} onChange={(v) => set('b', v)} allLabel="Select second teacher" searchPlaceholder="Search teachers…" options={teachers.filter((t) => t.value !== a)} dropdownWidth="w-[26rem]" />
      </div>

      {!chosen ? (
        <p className="mt-5 rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">Pick two teachers above to see how they compare.</p>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[560px] border-collapse text-[14px]">
            <thead>
              <tr>
                <th className="w-[34%] px-4 py-4 text-left align-middle">
                  <span className="block text-base font-bold text-foreground">Teacher Comparison</span>
                  <span className="mt-0.5 block text-xs font-normal leading-snug text-muted-foreground">{subtitle}</span>
                </th>
                <th className="px-3 py-4 text-center">
                  <Head id={a} batches={batches} />
                </th>
                <th className="px-3 py-4 text-center">
                  <Head id={b} batches={batches} />
                </th>
              </tr>
            </thead>
            <tbody>
              <Section>Overview</Section>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-border/60">
                  <td className="px-3 py-3">
                    <span className="flex items-center gap-2.5 font-medium">
                      <r.icon className="size-4 shrink-0 text-muted-foreground" />
                      {r.label}
                    </span>
                  </td>
                  <Cells a={statsA ? r.cell(statsA, bsA) : null} b={statsB ? r.cell(statsB, bsB) : null} better={r.better} label={r.label} whoA={whoA} whoB={whoB} />
                </tr>
              ))}

              {programIds.length > 0 && <Section>Average Rating by programme</Section>}
              {programIds.map((id) => {
                const cell = (s: TeacherStats | null, bs: BatchRecord[]): Cell | null => {
                  const v = s?.byProgram[id];
                  if (!v) return null;
                  const mine = bs.filter((x) => x.program === id);
                  return {
                    text: (
                      <span>
                        <strong className="tabular-nums">{fmt(v.rating)}</strong>
                        <span className="ml-1.5 text-xs text-muted-foreground">{plural(v.batches, 'batch', 'batches')}</span>
                      </span>
                    ),
                    value: v.rating,
                    info: <AverageInfo title={`${PROGRAM_BY_ID[id].label} · Average Rating`} intro={<>Each {PROGRAM_BY_ID[id].short} batch’s rating is the average of its First and Last Rating; they’re added up and divided by the number of batches.</>} values={ratingsOf(mine)} />,
                  };
                };
                return (
                  <tr key={id} className="border-b border-border/60">
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-2.5 font-medium">
                        {dot(PROGRAM_BY_ID[id].color)}
                        {PROGRAM_BY_ID[id].label}
                      </span>
                    </td>
                    <Cells a={cell(statsA, bsA)} b={cell(statsB, bsB)} better="higher" label={`${PROGRAM_BY_ID[id].label} Average Rating`} whoA={whoA} whoB={whoB} />
                  </tr>
                );
              })}

            </tbody>
          </table>
        </div>
      )}
      {chosen && <p className="mt-3 text-xs text-muted-foreground">The stronger score in each row is shaded green. Tap the small “i” beside a value to see how it was worked out. Every number follows the filters above.</p>}
    </section>
  );
}
