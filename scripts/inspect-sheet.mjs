import fs from 'node:fs';
import crypto from 'node:crypto';

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split('\n').filter(l => l.includes('=')).map(l => {
    const i = l.indexOf('=');
    let v = l.slice(i + 1).trim();
    if (v.startsWith('"')) v = v.slice(1, -1);
    return [l.slice(0, i), v.replace(/\\n/g, '\n')];
  })
);

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
  iss: env.GOOGLE_CLIENT_EMAIL, scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
  aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
});
const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(env.GOOGLE_PRIVATE_KEY).toString('base64url');
const tok = await (await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + sig }),
})).json();
if (!tok.access_token) { console.error('AUTH FAIL', tok); process.exit(1); }
const H = { authorization: 'Bearer ' + tok.access_token };
const id = env.GOOGLE_SHEET_ID;
const meta = await (await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=properties.title,sheets.properties`, { headers: H })).json();
if (meta.error) { console.error('META FAIL', meta.error); process.exit(1); }
console.log('TITLE:', meta.properties.title);
for (const s of meta.sheets) console.log(' -', JSON.stringify(s.properties.title), 'rows', s.properties.gridProperties.rowCount, 'cols', s.properties.gridProperties.columnCount, 'gid', s.properties.sheetId);
fs.mkdirSync('scripts/.out', { recursive: true });
fs.writeFileSync('scripts/.out/meta.json', JSON.stringify(meta, null, 2));
