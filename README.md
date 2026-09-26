# Teacher Performance — English Centre

Live dashboard over the Google Sheet **Teacher Performance Evaluation | English Centre**.
Reads four tabs — `IELTS (all_branch)`, `SEJ (all_branch)`, `EF (all_branch)`, `After SSC English` — and turns
each batch's *First Rating* / *Last Rating* rows into improvement charts, teacher profiles and branch comparisons.

## Run

```bash
cp .env.example .env      # then fill in the three GOOGLE_* values
npm install
npm run dev               # http://localhost:3000
npm run build && npm start
```

The sheet must be shared (Viewer is enough) with the service-account email in `GOOGLE_CLIENT_EMAIL`.
Credentials are only ever read on the server (`src/server/sheets.ts`); the browser talks to `/api/ratings`.

## How the main number works

- A **batch's rating** = the average of its First Rating and Last Rating (just the one, if only one exists yet).
- **Average Rating** = every batch's rating added up ÷ the number of batches. Overall, per programme, per branch, per teacher — same rule everywhere.

## Screens

| Route | What it shows |
|---|---|
| `/` and `/programs/[id]` | **Averages only** by default: headline Average Rating, then by programme / branch / level / teacher. Pick any filter (programme, branch, level, teacher, batch, class) or click a row and the **sheet-style data** appears: First/Last Rating average rows, then every rating row with the five criteria. |
| `/compare` (also on the overview) | **Teacher Comparison**: pick two teachers (searchable dropdowns) and see Average Rating, First/Last, improvement, programmes, branches, batches, best/worst batch, per-programme ratings and every criterion side by side. The stronger cell in each row is shaded. The pair is kept in the URL (`?a=&b=`). |
| `/teachers`, `/teachers/[id]` | Teacher list with Average Rating; a profile opens straight into the sheet-style data per programme |
| `/branches` | Average Rating by branch, and a branch × programme grid |
| `/collect` | **Upload forms** — photograph the paper forms, OCR reads them, you check, and the averages go into the sheet (see below) |
| `/data-health` | What was read, what was tidied, what to fix in the sheet |

Filters live in the URL (`?program=&branch=&level=&teacher=&batch=&criterion=&class=`); **Teacher**, **Batch** and **Criterion** are searchable dropdowns. The **Criterion** filter looks at every number through one criterion (e.g. “Communication Skills”); each option shows which programmes ask it (SEJ’s criteria differ from IELTS / EF / After SSC), and programmes that don’t ask it drop out, so any view can be shared as a link.

## Design

Follows the **Transportation Allowance (TA) & Per-Diem Management System** (same 10 Minute School design tokens):
system font stack (with Noto Sans Bengali), small bold headings, pure neutral greys with a near-black primary,
white cards with a hairline border and the lightest shadow, soft ring-style status pills, the same header
(logo · app name · page label), sidebar with a near-black main-action button, and a sliding drawer on phones.
Motion is functional only — hover transitions, spinners and the drawer; no entrance animations.
Tokens live in `src/app/globals.css` (`.card`, `.field`, `.eyebrow`); the menu is `src/lib/nav.ts`.
Dark mode and HQ-embedded mode (`?source=hq`) are kept. Each programme keeps its own fixed colour dot.

## Notes

- "Needs attention" = declined batch, or latest rating below 4.50 (`ATTENTION_THRESHOLD` in `analytics.ts`).
- The sheet is cached server-side for 5 minutes; the **Refresh** button bypasses the cache.
- **Login:** every page and API route needs a sign-in (`src/proxy.ts`). The credentials are hard-coded in `src/lib/auth.ts` (username `admin`, password `123456`); change them there. The session is a signed cookie valid for 7 days, signed with `AUTH_SECRET` if set, otherwise `GOOGLE_PRIVATE_KEY`.

## Upload forms (OCR) — `/collect`

Turns a batch's paper forms into the master-sheet row, replacing the manual copy-and-average step.

