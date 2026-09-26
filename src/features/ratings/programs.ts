import type { ProgramId } from './types';

export interface ProgramDef {
  id: ProgramId;
  /** Exact tab name in the Google Sheet. */
  tab: string;
  label: string;
  short: string;
  criteria: string[];
  hasLevel: boolean;
  /** CSS variable holding this program's fixed categorical colour. */
  color: string;
}

const CLASSROOM_CRITERIA = [
  'Subject Matter knowledge',
  'Teaching Techniques',
  'Communication Skills',
  'Availability and Approachability',
  'Professionalism',
];

// Colour follows the entity: each program keeps its slot in every chart, whatever the filter.
export const PROGRAMS: ProgramDef[] = [
  { id: 'ielts', tab: 'IELTS (all_branch)', label: 'IELTS', short: 'IELTS', criteria: CLASSROOM_CRITERIA, hasLevel: false, color: 'var(--viz-1)' },
  {
    id: 'sej',
    tab: 'SEJ (all_branch)',
    label: 'SEJ',
    short: 'SEJ',
    criteria: ['Understanding the Lecture', 'Scope of Participation', 'Teaching Technique', 'Learning Materials', 'Behaviour'],
    hasLevel: true,
    color: 'var(--viz-2)',
  },
  { id: 'ef', tab: 'EF (all_branch)', label: 'EF', short: 'EF', criteria: CLASSROOM_CRITERIA, hasLevel: false, color: 'var(--viz-3)' },
  { id: 'assc', tab: 'After SSC English', label: 'After SSC English', short: 'After SSC', criteria: CLASSROOM_CRITERIA, hasLevel: false, color: 'var(--viz-4)' },
];

export const PROGRAM_BY_ID = Object.fromEntries(PROGRAMS.map((p) => [p.id, p])) as Record<ProgramId, ProgramDef>;

export function isProgramId(v: string): v is ProgramId {
  return v in PROGRAM_BY_ID;
}
