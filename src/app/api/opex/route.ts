import { NextResponse } from 'next/server';
import { AppError } from '@/server/db';
import { saveTeamRatings, type OpexInput } from '@/server/opex';

export const dynamic = 'force-dynamic';

/** Saves one sitting of OpEx or Programme-team ratings (one row per teacher). `team` is 'opex' (default) or 'programme'. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as OpexInput & { team?: string };
    return NextResponse.json(await saveTeamRatings(body.team === 'programme' ? 'programme' : 'opex', { branch: String(body.branch ?? ''), rater: String(body.rater ?? ''), ratedOn: String(body.ratedOn ?? ''), entries: body.entries, replaceExisting: Boolean(body.replaceExisting) }));
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not save.' }, { status });
  }
}
