// Demo OpEx ratings, copied from the OpEx team's sheet (one monthly round), each given a made-up date between
// 1 Jan 2026 and today so the date filter has something to show.
//   npm run db:opex            → only if the table is empty
//   npm run db:opex -- --force → wipes the table first
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
    if (body?.code === 'PGRST205') throw new Error('The opex_ratings table does not exist yet. Run supabase/add-opex.sql in the Supabase SQL editor first.');
    throw new Error(`Supabase ${res.status}: ${body?.message ?? res.statusText}`);
  }
  return { body, res };
}

const RATERS = {
  Chattogram: 'Mohammad Shafkat Aziz, Mohammad Rifat Mahmud',
  Mirpur: 'Md Raju Ahmmed',
  Moghbazar: 'Nomit Akone Lamim',
  Panthapath: 'Noor Islam Babu',
};
// branch, teacher, six scores (blank rows of the sheet — teachers not yet rated — are left out)
const DATA = [
  ['Chattogram', 'Abeer', 5, 5, 4, 4, 5, 5],
  ['Chattogram', 'Anika Kader Aboni', 5, 5, 5, 5, 5, 5],
  ['Chattogram', 'Bushra Jahan', 5, 5, 5, 5, 5, 5],
  ['Chattogram', 'Fariya Islam', 5, 5, 5, 5, 5, 5],
  ['Chattogram', 'Mumtahana Islam', 5, 5, 5, 5, 5, 5],
  ['Chattogram', 'Nasaba Magnona Rawan', 5, 5, 4, 5, 5, 5],
  ['Chattogram', 'Raheta Sadeka', 5, 4, 5, 5, 5, 4],
  ['Mirpur', 'Khadizatul Kobra Safa', 5, 5, 5, 5, 4, 5],
  ['Mirpur', 'Md Ziaul Haq Jibon', 5, 5, 5, 5, 4, 5],
  ['Mirpur', 'Prarthona Hoque', 4, 5, 5, 4, 4, 5],
  ['Mirpur', 'Syed Al Farabi', 5, 5, 5, 5, 4, 5],
  ['Mirpur', 'Tahzebun Kobita', 5, 5, 5, 5, 4, 5],
  ['Moghbazar', 'Afra Rumali Anan', 3, 5, 5, 5, 4, 5],
  ['Moghbazar', 'Arpita Das', 5, 5, 4, 4, 4, 4],
  ['Moghbazar', 'Fairuj Fariha', 5, 5, 5, 4, 5, 5],
  ['Moghbazar', 'Irteza Ahamed Chowdhury', 5, 5, 5, 4, 5, 5],
  ['Moghbazar', 'Marja Binte Mansoor Meem', 5, 5, 5, 5, 5, 5],
  ['Moghbazar', 'Md. Sahedul Islam Hira', 5, 5, 5, 5, 5, 5],
  ['Moghbazar', 'Raisa Bente Alam', 5, 5, 5, 5, 3, 5],
  ['Panthapath', 'Nafisa Zaman', 4, 4, 5, 5, 5, 5],
  ['Panthapath', 'Promity Roy Chowdhury', 5, 5, 4, 5, 5, 5],
  ['Panthapath', 'Udvash Saha', 4, 5, 5, 5, 5, 5],
];

let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const start = Date.UTC(2026, 0, 1);
const end = Date.UTC(2026, 9, 17);
const day = () => new Date(start + Math.floor(rnd() * ((end - start) / 86_400_000 + 1)) * 86_400_000).toISOString().slice(0, 10);

const force = process.argv.includes('--force');
const { res } = await sb('opex_ratings?select=id', { headers: { prefer: 'count=exact', range: '0-0' } });
const have = Number(res.headers.get('content-range')?.split('/')[1] ?? 0);
if (have && !force) {
  console.log(`opex_ratings already has ${have} rows. Re-run with --force to wipe and re-import.`);
  process.exit(0);
}
if (have) await sb('opex_ratings?id=gt.0', { method: 'DELETE' });

const rows = DATA.map(([branch, name, ...scores]) => ({ instructor_name: name, branch, rater: RATERS[branch], scores, average_rating: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100, remarks: '', rated_on: day() }));
await sb('opex_ratings', { method: 'POST', headers: { prefer: 'return=minimal' }, body: JSON.stringify(rows) });
console.log(`Imported ${rows.length} OpEx ratings.`);
