import { cookies } from 'next/headers';
import { AppShell } from '@/components/layout/app-shell';
import { SESSION_COOKIE, readSession } from '@/lib/auth';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  return <AppShell user={user}>{children}</AppShell>;
}
