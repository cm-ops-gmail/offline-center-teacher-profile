'use client';
import { useEffect, useState } from 'react';

/* ------------------------------------------------------------------ *
 * The Online Teacher segment runs on demo data for now. Everything
 * lives here so the real online-teaching system can replace it later.
 * Every class carries its own numbers, so the cards simply aggregate
 * whichever classes the programme / subject filters select.
 * ------------------------------------------------------------------ */

export type OnlineProgramId = 'hsc-27' | 'hsc-26' | 'class-9' | 'class-7' | 'class-6';

export const ONLINE_PROGRAMS: Record<OnlineProgramId, { id: OnlineProgramId; label: string; color: string }> = {
  'hsc-27': { id: 'hsc-27', label: 'HSC 27', color: '#7c3aed' },
  'hsc-26': { id: 'hsc-26', label: 'HSC 26', color: '#0ea5e9' },
  'class-9': { id: 'class-9', label: 'Class 9', color: '#10b981' },
  'class-7': { id: 'class-7', label: 'Class 7', color: '#f59e0b' },
  'class-6': { id: 'class-6', label: 'Class 6', color: '#ef4444' },
};

export const SUBJECTS = ['English', 'Mathematics', 'Physics', 'Chemistry', 'ICT'] as const;

export interface OnlineClass {
  id: string;
  /** What the class covers, e.g. "ক্রোমাটোগ্রাফি". */
  topic: string;
  /** Live (taught in the studio) or Recorded. */
  type: 'Live' | 'Recorded';
  programme: OnlineProgramId;
  /** The full program name in the class system, e.g. "HSC 27 অনলাইন ব্যাচ - ফিজিক্স". */
  programName: string;
  /** The course inside the program, e.g. "Physics 1st Paper". */
  course: string;
  subject: string;
  batch: string;
  /** YYYY-MM-DD */
  date: string;
  time: string;
  /** This class's teaching-style rating (out of 5). */
  rating: number;
  /** Hours. */
  duration: number;
  /** % of enrolled students present. */
  attendance: number;
  /** Average minutes watched (fractional — seconds included). */
  watch: number;
  /** Class-recording numbers, shown in a past class's details. */
  participants: number;
  comments: number;
  doubts: number;
  uniqueCommenters: number;
  uniqueDoubters: number;
  /** Students' rating of the class slides (out of 5). */
  slideRating: number;
}

/** Is a class's date inside the From / To range? Empty ends are open. */
export const inDateRange = (c: OnlineClass, from: string, to: string) => (!from || c.date >= from) && (!to || c.date <= to);

export interface OnlineTeacher {
  id: string;
  name: string;
  designation: string;
  email: string;
  phone: string;
  yearsOfExperience: number;
  status: 'active' | 'inactive';
  address: string;
  /** Programmes this teacher has classes in. */
  programmes: OnlineProgramId[];
  /** Subjects this teacher teaches. */
  subjects: string[];
  upcoming: OnlineClass[];
  past: OnlineClass[];
  /** Set when the program manager uploads a photo in Manage profile (stored locally). */
  photo: string | null;
}

/* ---------- metrics aggregated over a set of classes ---------- */

export interface OnlineMetrics {
  classes: number;
  style: number | null;
  duration: number | null;
  attendance: number | null;
  watch: number | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The five card numbers for any set of classes (usually a teacher's past classes after the filters). */
export function metricsOf(classes: OnlineClass[]): OnlineMetrics {
  if (classes.length === 0) return { classes: 0, style: null, duration: null, attendance: null, watch: null };
  const avg = (f: (c: OnlineClass) => number) => classes.reduce((a, c) => a + f(c), 0) / classes.length;
  return {
    classes: classes.length,
    style: round2(avg((c) => c.rating)),
    duration: avg((c) => c.duration),
    attendance: avg((c) => c.attendance),
    watch: avg((c) => c.watch),
  };
}

/* ---------- deterministic demo schedule ---------- */

const SLOTS = ['09:00 AM', '11:00 AM', '01:30 PM', '04:00 PM', '06:30 PM', '08:00 PM'];
const SECTIONS = ['A', 'B', 'C'];

const hash = (s: string): number => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);
const abs = (n: number) => Math.abs(n);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const plusDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};
/** Bangla subject names, used in the program names. */
const SUBJECT_BN: Record<string, string> = { English: 'ইংরেজি', Mathematics: 'গণিত', Physics: 'ফিজিক্স', Chemistry: 'কেমিস্ট্রি', ICT: 'আইসিটি' };

