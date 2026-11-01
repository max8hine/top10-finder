import { loadCatalog, saveCatalog } from './catalog.js';
import { loadConfig, saveConfig } from './config.js';
import type { Catalog } from './types.js';

/**
 * Stop tracking a room: remove it from config.json (so later polls skip it) and from the
 * catalog (so it disappears from the app). Its recorded price history is kept. To track it
 * again, add it back to config.json and run `sync`.
 */
export function removeRoom(roomId: number): Catalog {
  const cfg = loadConfig();
  if (!cfg.rooms.some((r) => r.roomId === roomId)) throw new Error(`room ${roomId} is not tracked`);
  saveConfig({ ...cfg, rooms: cfg.rooms.filter((r) => r.roomId !== roomId) });

  const catalog = loadCatalog();
  const parks = catalog.parks
    .map((p) => ({ ...p, rooms: p.rooms.filter((r) => r.roomId !== roomId) }))
    .filter((p) => p.rooms.length > 0);
  const next = { ...catalog, parks };
  saveCatalog(next);
  return next;
}
