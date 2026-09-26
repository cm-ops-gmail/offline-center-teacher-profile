'use client';
import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@tenminuteschool/design-system';
import { useRatingsData } from '@/features/ratings/filters';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';

export function SyncStatus({ className }: { className?: string }) {
  const { data, isValidating, refresh, error } = useRatingsData();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className={cn('flex items-center gap-2 text-xs text-muted-foreground', className)}>
      <span className="hidden sm:inline" aria-live="polite">
        {error && !data ? 'Not connected' : data ? `Synced ${timeAgo(data.syncedAt, now)}` : 'Connecting…'}
      </span>
      <Button variant="outline" size="sm" onClick={() => refresh()} disabled={isValidating} className="h-8 gap-1.5">
        <RefreshCw className={cn('size-3.5', isValidating && 'animate-spin')} />
        <span>{isValidating ? 'Syncing' : 'Refresh'}</span>
      </Button>
    </div>
  );
}
