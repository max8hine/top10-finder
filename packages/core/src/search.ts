import { loadConfig } from './config.js';
import { addDays, daysBetween, localDate, today } from './date.js';
import { historyFor, observationsSince, type Observation } from './store.js';
import type { Deal, LeadPoint } from './types.js';

const stayKey = (o: Observation) => `${o.room_id}|${o.stay_date}|${o.nights}|${o.adults}`;

function groupByStay(rows: Observation[]) {
  const groups = new Map<string, Observation[]>();
  for (const o of rows) {
    const list = groups.get(stayKey(o)) ?? [];
    list.push(o);
    groups.set(stayKey(o), list);
  }
  return groups;
}

/**
 * Stays bookable right now (as of the latest poll) with a check-in in [fromDay, toDay]
 * days from today. Cheapest first.
 */
export function deals({ fromDay = 0, toDay = 7 } = {}): Deal[] {
  const cfg = loadConfig();
  const start = today();
  const from = addDays(start, fromDay);
  const to = addDays(start, toDay);
  const rooms = new Map(cfg.rooms.map((r) => [r.roomId, r]));

  const groups = [...groupByStay(observationsSince(from)).values()];

  // A poll stops at the first bookable length, so shorter lengths priced in older polls are stale.
  // For each room and check-in date, only the groups seen in the newest poll count.
  const dayKey = (o: Observation) => `${o.room_id}|${o.stay_date}|${o.adults}`;
  const newest = new Map<string, string>();
  for (const obs of groups) {
    const last = obs[obs.length - 1];
    if ((newest.get(dayKey(last)) ?? '') < last.fetched_at) newest.set(dayKey(last), last.fetched_at);
  }

  const out: Deal[] = [];
  for (const obs of groups) {
    const latest = obs[obs.length - 1];
    if (latest.fetched_at < (newest.get(dayKey(latest)) ?? '')) continue;
    if (!latest.available || latest.price === null) continue;
    if (latest.stay_date < from || latest.stay_date > to) continue;

    const priced = obs.filter((o) => o.price !== null).map((o) => o.price as number);
    const lowestPrice = Math.min(...priced);
    const previous = priced.length > 1 ? priced[priced.length - 2] : null;
    const room = rooms.get(latest.room_id);
    out.push({
      hotelId: room?.hotelId ?? 0,
      roomId: latest.room_id,
      label: room ? `${room.park} / ${room.name}` : String(latest.room_id),
      stayDate: latest.stay_date,
      nights: latest.nights,
      price: latest.price,
      previousPrice: previous,
      lowestPrice,
      isLowest: priced.length > 1 && latest.price === lowestPrice,
    });
  }
  return out.sort((a, b) => a.price - b.price || a.stayDate.localeCompare(b.stayDate));
}

/**
 * How far ahead of check-in prices tend to be cheapest, across all recorded stays.
 * Only stays with at least two priced observations are used.
 */
export function leadProfile(): LeadPoint[] {
  const buckets = new Map<number, number[]>();
  for (const obs of groupByStay(observationsSince('')).values()) {
    const priced = obs.filter((o) => o.price !== null && o.price > 0);
    if (priced.length < 2) continue;
    const cheapest = Math.min(...priced.map((o) => o.price as number));
    for (const o of priced) {
      const daysBefore = daysBetween(localDate(o.fetched_at), o.stay_date);
      if (daysBefore < 0) continue;
      const list = buckets.get(daysBefore) ?? [];
      list.push((o.price as number) / cheapest);
      buckets.set(daysBefore, list);
    }
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([daysBefore, ratios]) => ({
      daysBefore,
      samples: ratios.length,
      avgRatio: ratios.reduce((s, r) => s + r, 0) / ratios.length,
    }));
}

/** Every recorded observation for one room and check-in date, oldest first. */
export const history = (roomId: number, stayDate: string) => historyFor(roomId, stayDate);
