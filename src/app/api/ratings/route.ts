import { NextResponse } from 'next/server';
import { getRatings, AppError } from '@/server/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.get('refresh') === '1';
  try {
    const data = await getRatings(force);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    const message = e instanceof Error ? e.message : 'Unexpected error while loading the data.';
    return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
