'use client';
import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { SessionUser } from '@/lib/auth';
import { TeacherProfile } from '@/features/teachers/teacher-profile';
import { OnlineTeacherProfile } from '@/features/online/online-teacher-profile';

/**
 * Where a signed-in teacher lands: only their own profile. Online teachers see their online
 * profile, offline teachers their offline profile, and teachers in both can switch between
 * the two. Everything else in the app is closed to them (see src/proxy.ts).
 */
export function TeacherHome({ user }: { user: SessionUser }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const raw = params.get('profile');
  const both = !!user.onlineId && !!user.offlineId;
  const active: 'online' | 'offline' = raw === 'offline' || (!both && user.offlineId && !user.onlineId) ? 'offline' : 'online';

  const go = (tab: 'online' | 'offline') => {
    const next = new URLSearchParams(params.toString());
    if (tab === 'online') next.delete('profile');
    else next.set('profile', tab);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-5">
      {both && (
        <div role="tablist" aria-label="My profiles" className="flex flex-wrap gap-1 border-b border-border">
          {(['online', 'offline'] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active === id}
              onClick={() => go(id)}
              className={cn('-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-[13.5px] font-medium transition-colors', active === id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}
            >
              {id === 'online' ? 'My online profile' : 'My offline profile'}
            </button>
          ))}
        </div>
      )}

      {active === 'online' && user.onlineId ? <OnlineTeacherProfile id={user.onlineId} home /> : null}
      {active === 'offline' && user.offlineId ? <TeacherProfile id={user.offlineId} home /> : null}
      {!user.onlineId && !user.offlineId && (
        <p className="py-20 text-center text-muted-foreground">This account is not linked to a teacher yet. Ask the program manager to assign you.</p>
      )}
    </div>
  );
}
