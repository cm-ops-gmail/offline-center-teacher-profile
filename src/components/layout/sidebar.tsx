'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { APP_NAME, NAV, type NavItem } from '@/lib/nav';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './theme-toggle';
import { SyncStatus } from './sync-status';
import { LogoutButton } from './logout-button';

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');
}

const rowClass = (active: boolean) =>
  cn('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition', active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground');

function Item({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} aria-current={active ? 'page' : undefined} className={rowClass(active)}>
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

/** A row that opens a sub-menu (Collect → the rating screens). Starts open when one of them is showing. */
function CollapsibleItem({ item, pathname }: { item: NavItem; pathname: string }) {
  const childActive = (item.children ?? []).some((c) => isActive(pathname, c.href));
  const [open, setOpen] = useState(childActive);
  const Icon = item.icon;
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={cn(rowClass(false), childActive && 'text-foreground')}>
        {Icon && <Icon size={16} />}
        <span className="flex-1 truncate text-left">{item.label}</span>
        <ChevronDown size={15} className={cn('shrink-0 text-muted-foreground/70 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div className="mt-1 space-y-1 pl-7">
          {(item.children ?? []).map((child) => (
            <Item key={child.href} item={child} active={isActive(pathname, child.href)} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Always-on from lg up, a sliding drawer on phones — as in the TA & Per-Diem system.
 * Inside HQ it is the flat secondary nav, pinned open. The program manager can hide
 * the whole menu with the collapse button (and bring it back with the floating one).
 */
export function Sidebar({
  embedded,
  open,
  onClose,
  collapsed,
  onCollapse,
  onExpand,
}: {
  embedded: boolean;
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onCollapse: () => void;
  onExpand: () => void;
}) {
  const pathname = usePathname();
  const top = embedded ? 'top-12' : 'top-14';

  return (
    <>
      <aside
        className={cn(
          'fixed bottom-0 left-0 z-50 flex w-72 max-w-[85vw] shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200',
          'lg:sticky lg:inset-auto lg:z-30 lg:w-64 lg:max-w-none lg:translate-x-0 lg:self-start',
          top,
          embedded ? 'lg:top-0 lg:h-dvh' : 'lg:top-14 lg:h-[calc(100dvh-3.5rem)]',
          collapsed && 'lg:hidden', // only the desktop rail hides; the phone drawer keeps working
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-3.5">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" width={24} height={24} className="size-6 shrink-0 rounded-md object-contain" />
            <span className="truncate text-sm font-bold tracking-tight text-foreground">{APP_NAME}</span>
          </Link>
          <button
            type="button"
            onClick={onCollapse}
            aria-label="Hide menu"
            title="Hide menu"
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <PanelLeftClose size={16} />
          </button>
        </div>

        <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3" aria-label="Main">
          {NAV.map((group) => (
            <div key={group.category} className="space-y-1">
              <p className="px-1 pb-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">{group.category}</p>
              {group.items.map((item) =>
                item.children ? <CollapsibleItem key={item.label} item={item} pathname={pathname} /> : <Item key={item.href} item={item} active={isActive(pathname, item.href)} />,
              )}
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

      {collapsed && (
        <button
          type="button"
          onClick={onExpand}
          aria-label="Show menu"
          title="Show menu"
          className={cn('fixed left-2 z-30 hidden size-9 place-items-center rounded-lg border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground lg:grid', embedded ? 'top-2' : 'top-16')}
        >
          <PanelLeftOpen size={18} />
        </button>
      )}

      {open && <div className={cn('fixed inset-x-0 bottom-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden', top)} onClick={onClose} aria-hidden />}
    </>
  );
}
