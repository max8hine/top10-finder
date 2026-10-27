import { readFileSync } from 'node:fs';
import { db, insertObservation, lastObservation, type Obs } from './db.js';
import { Top10 } from './top10.js';

const cfg = JSON.parse(readFileSync('data/watch.json', 'utf8')) as {
  adults: number; nights: number[]; horizonDays: number; minDropPct: number; requestsPerSecond: number;
};
const parks = JSON.parse(readFileSync('data/parks.json', 'utf8')).parks as { hotelId: number; name: string; rooms: { roomTypeId: number; name: string }[] }[];

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (s: string, n: number) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return ymd(d); };
const roomName = (h: number, r: number) => parks.flatMap((p) => p.rooms.map((x) => ({ ...x, park: p.name, hotelId: p.hotelId }))).find((x) => x.hotelId === h && x.roomTypeId === r);
const label = (h: number, r: number) => { const x = roomName(h, r); return x ? `${x.park} / ${x.name}` : `${h}/${r}`; };
const pct = (a: number, b: number) => ((a - b) / b) * 100;

async function poll() {
  const api = new Top10(1000 / cfg.requestsPerSecond);
  await api.login();
  const today = ymd(new Date());
  const last = addDays(today, cfg.horizonDays);
  const fetchedAt = new Date().toISOString();
  let requests = 0, rows = 0; const drops: string[] = [];

  for (const park of parks) for (const room of park.rooms) {
    const days = await api.arrivalDays(park.hotelId, room.roomTypeId, today.slice(0, 7), last.slice(0, 7));
    requests++;
    const arrivals = days.filter((d) => d.date >= today && d.date <= last);
    for (const nights of cfg.nights) for (const day of arrivals) {
      const key = [park.hotelId, room.roomTypeId, day.date, nights, cfg.adults] as const;
      const prev = lastObservation.get(...key) as Obs | undefined;
      let available = 0, base: number | null = null, member: number | null = null, note: string | null = null;
      if (day.available) {
        const r = await api.price(park.hotelId, room.roomTypeId, day.date, addDays(day.date, nights), cfg.adults);
        requests++;
        if (r.offer) { available = 1; base = r.offer.baseAmount; member = r.offer.total; } else note = r.message;
      } else note = 'unavailable';
      insertObservation.run(fetchedAt, ...key.slice(0, 2) as [number, number], day.date, nights, cfg.adults, available, base, member, note);
      rows++;
      if (member !== null && prev?.member_total != null && pct(member, prev.member_total) <= -cfg.minDropPct)
        drops.push(`↓ ${label(park.hotelId, room.roomTypeId)} ${day.date} (${nights}n): $${prev.member_total} → $${member} (${pct(member, prev.member_total).toFixed(1)}%)`);
      if (member !== null && prev && !prev.available)
        drops.push(`★ ${label(park.hotelId, room.roomTypeId)} ${day.date} (${nights}n): became available at $${member}`);
    }
  }
  console.log(`polled ${rows} nights with ${requests} requests`);
  console.log(drops.length ? drops.join('\n') : 'no drops since previous poll');
}

/** Latest price vs previous poll and vs the highest price ever seen for that night. */
function showDrops(minPct = cfg.minDropPct) {
  const keys = db.prepare(`SELECT DISTINCT hotel_id,room_id,stay_date,nights,adults FROM observations WHERE stay_date >= ? ORDER BY stay_date`).all(ymd(new Date())) as any[];
  const q = db.prepare(`SELECT member_total FROM observations WHERE hotel_id=? AND room_id=? AND stay_date=? AND nights=? AND adults=? AND member_total IS NOT NULL ORDER BY id`);
  let n = 0;
  for (const k of keys) {
    const t = (q.all(k.hotel_id, k.room_id, k.stay_date, k.nights, k.adults) as any[]).map((r) => r.member_total as number);
    if (t.length < 2) continue;
    const cur = t[t.length - 1], prev = t[t.length - 2], peak = Math.max(...t);
    if (pct(cur, peak) <= -minPct) {
      n++;
      console.log(`${k.stay_date} ${k.nights}n ${label(k.hotel_id, k.room_id)}: now $${cur}  (prev $${prev}, peak $${peak}, ${pct(cur, peak).toFixed(1)}% vs peak, ${t.length} obs)`);
    }
  }
  if (!n) console.log('no nights currently below their peak price');
}

function history(roomId: number, date: string) {
  const rows = db.prepare(`SELECT fetched_at, available, base_amount, member_total, note FROM observations WHERE room_id=? AND stay_date=? ORDER BY id`).all(roomId, date) as any[];
  if (!rows.length) return console.log('no observations');
  for (const r of rows) console.log(`${r.fetched_at}  ${r.available ? `member $${r.member_total} (public $${r.base_amount})` : r.note}`);
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'poll') await poll();
else if (cmd === 'drops') showDrops(args[0] ? Number(args[0]) : undefined);
else if (cmd === 'history' && args.length === 2) history(Number(args[0]), args[1]);
else console.log('usage: npm run cli -- poll | drops [minPct] | history <roomTypeId> <YYYY-MM-DD>');
