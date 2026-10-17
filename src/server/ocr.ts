import 'server-only';
import { ApiError, GoogleGenAI, MediaResolution } from '@google/genai';
import { z } from 'zod';
import { toResponses, type RawForm } from '@/features/collect/parse';
import type { StudentResponse } from '@/features/collect/types';
import { AppError } from './db';

/** Change with GEMINI_MODEL in .env — see https://ai.google.dev/gemini-api/docs/models */
const DEFAULT_MODEL = 'gemini-3.6-flash';

/*
 * The reply schema is deliberately plain (no nullable fields, no unions) so it works on every Gemini version.
 * "" means "blank / unreadable"; it is turned into null below.
 */
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    forms: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          header: {
            type: 'object',
            properties: {
              programme: { type: 'string', description: 'The form title, e.g. "IELTS Programme – Teacher Evaluation Form"; "" if not visible' },
              branch: { type: 'string', description: 'Handwritten text after "Branch:"; "" if blank' },
              batch: { type: 'string', description: 'Handwritten text after "Batch:"; "" if blank' },
              teacher_name: { type: 'string', description: 'Handwritten text after "Teacher\'s Name:"; "" if blank' },
              date: { type: 'string', description: 'Handwritten text after "Date:"; "" if blank' },
            },
            required: ['programme', 'branch', 'batch', 'teacher_name', 'date'],
          },
          answers: {
            type: 'array',
            description: 'Exactly one entry per question row, top to bottom',
            items: {
              type: 'object',
              properties: {
                question: { type: 'integer', description: 'Row number of the question; 1 = first (top) row' },
                marked_boxes: { type: 'array', items: { type: 'integer' }, description: 'Column numbers (1-5, left to right) that carry a handwritten mark. Empty list if none.' },
                confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
              },
              required: ['question', 'marked_boxes', 'confidence'],
            },
          },
          feedback: { type: 'string', description: 'The handwritten "Additional feedback", transcribed exactly in its original language and script; "" if empty' },
          page_problem: { type: 'string', description: 'Only if the photo is cut off, blurry, upside-down or unreadable: say what. Otherwise ""' },
        },
        required: ['header', 'answers', 'feedback', 'page_problem'],
      },
    },
  },
  required: ['forms'],
} as const;

const Reply = z.object({
  forms: z.array(
    z.object({
      header: z.object({
        programme: z.string().default(''),
        branch: z.string().default(''),
        batch: z.string().default(''),
        teacher_name: z.string().default(''),
        date: z.string().default(''),
      }),
      answers: z.array(z.object({ question: z.coerce.number(), marked_boxes: z.array(z.coerce.number()).default([]), confidence: z.enum(['high', 'medium', 'low']).catch('low') })).default([]),
      feedback: z.string().default(''),
      page_problem: z.string().default(''),
    }),
  ),
});

const SYSTEM = `You read scanned or photographed paper "Teacher Evaluation Form" sheets filled in by students in a language school in Bangladesh.

Layout of every form: a title, then handwritten header fields (Branch, Batch, Teacher's Name, Date), then a table. Each of the FIVE question rows has five boxes numbered 1 to 5 from left to right. Every box contains a small PRE-PRINTED dot (•). The student ticks one box by drawing a tick, cross, circle, ring or scribble on or next to it. Below the table is a handwritten feedback area (Bangla or English).

Rules:
- The printed dots are NOT answers. Report only boxes where a student has added handwriting.
- List every box that carries a handwritten mark in marked_boxes. Do not guess: if no box is clearly marked, return an empty list; if two or more are marked, list them all. Use confidence "low" when a mark is faint, ambiguous, or you had to choose.
- Give exactly five answers, question 1 = top row.
- Copy header text exactly as written (do not correct spelling, do not expand abbreviations). Use "" for blank fields.
- Transcribe feedback exactly in the original script (Bangla stays Bangla). Never translate or summarise.
- A single file may contain more than one form (for example a multi-page PDF, or two forms on one page). Return one entry per form, in reading order. If the file contains no evaluation form, return an empty forms list.`;

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
type AcceptedType = (typeof ACCEPTED_TYPES)[number];

