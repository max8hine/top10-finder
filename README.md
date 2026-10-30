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
```

There is no database. Each `poll` overwrites `data/prices.json`, and everything else reads it.

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

Requires Node 20+.

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

- The page fetches everything on load. After a new `poll`, refresh the browser.
- If the page shows "Could not load data", the API isn't running, or `sync` or `poll` hasn't been run yet.
- Port 3000 is taken? Start the API with `PORT=3001 pnpm run api`. The web app proxies to port 3000, so also change the target in `apps/web/vite.config.ts`.

## Commands

| Command | What it does |
|---|---|
| `pnpm run cli -- sync` | Fetches park and room names, images, and links for the rooms in `config.json`. Run after changing the config. |
| `pnpm run cli -- poll` | Prices every tracked room over the horizon and saves the result, replacing the previous one. |
| `pnpm run cli -- deals [fromDay] [toDay]` | Stays bookable as of the last poll, cheapest per night first. Days are counted from today; default is today through the horizon. |
| `pnpm run api` | JSON API at http://127.0.0.1:3000. Routes: `/api/catalog`, `/api/deals?from=&to=`. |
| `pnpm run web` | Web app at http://localhost:5173. Needs the API running. |
| `pnpm start` | API and web app together. |
| `pnpm run typecheck` | Typechecks every package. |

Prices in `deals`, the API, and the web app are per night (the whole-stay total divided by nights). The whole-stay total is returned too.

The web app is a view only. Prices come from `poll`, so run that on a schedule.

## Configuration

`data/config.json`:

- `adults`: guests per quote (default 2)
- `nights`: stay lengths in order of preference. Default `[3, 2, 1]`: price 3 nights, fall back to 2, then 1, if the longer stay can't be booked. Only the first bookable length is kept for each check-in date.
- `horizonDays`: how many days ahead of today to poll check-in dates
- `requestsPerSecond`: throttle for the site API
- `rooms`: `{ hotelId, roomId, park, name }` for each room to track. Add rooms from other parks here, then run `sync`. The web app shows one card per park in this list.

## Scheduling

Prices go stale, so run `poll` on a schedule. Example, hourly:

```
0 * * * * cd /Users/you/Sites/top10-finder && pnpm run -s cli -- poll >> data/poll.log 2>&1
```

## Notes

Personal use with your own member account, read-only (no booking calls). Keep polling light. API responses contain your member email, so don't share raw responses.
