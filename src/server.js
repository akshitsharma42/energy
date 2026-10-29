import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { PortalClient, PortalError } from './portal-client.js';

function send(res, status, body) { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); }

export function createServer(client = new PortalClient()) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
    try {
      if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });
      if (url.pathname === '/health') return send(res, 200, { status: 'ok', source: 'urja-ops-portal' });
      if (url.pathname === '/v1/meters') return send(res, 200, await client.searchMeters({ q: url.searchParams.get('q') ?? '', page: url.searchParams.get('page') ?? 1 }));
      const readings = url.pathname.match(/^\/v1\/meters\/([^/]+)\/readings$/);
      if (readings) return send(res, 200, { meterId: decodeURIComponent(readings[1]), items: await client.getReadings(decodeURIComponent(readings[1])) });
      const meter = url.pathname.match(/^\/v1\/meters\/([^/]+)$/);
      if (meter) return send(res, 200, await client.getMeterWithLocation(decodeURIComponent(meter[1])));
      return send(res, 404, { error: 'not_found', message: 'Route not found.' });
    } catch (error) { return send(res, error instanceof PortalError ? error.status : 502, { error: error instanceof PortalError && error.status === 404 ? 'not_found' : 'portal_unavailable', message: error.message }); }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3000);
  createServer().listen(port, () => console.log(`Urja Meter API listening on http://localhost:${port}`));
}
