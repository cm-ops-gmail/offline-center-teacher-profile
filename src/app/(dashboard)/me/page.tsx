import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, readSession } from '@/lib/auth';
import { TeacherHome } from '@/features/me/teacher-home';

export const dynamic = 'force-dynamic';

/** A teacher's own page. The program manager never lands here (login sends them to the overview). */
export default async function Page() {
  const user = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!user) redirect('/login?next=/me');
  if (user.kind !== 'teacher') redirect('/');
  return <TeacherHome user={user} />;
}
