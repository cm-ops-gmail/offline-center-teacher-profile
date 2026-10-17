// One-time import: copies the current Google Sheet (master tabs, student rows, dropdown lists) into Supabase as demo data.
//   npm run db:seed            → only if the tables are empty
//   npm run db:seed -- --force → wipes the three tables first
// Needs the GOOGLE_* / RESPONSES_SHEET_ID values in .env for this run only; the app itself no longer uses Google Sheets.
import fs from 'node:fs';
import crypto from 'node:crypto';

const env = { ...process.env };
for (const l of fs.readFileSync('.env', 'utf8').split('\n')) {
  const i = l.indexOf('=');
  if (i < 1 || l.trimStart().startsWith('#')) continue;
  let v = l.slice(i + 1).trim();
  if (/^".*"$/.test(v) || /^'.*'$/.test(v)) v = v.slice(1, -1);
  env[l.slice(0, i).trim()] ??= v;
}
const force = process.argv.includes('--force');
process.on('uncaughtException', (e) => { console.error('\n' + e.message); process.exit(1); });

const PROGRAMS = [
  { id: 'ielts', tab: 'IELTS (all_branch)', label: 'IELTS', hasLevel: false, criteria: ['Subject Matter knowledge', 'Teaching Techniques', 'Communication Skills', 'Availability and Approachability', 'Professionalism'] },
  { id: 'sej', tab: 'SEJ (all_branch)', label: 'SEJ', hasLevel: true, criteria: ['Understanding the Lecture', 'Scope of Participation', 'Teaching Technique', 'Learning Materials', 'Behaviour'] },
  { id: 'ef', tab: 'EF (all_branch)', label: 'EF', hasLevel: false, criteria: ['Subject Matter knowledge', 'Teaching Techniques', 'Communication Skills', 'Availability and Approachability', 'Professionalism'] },
  { id: 'assc', tab: 'After SSC English', label: 'After SSC English', hasLevel: false, criteria: ['Subject Matter knowledge', 'Teaching Techniques', 'Communication Skills', 'Availability and Approachability', 'Professionalism'] },
];

