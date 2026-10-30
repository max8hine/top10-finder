// The public surface of the core library. The CLI and the API import from here.
export { poll, type PollResult } from './poll.js';
export { deals } from './search.js';
export { loadConfig } from './config.js';
export { loadCatalog, syncCatalog } from './catalog.js';
export { Top10Client } from './client.js';
export type { Config, Room, Deal, DealsResult, Catalog, CatalogPark, CatalogRoom } from './types.js';
