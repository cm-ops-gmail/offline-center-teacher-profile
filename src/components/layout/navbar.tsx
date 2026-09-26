'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { APP_NAME, NAV } from '@/lib/nav';
import { ThemeToggle } from './theme-toggle';
import { SyncStatus } from './sync-status';

function currentLabel(pathname: string): string {
  const items = NAV.flatMap((g) => g.items);
  const hit = items.filter((i) => (i.href === '/' ? pathname === '/' : pathname === i.href || pathname.startsWith(i.href + '/'))).sort((a, b) => b.href.length - a.href.length)[0];
  return hit?.label ?? '';
}

/** Sticky, blurred, one row — the same header as the TA & Per-Diem system. Inside HQ only a slim menu bar shows on phones. */
export function Header({ embedded, onMenu }: { embedded: boolean; onMenu: () => void }) {
  const pathname = usePathname();

  if (embedded) {
    return (
      <header className="sticky top-0 z-40 flex h-12 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur lg:hidden">
        <button type="button" onClick={onMenu} aria-label="Open menu" className="-ml-1 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <Menu size={20} />
        </button>
        <span className="text-sm font-semibold tracking-tight">{APP_NAME}</span>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-3 backdrop-blur sm:px-4 lg:px-8">
      <button type="button" onClick={onMenu} aria-label="Open menu" className="-ml-1 shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden">
        <Menu size={20} />
      </button>

      <Link href="/" className="flex shrink-0 items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="10 Minute School" width={32} height={32} className="size-8 shrink-0 rounded-lg object-contain" />
        <span className="hidden text-sm font-semibold tracking-tight sm:inline">{APP_NAME}</span>
      </Link>

      <div aria-hidden className="hidden h-5 w-px shrink-0 bg-border sm:block" />

      <div className="min-w-0 flex-1">
        <span className="hidden truncate text-sm font-semibold tracking-tight text-muted-foreground sm:inline">{currentLabel(pathname)}</span>
      </div>

      <SyncStatus />
      <ThemeToggle />
    </header>
  );
}
