import { CRITERIA_COUNT } from './aggregate';
import type { StudentResponse } from './types';

/** Shape the reader returns for each form (mirrors the schema in src/server/ocr.ts). */
export interface RawForm {
  header: { programme: string | null; branch: string | null; batch: string | null; teacher_name: string | null; date: string | null };
  answers: { question: number; marked_boxes: number[]; confidence: 'high' | 'medium' | 'low' }[];
  feedback: string | null;
  page_problem: string | null;
}

/** Turn the reader's answers into review rows: one marked box → a score; none or several → blank + a flag for the reviewer. */
export function toResponses(parsed: { forms: RawForm[] }, source: string, idPrefix: string): StudentResponse[] {
  return parsed.forms.map((form, i) => {
    const flags: string[] = [];
    const scores = Array.from({ length: CRITERIA_COUNT }, (_, q) => {
      const answer = form.answers.find((a) => a.question === q + 1);
      if (!answer) {
        flags.push(`Q${q + 1}: not read`);
        return null;
      }
      const marks = [...new Set(answer.marked_boxes.filter((b) => Number.isInteger(b) && b >= 1 && b <= 5))].sort();
      if (marks.length === 0) {
        flags.push(`Q${q + 1}: no box marked`);
        return null;
      }
      if (marks.length > 1) {
        flags.push(`Q${q + 1}: several boxes marked (${marks.join(', ')})`);
        return null;
      }
      if (answer.confidence === 'low') flags.push(`Q${q + 1}: unclear mark — please check`);
      return marks[0];
    });
    if (form.page_problem) flags.push(form.page_problem);
    return {
      id: `${idPrefix}-${i + 1}`,
      scores,
      feedback: (form.feedback ?? '').trim(),
      flags,
      header: { programme: form.header.programme, branch: form.header.branch, batch: form.header.batch, teacher: form.header.teacher_name, date: form.header.date },
      source: parsed.forms.length > 1 ? `${source} · form ${i + 1}` : source,
    };
  });
}
