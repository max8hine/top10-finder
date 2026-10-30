import 'dotenv/config';
import { ymd } from './date.js';

const BASE = 'https://top10.co.nz';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36';

/** Price for the logged-in member. `price` is null when the stay can't be booked. */
export interface Quote {
  available: boolean;
  price: number | null;
  note: string | null;
}

const cookieHeader = (jar: Record<string, string>) =>
  Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');

/** Logged-in client for the TOP 10 site. Requests are spaced out by `minIntervalMs`. */
export class Top10Client {
  private cookies: Record<string, string> = {};
  private lastRequest = 0;

  constructor(private minIntervalMs: number) {}

  private async send(url: string, init: RequestInit = {}): Promise<Response> {
    const wait = this.lastRequest + this.minIntervalMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastRequest = Date.now();
    const res = await fetch(url, {
      ...init,
      headers: { 'user-agent': UA, accept: '*/*', cookie: cookieHeader(this.cookies), ...init.headers },
    });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(';');
      const i = kv.indexOf('=');
      this.cookies[kv.slice(0, i)] = kv.slice(i + 1);
    }
    return res;
  }

  /** Header-login form: scrape the antiforgery tokens, then POST the form. */
  async login(email = process.env.TOP10_EMAIL, password = process.env.TOP10_PASSWORD) {
    if (!email || !password) throw new Error('Set TOP10_EMAIL and TOP10_PASSWORD in .env');
    this.cookies = {};
    const html = await (await this.send(BASE + '/')).text();
    const form = html.slice(html.indexOf('id="header-login"'));
    const field = (n: string) => form.match(new RegExp(`name="${n}"[^>]*value="([^"]*)"`))?.[1] ?? '';
    const body = new FormData();
    body.set('SubmittedFormId', 'header-login');
    body.set('RedirectLinkUrl', '');
    body.set('Username', email);
    body.set('Password', password);
    body.set('__RequestVerificationToken', field('__RequestVerificationToken'));
    body.set('ufprt', field('ufprt'));
    await this.send(BASE + '/', { method: 'POST', body, redirect: 'manual', headers: { origin: BASE, referer: BASE + '/' } });
    if (!this.cookies['Top10.Identity']) throw new Error('Login failed: no Top10.Identity cookie');
  }

  /** Check-in dates from `fromDate` to `toDate` (inclusive, YYYY-MM-DD). status 4 = bookable. */
  async arrivalDays(hotelId: number, roomId: number, fromDate: string, toDate: string): Promise<{ date: string; available: boolean }[]> {
    // The endpoint returns whole months from the 1st of the first month up to the 1st of the last month,
    // so ask for the month after `toDate` and filter to the exact range.
    const [y, m] = toDate.slice(0, 7).split('-').map(Number);
    const monthAfter = ymd(new Date(y, m, 1)).slice(0, 7);
    const res = await this.send(`${BASE}/api/hotels/${hotelId}/rooms/${roomId}/availability/${fromDate.slice(0, 7)}/${monthAfter}`);
    if (!res.ok) throw new Error(`availability ${res.status}`);
    const j = (await res.json()) as { days: { date: string; status: number }[] };
    return j.days
      .map((d) => ({ date: String(d.date).slice(0, 10), available: d.status === 4 }))
      .filter((d) => d.date >= fromDate && d.date <= toDate);
  }

  /** Member price for a stay. */
  async quote(hotelId: number, roomId: number, checkIn: string, checkOut: string, adults: number): Promise<Quote> {
    const url = `${BASE}/api/hotels/${hotelId}/rooms/${roomId}/pricing/${checkIn}/${checkOut}?adults=${adults}&children=0&infants=0&promoCode=&explain=true`;
    const res = await this.send(url);
    if (!res.ok) throw new Error(`pricing ${res.status}`);
    const j = (await res.json()) as { offers?: { totalAmount: number }[]; messages?: string[] };
    const offer = j.offers?.[0];
    if (!offer) return { available: false, price: null, note: j.messages?.[0] ?? 'no offer' };
    return { available: true, price: offer.totalAmount, note: null };
  }
}
