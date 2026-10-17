// Demo Programme-team (classroom observation) ratings. The first row is the sample from the team's sheet
// (Mirpur, 3·4·2·4·5·3·5·3·2·3 = 3.40); the rest are made-up, with dates between 1 Jan 2026 and today.
//   npm run db:programme            → only if the table is empty
//   npm run db:programme -- --force → wipes the table first
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
async function sb(path, init = {}) {
  const res = await fetch(`${SB}/rest/v1/${path}`, { ...init, headers: { apikey: KEY, 'content-type': 'application/json', ...init.headers } });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (body?.code === 'PGRST205') throw new Error('The programme_ratings table does not exist yet. Run supabase/add-programme-team.sql in the Supabase SQL editor first.');
    throw new Error(`Supabase ${res.status}: ${body?.message ?? res.statusText}`);
  }
  return { body, res };
}

let seed = 11;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = (xs) => xs[Math.floor(rnd() * xs.length)];
const start = Date.UTC(2026, 0, 1);
const end = Date.UTC(2026, 9, 17);
const day = () => new Date(start + Math.floor(rnd() * ((end - start) / 86_400_000 + 1)) * 86_400_000).toISOString().slice(0, 10);

const OBSERVERS = ['Programme Team A', 'Programme Team B', 'Programme Team C'];
const STRENGTHS = ['Interactive', 'Creates inclusive opportunity', 'Good transition', 'Constructive feedback', 'Clear instructions', 'Confident English', 'Well prepared', 'Good pacing', 'Encourages quiet students'];
const AREAS = ['TTT should be decreased', 'Develop more empathy while feedback', 'Should include pre-video instruction', 'Should increase passive student participation', 'More speaking checks at the end', 'Slow down when giving instructions', 'Use more pair work'];
const list = (xs, n) => [...xs].sort(() => rnd() - 0.5).slice(0, n).map((t, i) => `${i + 1}. ${t}`).join('\n');

const TEACHERS = [
  ['Mirpur', 'Prarthona Hoque'], ['Mirpur', 'Syed Al Farabi'], ['Mirpur', 'Tahzebun Kobita'], ['Mirpur', 'Md Ziaul Haq Jibon'],
  ['Moghbazar', 'Afra Rumali Anan'], ['Moghbazar', 'Arpita Das'], ['Moghbazar', 'Fairuj Fariha'], ['Moghbazar', 'Raisa Bente Alam'],
  ['Panthapath', 'Nafisa Zaman'], ['Panthapath', 'Promity Roy Chowdhury'], ['Panthapath', 'Udvash Saha'],
  ['Chattogram', 'Abeer'], ['Chattogram', 'Bushra Jahan'], ['Chattogram', 'Raheta Sadeka'], ['Chattogram', 'Nasaba Magnona Rawan'],
];

const avg = (xs) => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100;
const rows = TEACHERS.map(([branch, name], i) => {
  const scores = i === 0 ? [3, 4, 2, 4, 5, 3, 5, 3, 2, 3] : Array.from({ length: 10 }, () => Math.min(5, Math.max(1, Math.round(3.8 + (rnd() - 0.4) * 2.6))));
  return {
    instructor_name: name, branch, rater: i === 0 ? OBSERVERS[0] : pick(OBSERVERS), scores, average_rating: avg(scores),
    strengths: i === 0 ? '1. Interactive\n2. Creates inclusive opportunity\n3. Good transition\n4. Constructive feedback' : list(STRENGTHS, 2 + Math.floor(rnd() * 3)),
    areas_of_development: i === 0 ? '1. TTT should be decreased\n2. Develop more empathy while feedback\n3. Should include pre-video instruction\n4. Should increase passive student participation' : list(AREAS, 1 + Math.floor(rnd() * 3)),
    remarks: '', rated_on: day(),
  };
});

const force = process.argv.includes('--force');
const { res } = await sb('programme_ratings?select=id', { headers: { prefer: 'count=exact', range: '0-0' } });
const have = Number(res.headers.get('content-range')?.split('/')[1] ?? 0);
if (have && !force) {
  console.log(`programme_ratings already has ${have} rows. Re-run with --force to wipe and re-import.`);
  process.exit(0);
}
if (have) await sb('programme_ratings?id=gt.0', { method: 'DELETE' });
await sb('programme_ratings', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify(rows) });
console.log(`Imported ${rows.length} Programme-team ratings.`);
