'use client';
import { useEffect, useState } from 'react';

/* ------------------------------------------------------------------ *
 * The Online Teacher segment runs on demo data for now. Everything
 * lives here so the real online-teaching system can replace it later.
 * ------------------------------------------------------------------ */

export type OnlineProgramId = 'ielts' | 'spoken' | 'kids' | 'academic';

export const ONLINE_PROGRAMS: Record<OnlineProgramId, { id: OnlineProgramId; label: string; color: string }> = {
  ielts: { id: 'ielts', label: 'IELTS', color: '#7c3aed' },
  spoken: { id: 'spoken', label: 'Spoken English', color: '#0ea5e9' },
  kids: { id: 'kids', label: 'Kids English', color: '#f59e0b' },
  academic: { id: 'academic', label: 'Academic English', color: '#10b981' },
};

export interface OnlineClass {
  id: string;
  programme: OnlineProgramId;
  batch: string;
  /** YYYY-MM-DD */
  date: string;
  time: string;
}

export interface OnlineTeacher {
  id: string;
  name: string;
  designation: string;
  email: string;
  phone: string;
  yearsOfExperience: number;
  status: 'active' | 'inactive';
  address: string;
  programmes: OnlineProgramId[];
  totalClasses: number;
  /** Average rating of the teaching style, out of 5. */
  teachingStyle: number;
  /** Average length of one class, hours. */
  avgDuration: number;
  /** Average attendance, %. */
  avgAttendance: number;
  /** Average watch time per class, minutes. */
  avgWatchTime: number;
  upcoming: OnlineClass[];
  past: OnlineClass[];
  /** Set when the program manager uploads a photo in Manage profile (stored locally). */
  photo: string | null;
}

/* ---------- deterministic demo schedule ---------- */

const SLOTS = ['09:00 AM', '11:00 AM', '01:30 PM', '04:00 PM', '06:30 PM', '08:00 PM'];
const PREFIX: Record<OnlineProgramId, string> = { ielts: 'IELTS Online', spoken: 'Spoken Batch', kids: 'Kids Batch', academic: 'Academic Batch' };

const hash = (s: string): number => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);
const abs = (n: number) => Math.abs(n);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const plusDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};

function makeClasses(teacherId: string, programme: OnlineProgramId, kind: 'upcoming' | 'past', count: number): OnlineClass[] {
  return Array.from({ length: count }, (_, i) => {
    const seed = hash(`${teacherId}:${kind}:${i}`);
    return {
      id: `${teacherId}-${kind}-${i}`,
      programme,
      batch: `${PREFIX[programme]} ${2 + (abs(hash(teacherId + programme)) % 21)}`,
      date: kind === 'upcoming' ? plusDays(1 + (seed % 14)) : plusDays(-(3 + (abs(seed) % 60))),
      time: SLOTS[abs(hash(`${teacherId}:${kind}:t:${i}`)) % SLOTS.length],
    };
  });
}

/* ---------- demo teachers ---------- */

function teacher(
  id: string,
  name: string,
  designation: string,
  programmes: OnlineProgramId[],
  totalClasses: number,
  teachingStyle: number,
  avgDuration: number,
  avgAttendance: number,
  avgWatchTime: number,
  yearsOfExperience: number,
  status: 'active' | 'inactive',
  address: string,
): OnlineTeacher {
  const email = `${id.replace(/-/g, '.')}@10minuteschool.com`;
  const phone = `+8801${7 + (abs(hash(id)) % 3)}${String(abs(hash(id + 'p')) % 100000000).padStart(8, '0')}`.slice(0, 14);
  const main = programmes[0];
  return {
    id,
    name,
    designation,
    email,
    phone,
    yearsOfExperience,
    status,
    address,
    programmes,
    totalClasses,
    teachingStyle,
    avgDuration,
    avgAttendance,
    avgWatchTime,
    upcoming: makeClasses(id, main, 'upcoming', 2 + (abs(hash(id + 'u')) % 3)),
    past: makeClasses(id, main, 'past', 4 + (abs(hash(id + 'p2')) % 6)),
    photo: null,
  };
}

