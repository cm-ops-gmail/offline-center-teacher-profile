import { OPEX_CRITERIA } from './criteria';

export type TeamKey = 'opex' | 'programme';
export interface Criterion {
  short: string;
  question: string;
  scale: string;
}

const UNSAT = '1 = Unsatisfactory, 5 = Excellent';

/** The ten things the Programme team scores when they observe a class. */
export const PROGRAMME_CRITERIA: Criterion[] = [
  ['Class preparation', 'Class Preparation & Readiness'],
  ['Instruction clarity', 'Instruction Clarity & Task Demonstration'],
  ['English proficiency', 'English Proficiency & Classroom Language'],
  ['Student engagement', 'Student Engagement & Participation'],
  ['Student talking time', 'Student Talking Time & Speaking Opportunities'],
  ['Interactive activities', 'Interactive Activities & Communicative Teaching'],
  ['Classroom management', 'Classroom Management & Activity Transitions'],
  ['Feedback & correction', 'Constructive Feedback & Error Correction'],
  ['Inclusivity & support', 'Inclusivity & Individual Learner Support'],
  ['Speaking outcomes', 'Speaking Outcome Achievement & Learning Checks'],
].map(([short, question]) => ({ short, question, scale: UNSAT }));

export interface TeamConfig {
  key: TeamKey;
  /** Tab / section title. */
  title: string;
  /** What the person who rates is called. */
  who: string;
  /** Label of the date field. */
  dateLabel: string;
  criteria: readonly Criterion[];
  page: string;
  blurb: string;
}

export const TEAMS: Record<TeamKey, TeamConfig> = {
  opex: { key: 'opex', title: 'OpEx rating', who: 'OpEx member', dateLabel: 'Date of this rating', criteria: OPEX_CRITERIA, page: '/opex', blurb: 'Given monthly by the OpEx / ABM / AC team on six questions, each scored 1–5.' },
  programme: { key: 'programme', title: 'Programme team rating', who: 'Programme team member', dateLabel: 'Observation date', criteria: PROGRAMME_CRITERIA, page: '/programme-team', blurb: 'Given by the Programme team after observing a class: ten criteria, each scored 1–5, with strengths and areas of development.' },
};
