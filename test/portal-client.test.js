import assert from 'node:assert/strict';
import test from 'node:test';
import { mapDetail, PortalClient } from '../src/portal-client.js';

const payload = { nodes: [null, null, { data: [{ meterId: 'J100000', detail: { data: [{ parameterName: 'Serial No', parameterValue: 'SE33962' }] }, hierarchy: { Zone: 'Jaipur Zone 1 (Z-01)', Circle: 'Circle 1 (C-01)', Division: 'Division 1 (D-01)', Subdivision: 'Subdivision 1 (SD-01)', 'Sub Station': 'Substation 1 (SS-01)', Feeder: 'Feeder 1 (F-001)', DT: 'Malviya Nagar DT 1 (DT-001)' } }] }] };

test('decodes portal Svelte data into a stable meter contract', () => {
  const meter = mapDetail(payload);
  assert.equal(meter.meterId, 'J100000');
  assert.equal(meter.serialNo, 'SE33962');
  assert.deepEqual(meter.hierarchy.feeder, { level: 'feeder', name: 'Feeder 1', code: 'F-001' });
});

test('maps live search and energy responses', async () => {
  const calls = []; const response = (data, cookies = []) => ({ ok: true, status: 200, json: async () => data, headers: { getSetCookie: () => cookies } });
  const client = new PortalClient({ email: 'test@example.com', password: 'secret', baseUrl: 'https://portal.test', fetchImpl: async (url) => { calls.push(url); if (url.endsWith('/login')) return response({}, calls.filter((value) => value.endsWith('/login')).length === 1 ? ['seed=1; Path=/'] : ['session=2; Path=/']); if (url.includes('/search')) return response({ total: 1, data: [{ meterId: 'M-1' }] }); return response({ data: [{ timestamp: '01/01/2026 00:00', kwh: '1.2', kvah: '1.3', voltR: '230' }] }); } });
  assert.equal((await client.searchMeters({ q: 'M-1' })).total, 1);
  assert.deepEqual(await client.getReadings('M-1'), [{ timestamp: '01/01/2026 00:00', kwh: 1.2, kvah: 1.3, voltR: 230 }]);
  assert.ok(calls.some((url) => url.includes('q=M-1')));
});
