import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from './paths.js';

mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(join(DATA_DIR, 'prices.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS observations (
    fetched_at TEXT NOT NULL,    -- ISO UTC, one value per poll
    room_id    INTEGER NOT NULL,
    stay_date  TEXT NOT NULL,    -- check-in, YYYY-MM-DD
    nights     INTEGER NOT NULL,
    adults     INTEGER NOT NULL,
    available  INTEGER NOT NULL, -- 1/0
    price      REAL,             -- member total for the whole stay
    note       TEXT
  );
  CREATE INDEX IF NOT EXISTS observations_stay
    ON observations (room_id, stay_date, nights, adults, fetched_at);
`);

export interface Observation {
  fetched_at: string;
  room_id: number;
  stay_date: string;
  nights: number;
  adults: number;
  available: number;
  price: number | null;
  note: string | null;
}

export const insertObservation = db.prepare(
  `INSERT INTO observations (fetched_at, room_id, stay_date, nights, adults, available, price, note)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

export const latestObservation = db.prepare(
  `SELECT available, price FROM observations
   WHERE room_id = ? AND stay_date = ? AND nights = ? AND adults = ?
   ORDER BY fetched_at DESC LIMIT 1`);

/** Every observation for stays on or after `sinceDate`, oldest first. */
export const observationsSince = (sinceDate: string) =>
  db.prepare(
    `SELECT fetched_at, room_id, stay_date, nights, adults, available, price, note
     FROM observations WHERE stay_date >= ? ORDER BY fetched_at`)
    .all(sinceDate) as unknown as Observation[];

export const historyFor = (roomId: number, stayDate: string) =>
  db.prepare(
    `SELECT fetched_at, room_id, stay_date, nights, adults, available, price, note
     FROM observations WHERE room_id = ? AND stay_date = ? ORDER BY fetched_at`)
    .all(roomId, stayDate) as unknown as Observation[];
