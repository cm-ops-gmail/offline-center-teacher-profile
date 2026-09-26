'use client';
import useSWR from 'swr';
import type { RatingsPayload } from './types';

const fetcher = async (url: string): Promise<RatingsPayload> => {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Could not load ratings');
  return json;
};

export function useRatings() {
  const swr = useSWR<RatingsPayload>('/api/ratings', fetcher, { revalidateOnFocus: false, dedupingInterval: 60_000 });
  /** Bypass the server cache and re-read the sheet. */
  const refresh = () => swr.mutate(fetcher('/api/ratings?refresh=1'), { revalidate: false });
  return { ...swr, refresh };
}
