import { NextResponse } from 'next/server';
import { SESSION_COOKIE, SESSION_SECONDS, cookieOptions, createSession, lookupLogin, safeNext } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { username?: unknown; password?: unknown; next?: unknown };
  const user = lookupLogin(String(body.username ?? ''), String(body.password ?? ''));
  if (!user) {
    await new Promise((r) => setTimeout(r, 600)); // slows down guessing
    return NextResponse.json({ error: 'Wrong username or password.' }, { status: 401 });
  }
  // Teachers land on their own profile; the program manager goes back to the page they asked for (or the overview).
  const redirect = user.kind === 'teacher' ? '/me' : safeNext(typeof body.next === 'string' ? body.next : null);
  const res = NextResponse.json({ ok: true, redirect });
  res.cookies.set(SESSION_COOKIE, await createSession(user), cookieOptions(SESSION_SECONDS));
  return res;
}
