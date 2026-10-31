import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from './paths.js';

const FILE = join(DATA_DIR, 'prices.json');

/** One bookable stay: the first length in config.nights that could be booked for this check-in. */
export interface Stay {
  hotelId: number;
  roomId: number;
  stayDate: string;
  nights: number;
  /** Member price for the whole stay. */
  total: number;
}

/** Result of the latest poll. Each poll replaces the previous snapshot. */
export interface Snapshot {
  fetchedAt: string;
  stays: Stay[];
}

export function saveSnapshot(snapshot: Snapshot) {
  mkdirSync(DATA_DIR, { recursive: true });
  // Write then rename, so a reader never sees a half-written file.
  const tmp = FILE + '.tmp';
  writeFileSync(tmp, JSON.stringify(snapshot));
  renameSync(tmp, FILE);
}

/** The latest snapshot, or null if no poll has run yet. */
export function loadSnapshot(): Snapshot | null {
  try {
    return JSON.parse(readFileSync(FILE, 'utf8')) as Snapshot;
  } catch {
    return null;
  }
}
