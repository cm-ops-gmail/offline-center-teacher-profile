import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, readSession, type SessionUser } from '@/lib/auth';

/** A teacher may only touch their own profile: /me, the shared ratings read, and saving their own offline profile. */
function teacherAllowed(user: SessionUser, pathname: string): boolean {
  if (pathname === '/me' || pathname === '/api/ratings' || pathname === '/api/auth/logout') return true;
  if (user.offlineId && pathname === `/api/teachers/${user.offlineId}`) return true;
  return false;
}

/** Everything except the login page, its API and static assets needs a valid session. Teachers stay inside their own profile. */
export async function proxy(request: NextRequest) {
  const user = await readSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (user) {
    if (user.kind === 'teacher' && !teacherAllowed(user, request.nextUrl.pathname)) {
      if (request.nextUrl.pathname.startsWith('/api/')) return NextResponse.json({ error: 'Teachers can only view their own profile.' }, { status: 403 });
      return NextResponse.redirect(new URL('/me', request.url));
    }
    return NextResponse.next();
  }

  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  const login = new URL('/login', request.url);
  if (pathname !== '/') login.searchParams.set('next', pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/((?!login|api/auth|_next/static|_next/image|logo\\.png|icon\\.png|favicon\\.ico).*)'],
};
