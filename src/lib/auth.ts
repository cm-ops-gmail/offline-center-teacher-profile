/**
 * Hard-coded single login. The session cookie is a signed expiry time, so it cannot be forged without the server
 * secret. Uses Web Crypto only, so it runs in the proxy as well as in route handlers.
 */
export const LOGIN_USER = 'admin';
export const LOGIN_PASSWORD = '123456';

export const SESSION_COOKIE = 'tp_session';
export const SESSION_SECONDS = 60 * 60 * 24 * 7;

// AUTH_SECRET if set; otherwise the Google private key (already secret and server-only); otherwise a dev-only value.
const secret = () => process.env.AUTH_SECRET || process.env.GOOGLE_PRIVATE_KEY || 'dev-only-secret';

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

export function credentialsOk(user: string, password: string): boolean {
  return same(user.trim().toLowerCase(), LOGIN_USER) && same(password, LOGIN_PASSWORD);
}

export async function createSession(): Promise<string> {
  const expires = String(Date.now() + SESSION_SECONDS * 1000);
  return `${expires}.${await sign(expires)}`;
}

export async function sessionValid(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [expires, sig] = token.split('.');
  if (!expires || !sig || Number(expires) < Date.now()) return false;
  return same(sig, await sign(expires));
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