const TOPICS: Record<string, string[]> = {
  English: ['Parts of Speech', 'Right Form of Verbs', 'Narration', 'Transformation of Sentences', 'Paragraph Writing', 'Completing Sentences'],
  Mathematics: ['ম্যাট্রিক্স ও নির্ণায়ক', 'সরলরেখা', 'অন্তরীকরণ', 'যোজিত ফল', 'ত্রিকোণমিতিক অনুপাত', 'বীজগাণিতিক রাশি'],
  Physics: ['ভেক্টর', 'নিউটনিয়ান বলবিদ্যা', 'কাজ, শক্তি ও ক্ষমতা', 'মহাকর্ষ ও অভিকর্ষ', 'তরঙ্গ', 'স্থির তড়িৎ'],
  Chemistry: ['ক্রোমাটোগ্রাফি', 'পর্যায়বৃত্ত ধর্ম', 'রাসায়নিক বন্ধন', 'গুণগত রসায়ন', 'মোলের ধারণা', 'অম্ল, ক্ষারক ও লবণ'],
  ICT: ['সংখ্যা পদ্ধতি', 'ডিজিটাল ডিভাইস', 'ওয়েব ডিজাইন ও HTML', 'প্রোগ্রামিং ভাষা', 'ডেটাবেজ ম্যানেজমেন্ট', 'কমিউনিকেশন সিস্টেম'],
};

/** HSC courses come in 1st / 2nd papers (ICT has one); the school classes only split English. */
function courseOf(programme: OnlineProgramId, subject: string, seed: number): string {
  const papered = programme.startsWith('hsc') ? subject !== 'ICT' : subject === 'English';
  return papered ? `${subject} ${seed % 2 === 0 ? '1st' : '2nd'} Paper` : subject;
}

const clamp = (lo: number, hi: number, v: number) => Math.min(hi, Math.max(lo, v));

function makeClasses(teacherId: string, programmes: OnlineProgramId[], subjects: string[], kind: 'upcoming' | 'past', count: number, styleBase: number): OnlineClass[] {
  return Array.from({ length: count }, (_, i) => {
    const seed = abs(hash(`${teacherId}:${kind}:${i}`));
    const programme = programmes[seed % programmes.length];
    const subject = subjects[abs(hash(`${teacherId}:${kind}:s:${i}`)) % subjects.length];
    const participants = 300 + (abs(hash(`${teacherId}:${kind}:p:${i}`)) % 1400);
    const comments = Math.round(participants * (1 + (seed % 40) / 10));
    const doubts = seed % 4 === 0 ? 0 : abs(hash(`${teacherId}:${kind}:d:${i}`)) % 60;
    const topics = TOPICS[subject] ?? ['Chapter review'];
    return {
      id: `${teacherId}-${kind}-${i}`,
      topic: topics[abs(hash(`${teacherId}:${kind}:topic:${i}`)) % topics.length],
      type: seed % 6 === 0 ? 'Recorded' : 'Live',
      programme,
      programName: `${ONLINE_PROGRAMS[programme].label} অনলাইন ব্যাচ - ${SUBJECT_BN[subject] ?? subject}`,
      course: courseOf(programme, subject, abs(hash(`${teacherId}:${kind}:paper:${i}`))),
      subject,
      batch: `${ONLINE_PROGRAMS[programme].label} · ${SECTIONS[abs(seed) % SECTIONS.length]}`,
      date: kind === 'upcoming' ? plusDays(1 + (seed % 14)) : plusDays(-(3 + (seed % 60))),
      time: SLOTS[abs(hash(`${teacherId}:${kind}:t:${i}`)) % SLOTS.length],
      rating: clamp(1, 5, round2(styleBase + ((abs(seed) % 11) - 5) / 20)),
      duration: [1, 1.5, 2][abs(seed) % 3],
      attendance: 55 + (abs(seed) % 41),
      watch: 8 + (abs(seed) % 28) + (abs(hash(`${teacherId}:${kind}:ws:${i}`)) % 60) / 60,
      participants,
      comments,
      doubts,
      uniqueCommenters: Math.round(comments / (6 + (seed % 9))),
      uniqueDoubters: Math.min(doubts, Math.round(doubts / (1 + (seed % 3)))),
      slideRating: clamp(1, 5, round2(styleBase + ((abs(hash(`${teacherId}:${kind}:sl:${i}`)) % 11) - 5) / 20)),
    };
  });
}

