import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from './config.js';
import { DATA_DIR } from './paths.js';
import type { Catalog, CatalogPark } from './types.js';

const BASE = 'https://top10.co.nz';
const FILE = join(DATA_DIR, 'catalog.json');

/** Subset of the site's /api/parks response that we use. */
interface SitePark {
  hotelId: number;
  name: string;
  townOrDistrict: string;
  url: string;
  image?: { url: string } | null;
  rooms: { roomTypeId: number; name: string; image?: { url: string } | null }[];
}

const absolute = (path?: string | null) => (path ? BASE + path : null);

/**
 * Fetch names, links, and images for the parks and rooms in config.json
 * and save them to data/catalog.json. Run after changing the config.
 */
export async function syncCatalog(): Promise<Catalog> {
  const res = await fetch(`${BASE}/api/parks`, { headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`/api/parks ${res.status}`);
  const sites = (await res.json()) as SitePark[];
  const cfg = loadConfig();

  const hotelIds = [...new Set(cfg.rooms.map((r) => r.hotelId))];
  const parks: CatalogPark[] = hotelIds.map((hotelId) => {
    const site = sites.find((p) => p.hotelId === hotelId);
    if (!site) throw new Error(`hotel ${hotelId} not found on the site`);
    const rooms = cfg.rooms.filter((r) => r.hotelId === hotelId).map((r) => {
      const room = site.rooms.find((x) => x.roomTypeId === r.roomId);
      if (!room) throw new Error(`room ${r.roomId} not found in hotel ${hotelId}`);
      return { roomId: r.roomId, name: room.name, image: absolute(room.image?.url) };
    });
    return {
      hotelId,
      name: site.name,
      town: site.townOrDistrict,
      url: BASE + site.url,
      image: absolute(site.image?.url),
      rooms,
    };
  });

  const catalog: Catalog = { syncedAt: new Date().toISOString(), parks };
  writeFileSync(FILE, JSON.stringify(catalog, null, 2) + '\n');
  return catalog;
}

export function loadCatalog(): Catalog {
  try {
    return JSON.parse(readFileSync(FILE, 'utf8')) as Catalog;
  } catch {
    throw new Error('No catalog yet. Run: pnpm run cli -- sync');
  }
}
