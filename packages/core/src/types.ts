// Plain data shapes shared by the core library and the apps. No Node-only imports, so the web app can import this file.

export interface Room {
  hotelId: number;
  roomId: number;
  park: string;
  name: string;
}

export interface Config {
  adults: number;
  /** Stay lengths in order of preference, e.g. [3, 2, 1]. The first one that can be booked is priced. */
  nights: number[];
  /** How many days of check-in dates to poll, counted from today. */
  horizonDays: number;
  requestsPerSecond: number;
  /** A poll is started on page load when the last one is older than this. */
  pollEveryHours: number;
  /** Price history older than this many days is deleted. */
  historyDays: number;
  rooms: Room[];
}

export interface Deal {
  hotelId: number;
  roomId: number;
  label: string;
  stayDate: string;
  nights: number;
  /** Member price per night: the whole-stay total divided by nights. */
  price: number;
  /** Member price for the whole stay. */
  total: number;
  /** Lowest per-night price seen in history for this room, check-in date and length. Null until it has been seen twice. */
  low: { price: number; seenAt: string } | null;
}

export interface DealsResult {
  /** ISO time of the poll these prices come from, or null if no poll has run yet. */
  fetchedAt: string | null;
  deals: Deal[];
}

export interface RefreshStatus {
  /** ISO time of the latest finished poll, or null. */
  fetchedAt: string | null;
  /** A poll is running now. */
  polling: boolean;
  /** Error from the last background poll, if it failed. */
  error: string | null;
}

export interface CatalogRoom {
  roomId: number;
  name: string;
  /** Absolute page URL on the TOP 10 site. */
  url: string;
  /** Absolute image URL on the TOP 10 site, or null. */
  image: string | null;
}

export interface CatalogPark {
  hotelId: number;
  name: string;
  town: string;
  url: string;
  image: string | null;
  rooms: CatalogRoom[];
}

export interface Catalog {
  syncedAt: string;
  parks: CatalogPark[];
}