/* ---------- Supabase ---------- */
const SB = (env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!SB || !KEY) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env');
async function sb(path, init = {}) {
  const res = await fetch(`${SB}/rest/v1/${path}`, { ...init, headers: { apikey: KEY, 'content-type': 'application/json', ...init.headers } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (body.code === 'PGRST205') throw new Error('The tables do not exist yet. Run supabase/schema.sql in the Supabase SQL editor first.');
    throw new Error(`Supabase ${res.status}: ${body.message ?? res.statusText}`);
  }
  return res;
}
const count = async (t) => Number((await sb(`${t}?select=id`, { headers: { prefer: 'count=exact', range: '0-0' } })).headers.get('content-range')?.split('/')[1] ?? 0);
async function insert(table, rows) {
  for (let i = 0; i < rows.length; i += 400) await sb(table, { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify(rows.slice(i, i + 400)) });
}

/* ---------- Google (read-only, service account) ---------- */
function pem(raw) {
  let k = raw.trim();
  if (k.startsWith('{')) try { k = String(JSON.parse(k).private_key ?? ''); } catch {}
  k = k.replace(/^["']+|["']+$/g, '').replace(/\\r/g, '').replace(/\\n/g, '\n').replace(/\r/g, '');
  const m = k.match(/-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/);
  if (!m) throw new Error('GOOGLE_PRIVATE_KEY is not a valid private key');
  return `-----BEGIN ${m[1]}-----\n${m[2].replace(/\s+/g, '').match(/.{1,64}/g).join('\n')}\n-----END ${m[1]}-----\n`;
}
async function googleToken() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: env.GOOGLE_CLIENT_EMAIL, scope: 'https://www.googleapis.com/auth/spreadsheets.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(pem(env.GOOGLE_PRIVATE_KEY)).toString('base64url');
  const res = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }) })).json();
  if (!res.access_token) throw new Error(`Google sign-in failed: ${res.error_description ?? 'unknown'}`);
  return res.access_token;
}
async function readTabs(token, sheetId, tabs, range = '') {
  const q = tabs.map((t) => `ranges=${encodeURIComponent(`'${t}'${range}`)}`).join('&');
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchGet?${q}&valueRenderOption=FORMATTED_VALUE`, { headers: { authorization: `Bearer ${token}` } });
  const json = await res.json();
  if (!res.ok) throw new Error(`Google Sheets: ${json.error?.message ?? res.statusText}`);
  return json.valueRanges.map((v) => v.values ?? []);
}

/* ---------- parsing ---------- */
const num = (v) => {
  const t = String(v ?? '').trim();
  if (t === '' || t.startsWith('#')) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
const slot = (cls) => { const c = String(cls ?? '').toLowerCase(); return c.includes('first') ? 'first' : c.includes('last') ? 'last' : null; };
const indexer = (header) => { const h = header.map((x) => String(x).trim().toLowerCase()); return (n) => h.indexOf(n.toLowerCase()); };
const text = (row, i) => (i >= 0 ? String(row[i] ?? '').trim() : '');

function masterRows(p, rows) {
  if (!rows.length) return [];
  const col = indexer(rows[0]);
  const [iName, iBranch, iLevel, iBatch, iClass, iAvg, iRem] = ['instructor_name', 'branch', 'level', 'batch', 'class', 'average rating', 'remarks'].map(col);
  const iCrit = p.criteria.map(col);
  const out = [];
  for (const r of rows.slice(1)) {
    const name = text(r, iName);
    const cls = slot(text(r, iClass));
    if (!name || !cls) continue;
    const scores = iCrit.map((i) => num(r[i]));
    const avg = num(r[iAvg]);
    if (avg === null && scores.every((s) => s === null)) continue; // nothing rated yet
    out.push({ program: p.id, instructor_name: name, branch: text(r, iBranch), level: p.hasLevel ? text(r, iLevel) || null : null, batch: text(r, iBatch), class: cls, scores, average_rating: avg, remarks: text(r, iRem) });
  }
  return out;
}

function studentRows(p, rows) {
  if (!rows.length) return [];
  const col = indexer(rows[0]);
  const iCrit = p.criteria.map(col);
  const [iName, iBranch, iLevel, iBatch, iClass, iUsers, iAvg, iFeed, iDate, iSrc, iAt, iSub] = ['instructor_name', 'branch', 'level', 'batch', 'class', 'users rated', 'average rating', 'feedback', 'form date', 'source file', 'submitted_at', 'submission_id'].map(col);
  const out = [];
  for (const r of rows.slice(1)) {
    const name = text(r, iName);
    const cls = slot(text(r, iClass));
    if (!name || !cls) continue;
    const at = Date.parse(text(r, iAt));
    out.push({ program: p.id, instructor_name: name, branch: text(r, iBranch), level: p.hasLevel ? text(r, iLevel) || null : null, batch: text(r, iBatch), class: cls, users_rated: num(r[iUsers]), scores: iCrit.map((i) => num(r[i])), average_rating: num(r[iAvg]), feedback: text(r, iFeed), form_date: text(r, iDate), source_file: text(r, iSrc), ...(Number.isNaN(at) ? {} : { submitted_at: new Date(at).toISOString() }), submission_id: text(r, iSub) });
  }
  return out;
}

/* ---------- run ---------- */
const have = { master_ratings: await count('master_ratings'), student_responses: await count('student_responses'), lookups: await count('lookups') };
if (Object.values(have).some(Boolean)) {
  if (!force) {
    console.log('Tables already contain data:', have, '\nRe-run with --force to wipe and re-import.');
    process.exit(0);
  }
  for (const t of Object.keys(have)) await sb(`${t}?id=gt.0`, { method: 'DELETE' });
  console.log('Cleared existing rows.');
}

const token = await googleToken();
const master = (await readTabs(token, env.GOOGLE_SHEET_ID, PROGRAMS.map((p) => p.tab))).flatMap((rows, i) => masterRows(PROGRAMS[i], rows));
const [validation] = await readTabs(token, env.GOOGLE_SHEET_ID, ['Data Validation'], '!B2:D300').catch(() => [[]]);
const col = (i) => [...new Set(validation.map((r) => String(r[i] ?? '').trim()).filter(Boolean))];
const lookups = [...col(0).map((value) => ({ kind: 'branch', value })), ...col(2).map((value) => ({ kind: 'batch', value }))];

let students = [];
if (env.RESPONSES_SHEET_ID) {
  try {
    students = (await readTabs(token, env.RESPONSES_SHEET_ID, PROGRAMS.map((p) => p.label))).flatMap((rows, i) => studentRows(PROGRAMS[i], rows));
  } catch (e) {
    console.log(`(No student rows imported: ${e.message})`);
  }
}

await insert('master_ratings', master);
await insert('student_responses', students);
await insert('lookups', lookups);
console.log(`Imported ${master.length} master rows, ${students.length} student rows, ${lookups.length} dropdown values.`);
for (const p of PROGRAMS) console.log(`  ${p.label}: ${master.filter((m) => m.program === p.id).length} master rows`);
