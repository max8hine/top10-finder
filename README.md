# top10-finder

Finds the cheapest member price for [TOP 10 Holiday Parks](https://top10.co.nz/) (NZ) stays. It polls the site's JSON API as a logged-in member, stores every price in SQLite, and answers:

- what can I book right now, cheapest first, for tonight through next week?
- how much does the price usually change as check-in gets closer?

## Layout

A pnpm monorepo. One core library holds all the logic. The CLI, the API, and the web app are thin layers over it.

```
packages/core/     @top10/core: all logic (site client, poll, deals, lead profile, catalog)
  src/types.ts     shared data shapes (browser-safe)
  src/index.ts     public surface
apps/cli/          command line: sync, poll, deals, lead, history   (imports @top10/core)
apps/api/          JSON API on 127.0.0.1:3000                       (imports @top10/core)
apps/web/          React + Vite interface on :5173, reads the API
data/config.json   rooms to track, stay lengths, horizon, throttle
data/catalog.json  park and room names and images (made by `cli sync`)
data/prices.db     observations (gitignored; safe to delete and rebuild by polling)
```

## Setup

```sh
pnpm install
cp .env.example .env    # then fill in your member login
pnpm run cli -- sync    # fetch park names and images for the rooms in config.json
```

`.env`:

```
TOP10_EMAIL=you@example.com
TOP10_PASSWORD=...
```

Requires Node 22+ (uses the built-in `node:sqlite`).

## Running

| Command | What it does |
|---|---|
| `pnpm run cli -- sync` | Fetches park and room names and images for the rooms in `config.json`. Run after changing the config. |
| `pnpm run cli -- poll` | Prices every bookable stay for the configured rooms over the horizon and stores it. Prints drops and stays that became bookable since the last poll. |
| `pnpm run cli -- deals [fromDay] [toDay]` | Stays bookable as of the last poll, cheapest first. Default `0 7` = tonight to next week. |
| `pnpm run cli -- lead` | Average price by days before check-in, relative to the cheapest seen for each stay. Lower = better time to book. |
| `pnpm run cli -- history <roomId> <YYYY-MM-DD>` | Every recorded price for one room and check-in date. |
| `pnpm run api` | JSON API at http://127.0.0.1:3000. Routes: `/api/catalog`, `/api/deals?from=&to=`, `/api/lead`, `/api/history?roomId=&date=`. |
| `pnpm run web` | Web app at http://localhost:5173. Fetches data on page load. Needs the API running. |
| `pnpm run typecheck` | Typechecks every package. |

The web app is a view only. Prices come from `poll`, so run that on a schedule.

## Configuration

`data/config.json`:

- `adults`: guests per quote (default 2)
- `nights`: stay lengths to price, e.g. `[1, 2, 3]`
- `horizonDays`: how many days ahead of today to poll check-in dates
- `minDropPct`: smallest drop reported by `poll`
- `requestsPerSecond`: throttle for the site API
- `rooms`: `{ hotelId, roomId, park, name }` for each room to track. Add rooms from other parks here, then run `sync`. The web app shows one card per park in this list.

## Scheduling

The value comes from polling over time, so run it on a schedule. Example, hourly:

```
0 * * * * cd /Users/you/Sites/top10-finder && pnpm run -s cli -- poll >> data/poll.log 2>&1
```

## Notes

Personal use with your own member account, read-only (no booking calls). Keep polling light. API responses contain your member email, so don't share raw responses.
