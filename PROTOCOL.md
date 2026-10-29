# Portal protocol notes

## Scope and evidence

The live portal is a SvelteKit application. Normal operator login is a form `POST /login`, with URL-encoded `email` and `password`, same-origin headers, and an HttpOnly `__Secure-better-auth.session_token` cookie with a one-hour lifetime. The adapter uses those normal routes in memory only; credentials and cookies are never logged or stored on disk.

## Observed data model

`GET /portal/meters/search?q=&page=` returns 20-row meter pages. `GET /meters/{id}/__data.json` contains server-loaded nameplate data and zone -> circle -> division -> subdivision -> substation -> feeder -> DT hierarchy. `GET /portal/meters/{id}/geo` returns latitude/longitude and `GET /portal/meters/{id}/energy` returns the default-window half-hourly readings (timestamp, kWh, kVAh, V(R)).

## Access and extraction

The adapter authenticates lazily, keeps the session only in process memory, and retries once after a 401/403 by signing in again. It calls only routes demonstrably used by the portal UI; it does not write data, mutate accounts, or call administrative endpoints.

## Quirks and safeguards

The search route owns filtering and has a fixed page size of 20, so the public API deliberately exposes that behavior. The Svelte data payload is a compact reference table rather than ordinary JSON; `portal-client.js` decodes it into stable fields. The adapter treats portal markup and payload shapes as an integration contract and surfaces upstream failures as 502/503 rather than returning stale data.
