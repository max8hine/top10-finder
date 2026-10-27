# top10-finder

Headless price tracker for [TOP 10 Holiday Parks](https://top10.co.nz/) (NZ). Polls the site's own JSON API as a logged-in member, stores each night's price in SQLite, and flags drops (to test whether rooms get cheaper close to arrival).

## Setup

```sh
npm install
npx playwright install chromium     # only needed for `npm run capture`
cp .env.example .env                # then fill in your member login
```

`.env`:

```
TOP10_EMAIL=you@example.com
TOP10_PASSWORD=...
```

Requires Node 22+ (uses built-in `node:sqlite`). `.env`, `captures/` and `data/prices.db*` are gitignored.

## Commands

| Command | What it does |
|---|---|
| `npm run sync-parks` | Regenerates `data/parks.json` from `/api/parks`, keeping only parks/rooms in `data/whitelist.json`. |
| `npm run cli -- poll` | Logs in, checks availability + member price for every whitelisted room over the horizon, stores observations, prints drops since the previous poll. |
| `npm run cli -- drops [minPct]` | Lists upcoming nights currently priced below their historic peak (default threshold from `watch.json`). |
| `npm run cli -- history <roomTypeId> <YYYY-MM-DD>` | Shows every recorded price for a room and check-in date. |
| `npm run probe` | One-off check: member vs public price for hotel 3008 rooms 476/477 at today, +1, +7, +14 days. |
| `npm run capture` | Headed browser that records the site's XHR/fetch traffic to `captures/` (API discovery). |

Examples:

```sh
npm run cli -- poll
npm run cli -- drops 5
npm run cli -- history 476 2026-10-26
```

## Configuration

- `data/whitelist.json`: `{ "<hotelId>": [roomTypeId, ...] }`. Source of truth for what is tracked. Edit it, then run `npm run sync-parks`. Don't edit `data/parks.json` by hand.
- `data/watch.json`:
  - `adults`: guests per query (default 2)
  - `nights`: stay lengths to price, e.g. `[1, 2, 3]`
  - `horizonDays`: how many days of check-in dates to poll
  - `minDropPct`: smallest drop that gets flagged
  - `requestsPerSecond`: throttle (default 3)

## Scheduling

Prices only become useful as a time series. Example cron (hourly):

```
0 * * * * cd /Users/you/Sites/top10-finder && npm run -s cli -- poll >> data/poll.log 2>&1
```

## Layout

- `src/top10.ts`: login + API client (throttled)
- `src/db.ts`: SQLite schema (`observations` table)
- `src/cli.ts`: `poll` / `drops` / `history`
- `scripts/`: `sync-parks`, `probe`, `capture`
- `docs/api-notes.md`: endpoints, auth flow, findings

## Notes

Personal use with your own member account, read-only (no booking calls). Keep polling light. API responses contain your member email, so don't share raw captures.
