# top10-finder

Finds the cheapest member price for [TOP 10 Holiday Parks](https://top10.co.nz/) (NZ) stays. It logs in to the site's JSON API as a member, prices the rooms you track for the coming days, and shows what you can book right now, cheapest per night first.

## Layout

A pnpm monorepo. One core library holds all the logic. The CLI, the API, and the web app are thin layers over it.

```
packages/core/     @top10/core: all logic (site client, poll, deals, catalog)
  src/types.ts     shared data shapes (browser-safe)
  src/index.ts     public surface
apps/cli/          command line: sync, poll, deals   (imports @top10/core)
apps/api/          JSON API on 127.0.0.1:3000        (imports @top10/core)
apps/web/          React + Vite interface on :5173, reads the API
data/config.json   rooms to track, stay lengths, horizon, throttle
data/catalog.json  park and room names, images, links (made by `cli sync`)
data/prices.json   result of the latest poll (gitignored; each poll replaces it)
data/history.db    SQLite: every poll for the last year (gitignored)
```

Each `poll` overwrites `data/prices.json` (what the app shows) and also adds its results to `data/history.db`, a SQLite file that keeps every poll for `historyDays` (default 365). History is what gives each stay its "low" price: the lowest per-night price seen for that room, check-in date and stay length. It shows once a stay has been priced in at least two polls.

## Setup

```sh
pnpm install
cp .env.example .env    # then fill in your member login
pnpm run cli -- sync    # fetch park names and images for the rooms in config.json
pnpm run cli -- poll    # price the tracked rooms (takes a few minutes)
```

`.env`:

```
TOP10_EMAIL=you@example.com
TOP10_PASSWORD=...
```

Requires Node 22.13+ (`node:sqlite`). `.nvmrc` pins Node 24; `nvm use` picks it up.

## Start the interface on localhost

The web app reads from the API, so both must be running. One command starts both (Ctrl-C stops both):

```sh
pnpm start      # API on :3000, web app on http://localhost:5173 (opens your browser)
```

Or run them separately in two terminals from the repo root:

```sh
# terminal 1: JSON API on http://127.0.0.1:3000
pnpm run api

# terminal 2: web app, then open http://localhost:5173
pnpm run web
```

- The page fetches everything on load. If the last poll is older than `pollEveryHours` (default 72), the API starts a poll in the background and the page reloads the prices when it finishes (a few minutes). The footer has a "Refresh prices" button that forces one. This only works while the API is running.
- If the page shows "Could not load data", the API isn't running, or `sync` or `poll` hasn't been run yet.
- Port 3000 is taken? Start the API with `PORT=3001 pnpm run api`. The web app proxies to port 3000, so also change the target in `apps/web/vite.config.ts`.

## Commands

| Command | What it does |
|---|---|
| `pnpm run cli -- sync` | Fetches park and room names, images, and links for the rooms in `config.json`. Run after changing the config. |
| `pnpm run cli -- poll` | Prices every tracked room over the horizon and saves the result, replacing the previous one. |
| `pnpm run cli -- deals [fromDay] [toDay]` | Stays bookable as of the last poll, cheapest per night first. Days are counted from today; default is everything in the last poll, including the weekend stays. |
| `pnpm run api` | JSON API at http://127.0.0.1:3000. Routes: `/api/catalog`, `/api/deals?from=&to=`, `/api/status`, `POST /api/refresh[?force=1]`. |
| `pnpm run web` | Web app at http://localhost:5173. Needs the API running. |
| `pnpm start` | API and web app together. |
| `pnpm run typecheck` | Typechecks every package. |

Prices in `deals`, the API, and the web app are per night (the whole-stay total divided by nights). The whole-stay total is returned too.


## Configuration

`data/config.json`:

- `adults`: guests per quote (default 2)
- `nights`: stay lengths in order of preference. Default `[3, 2, 1]`: price 3 nights, fall back to 2, then 1, if the longer stay can't be booked. Only the first bookable length is kept for each check-in date.
- `horizonDays`: how many days ahead of today to poll check-in dates
- `requestsPerSecond`: throttle for the site API
- `pollEveryHours`: the page starts a poll on load when the last one is older than this (default 72)
- `historyDays`: price history older than this is deleted (default 365)
- `weekends`: `{ nights, startWeeks, count }`. Every poll also records weekend stays beyond the horizon: a `nights`-night stay from each Friday check-in. The upcoming Friday is week 0; `startWeeks: 1` starts one week after it, and `count: 5` covers five Fridays. Weekend stays are recorded to history only and aren't shown on the page.
- `rooms`: `{ hotelId, roomId, park, name }` for each room to track. Add rooms from other parks here, then run `sync`. The web app shows one card per park in this list.

## Scheduling

The API polls on page load when prices are stale (see above). To poll without the page open, use cron instead. Example, every 6 hours:

```
0 */6 * * * cd /Users/you/Sites/top10-finder && pnpm run -s cli -- poll >> data/poll.log 2>&1
```

## Notes

Personal use with your own member account, read-only (no booking calls). Keep polling light. API responses contain your member email, so don't share raw responses.
