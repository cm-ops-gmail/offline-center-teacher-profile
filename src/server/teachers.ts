import 'server-only';
import { AppError, clearRatingsCache, getRatings, rest, storageUpload } from './db';
import type { TeacherProfile } from '@/features/ratings/types';

/** What the Manage profile dialog sends (the photo arrives as a separate file). */
export interface TeacherProfileInput {
  name: string;
  designation: string;
  email: string;
  phone: string;
  /** Years of Experience; null when left blank. */
  yearsOfExperience: number | null;
  status: 'active' | 'inactive';
  address: string;
}

const PHOTO_BUCKET = 'teacher-photos';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clean = (s: string, max = 300) => s.replace(/\s+/g, ' ').trim().slice(0, max);

/** Saves (or creates) one teacher's profile, optionally replacing their photo. */
export async function saveTeacherProfile(id: string, input: TeacherProfileInput, photo?: File): Promise<TeacherProfile> {
  if (!id) throw new AppError(400, 'Missing teacher id.');
  const known = (await getRatings().catch(() => null))?.teachers.find((t) => t.id === id);
  if (!known) throw new AppError(404, 'That teacher does not exist.');

  const name = clean(input.name);
  if (!name) throw new AppError(400, 'Name cannot be empty.');
  const email = clean(input.email);
  if (email && !EMAIL.test(email)) throw new AppError(400, 'That email address does not look right.');

  let imageUrl: string | undefined;
  if (photo) {
    const ext = photo.type === 'image/png' ? 'png' : photo.type === 'image/webp' ? 'webp' : 'jpg';
    imageUrl = await storageUpload(PHOTO_BUCKET, `${id}.${ext}`, photo);
  }

  const profile: TeacherProfile = {
    name,
    designation: clean(input.designation),
    email,
    phone: clean(input.phone, 40),
    yearsOfExperience: input.yearsOfExperience,
    status: input.status === 'inactive' ? 'inactive' : 'active',
    address: clean(input.address, 1000),
    imageUrl: imageUrl ?? known.profile?.imageUrl ?? null,
  };

  try {
    await rest('teacher_profiles?on_conflict=teacher_id', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: JSON.stringify({
        teacher_id: id,
        name: profile.name,
        designation: profile.designation,
        email: profile.email,
        phone: profile.phone,
        years_of_experience: profile.yearsOfExperience,
        status: profile.status,
        address: profile.address,
        ...(imageUrl ? { image_url: imageUrl } : {}),
        updated_at: new Date().toISOString(),
      }),
    });
  } catch (e) {
    if (e instanceof AppError && e.message.includes('schema.sql')) {
      throw new AppError(500, 'The teacher profiles table does not exist yet. Run supabase/add-teacher-profiles.sql in the Supabase SQL editor, then save again.');
    }
    throw e;
  }

  clearRatingsCache();
  return profile;
}
