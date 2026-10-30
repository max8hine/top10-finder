import { loadConfig } from './config.js';
import { addDays, today } from './date.js';
import { loadSnapshot } from './snapshot.js';
import type { Deal, DealsResult } from './types.js';

/**
 * Stays bookable as of the latest poll, with a check-in from `fromDay` to `toDay` days from
 * today (default: today through the end of the horizon). Cheapest per night first.
 */
export function deals({ fromDay = 0, toDay }: { fromDay?: number; toDay?: number } = {}): DealsResult {
  const cfg = loadConfig();
  const snapshot = loadSnapshot();
  const start = today();
  const from = addDays(start, fromDay);
  const to = addDays(start, toDay ?? cfg.horizonDays);
  const rooms = new Map(cfg.rooms.map((r) => [r.roomId, r]));

  const list: Deal[] = snapshot.stays
    .filter((s) => s.stayDate >= from && s.stayDate <= to)
    .map((s) => {
      const room = rooms.get(s.roomId);
      return {
        hotelId: s.hotelId,
        roomId: s.roomId,
        label: room ? `${room.park} / ${room.name}` : String(s.roomId),
        stayDate: s.stayDate,
        nights: s.nights,
        price: Math.round((s.total / s.nights) * 100) / 100,
        total: s.total,
      };
    })
    .sort((a, b) => a.price - b.price || a.stayDate.localeCompare(b.stayDate));

  return { fetchedAt: snapshot.fetchedAt, deals: list };
}
