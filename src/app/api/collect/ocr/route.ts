import { NextResponse } from 'next/server';
import { assertUploadAllowed } from '@/server/collect-auth';
import { ACCEPTED_TYPES, readForms } from '@/server/ocr';
import { SheetsError } from '@/server/sheets';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MAX_BYTES = 20 * 1024 * 1024;

/** One file in (a photo, scan or PDF) → the student forms found in it. */
export async function POST(request: Request) {
  try {
    assertUploadAllowed(request);
    const form = await request.formData();
    const file = form.get('file');
    const id = String(form.get('id') ?? Date.now());
    if (!(file instanceof File)) throw new SheetsError(400, 'No file received.');
    if (file.size > MAX_BYTES) throw new SheetsError(413, 'That file is over 20 MB. Take a smaller photo or scan.');
    const mime = ACCEPTED_TYPES.find((t) => t === file.type);
    if (!mime) throw new SheetsError(415, 'Use a JPG, PNG or WebP photo, or a PDF. (iPhone HEIC photos: export as JPG first.)');
    const base64 = Buffer.from(await file.arrayBuffer()).toString('base64');
    const responses = await readForms({ name: file.name, mime, base64 }, id);
    return NextResponse.json({ responses });
  } catch (e) {
    const status = e instanceof SheetsError ? e.status : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not read this file.' }, { status });
  }
}
