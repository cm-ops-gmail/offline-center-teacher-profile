// Gives every master_ratings row a made-up "rated_on" date between 1 Jan 2026 and today, so the date filter has
// something to show. A batch's Last Rating always falls 6–17 weeks after its First Rating. Safe to re-run (same dates).
//   npm run db:dates          → only rows with no date yet
//   npm run db:dates -- --all → overwrite every row
import fs from 'node:fs';

const env = { ...process.env };
for (const l of fs.readFileSync('.env', 'utf8').split('\n')) {
  const i = l.indexOf('=');
  if (i < 1 || l.trimStart().startsWith('#')) continue;
  let v = l.slice(i + 1).trim();
  if (/^".*"$/.test(v) || /^'.*'$/.test(v)) v = v.slice(1, -1);
  env[l.slice(0, i).trim()] ??= v;
}
process.on('uncaughtException', (e) => { console.error('\n' + e.message); process.exit(1); });
const SB = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, '');
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const all = process.argv.includes('--all');
async function sb(path, init = {}) {
  const res = await fetch(`${SB}/rest/v1/${path}`, { ...init, headers: { apikey: KEY, 'content-type': 'application/json', ...init.headers } });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (body?.code === '42703' || /rated_on/.test(body?.message ?? '')) throw new Error('The rated_on column does not exist yet. Run supabase/add-dates.sql in the Supabase SQL editor first.');
    throw new Error(`Supabase ${res.status}: ${body?.message ?? res.statusText}`);
  }
  return body;
}

// small seeded random generator → same dates every run
let seed = 20260101;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const DAY = 86_400_000;
const start = Date.UTC(2026, 0, 1);
const end = Date.UTC(2026, 9, 17); // today
const iso = (t) => new Date(t).toISOString().slice(0, 10);

const rows = [];
for (let from = 0; ; from += 1000) {
  const page = await sb('master_ratings?select=id,program,instructor_name,branch,level,batch,class,rated_on&order=id.asc', { headers: { range: `${from}-${from + 999}`, 'range-unit': 'items' } });
  rows.push(...page);
  if (page.length < 1000) break;
}
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const groups = new Map();
for (const r of rows) {
  const k = [r.program, norm(r.instructor_name), norm(r.branch), norm(r.level), norm(r.batch)].join('|');
  (groups.get(k) ?? groups.set(k, []).get(k)).push(r);
}

const dates = new Map();
for (const g of groups.values()) {
  const firstAt = start + Math.floor(rnd() * ((end - 120 * DAY) - start) / DAY) * DAY; // leaves room for a Last Rating
  const gap = (42 + Math.floor(rnd() * 78)) * DAY;
  for (const r of g) {
    const jitter = r.class === 'last' ? Math.floor(rnd() * 10) * DAY : 0; // extra students' rows in the same round
    dates.set(r.id, iso(Math.min(end, (r.class === 'first' ? firstAt : firstAt + gap) + jitter)));
  }
}

const todo = rows.filter((r) => all || !r.rated_on);
let done = 0;
for (let i = 0; i < todo.length; i += 12) {
  await Promise.all(todo.slice(i, i + 12).map((r) => sb(`master_ratings?id=eq.${r.id}`, { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: JSON.stringify({ rated_on: dates.get(r.id) }) })));
  done += Math.min(12, todo.length - i);
}
console.log(`Gave ${done} of ${rows.length} rows a date (${iso(start)} … ${iso(end)}).`);
