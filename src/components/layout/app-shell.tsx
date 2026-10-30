'use client';
import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { RatingsProvider } from '@/features/ratings/filters';
import { useIsEmbedded } from '@/lib/embedded';
import type { SessionUser } from '@/lib/auth';
import { Header } from './navbar';
import { Sidebar } from './sidebar';

/**
 * Same frame as the TA & Per-Diem system: header on top, sidebar left, content directly on the grey page.
 * A signed-in teacher gets no menu at all — only their own profile (see /me).
 */
export function AppShell({ children, user }: { children: ReactNode; user?: SessionUser | null }) {
  const embedded = useIsEmbedded();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  useEffect(() => setMenuOpen(false), [pathname]);

  const teacher = user?.kind === 'teacher';

  // The program manager's "hide the menu" choice is remembered between visits.
  useEffect(() => {
    if (teacher) return;
    try {
      setCollapsed(localStorage.getItem('sidebar-collapsed') === '1');
    } catch {}
  }, [teacher]);
  useEffect(() => {
    if (teacher) return;
    try {
      localStorage.setItem('sidebar-collapsed', collapsed ? '1' : '0');
    } catch {}
  }, [collapsed, teacher]);

  return (
    <Suspense>
      <RatingsProvider>
        <div className="flex min-h-dvh flex-col">
          <Header embedded={embedded} onMenu={() => setMenuOpen(true)} sidebarCollapsed={collapsed} onToggleSidebar={() => setCollapsed((c) => !c)} user={user} />
          <div className="flex min-h-0 flex-1">
            {!teacher && (
              <Sidebar
                embedded={embedded}
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                collapsed={collapsed}
                onCollapse={() => setCollapsed(true)}
                onExpand={() => setCollapsed(false)}
              />
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              <main className="mx-auto w-full max-w-6xl flex-1 p-3 sm:p-4 lg:p-8">{children}</main>
            </div>
          </div>
        </div>
      </RatingsProvider>
    </Suspense>
  );
}
