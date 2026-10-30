// Plain data shapes shared by the core library and the apps. No Node-only imports, so the web app can import this file.

export interface Room {
  hotelId: number;
  roomId: number;
  park: string;
  name: string;
}

export interface Config {
  adults: number;
  /** Stay lengths to price, e.g. [1, 2, 3]. */
  nights: number[];
  /** How many days of check-in dates to poll, counted from today. */
  horizonDays: number;
  /** Smallest drop (%) that poll() reports as a change. */
  minDropPct: number;
  requestsPerSecond: number;
  rooms: Room[];
}

export interface Deal {
  hotelId: number;
  roomId: number;
  label: string;
  stayDate: string;
  nights: number;
  price: number;
  /** Price at the previous poll, or null if this is the first sighting. */
  previousPrice: number | null;
  lowestPrice: number;
  /** True when the current price is the lowest ever recorded for this stay. */
  isLowest: boolean;
}

export interface LeadPoint {
  /** Days between the poll and check-in. 0 = same day. */
  daysBefore: number;
  samples: number;
  /** Average of price / cheapest price seen for the same stay. 1.0 = as cheap as it gets. */
  avgRatio: number;
}

export interface CatalogRoom {
  roomId: number;
  name: string;
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
