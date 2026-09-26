import 'server-only';
import crypto from 'node:crypto';
import { SheetsError } from './sheets';

/**
 * These endpoints spend Gemini quota and edit the Google Sheet:
 *  - if UPLOAD_ACCESS_KEY is set, every call must send it in the `x-access-key` header;
 *  - if it is not set, they are open (anyone who can reach the app can upload).
 */
export function assertUploadAllowed(request: Request): void {
  const required = process.env.UPLOAD_ACCESS_KEY;
  if (!required) return;
  const given = request.headers.get('x-access-key') ?? '';
  const a = Buffer.from(given);
  const b = Buffer.from(required);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new SheetsError(401, 'ACCESS_KEY_REQUIRED');
}

export function accessKeyRequired(): boolean {
  return Boolean(process.env.UPLOAD_ACCESS_KEY);
}
