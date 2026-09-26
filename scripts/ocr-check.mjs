// Pilot helper: send photos/PDFs through the OCR endpoint and print what was read,
// so you can compare against numbers you typed by hand.
//   npm run dev            (in another terminal; needs ANTHROPIC_API_KEY in .env)
//   node scripts/ocr-check.mjs forms/*.jpg
import fs from 'node:fs';
import path from 'node:path';

const base = process.env.BASE_URL ?? 'http://localhost:3000';
const key = process.env.UPLOAD_ACCESS_KEY ?? '';
const files = process.argv.slice(2);
if (!files.length) {
  console.error('Usage: node scripts/ocr-check.mjs <photo-or-pdf> [...]');
  process.exit(1);
}
const mime = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.pdf': 'application/pdf' };

for (const f of files) {
  const type = mime[path.extname(f).toLowerCase()];
  if (!type) { console.log(`${f}: unsupported type`); continue; }
  const body = new FormData();
  body.append('file', new File([fs.readFileSync(f)], path.basename(f), { type }));
  const res = await fetch(`${base}/api/collect/ocr`, { method: 'POST', body, headers: key ? { 'x-access-key': key } : {} });
  const json = await res.json();
  if (!res.ok) { console.log(`${f}: ERROR ${res.status} ${json.error}`); continue; }
  for (const r of json.responses) {
    const h = r.header ?? {};
    console.log(`${r.source}  | branch=${h.branch ?? '—'} batch=${h.batch ?? '—'} teacher=${h.teacher ?? '—'} | scores=${r.scores.map((s) => s ?? '·').join(' ')}${r.flags.length ? '  ⚠ ' + r.flags.join('; ') : ''}`);
    if (r.feedback) console.log(`    feedback: ${r.feedback}`);
  }
}
