import { NextResponse } from 'next/server';
import { accessKeyRequired } from '@/server/collect-auth';
import { getLookups, SheetsError } from '@/server/sheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const lookups = await getLookups();
    return NextResponse.json({ ...lookups, accessKeyRequired: accessKeyRequired(), ocrConfigured: Boolean(process.env.GEMINI_API_KEY), production: process.env.NODE_ENV === 'production' });
  } catch (e) {
    const status = e instanceof SheetsError ? e.status : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not load lists' }, { status });
  }
}
