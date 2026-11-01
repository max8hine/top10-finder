import { loadConfig } from './config.js';
import { poll } from './poll.js';
import { loadSnapshot } from './snapshot.js';
import type { RefreshStatus } from './types.js';

// Runs a poll in the background of a long-lived process (the API), so a page load can start one
// without waiting minutes for it. Only one poll runs at a time.

let running = false;
let lastError: string | null = null;

export function refreshStatus(): RefreshStatus {
  return { fetchedAt: loadSnapshot()?.fetchedAt ?? null, polling: running, error: lastError };
}

/** Start a background poll if the latest one is older than config.pollEveryHours (or `force`). Returns at once. */
export function refresh({ force = false }: { force?: boolean } = {}): RefreshStatus {
  const cfg = loadConfig();
  const { fetchedAt } = refreshStatus();
  const stale = !fetchedAt || Date.now() - Date.parse(fetchedAt) > cfg.pollEveryHours * 3_600_000;

  if (!running && (force || stale)) {
    running = true;
    lastError = null;
    poll(cfg)
      .catch((err) => { lastError = err instanceof Error ? err.message : String(err); })
      .finally(() => { running = false; });
  }
  return refreshStatus();
}
