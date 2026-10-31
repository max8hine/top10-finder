import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { addDays, today } from './date.js';
import { DATA_DIR } from './paths.js';
import type { Snapshot } from './snapshot.js';

// Every poll is kept (up to config.historyDays) so we can see how a stay's price moves.

let db: DatabaseSync | undefined;

function open(): DatabaseSync {
  if (db) return db;
  mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(join(DATA_DIR, 'history.db'));
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS polls (id INTEGER PRIMARY KEY, fetched_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS stays (
      poll_id INTEGER NOT NULL REFERENCES polls(id),
      hotel_id INTEGER NOT NULL,
      room_id INTEGER NOT NULL,
      stay_date TEXT NOT NULL,
      nights INTEGER NOT NULL,
      total REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS stays_key ON stays (room_id, stay_date, nights);
  `);
  return db;
}

/** Add a finished poll to the history and delete polls older than `keepDays`. */
export function recordPoll(snapshot: Snapshot, keepDays: number) {
  const d = open();
  d.exec('BEGIN');
  try {
    const { lastInsertRowid } = d.prepare('INSERT INTO polls (fetched_at) VALUES (?)').run(snapshot.fetchedAt);
    const insert = d.prepare('INSERT INTO stays (poll_id, hotel_id, room_id, stay_date, nights, total) VALUES (?, ?, ?, ?, ?, ?)');
    for (const s of snapshot.stays) insert.run(lastInsertRowid, s.hotelId, s.roomId, s.stayDate, s.nights, s.total);

    const cutoff = addDays(today(), -keepDays);
    d.prepare('DELETE FROM stays WHERE poll_id IN (SELECT id FROM polls WHERE fetched_at < ?)').run(cutoff);
    d.prepare('DELETE FROM polls WHERE fetched_at < ?').run(cutoff);
    d.exec('COMMIT');
  } catch (err) {
    d.exec('ROLLBACK');
    throw err;
  }
}

export interface Low {
  /** Lowest whole-stay total seen for this room, check-in date and length. */
  total: number;
  seenAt: string;
  /** How many polls have priced this stay. */
  polls: number;
}

/** Key for a stay: room, check-in date and length. Different lengths are never compared. */
export const stayKey = (roomId: number, stayDate: string, nights: number) => `${roomId}|${stayDate}|${nights}`;

/** Lowest price ever recorded for each stay checking in on or after `fromDate`. */
export function lowestSeen(fromDate: string): Map<string, Low> {
  const rows = open()
    .prepare(
      `SELECT room_id, stay_date, nights, total, fetched_at, polls FROM (
         SELECT s.room_id, s.stay_date, s.nights, s.total, p.fetched_at,
                ROW_NUMBER() OVER (PARTITION BY s.room_id, s.stay_date, s.nights ORDER BY s.total, p.fetched_at) AS rn,
                COUNT(*) OVER (PARTITION BY s.room_id, s.stay_date, s.nights) AS polls
         FROM stays s JOIN polls p ON p.id = s.poll_id
         WHERE s.stay_date >= ?
       ) WHERE rn = 1`,
    )
    .all(fromDate) as { room_id: number; stay_date: string; nights: number; total: number; fetched_at: string; polls: number }[];

  return new Map(rows.map((r) => [stayKey(r.room_id, r.stay_date, r.nights), { total: r.total, seenAt: r.fetched_at, polls: r.polls }]));
}
