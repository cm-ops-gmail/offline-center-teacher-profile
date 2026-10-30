# Teacher Performance — English Centre

Live dashboard over the teacher-performance ratings of the English Centre, stored in Supabase (originally imported from the Google Sheet **Teacher Performance Evaluation | English Centre**).
Reads four tabs — `IELTS (all_branch)`, `SEJ (all_branch)`, `EF (all_branch)`, `After SSC English` — and turns
each batch's *First Rating* / *Last Rating* rows into improvement charts, teacher profiles and branch comparisons.

## Run

```bash
cp .env.example .env      # fill in the Supabase URL + key (and GEMINI_API_KEY for /collect)
npm install
# 1. Supabase dashboard → SQL Editor → paste supabase/schema.sql → Run   (creates the tables)
npm run db:seed           # 2. one-time: copies the old Google Sheet into Supabase as demo data
npm run dev               # http://localhost:3000
npm run build && npm start
```

Optional add-ons, run in the SQL editor the same way: `supabase/add-opex.sql` (OpEx team ratings), `supabase/add-programme-team.sql` (programme team ratings), `supabase/add-dates.sql`, and `supabase/add-teacher-profiles.sql` (**Manage profile** on a teacher's page: name, designation, email, experience, phone, active/inactive status, address and photo — creates the `teacher_profiles` table plus a public `teacher-photos` storage bucket for the images).

All data lives in three Supabase tables — `master_ratings` (one row per teacher × branch × batch × round, what the dashboard reads), `student_responses` (one row per student form) and `lookups` (branch / batch dropdown lists). Nothing reads or writes Google Sheets any more; the `GOOGLE_*` variables are only used by `npm run db:seed` (add `-- --force` to wipe and re-import).
Credentials are only ever read on the server (`src/server/db.ts`); the browser talks to `/api/ratings`.

## Logins (hard-coded until the mail-auth role SDK is integrated)

| Username | Password | Who / what they see |
|---|---|---|
| `admin` | `654321` | The program manager — everything |
| `nusrat` | `1234` | Nusrat Jahan — **online only**: her online profile and upcoming classes |
| `sirazum` | `1234` | Sirazum Munira — **offline only**: her offline profile |
| `adiba` | `1234` | Adiba Nawrin — **both**: can switch between her online and offline profiles |

Teacher accounts land on `/me`, see no menus, and every other page redirects them back (see `src/proxy.ts` — only `/me`, the ratings read and saving their own offline profile are allowed).

## How the main number works

- A **batch's rating** = the average of its First Rating and Last Rating (just the one, if only one exists yet).
- **Average Rating** = every batch's rating added up ÷ the number of batches. Overall, per programme, per branch, per teacher — same rule everywhere.

## Screens

| Route | What it shows |
|---|---|
| `/` and `/programs/[id]` | **Averages only** by default: headline Average Rating, then by programme / branch / level / teacher. Pick any filter (programme, branch, level, teacher, batch, class) or click a row and the **sheet-style data** appears: First/Last Rating average rows, then every rating row with the five criteria. |
| `/compare` (also on the overview) | **Teacher Comparison**: pick two teachers (searchable dropdowns) and see Average Rating, First/Last, improvement, programmes, branches, batches, best/worst batch, per-programme ratings and every criterion side by side. The stronger cell in each row is shaded. The pair is kept in the URL (`?a=&b=`). |
| `/teachers`, `/teachers/[id]` | Teacher list with Average Rating; a profile opens straight into the sheet-style data per programme. The teacher page shows their **Profile** details first (name, designation, email, experience, phone, status, address — edited via **Manage profile**), then the rating cards and tabs: **Upcoming classes** (batches whose Last Rating is still missing), **Past classes** (batches that have had it), Student rating, OpEx rating, Programme team rating |
| `/branches` | Average Rating by branch, and a branch × programme grid |
| `/collect` | **Student rating** (under Collect) — photograph the paper forms, OCR reads them, you check, and the averages are saved to the database (see below) |
| `/data-health` | What was read, what was tidied, what to fix in the data |

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
- Data is cached server-side for 1 minute (and cleared after every save); the **Refresh** button bypasses the cache.
- **Login:** every page and API route needs a sign-in (`src/proxy.ts`). The credentials are hard-coded in `src/lib/auth.ts` (username `admin`, password `654321`); change them there. The session is a signed cookie valid for 7 days, signed with `AUTH_SECRET` if set, otherwise `GOOGLE_PRIVATE_KEY`.

## Student rating entry (OCR) — `/collect`

Turns a batch's paper forms into the master rating row, replacing the manual copy-and-average step.

1. **Pick the batch once:** programme, branch, (level for SEJ), batch, teacher, and **First** or **Last Rating**.
2. **Add the photos / scans / PDFs** for the whole batch. Each file is read by **Gemini** vision: the five tick marks, the handwritten header, and the feedback (Bangla or English).
3. **Check what was read.** The header on each form is cross-checked against your choices; blank ticks, double ticks and unclear marks are flagged and never guessed. Save stays disabled until every flagged form is corrected or confirmed.
4. **Save** — you first see exactly what will change. Then, in this order:
   1. **Students first → `student_responses`**: one row per student (teacher, branch, level, batch, round, Users Rated, the criteria scores, Average Rating, feedback, form date, source file). If rows for the same teacher, branch, batch and round are already saved, you choose **Add** (keeps them; the batch average then covers everyone, so 50–60+ students can be uploaded in several sittings) or **Replace** (deletes them first — for re-uploading the same forms). Forms whose file name is already saved are flagged so nobody is counted twice.
   2. **Then the batch average → `master_ratings`**: each criterion is averaged across the students (blank answers ignored, not counted as 0) and the five are averaged into the Average Rating. An existing row for the same teacher/branch/batch/round is replaced (after confirmation), otherwise a new row is added.

After saving, both tables are **read back from the database** and shown on screen as sheet-style grids: the student rows (this upload's highlighted) and the master rows for that batch. That is also the proof the save landed.

Form questions map to criteria **in order** (question 1 → first criterion, … question 5 → fifth).

Setup (`.env`): `GEMINI_API_KEY` (from https://aistudio.google.com/apikey), optionally `GEMINI_MODEL` (default `gemini-3.6-flash`). Optionally set `UPLOAD_ACCESS_KEY` to require a password for uploads. To measure accuracy before relying on it: `node scripts/ocr-check.mjs forms/*.jpg` and compare with the numbers you typed by hand.

## Deploy on Vercel

Import the GitHub repo into Vercel (Framework: Next.js), add these under **Project → Settings → Environment Variables** and redeploy:

| Variable | Required | Value |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | recommended | secret key; with it you can remove the open `app_all` policies |
| `AUTH_SECRET` | yes | long random string that signs the login cookie |
| `GEMINI_API_KEY` | for `/collect` | key from https://aistudio.google.com/apikey |
| `UPLOAD_ACCESS_KEY` | optional | password for uploads |
