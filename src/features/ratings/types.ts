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

export interface Teacher {
  id: string;
  name: string;
  code: string | null;
  /** How the master sheet spells this teacher (most common form), e.g. "LCI004 - SIRAZUM MUNIRA". */
  sheetName: string;
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

export interface RatingsPayload {
  syncedAt: string;
  sheetTitle: string;
  sheetUrl: string;
  batches: BatchRecord[];
  teachers: Teacher[];
  issues: DataIssue[];
  tabs: TabStats[];
}
