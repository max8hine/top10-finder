import { addDays, today } from './date.js';
import type { Config } from './types.js';

/**
 * Friday check-in dates for the weekend stays that are recorded outside the horizon.
 * The upcoming Friday is week 0. `startWeeks` moves the first one forward, and `count` is how many follow.
 */
export function weekendCheckIns({ startWeeks, count }: Config['weekends'], from = today()): string[] {
  const dow = new Date(from + 'T00:00:00').getDay(); // 0 = Sunday, 5 = Friday
  const toFriday = (5 - dow + 7) % 7;
  const upcoming = addDays(from, toFriday);
  return Array.from({ length: count }, (_, i) => addDays(upcoming, 7 * (startWeeks + i)));
}
