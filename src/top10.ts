import 'dotenv/config';

const BASE = 'https://top10.co.nz';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36';

type Jar = Record<string, string>;
const collect = (res: Response, jar: Jar) => {
  for (const c of res.headers.getSetCookie()) {
    const [kv] = c.split(';'); const i = kv.indexOf('=');
    jar[kv.slice(0, i)] = kv.slice(i + 1);
  }
};
const header = (jar: Jar) => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');

export interface Offer { total: number; baseAmount: number; nightly: { date: string; amount: number }[]; isMember: boolean }
export type PriceResult = { offer: Offer } | { offer: null; message: string };

export class Top10 {
  private jar: Jar = {};
  private lastRequest = 0;
  constructor(private minIntervalMs: number) {}

  private async throttled(url: string, init: RequestInit = {}): Promise<Response> {
    const wait = this.lastRequest + this.minIntervalMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastRequest = Date.now();
    return fetch(url, { ...init, headers: { 'user-agent': UA, accept: '*/*', cookie: header(this.jar), ...init.headers } });
  }

  /** Member login via the header-login form (antiforgery token + multipart POST). */
  async login(email = process.env.TOP10_EMAIL, password = process.env.TOP10_PASSWORD) {
    if (!email || !password) throw new Error('Set TOP10_EMAIL / TOP10_PASSWORD in .env');
    this.jar = {};
    const home = await this.throttled(BASE + '/');
    collect(home, this.jar);
    const html = await home.text();
    const form = html.slice(html.indexOf('id="header-login"'));
    const field = (n: string) => form.match(new RegExp(`name="${n}"[^>]*value="([^"]*)"`))?.[1] ?? '';
    const fd = new FormData();
    fd.set('SubmittedFormId', 'header-login'); fd.set('RedirectLinkUrl', '');
    fd.set('Username', email); fd.set('Password', password);
    fd.set('__RequestVerificationToken', field('__RequestVerificationToken')); fd.set('ufprt', field('ufprt'));
    const res = await this.throttled(BASE + '/', { method: 'POST', body: fd, redirect: 'manual', headers: { origin: BASE, referer: BASE + '/' } });
    collect(res, this.jar);
    if (!this.jar['Top10.Identity']) throw new Error(`Login failed (status ${res.status}); no Top10.Identity cookie`);
  }

  /** Check-in dates (YYYY-MM-DD) that are bookable as arrival days, for the months covering [fromMonth, toMonth]. */
  async arrivalDays(hotelId: number, roomId: number, fromMonth: string, toMonth: string): Promise<{ date: string; available: boolean }[]> {
    const res = await this.throttled(`${BASE}/api/hotels/${hotelId}/rooms/${roomId}/availability/${fromMonth}/${toMonth}`);
    if (!res.ok) throw new Error(`availability ${res.status}`);
    const j: any = await res.json();
    return j.days.map((d: any) => ({ date: String(d.date).slice(0, 10), available: d.status === 4 }));
  }

  async price(hotelId: number, roomId: number, from: string, to: string, adults: number): Promise<PriceResult> {
    const url = `${BASE}/api/hotels/${hotelId}/rooms/${roomId}/pricing/${from}/${to}?adults=${adults}&children=0&infants=0&promoCode=&explain=true`;
    const res = await this.throttled(url);
    if (!res.ok) throw new Error(`pricing ${res.status} for ${url}`);
    const j: any = await res.json();
    const o = j.offers?.[0];
    if (!o) return { offer: null, message: j.messages?.[0] ?? 'no offer' };
    const nightly = (o.dailyBreakdown ?? []).map((d: any) => ({ date: String(d.date).slice(0, 10), amount: d.amount }));
    return { offer: { total: o.totalAmount, baseAmount: nightly.reduce((s: number, n: any) => s + n.amount, 0), nightly, isMember: !!o.bookingDetail?.isMember } };
  }
}
