import 'dotenv/config';

// Headless login once (Playwright) -> reuse session cookies with plain fetch.
// Compares anonymous vs member price for the same room across near-term dates.
const BASE = 'https://top10.co.nz';
const HOTEL = Number(process.env.HOTEL_ID ?? 3008);
const ROOMS = (process.env.ROOM_IDS ?? '476,477').split(',').map(Number);
const OFFSETS = [0, 1, 7, 14];
const NIGHTS = 1;

const { TOP10_EMAIL: email, TOP10_PASSWORD: pw } = process.env;
if (!email || !pw) throw new Error('Set TOP10_EMAIL / TOP10_PASSWORD in .env');

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36';
const jar = (res: Response, prev: Record<string, string> = {}) => {
  for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); prev[kv.slice(0, i)] = kv.slice(i + 1); }
  return prev;
};
const toHeader = (j: Record<string, string>) => Object.entries(j).map(([k, v]) => `${k}=${v}`).join('; ');

// Pure-HTTP login: GET home for antiforgery tokens, POST the header-login form.
async function loginCookies(): Promise<string> {
  const home = await fetch(BASE + '/', { headers: { 'user-agent': UA } });
  const cookies = jar(home);
  const html = await home.text();
  const form = html.slice(html.indexOf('id="header-login"'));
  const field = (n: string) => form.match(new RegExp(`name="${n}"[^>]*value="([^"]*)"`))?.[1] ?? '';
  const fd = new FormData();
  fd.set('SubmittedFormId', 'header-login'); fd.set('RedirectLinkUrl', '');
  fd.set('Username', email!); fd.set('Password', pw!);
  fd.set('__RequestVerificationToken', field('__RequestVerificationToken')); fd.set('ufprt', field('ufprt'));
  const res = await fetch(BASE + '/', { method: 'POST', body: fd, redirect: 'manual', headers: { 'user-agent': UA, cookie: toHeader(cookies), origin: BASE, referer: BASE + '/' } });
  jar(res, cookies);
  console.log('login POST status', res.status);
  return toHeader(cookies);
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };

async function price(room: number, from: string, to: string, cookie?: string) {
  const url = `${BASE}/api/hotels/${HOTEL}/rooms/${room}/pricing/${from}/${to}?adults=2&children=0&infants=0&promoCode=&explain=true`;
  const res = await fetch(url, { headers: { accept: '*/*', 'user-agent': 'Mozilla/5.0', ...(cookie ? { cookie } : {}) } });
  if (!res.ok) return `HTTP ${res.status}`;
  const j: any = await res.json();
  const o = j.offers?.[0];
  return o ? { total: o.totalAmount, isMember: o.bookingDetail?.isMember, discount: o.yourDiscountAmount, name: o.name } : (j.messages?.[0] ?? 'none');
}

const cookie = await loginCookies();
console.log('logged in, cookie names:', cookie.split('; ').map((c) => c.split('=')[0]).join(', '));
for (const room of ROOMS) {
  for (const off of OFFSETS) {
    const from = iso(addDays(off)), to = iso(addDays(off + NIGHTS));
    const [anon, member] = [await price(room, from, to), await price(room, from, to, cookie)];
    console.log(`room ${room} ${from}+${NIGHTS}n  anon:`, JSON.stringify(anon), ' member:', JSON.stringify(member));
    await new Promise((r) => setTimeout(r, 700));
  }
}
