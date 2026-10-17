/** The six questions the OpEx / ABM / AC team answers about each teacher, once a month. Each is scored 1–5. */
export const OPEX_CRITERIA = [
  { short: 'On-time arrival', question: "Rate the teacher's on-time arrival for classes/sessions this month.", scale: '1 = frequently late, 5 = always on time/early' },
  { short: 'Records accuracy', question: 'Rate accuracy and timeliness of submitted records (attendance, grades, timesheets).', scale: '1 = often missing/late, 5 = always accurate and on time' },
  { short: 'Query response', question: 'Rate how quickly the teacher responds to parent/student/admin queries.', scale: '1 = very slow/unresponsive, 5 = consistently prompt' },
  { short: 'Parent/student satisfaction', question: 'Rate average parent/student satisfaction from post-session feedback.', scale: '1 = mostly negative, 5 = mostly excellent' },
  { short: 'WhatsApp feedback', question: 'Rate WhatsApp Feedback Regularity.', scale: '1 = mostly negative, 5 = mostly excellent' },
  { short: 'Behaviour with stakeholders', question: "Rate Teacher's Behaviour with other stakeholders in the branch.", scale: '1 = mostly negative, 5 = mostly excellent' },
] as const;

export const OPEX_COUNT = OPEX_CRITERIA.length;
