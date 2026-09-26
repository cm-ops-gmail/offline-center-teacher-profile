import 'server-only';
import crypto from 'node:crypto';
import { SheetsError } from './sheets';

/**
 * These endpoints spend Anthropic credits and edit the Google Sheet, so they are never open by accident:
 *  - if UPLOAD_ACCESS_KEY is set, every call must send it in the `x-access-key` header;
 *  - if it is not set, they only work outside production (local development).
 */
export function assertUploadAllowed(request: Request): void {
  const required = process.env.UPLOAD_ACCESS_KEY;
  if (!required) {
    if (process.env.NODE_ENV === 'production') throw new SheetsError(403, 'Uploading is disabled: set UPLOAD_ACCESS_KEY on the server to turn it on.');
    return;
  }
  const given = request.headers.get('x-access-key') ?? '';
  const a = Buffer.from(given);
  const b = Buffer.from(required);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new SheetsError(401, 'ACCESS_KEY_REQUIRED');
}

export function accessKeyRequired(): boolean {
  return Boolean(process.env.UPLOAD_ACCESS_KEY);
}
