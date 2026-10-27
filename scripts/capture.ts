import 'dotenv/config';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';

// Headed capture: log in as member, do one park search by hand, and we record
// every XHR/fetch/document request (secrets redacted) to captures/.
const SENSITIVE = /^(cookie|set-cookie|authorization|x-csrf.*|x-xsrf.*)$/i;
const redactHeaders = (h: Record<string, string>) =>
  Object.fromEntries(Object.entries(h).map(([k, v]) => [k, SENSITIVE.test(k) ? '<redacted>' : v]));
const redactBody = (s?: string | null) =>
  s?.replace(/((?:pass(?:word)?|pwd)=)[^&]*/gi, '$1<redacted>').replace(/("pass(?:word)?"\s*:\s*")[^"]*/gi, '$1<redacted>');

mkdirSync('captures', { recursive: true });
const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({ recordHar: { path: 'captures/session.har', content: 'omit' } });
const page = await ctx.newPage();
const log: unknown[] = [];

page.on('response', async (res) => {
  const req = res.request();
  if (!['xhr', 'fetch', 'document'].includes(req.resourceType())) return;
  let body: string | undefined;
  try {
    const ct = res.headers()['content-type'] ?? '';
    if (/json|text|xml/.test(ct)) body = (await res.text()).slice(0, 20000);
  } catch {}
  log.push({
    t: new Date().toISOString(), method: req.method(), url: req.url(), status: res.status(),
    type: req.resourceType(), reqHeaders: redactHeaders(await req.allHeaders()),
    postData: redactBody(req.postData()), respBody: redactBody(body),
  });
});

const rl = createInterface({ input: process.stdin, output: process.stdout });
const save = (name: string) => {
  writeFileSync(`captures/${name}.json`, JSON.stringify(log, null, 2));
  console.log(`saved captures/${name}.json (${log.length} entries)`);
  log.length = 0;
};

// Part 1: anonymous search
await page.goto('https://top10.co.nz/');
await rl.question('\n[1/2] LOGGED OUT: search one park (e.g. dates ~1 week out) until prices show, then press Enter... ');
save('anon');

// Part 2: member login + same search
await page.goto('https://top10.co.nz/membership/dashboard/');
const { TOP10_EMAIL: email, TOP10_PASSWORD: pw } = process.env;
if (email && pw) {
  try {
    await page.locator('input[type=email], input[name*=email i]').first().fill(email, { timeout: 5000 });
    await page.locator('input[type=password]').first().fill(pw, { timeout: 5000 });
    await page.locator('button[type=submit], input[type=submit]').first().click({ timeout: 5000 });
  } catch { console.log('Auto-fill failed; please log in manually in the browser.'); }
} else console.log('No .env creds; please log in manually in the browser.');
await rl.question('\n[2/2] LOGGED IN: confirm you are logged in, search the SAME park/dates, then press Enter... ');
save('member');

await ctx.close(); await browser.close(); rl.close();
