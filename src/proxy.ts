import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, sessionValid } from '@/lib/auth';

/** Everything except the login page, its API and static assets needs a valid session. */
export async function proxy(request: NextRequest) {
  if (await sessionValid(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  const login = new URL('/login', request.url);
  if (pathname !== '/') login.searchParams.set('next', pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/((?!login|api/auth|_next/static|_next/image|logo\\.png|icon\\.png|favicon\\.ico).*)'],
};
