import { loadConfig } from './config.js';
import { addDays, today } from './date.js';
import { lowestSeen, stayKey } from './history.js';
import { loadSnapshot, type Stay } from './snapshot.js';
import type { Deal, DealsResult } from './types.js';

/**
 * Stays bookable as of the latest poll, with a check-in from `fromDay` to `toDay` days from
 * today (default: today onward, which includes the weekend stays beyond the horizon). Cheapest per night first.
 */
export function deals({ fromDay = 0, toDay }: { fromDay?: number; toDay?: number } = {}): DealsResult {
  const cfg = loadConfig();
  const snapshot = loadSnapshot();
  if (!snapshot) return { fetchedAt: null, deals: [] };
  const start = today();
  const lows = lowestSeen(start);
  const from = addDays(start, fromDay);
  const to = toDay === undefined ? '9999-12-31' : addDays(start, toDay);
  const rooms = new Map(cfg.rooms.map((r) => [r.roomId, r]));

  const list: Deal[] = snapshot.stays
    .filter((s): s is Stay & { total: number } => s.total !== null && rooms.has(s.roomId) && s.stayDate >= from && s.stayDate <= to)
    .map((s) => {
      const room = rooms.get(s.roomId);
      const low = lows.get(stayKey(s.roomId, s.stayDate, s.nights));
      return {
        hotelId: s.hotelId,
        roomId: s.roomId,
        label: room ? `${room.park} / ${room.name}` : String(s.roomId),
        stayDate: s.stayDate,
        nights: s.nights,
        price: Math.round((s.total / s.nights) * 100) / 100,
        total: s.total,
        low: low && low.polls > 1 ? { price: Math.round((low.total / s.nights) * 100) / 100, seenAt: low.seenAt } : null,
      };
    })
    .sort((a, b) => a.price - b.price || a.stayDate.localeCompare(b.stayDate));

  return { fetchedAt: snapshot.fetchedAt, deals: list };
}
