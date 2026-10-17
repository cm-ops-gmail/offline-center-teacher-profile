import { NextResponse } from 'next/server';
import { AppError } from '@/server/db';
import { saveOpex, type OpexInput } from '@/server/opex';

export const dynamic = 'force-dynamic';

/** Saves one sitting of OpEx ratings (one row per teacher). */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as OpexInput;
    return NextResponse.json(await saveOpex({ branch: String(body.branch ?? ''), rater: String(body.rater ?? ''), ratedOn: String(body.ratedOn ?? ''), entries: body.entries, replaceExisting: Boolean(body.replaceExisting) }));
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not save.' }, { status });
  }
}
