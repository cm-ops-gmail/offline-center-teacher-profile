import { NextResponse } from 'next/server';
import { getRatings, SheetsError } from '@/server/sheets';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.get('refresh') === '1';
  try {
    const data = await getRatings(force);
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const status = e instanceof SheetsError ? e.status : 500;
    const message = e instanceof Error ? e.message : 'Unexpected error while reading the sheet.';
    return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
