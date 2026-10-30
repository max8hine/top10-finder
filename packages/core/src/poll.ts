import { Top10Client, type Quote } from './client.js';
import { loadConfig } from './config.js';
import { addDays, today } from './date.js';
import { insertObservation, latestObservation } from './store.js';
import type { Config } from './types.js';

export interface Change {
  kind: 'drop' | 'available';
  label: string;
  stayDate: string;
  nights: number;
  from: number | null;
  to: number;
}

export interface PollResult {
  stays: number;
  requests: number;
  changes: Change[];
}

/**
 * Price every bookable stay in the horizon for each configured room and record it.
 * Reports price drops and stays that became bookable since the previous poll.
 */
export async function poll(cfg: Config = loadConfig()): Promise<PollResult> {
  const client = new Top10Client(1000 / cfg.requestsPerSecond);
  await client.login();

  const start = today();
  const end = addDays(start, cfg.horizonDays);
  const fetchedAt = new Date().toISOString();
  const result: PollResult = { stays: 0, requests: 0, changes: [] };

  for (const room of cfg.rooms) {
    const days = await client.arrivalDays(room.hotelId, room.roomId, start, end);
    result.requests++;

    for (const nights of cfg.nights) {
      for (const day of days) {
        const prev = latestObservation.get(room.roomId, day.date, nights, cfg.adults) as
          | { available: number; price: number | null }
          | undefined;

        let quote: Quote = { available: false, price: null, note: 'unavailable' };
        if (day.available) {
          quote = await client.quote(room.hotelId, room.roomId, day.date, addDays(day.date, nights), cfg.adults);
          result.requests++;
        }
        insertObservation.run(fetchedAt, room.roomId, day.date, nights, cfg.adults,
          quote.available ? 1 : 0, quote.price, quote.note);
        result.stays++;

        const label = `${room.park} / ${room.name}`;
        if (quote.price !== null && prev && !prev.available) {
          result.changes.push({ kind: 'available', label, stayDate: day.date, nights, from: null, to: quote.price });
        } else if (quote.price !== null && prev?.price != null &&
          ((quote.price - prev.price) / prev.price) * 100 <= -cfg.minDropPct) {
          result.changes.push({ kind: 'drop', label, stayDate: day.date, nights, from: prev.price, to: quote.price });
        }
      }
    }
  }
  return result;
}
