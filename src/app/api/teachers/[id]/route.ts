import { NextResponse } from 'next/server';
import { AppError } from '@/server/db';
import { saveTeacherProfile } from '@/server/teachers';

export const dynamic = 'force-dynamic';

// Vercel functions reject request bodies over 4.5 MB; the dialog shrinks photos to a small square JPEG anyway.
const MAX_BYTES = 4.4 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Saves the Manage profile form for one teacher: fields as form values, the photo as a file. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const form = await request.formData();
    const str = (k: string) => String(form.get(k) ?? '').trim();

    const photo = form.get('image');
    if (photo && !(photo instanceof File)) throw new AppError(400, 'The photo must be a file.');
    if (photo instanceof File && photo.size > 0) {
      if (photo.size > MAX_BYTES) throw new AppError(413, 'That photo is over 4 MB. Pick a smaller one.');
      if (!PHOTO_TYPES.includes(photo.type)) throw new AppError(415, 'Use a JPG, PNG or WebP photo.');
    }

    const years = str('yearsOfExperience');
    const yearsNum = years === '' ? null : Number(years);
    if (yearsNum !== null && (!Number.isFinite(yearsNum) || yearsNum < 0)) throw new AppError(400, 'Years of experience must be a positive number.');
    const profile = await saveTeacherProfile(
      id,
      {
        name: str('name'),
        designation: str('designation'),
        email: str('email'),
        phone: str('phone'),
        yearsOfExperience: yearsNum,
        status: str('status') === 'inactive' ? 'inactive' : 'active',
        address: str('address'),
      },
      photo instanceof File && photo.size > 0 ? photo : undefined,
    );
    return NextResponse.json({ profile });
  } catch (e) {
    const status = e instanceof AppError ? e.status : 500;
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not save the profile.' }, { status });
  }
}
