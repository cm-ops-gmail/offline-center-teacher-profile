/**
 * Hard-coded logins for now: the program manager (admin) and three demo teacher
 * accounts. Later the mail-auth role SDK will replace this — until then the
 * accounts below decide who sees what. The session cookie is a signed payload,
 * so it cannot be forged without the server secret. Uses Web Crypto only, so
 * it runs in the proxy as well as in route handlers.
 */
export const LOGIN_USER = 'admin';
export const LOGIN_PASSWORD = '654321';

export const SESSION_COOKIE = 'tp_session';
export const SESSION_SECONDS = 60 * 60 * 24 * 7;

/** Who is signed in. Teachers only ever see their own profile(s). */
export interface SessionUser {
  kind: 'admin' | 'teacher';
  name: string;
  /** The teacher's id in the online demo data (null when they teach offline only). */
  onlineId: string | null;
  /** The teacher's id in the offline ratings data (null when they teach online only). */
  offlineId: string | null;
}

const ADMIN: SessionUser = { kind: 'admin', name: 'Program manager', onlineId: null, offlineId: null };

/** The three demo teacher logins (password 1234). onlineId / offlineId decide what they see. */
export const TEACHER_LOGINS: Record<string, { password: string; user: SessionUser }> = {
  nusrat: { password: '1234', user: { kind: 'teacher', name: 'Nusrat Jahan', onlineId: 'nusrat-jahan', offlineId: null } },
  sirazum: { password: '1234', user: { kind: 'teacher', name: 'Sirazum Munira', onlineId: null, offlineId: 'sirazum-munira' } },
  adiba: { password: '1234', user: { kind: 'teacher', name: 'Adiba Nawrin', onlineId: 'adiba-nawrin', offlineId: 'adiba-nawrin' } },
};

// AUTH_SECRET if set; otherwise the Google private key or Supabase secret key (server-only); otherwise a dev-only value.
const secret = () => process.env.AUTH_SECRET || process.env.GOOGLE_PRIVATE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-only-secret';

const enc = new TextEncoder();

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(payload)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('');
}

function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Checks a username + password against every hard-coded login and says who signed in. */
export function lookupLogin(user: string, password: string): SessionUser | null {
  const u = user.trim().toLowerCase();
  if (same(u, LOGIN_USER) && same(password, LOGIN_PASSWORD)) return ADMIN;
  const t = TEACHER_LOGINS[u];
  if (t && same(password, t.password)) return t.user;
  return null;
}

export async function createSession(user: SessionUser): Promise<string> {
  const expires = String(Date.now() + SESSION_SECONDS * 1000);
  const payload = `${expires}.${btoa(JSON.stringify(user))}`;
  return `${payload}.${await sign(payload)}`;
}

/** The signed-in user, or null when the cookie is missing, stale or forged. */
export async function readSession(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const [expires, body, sig] = token.split('.');
  if (!expires || !body || !sig || Number(expires) < Date.now()) return null;
  if (!same(sig, await sign(`${expires}.${body}`))) return null;
  try {
    const user = JSON.parse(atob(body)) as SessionUser;
    if (user?.kind !== 'admin' && user?.kind !== 'teacher') return null;
    return user;
  } catch {
    return null;
  }
}

/** Only allow redirects back to a page inside this app. */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login') ? next : '/';
}

export function cookieOptions(maxAge: number) {
  const production = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: production,
    // HQ embeds this app in an iframe, so the cookie has to be sent from a third-party context there.
    sameSite: (production ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
    maxAge,
  };
}
