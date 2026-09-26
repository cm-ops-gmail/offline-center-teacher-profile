'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ScanLine } from 'lucide-react';
import { NAV, type NavItem } from '@/lib/nav';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './theme-toggle';
import { SyncStatus } from './sync-status';
import { LogoutButton } from './logout-button';

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');
}

function Item({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition', active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}
    >
      {item.dot ? (
        <span className="grid size-4 place-items-center">
          <span className="size-2.5 rounded-full" style={{ background: item.dot }} />
        </span>
      ) : (
        Icon && <Icon size={16} />
      )}
      <span className="flex-1 truncate text-left">{item.label}</span>
    </Link>
  );
}

/**
 * Always-on from lg up, a sliding drawer on phones — as in the TA & Per-Diem system.
 * Inside HQ it is the flat secondary nav, pinned open.
 */
export function Sidebar({ embedded, open, onClose }: { embedded: boolean; open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const collect = NAV.flatMap((g) => g.items).find((i) => i.href === '/collect');
  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((i) => i.href !== '/collect') })).filter((g) => g.items.length > 0);
  const top = embedded ? 'top-12' : 'top-14';

  return (
    <>
      <aside
        className={cn(
          'fixed bottom-0 left-0 z-50 flex w-72 max-w-[85vw] shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200',
          'lg:sticky lg:inset-auto lg:z-30 lg:w-64 lg:max-w-none lg:translate-x-0 lg:self-start',
          top,
          embedded ? 'lg:top-0 lg:h-dvh' : 'lg:top-14 lg:h-[calc(100dvh-3.5rem)]',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {collect && (
          <div className="border-b border-sidebar-border p-3">
            <Link
              href={collect.href}
              aria-current={isActive(pathname, collect.href) ? 'page' : undefined}
              className={cn('flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-[0.98]', isActive(pathname, collect.href) && 'ring-2 ring-ring ring-offset-2 ring-offset-sidebar')}
            >
              <ScanLine size={16} /> Upload forms
            </Link>
          </div>
        )}

        <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3" aria-label="Main">
          {groups.map((group) => (
            <div key={group.category} className="space-y-1">
              <p className="px-1 pb-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">{group.category}</p>
              {group.items.map((item) => (
                <Item key={item.href} item={item} active={isActive(pathname, item.href)} />
              ))}
            </div>
          ))}
        </nav>

        {embedded && (
          <div className="flex items-center justify-between border-t border-sidebar-border p-3">
            <SyncStatus />
            <span className="flex items-center">
              <ThemeToggle />
              <LogoutButton />
            </span>
          </div>
        )}
      </aside>

      {open && <div className={cn('fixed inset-x-0 bottom-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden', top)} onClick={onClose} aria-hidden />}
    </>
  );
}
