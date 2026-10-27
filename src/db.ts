import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';

mkdirSync('data', { recursive: true });
export const db = new DatabaseSync('data/prices.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS observations (
    id INTEGER PRIMARY KEY,
    fetched_at TEXT NOT NULL,        -- ISO UTC
    hotel_id INTEGER NOT NULL,
    room_id INTEGER NOT NULL,
    stay_date TEXT NOT NULL,         -- check-in date
    nights INTEGER NOT NULL,
    adults INTEGER NOT NULL,
    available INTEGER NOT NULL,      -- 1/0
    base_amount REAL,                -- public total before member discount
    member_total REAL,               -- total charged to the logged-in member
    note TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_obs_key ON observations (hotel_id, room_id, stay_date, nights, adults, fetched_at);
`);

export interface Obs { fetched_at: string; available: number; base_amount: number | null; member_total: number | null }
export const lastObservation = db.prepare(
  `SELECT fetched_at, available, base_amount, member_total FROM observations
   WHERE hotel_id=? AND room_id=? AND stay_date=? AND nights=? AND adults=? ORDER BY id DESC LIMIT 1`);
export const insertObservation = db.prepare(
  `INSERT INTO observations (fetched_at,hotel_id,room_id,stay_date,nights,adults,available,base_amount,member_total,note)
   VALUES (?,?,?,?,?,?,?,?,?,?)`);