1. **Pick the batch once:** programme, branch, (level for SEJ), batch, teacher, and **First** or **Last Rating**.
2. **Add the photos / scans / PDFs** for the whole batch. Each file is read by **Gemini** vision: the five tick marks, the handwritten header, and the feedback (Bangla or English).
3. **Check what was read.** The header on each form is cross-checked against your choices; blank ticks, double ticks and unclear marks are flagged and never guessed. Save stays disabled until every flagged form is corrected or confirmed.
4. **Save** — you first see exactly what will change. Then, in this order:
   1. **Students first → the responses sheet** (`RESPONSES_SHEET_ID`): one tab per programme (`IELTS`, `SEJ`, `EF`, `After SSC English`, created on first use), one row per student in the "Users Rated" layout — `instructor_name · branch · (level) · batch · class · Users Rated · the five criteria · Average Rating · Feedback · Form date · Source file`. Each student's Average Rating is a live `=AVERAGE(...)` formula. If rows for the same teacher, branch, batch and round are already saved, you choose **Add** (keeps them; the batch average then covers everyone, so 50–60+ students can be uploaded in several sittings) or **Replace** (deletes them first — for re-uploading the same forms). Forms whose file name is already saved are flagged so nobody is counted twice.
   2. **Then the batch average → the master sheet** (`GOOGLE_SHEET_ID`, e.g. `IELTS (all_branch)`): each criterion is averaged across the students (blank answers ignored, not counted as 0) and the five are averaged into the Average Rating. An existing row for the same teacher/branch/batch/round is replaced (after confirmation), otherwise the first empty template row is used; the sheet's own `=AVERAGE(...)` column is left in place.

After saving, both sheets are **read back from Google Sheets** and shown on screen as sheet-style grids: the student sheet (this upload's rows highlighted) and the master sheet (the row just written, next to the batch's other round). That is also the proof the save landed.

Form questions map to sheet columns **in order** (question 1 → first criterion column, … question 5 → fifth).

Setup (`.env`): `GEMINI_API_KEY` (from https://aistudio.google.com/apikey), `RESPONSES_SHEET_ID`, optionally `GEMINI_MODEL` (default `gemini-3.6-flash`). Both spreadsheets must be shared with the service account as **Editor**. Optionally set `UPLOAD_ACCESS_KEY` to require a password for uploads. To measure accuracy before relying on it: `node scripts/ocr-check.mjs forms/*.jpg` and compare with the numbers you typed by hand.

## Deploy on Vercel

Import the GitHub repo into Vercel (Framework: Next.js, no build settings to change), then add these under **Project → Settings → Environment Variables** (Production) and redeploy:

| Variable | Required | Value |
| --- | --- | --- |
| `GOOGLE_SHEET_ID` | yes | ID of the master sheet (`/d/<ID>/` in its URL) |
| `GOOGLE_CLIENT_EMAIL` | yes | service-account email |
| `GOOGLE_PRIVATE_KEY` | yes | the `private_key` from the JSON key, on one line with literal `\n`, **no surrounding quotes** |
| `RESPONSES_SHEET_ID` | for `/collect` | ID of the responses spreadsheet |
| `GEMINI_API_KEY` | for `/collect` | key from https://aistudio.google.com/apikey |
| `UPLOAD_ACCESS_KEY` | no | optional password for `/collect`; leave it out and uploads are open to anyone with the URL |
| `GEMINI_MODEL` | no | defaults to `gemini-3.6-flash` |

Things that behave differently on Vercel:

- **Uploads are capped at 4 MB per file** (Vercel rejects request bodies over 4.5 MB). Photos are shrunk in the browser automatically; scan PDFs at ~150 dpi greyscale, or split them.
- OCR can take up to 2 minutes on a large PDF (`maxDuration = 120` on `/api/collect/ocr`). Vercel's default limit on current plans allows this; if functions time out on your plan, upload smaller PDFs.
- Saves stay safe across serverless instances: the per-programme lock also lives in the responses sheet (`_locks` tab).
- Sign-in is built in (see Notes). Optionally set `AUTH_SECRET` (any long random string) to sign sessions; if you don't, `GOOGLE_PRIVATE_KEY` is used.
