'use client';
import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { RatingsProvider } from '@/features/ratings/filters';
import { useIsEmbedded } from '@/lib/embedded';
import { Header } from './navbar';
import { Sidebar } from './sidebar';

/** Same frame as the TA & Per-Diem system: header on top, sidebar left, content directly on the grey page. */
export function AppShell({ children }: { children: ReactNode }) {
  const embedded = useIsEmbedded();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <Suspense>
      <RatingsProvider>
        <div className="flex min-h-dvh flex-col">
          <Header embedded={embedded} onMenu={() => setMenuOpen(true)} />
          <div className="flex min-h-0 flex-1">
            <Sidebar embedded={embedded} open={menuOpen} onClose={() => setMenuOpen(false)} />
            <div className="flex min-w-0 flex-1 flex-col">
              <main className="mx-auto w-full max-w-6xl flex-1 p-3 sm:p-4 lg:p-8">{children}</main>
            </div>
          </div>
        </div>
      </RatingsProvider>
    </Suspense>
  );
}
