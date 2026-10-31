import { createServer, type ServerResponse } from 'node:http';
import { deals, loadCatalog, loadConfig, refresh, refreshStatus } from '@top10/core';

// JSON API over the core library. The web app and any other client read from here.
// Prices come from the latest poll. POST /api/refresh starts one in the background when the last is stale.

const PORT = Number(process.env.PORT ?? 3000);

const int = (v: string | null) => (v !== null && Number.isInteger(Number(v)) ? Number(v) : undefined);

const send = (res: ServerResponse, status: number, body: unknown) =>
  res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body, null, 2));

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  try {
    switch (url.pathname) {
      case '/api/catalog':
        return send(res, 200, { horizonDays: loadConfig().horizonDays, ...loadCatalog() });
      case '/api/deals':
        return send(res, 200, deals({ fromDay: int(url.searchParams.get('from')), toDay: int(url.searchParams.get('to')) }));
      case '/api/status':
        return send(res, 200, refreshStatus());
      case '/api/refresh':
        if (req.method !== 'POST') return send(res, 405, { error: 'use POST' });
        return send(res, 200, refresh({ force: url.searchParams.get('force') === '1' }));
      default:
        return send(res, 404, { error: 'not found' });
    }
  } catch (err) {
    return send(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
}).listen(PORT, '127.0.0.1', () => console.log(`API http://127.0.0.1:${PORT}`));