let client: GoogleGenAI | null = null;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const blankToNull = (s: string) => (s.trim() === '' ? null : s.trim());

function toRaw(reply: z.infer<typeof Reply>): { forms: RawForm[] } {
  return {
    forms: reply.forms.map((f) => ({
      header: { programme: blankToNull(f.header.programme), branch: blankToNull(f.header.branch), batch: blankToNull(f.header.batch), teacher_name: blankToNull(f.header.teacher_name), date: blankToNull(f.header.date) },
      answers: f.answers,
      feedback: blankToNull(f.feedback),
      page_problem: blankToNull(f.page_problem),
    })),
  };
}

export async function readForms(file: { name: string; mime: AcceptedType; base64: string }, idPrefix: string): Promise<StudentResponse[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AppError(503, 'Reading forms needs a Gemini API key. Add GEMINI_API_KEY to .env and restart the server.');
  client ??= new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  const generate = (highRes: boolean) =>
    client!.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ inlineData: { mimeType: file.mime, data: file.base64 } }, { text: 'Read every evaluation form in this file.' }] }],
      config: {
        systemInstruction: SYSTEM,
        responseMimeType: 'application/json',
        responseJsonSchema: RESPONSE_SCHEMA,
        temperature: 0,
        // Handwriting needs detail; some models reject the setting, so it is dropped on a 400 below.
        ...(highRes ? { mediaResolution: MediaResolution.MEDIA_RESOLUTION_HIGH } : {}),
      },
    });

  let highRes = true;
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await generate(highRes);
      if (response.promptFeedback?.blockReason) throw new AppError(422, 'Gemini declined to read this file. Enter its answers by hand instead.');
      const text = response.text;
      if (!text) throw new AppError(502, 'The reader returned nothing for this file. Try again, or enter it by hand.');
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new AppError(502, 'The reader returned something unexpected for this file. Try again, or enter it by hand.');
      }
      const parsed = Reply.safeParse(json);
      if (!parsed.success) throw new AppError(502, 'The reader returned something unexpected for this file. Try again, or enter it by hand.');
      return toResponses(toRaw(parsed.data), file.name, idPrefix);
    } catch (e) {
      if (e instanceof AppError) throw e;
      if (e instanceof ApiError) {
        if (e.status === 400 && highRes && /resolution/i.test(e.message)) {
          highRes = false; // this model does not take the setting: retry once without it
          continue;
        }
        if ((e.status === 429 || e.status === 503 || e.status === 500) && attempt < 4) {
          // Gemini often says how long to wait ("retry in 24s"); otherwise back off 4s, 10s, 20s, 40s.
          const hint = /(\d+(?:\.\d+)?)\s*s\b/i.exec(e.message);
          await sleep(hint ? Math.min(60_000, Number(hint[1]) * 1000 + 500) : [4000, 10000, 20000, 40000][attempt]);
          continue;
        }
        if (e.status === 429) throw new AppError(429, 'Gemini is rate-limiting this key. Wait a minute and press retry, or use a key with a higher quota.');
        if (e.status === 404) throw new AppError(502, `Gemini model "${model}" is not available for this key. Set GEMINI_MODEL in .env to a current model (https://ai.google.dev/gemini-api/docs/models).`);
        if (e.status === 401 || e.status === 403 || (e.status === 400 && /api key/i.test(e.message))) throw new AppError(401, 'Gemini rejected the API key. Check GEMINI_API_KEY.');
        if (e.status === 400) throw new AppError(400, `Gemini could not use this file: ${e.message.slice(0, 200)}`);
        throw new AppError(502, `Gemini is unavailable (${e.status}). Try again shortly.`);
      }
      throw e;
    }
  }
}
