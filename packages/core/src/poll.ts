import { Top10Client } from './client.js';
import { loadConfig } from './config.js';
import { addDays, today } from './date.js';
import { recordPoll } from './history.js';
import { weekendCheckIns } from './weekends.js';
import { saveSnapshot, type Stay } from './snapshot.js';
import type { Config, Room } from './types.js';

export interface PollResult {
  /** Bookable stays found. */
  stays: number;
  requests: number;
}

/**
 * Price every check-in date in the horizon for each configured room and save the result as the
 * new snapshot and in the price history. For each date, config.nights is tried in order of
 * preference (e.g. [3, 2, 1]) and the first length that can be booked is kept. Dates that can't be
 * booked are recorded with a null total, so the history shows them too.
 */
export async function poll(cfg: Config = loadConfig()): Promise<PollResult> {
  const client = new Top10Client(1000 / cfg.requestsPerSecond);
  await client.login();

  const start = today();
  const end = addDays(start, cfg.horizonDays);
  // Weekend stays are priced at exactly `weekends.nights`, not the fallback, and sit beyond the horizon.
  const fridays = weekendCheckIns(cfg.weekends);
  const stays: Stay[] = [];
  let requests = 0;

  const add = (room: Room, stayDate: string, nights: number, total: number | null) =>
    stays.push({ hotelId: room.hotelId, roomId: room.roomId, stayDate, nights, total });

  // Quote each length in turn, recording every attempt. Stops at the first one that can be booked.
  const priceDate = async (room: Room, date: string, lengths: number[]) => {
    for (const nights of lengths) {
      const total = await client.quote(room.hotelId, room.roomId, date, addDays(date, nights), cfg.adults);
      requests++;
      add(room, date, nights, total);
      if (total !== null) return;
    }
  };

  for (const room of cfg.rooms) {
    const days = await client.arrivalDays(room.hotelId, room.roomId, start, end);
    requests++;
    for (const day of days) {
      if (day.available) await priceDate(room, day.date, cfg.nights);
      else add(room, day.date, cfg.nights[0], null);
    }

    if (fridays.length) {
      const weekendDays = await client.arrivalDays(room.hotelId, room.roomId, fridays[0], fridays[fridays.length - 1]);
      requests++;
      const { nights } = cfg.weekends;
      for (const day of weekendDays) {
        if (!fridays.includes(day.date)) continue;
        // Already recorded at this length by the horizon pass (possible if the horizon reaches this date).
        if (stays.some((s) => s.roomId === room.roomId && s.stayDate === day.date && s.nights === nights)) continue;
        if (day.available) await priceDate(room, day.date, [nights]);
        else add(room, day.date, nights, null);
      }
    }
  }

  const snapshot = { fetchedAt: new Date().toISOString(), stays };
  saveSnapshot(snapshot);
  recordPoll(snapshot, cfg.historyDays);
  return { stays: stays.filter((s) => s.total !== null).length, requests };
}