export const DEMO_TEACHERS: OnlineTeacher[] = [
  teacher('anika-tabassum', 'Anika Tabassum', 'Senior Online Instructor', ['ielts'], 320, 4.7, 1.5, 88, 22, 9, 'active', 'Dhanmondi, Dhaka'),
  teacher('rashidul-hasan', 'Rashidul Hasan', 'Online Instructor', ['ielts', 'spoken'], 210, 4.4, 1.5, 82, 18, 6, 'active', 'Uttara, Dhaka'),
  teacher('nusrat-jahan', 'Nusrat Jahan', 'Online Instructor', ['kids'], 180, 4.5, 1.0, 91, 15, 5, 'active', 'Chattogram'),
  teacher('tanvir-ahmed', 'Tanvir Ahmed', 'Senior Online Instructor', ['ielts'], 285, 4.2, 1.5, 76, 20, 8, 'active', 'Mirpur, Dhaka'),
  teacher('farhana-yasmin', 'Farhana Yasmin', 'Online Instructor', ['spoken'], 150, 4.8, 1.5, 85, 26, 4, 'active', 'Bashundhara, Dhaka'),
  teacher('mahmudul-hasan', 'Mahmudul Hasan', 'Lead Online Instructor', ['academic'], 260, 4.6, 2.0, 79, 24, 11, 'active', 'Gulshan, Dhaka'),
  teacher('sadia-afrin', 'Sadia Afrin', 'Online Instructor', ['kids', 'spoken'], 120, 4.3, 1.0, 87, 14, 3, 'active', 'Sylhet'),
  teacher('rezaul-karim', 'Rezaul Karim', 'Online Instructor', ['academic'], 175, 4.1, 2.0, 72, 19, 7, 'active', 'Khulna'),
  teacher('mehjabin-chowdhury', 'Mehjabin Chowdhury', 'Senior Online Instructor', ['spoken', 'ielts'], 240, 4.9, 1.5, 90, 28, 10, 'active', 'Banani, Dhaka'),
  teacher('arif-chowdhury', 'Arif Chowdhury', 'Online Instructor', ['ielts'], 95, 3.9, 1.5, 70, 16, 2, 'inactive', 'Rajshahi'),
  teacher('tasnim-rahman', 'Tasnim Rahman', 'Online Instructor', ['kids'], 140, 4.4, 1.0, 84, 12, 4, 'active', 'Mohammadpur, Dhaka'),
  teacher('imran-hossain', 'Imran Hossain', 'Online Instructor', ['academic', 'spoken'], 200, 4.5, 2.0, 81, 21, 6, 'active', 'Narayanganj'),
];

/* ---------- Manage profile saves (demo) live in localStorage ---------- */

const STORE_KEY = 'online-teacher-profiles';
export const ONLINE_CHANGED = 'online-teachers-changed';

interface StoredProfile {
  name?: string;
  designation?: string;
  email?: string;
  phone?: string;
  yearsOfExperience?: number;
  status?: 'active' | 'inactive';
  address?: string;
  photo?: string | null;
}

export function getOnlineTeachers(): OnlineTeacher[] {
  let stored: Record<string, StoredProfile> = {};
  try {
    stored = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}');
  } catch {
    stored = {};
  }
  return DEMO_TEACHERS.map((t) => {
    const s = stored[t.id];
    return s ? ({ ...t, ...s, programmes: t.programmes, photo: s.photo ?? null } as OnlineTeacher) : t;
  });
}

export function saveOnlineProfile(id: string, profile: StoredProfile) {
  let stored: Record<string, StoredProfile> = {};
  try {
    stored = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}');
  } catch {
    stored = {};
  }
  stored[id] = { ...stored[id], ...profile };
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(stored));
  } catch {}
  window.dispatchEvent(new Event(ONLINE_CHANGED));
}

/** The demo teacher list, including whatever the program manager changed through Manage profile. */
export function useOnlineTeachers(): OnlineTeacher[] {
  const [teachers, setTeachers] = useState<OnlineTeacher[]>(DEMO_TEACHERS);
  useEffect(() => {
    const read = () => setTeachers(getOnlineTeachers());
    read();
    window.addEventListener(ONLINE_CHANGED, read);
    window.addEventListener('storage', read);
    return () => {
      window.removeEventListener(ONLINE_CHANGED, read);
      window.removeEventListener('storage', read);
    };
  }, []);
  return teachers;
}
