import type { ProgramId } from '../ratings/types';

export type Score = number | null;
export type RatingRound = 'first' | 'last';

/** The handwritten header of one paper form, as read by OCR (null = blank / unreadable). */
export interface FormHeader {
  programme: string | null;
  branch: string | null;
  batch: string | null;
  teacher: string | null;
  date: string | null;
}

/** One student's paper form. `scores[i]` is the ticked box (1–5) for question i+1, or null if none/unclear. */
export interface StudentResponse {
  id: string;
  scores: Score[];
  feedback: string;
  /** Human-readable reasons this form needs a look (blank answer, two ticks, unclear…). */
  flags: string[];
  header: FormHeader | null;
  /** File name, plus " · page n" for multi-page PDFs. */
  source: string;
}

/** What the person picks once for the whole pile of forms. */
export interface Selection {
  program: ProgramId;
  branch: string;
  level: string | null;
  batch: string;
  /** Teacher exactly as it should appear in the master sheet, e.g. "LCI004 - SIRAZUM MUNIRA". */
  teacherName: string;
  round: RatingRound;
  /** The day the rating was given, YYYY-MM-DD (defaults to today). */
  ratedOn?: string;
}

export interface Aggregate {
  forms: number;
  /** Average per criterion (2 dp), null if nobody answered it. */
  criteria: Score[];
  /** How many forms answered each criterion. */
  counts: number[];
  /** Mean of the five criterion averages — what the sheet's =AVERAGE(...) column will show. */
  average: number | null;
}

export interface PublishPlan {
  aggregate: Aggregate;
  /** The exact spelling that will be written to the sheets (after standardising case and spaces). */
  written: { teacher: string; branch: string; level: string | null; batch: string; round: string; changes: string[] };
  master: {
    tab: string;
    action: 'update' | 'add';
    /** Id of the existing master row (null when a new one will be added). */
    row: number | null;
    columns: string[];
    before: (string | number)[] | null;
    after: (string | number)[];
  };
  /** Where the individual student rows are saved first (one row per student). */
  responses: {
    spreadsheet: string;
    tab: string;
    exists: boolean;
    /** Student rows already saved for this teacher + branch + batch + round. */
    existing: number;
    /** How many of THIS upload's forms come from files that were already saved (same file name). */
    duplicates: number;
    mode: 'add' | 'replace';
    /** Rows that will be deleted (only when mode is 'replace'). */
    replace: number;
    /** Rows that will be added by this upload. */
    add: number;
    /** Students the batch average is calculated from after saving. */
    total: number;
  };
  warnings: string[];
}

/** A slice of a table, read back after saving, exactly as stored. */
export interface SheetView {
  spreadsheet: string;
  tab: string;
  url?: string;
  /** Row 1 of the tab. */
  headers: string[];
  rows: { row: number; cells: string[]; highlight: boolean }[];
}

export interface PublishResult {
  plan: PublishPlan;
  /** Read back from the sheets after the save (absent if the read-back itself failed — the save still happened). */
  view?: { students: SheetView; master: SheetView };
}
