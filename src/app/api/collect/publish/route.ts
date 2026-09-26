import { NextResponse } from 'next/server';
import { assertUploadAllowed } from '@/server/collect-auth';
import { previewPublish, publish, type PublishInput } from '@/server/collect';
import { SheetsError } from '@/server/sheets';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** `{ dryRun: true }` → what WOULD be written (read-only). Otherwise saves to the Google Sheet. */
export async function POST(request: Request) {
  try {
    assertUploadAllowed(request);
    const body = (await request.json()) as PublishInput & { dryRun?: boolean };
    if (!body?.selection || !Array.isArray(body.responses)) throw new SheetsError(400, 'Malformed request.');
    const input: PublishInput = { selection: body.selection, responses: body.responses, overwrite: Boolean(body.overwrite), mode: body.mode === 'add' || body.mode === 'replace' ? body.mode : undefined };
    if (body.dryRun) return NextResponse.json({ plan: await previewPublish(input) });
    return NextResponse.json(await publish(input));
  } catch (e) {
    const status = e instanceof SheetsError ? e.status : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not save.' }, { status });
  }
}
