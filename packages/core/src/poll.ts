import { Top10Client } from './client.js';
import { loadConfig } from './config.js';
import { addDays, today } from './date.js';
import { recordPoll } from './history.js';
import { saveSnapshot, type Stay } from './snapshot.js';
import type { Config } from './types.js';

export interface PollResult {
  /** Bookable stays found. */
  stays: number;
  requests: number;
}

/**
 * Price every bookable check-in date in the horizon for each configured room and save the
 * result as the new snapshot and in the price history. For each date, config.nights is tried in order of preference
 * (e.g. [3, 2, 1]) and the first length that can be booked is kept.
 */
export async function poll(cfg: Config = loadConfig()): Promise<PollResult> {
  const client = new Top10Client(1000 / cfg.requestsPerSecond);
  await client.login();

  const start = today();
  const end = addDays(start, cfg.horizonDays);
  const stays: Stay[] = [];
  let requests = 0;

  for (const room of cfg.rooms) {
    const days = await client.arrivalDays(room.hotelId, room.roomId, start, end);
    requests++;

    for (const day of days) {
      if (!day.available) continue;
      for (const nights of cfg.nights) {
        const total = await client.quote(room.hotelId, room.roomId, day.date, addDays(day.date, nights), cfg.adults);
        requests++;
        if (total !== null) {
          stays.push({ hotelId: room.hotelId, roomId: room.roomId, stayDate: day.date, nights, total });
          break;
        }
      }
    }
  }

  const snapshot = { fetchedAt: new Date().toISOString(), stays };
  saveSnapshot(snapshot);
  recordPoll(snapshot, cfg.historyDays);
  return { stays: stays.length, requests };
}
