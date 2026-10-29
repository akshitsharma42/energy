# Urja Meter API

A clean, read-only HTTP API over the live Urja Meter Ops portal. It signs in with short-lived credentials supplied at runtime, then translates the portal's own meter, location, and consumption routes into a stable API. Node's standard library is the only runtime dependency.

## Run

Requires Node.js 18+.

```bash
npm test
PORTAL_EMAIL='operator@urja.local' PORTAL_PASSWORD='your-password' npm start
```

The API starts at `http://localhost:3000`. Never commit credentials; use `PORTAL_EMAIL`, `PORTAL_PASSWORD`, and optionally `PORTAL_URL` (defaults to the supplied portal). Set `PORT=4000` to choose a port.

## Example requests

```bash
curl http://localhost:3000/health
curl 'http://localhost:3000/v1/meters?q=J100000&page=1'
curl http://localhost:3000/v1/meters/J100000
curl http://localhost:3000/v1/meters/J100000/readings
```

## API

| Route | Purpose |
| --- | --- |
| `GET /health` | Liveness and loaded-record count. |
| `GET /v1/meters` | Live, portal-backed search. Supports `q` and `page`; the portal's fixed page size is 20. |
| `GET /v1/meters/{meterId}` | Full nameplate, reconstructed hierarchy, and live portal coordinates. |
| `GET /v1/meters/{meterId}/readings` | Live half-hourly kWh, kVAh, and V(R) readings from the portal's default window. |

The machine-readable contract is [openapi.json](./openapi.json). Error responses are JSON and use appropriate 400, 404, or 405 statuses.

## Structure

`src/server.js` owns HTTP behavior; `src/portal-client.js` owns sign-in, session reuse, portal translation, and short-session reauthentication; `test/` uses a mocked portal to test the adapter without live credentials. The provided export remains in `data/` as a reference fixture, not the running source.

## Decisions and trade-offs

- **Live portal adapter:** requests use normal operator-visible portal routes, authenticated with an in-memory session cookie. See [PROTOCOL.md](./PROTOCOL.md) for the observed protocol.
- **No external framework:** appropriate for five GET endpoints and makes setup immediate. A production deployment could move to Fastify/Express when middleware and observability grow.
- **Portal-shaped pagination:** the wrapper preserves the source portal's fixed 20-record pages rather than pretending it supports arbitrary page sizes.
- **Data honesty:** consumption readings are now exposed because they were verified on the live meter detail view.

## Intentionally left out / next steps

This is read-only: no portal writes, user management, persistent credential storage, cache, API authentication, rate limiting, or web UI. A deployment should use a secrets manager, put this API behind authentication and rate limiting, add retry/backoff and metrics, and use a dedicated least-privilege portal identity.

See [REFLECTION.md](./REFLECTION.md) for the requested retrospective.
