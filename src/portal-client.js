const DEFAULT_PORTAL_URL = 'https://urja-ops.flockenergy.tech';

function cookieValue(setCookie) { return setCookie.map((value) => value.split(';', 1)[0]).join('; '); }

function decodeSvelte(value) {
  const resolve = (index, resolving = new Set()) => {
    if (typeof index !== 'number') return index;
    if (resolving.has(index)) throw new Error('Unexpected circular Svelte data reference.');
    resolving.add(index);
    const raw = value[index];
    return Array.isArray(raw) ? raw.map((item) => resolve(item, new Set(resolving)))
      : raw && typeof raw === 'object' ? Object.fromEntries(Object.entries(raw).map(([key, item]) => [key, resolve(item, new Set(resolving))])) : raw;
  };
  return resolve(0);
}

function hierarchyNode(label, level) { const match = /^(.*) \(([^)]+)\)$/.exec(label ?? ''); return match ? { level, name: match[1], code: match[2] } : { level, name: label, code: null }; }

function mapDetail(payload) {
  const decoded = decodeSvelte(payload.nodes[2].data);
  const fields = Object.fromEntries(decoded.detail.data.map(({ parameterName, parameterValue }) => [parameterName, parameterValue]));
  const levels = [['Zone', 'zone'], ['Circle', 'circle'], ['Division', 'division'], ['Subdivision', 'subdivision'], ['Sub Station', 'substation'], ['Feeder', 'feeder'], ['DT', 'dt']];
  return { meterId: decoded.meterId, serialNo: fields['Serial No'], make: fields.Make, phaseType: fields['Phase Type'], installStatus: fields['Installation Status'], installType: fields['Installation Type'], hierarchy: Object.fromEntries(levels.map(([portalName, key]) => [key, hierarchyNode(decoded.hierarchy[portalName], key)])) };
}

export class PortalError extends Error { constructor(message, status = 502) { super(message); this.status = status; } }

export class PortalClient {
  constructor({ baseUrl = process.env.PORTAL_URL ?? DEFAULT_PORTAL_URL, email = process.env.PORTAL_EMAIL, password = process.env.PORTAL_PASSWORD, fetchImpl = fetch } = {}) { this.baseUrl = baseUrl.replace(/\/$/, ''); this.email = email; this.password = password; this.fetch = fetchImpl; this.cookie = null; }
  async authenticate() {
    if (!this.email || !this.password) throw new PortalError('Portal credentials are required: set PORTAL_EMAIL and PORTAL_PASSWORD.', 503);
    const loginUrl = `${this.baseUrl}/login`; const initial = await this.fetch(loginUrl); const initialCookies = initial.headers.getSetCookie?.() ?? [];
    const response = await this.fetch(loginUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: this.baseUrl, referer: loginUrl, cookie: cookieValue(initialCookies) }, body: new URLSearchParams({ email: this.email, password: this.password }).toString(), redirect: 'manual' });
    if (!response.ok) throw new PortalError('Portal sign-in was rejected.', 502);
    this.cookie = cookieValue([...(initialCookies), ...(response.headers.getSetCookie?.() ?? [])]);
  }
  async request(path, { retry = true } = {}) {
    if (!this.cookie) await this.authenticate();
    const response = await this.fetch(`${this.baseUrl}${path}`, { headers: { cookie: this.cookie, accept: 'application/json' } });
    if ((response.status === 401 || response.status === 403) && retry) { this.cookie = null; return this.request(path, { retry: false }); }
    if (response.status === 404) throw new PortalError('Meter not found in portal.', 404);
    if (!response.ok) throw new PortalError(`Portal request failed with status ${response.status}.`);
    return response.json();
  }
  async searchMeters({ q = '', page = 1 } = {}) { const currentPage = Math.max(1, Number(page) || 1); const result = await this.request(`/portal/meters/search?q=${encodeURIComponent(q)}&page=${currentPage}`); return { page: currentPage, pageSize: 20, total: result.total, items: result.data }; }
  async getMeter(meterId) { return mapDetail(await this.request(`/meters/${encodeURIComponent(meterId)}/__data.json`)); }
  async getLocation(meterId) { const result = await this.request(`/portal/meters/${encodeURIComponent(meterId)}/geo`); return { lat: Number(result.data.latitude), lng: Number(result.data.longitude) }; }
  async getReadings(meterId) { const result = await this.request(`/portal/meters/${encodeURIComponent(meterId)}/energy`); return result.data.map((reading) => ({ timestamp: reading.timestamp, kwh: Number(reading.kwh), kvah: Number(reading.kvah), voltR: Number(reading.voltR) })); }
  async getMeterWithLocation(meterId) { const [meter, geo] = await Promise.all([this.getMeter(meterId), this.getLocation(meterId)]); return { ...meter, geo }; }
}

export { decodeSvelte, mapDetail };
