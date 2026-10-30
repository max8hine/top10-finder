import { createServer, type ServerResponse } from 'node:http';
import { deals, history, leadProfile, loadCatalog, loadConfig } from '@top10/core';

// JSON API over the core library. The web app and any other client read from here.
// Data is produced by `pnpm run cli -- poll` (run it on a schedule); this server only reads.

const PORT = Number(process.env.PORT ?? 3000);

const int = (v: string | null, fallback: number) => (v !== null && Number.isInteger(Number(v)) ? Number(v) : fallback);

const send = (res: ServerResponse, status: number, body: unknown) =>
  res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body, null, 2));

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  try {
    switch (url.pathname) {
      case '/api/catalog': {
        const { horizonDays } = loadConfig();
        return send(res, 200, { horizonDays, ...loadCatalog() });
      }
      case '/api/deals': {
        const { horizonDays } = loadConfig();
        const fromDay = int(url.searchParams.get('from'), 0);
        const toDay = int(url.searchParams.get('to'), horizonDays);
        return send(res, 200, deals({ fromDay, toDay }));
      }
      case '/api/lead':
        return send(res, 200, leadProfile());
      case '/api/history': {
        const roomId = int(url.searchParams.get('roomId'), NaN);
        const date = url.searchParams.get('date') ?? '';
        if (!Number.isFinite(roomId) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return send(res, 400, { error: 'need roomId and date=YYYY-MM-DD' });
        return send(res, 200, history(roomId, date));
      }
      default:
        return send(res, 404, { error: 'not found' });
    }
  } catch (err) {
    return send(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
}).listen(PORT, '127.0.0.1', () => console.log(`API http://127.0.0.1:${PORT}`));
