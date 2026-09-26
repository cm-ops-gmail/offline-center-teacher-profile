'use client';
import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@tenminuteschool/design-system';
import { useRatingsData } from '@/features/ratings/filters';
import type { RatingsPayload } from '@/features/ratings/types';
import { Skeleton } from './primitives';

/** Shows a skeleton while the sheet loads and a helpful error if it can't be read; otherwise renders children with the data. */
export function DataGate({ children }: { children: (data: RatingsPayload) => ReactNode }) {
  const { data, error, isLoading, refresh } = useRatingsData();

  if (data) return <>{children(data)}</>;

  if (error) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-20 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-muted text-critical">
          <AlertTriangle className="size-5" />
        </span>
        <div>
          <h2 className="text-base font-bold">We couldn’t read the sheet</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{error.message}</p>
        </div>
        <Button onClick={() => refresh()}>Try again</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" aria-busy={isLoading}>
      <Skeleton className="h-14 w-2/3" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-36" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}
