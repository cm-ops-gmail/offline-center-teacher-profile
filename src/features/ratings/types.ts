export type ProgramId = 'ielts' | 'sej' | 'ef' | 'assc';

/** One rating round for a batch (either the "First Rating" or the "Last Rating"). */
export interface Rating {
  /** Scores aligned to the program's `criteria` list; null when the cell was blank. */
  scores: (number | null)[];
  /** The sheet's own "Average Rating" (falls back to the mean of the scores). */
  avg: number;
  /** The day this rating was given (YYYY-MM-DD), null if unknown. */
  date: string | null;
}

/** One teacher × branch × batch, with its first and last rating when available. */
export interface BatchRecord {
  id: string;
  program: ProgramId;
  teacherId: string;
  teacherName: string;
  branch: string;
  level: string | null;
  batch: string;
  first: Rating | null;
  last: Rating | null;
  remarks: string[];
}

/** Profile details a program manager keeps through the Manage profile dialog. */
export interface TeacherProfile {
  name: string;
  designation: string;
  email: string;
  phone: string;
  /** Years of Experience, as entered; null when blank. */
  yearsOfExperience: number | null;
  status: 'active' | 'inactive';
  address: string;
  /** Public URL of the teacher's photo, when one was uploaded. */
  imageUrl: string | null;
}

export interface Teacher {
  id: string;
  name: string;
  code: string | null;
  /** How the master sheet spells this teacher (most common form), e.g. "LCI004 - SIRAZUM MUNIRA". */
  sheetName: string;
  /** Saved through Manage profile (supabase/add-teacher-profiles.sql); optional because the table is an add-on. */
  profile?: TeacherProfile;
}

export type IssueKind =
  | 'empty-rows'
  | 'no-scores'
  | 'missing-branch'
  | 'duplicate-rating'
  | 'possible-duplicate-teacher'
  | 'code-conflict'
  | 'name-normalised';

export interface DataIssue {
  kind: IssueKind;
  program: ProgramId | null;
  message: string;
  count?: number;
}

export interface TabStats {
  program: ProgramId;
  tab: string;
  rowsRead: number;
  batches: number;
  teachers: number;
}

/** One monthly rating of a teacher by the OpEx / ABM / AC team (six questions, scored 1–5). */
export interface OpexRating {
  id: number;
  /** Same id as the teacher's student ratings when the name matches, otherwise a slug of the name. */
  teacherId: string;
  teacherName: string;
  branch: string;
  rater: string;
  scores: (number | null)[];
  avg: number;
  date: string | null;
  remarks: string;
  /** Programme team only. */
  strengths?: string;
  areas?: string;
}

export interface RatingsPayload {
  syncedAt: string;
  sheetTitle: string;
  sheetUrl: string;
  batches: BatchRecord[];
  teachers: Teacher[];
  issues: DataIssue[];
  tabs: TabStats[];
  /** OpEx ratings (empty until supabase/add-opex.sql has been run). */
  opex: OpexRating[];
  opexReady: boolean;
  /** Programme team (classroom observation) ratings, same shape as OpEx. */
  programme: OpexRating[];
  programmeReady: boolean;
}