/* ---------- demo teachers ---------- */

function teacher(
  id: string,
  name: string,
  designation: string,
  programmes: OnlineProgramId[],
  subjects: string[],
  styleBase: number,
  yearsOfExperience: number,
  status: 'active' | 'inactive',
  address: string,
): OnlineTeacher {
  const email = `${id.replace(/-/g, '.')}@10minuteschool.com`;
  const phone = `+8801${7 + (abs(hash(id)) % 3)}${String(abs(hash(id + 'p')) % 100000000).padStart(8, '0')}`.slice(0, 14);
  const past = makeClasses(id, programmes, subjects, 'past', 8 + (abs(hash(id + 'pc')) % 10), styleBase);
  const upcoming = makeClasses(id, programmes, subjects, 'upcoming', 2 + (abs(hash(id + 'uc')) % 4), styleBase);
  return {
    id,
    name,
    designation,
    email,
    phone,
    yearsOfExperience,
    status,
    address,
    programmes: [...new Set(past.flatMap((c) => c.programme).concat(upcoming.map((c) => c.programme)))],
    subjects: [...new Set(past.flatMap((c) => c.subject).concat(upcoming.map((c) => c.subject)))].sort(),
    past,
    upcoming,
    photo: null,
  };
}

export const DEMO_TEACHERS: OnlineTeacher[] = [
  teacher('anika-tabassum', 'Anika Tabassum', 'Senior Online Instructor', ['hsc-27', 'hsc-26'], ['English', 'ICT'], 4.7, 9, 'active', 'Dhanmondi, Dhaka'),
  teacher('rashidul-hasan', 'Rashidul Hasan', 'Online Instructor', ['hsc-27', 'class-9'], ['Physics', 'Mathematics'], 4.4, 6, 'active', 'Uttara, Dhaka'),
  teacher('nusrat-jahan', 'Nusrat Jahan', 'Online Instructor', ['class-6', 'class-7'], ['English'], 4.5, 5, 'active', 'Chattogram'),
  teacher('tanvir-ahmed', 'Tanvir Ahmed', 'Senior Online Instructor', ['hsc-26'], ['Chemistry', 'Physics'], 4.2, 8, 'active', 'Mirpur, Dhaka'),
  teacher('farhana-yasmin', 'Farhana Yasmin', 'Online Instructor', ['class-9', 'class-7'], ['English', 'Mathematics'], 4.8, 4, 'active', 'Bashundhara, Dhaka'),
  teacher('mahmudul-hasan', 'Mahmudul Hasan', 'Lead Online Instructor', ['hsc-27', 'hsc-26'], ['Mathematics', 'ICT'], 4.6, 11, 'active', 'Gulshan, Dhaka'),
  teacher('sadia-afrin', 'Sadia Afrin', 'Online Instructor', ['class-6', 'class-9'], ['English', 'ICT'], 4.3, 3, 'active', 'Sylhet'),
  teacher('rezaul-karim', 'Rezaul Karim', 'Online Instructor', ['hsc-26', 'class-9'], ['Chemistry'], 4.1, 7, 'active', 'Khulna'),
  teacher('mehjabin-chowdhury', 'Mehjabin Chowdhury', 'Senior Online Instructor', ['hsc-27', 'class-9'], ['English', 'Physics'], 4.9, 10, 'active', 'Banani, Dhaka'),
  teacher('arif-chowdhury', 'Arif Chowdhury', 'Online Instructor', ['hsc-26'], ['Mathematics'], 3.9, 2, 'inactive', 'Rajshahi'),
  teacher('tasnim-rahman', 'Tasnim Rahman', 'Online Instructor', ['class-7', 'class-6'], ['English', 'ICT'], 4.4, 4, 'active', 'Mohammadpur, Dhaka'),
  teacher('imran-hossain', 'Imran Hossain', 'Online Instructor', ['hsc-27', 'class-7'], ['Physics', 'Chemistry'], 4.5, 6, 'active', 'Narayanganj'),
  // Also an offline teacher (LCI003) — the demo login "adiba" shows both profiles.
  teacher('adiba-nawrin', 'Adiba Nawrin', 'Senior Online Instructor', ['hsc-27', 'class-9'], ['English', 'Mathematics'], 4.6, 8, 'active', 'Mymensingh'),
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
    return s ? ({ ...t, ...s, programmes: t.programmes, subjects: t.subjects, past: t.past, upcoming: t.upcoming, photo: s.photo ?? null } as OnlineTeacher) : t;
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
