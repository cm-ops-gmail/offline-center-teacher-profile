import { NextResponse } from 'next/server';
import { SESSION_COOKIE, SESSION_SECONDS, cookieOptions, createSession, credentialsOk } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { username?: unknown; password?: unknown };
  const ok = credentialsOk(String(body.username ?? ''), String(body.password ?? ''));
  if (!ok) {
    await new Promise((r) => setTimeout(r, 600)); // slows down guessing
    return NextResponse.json({ error: 'Wrong username or password.' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSession(), cookieOptions(SESSION_SECONDS));
  return res;
}
