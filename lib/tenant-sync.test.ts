import assert from 'node:assert/strict';
import { hydrateTenant, flushTenantSync, stopTenantSync, getSyncError } from './tenant-sync';
import { SESSION_MAX_AGE, SESSION_VERSION, sessionIsCurrent } from './session-version';
import { renamePersonBook } from './people';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}
const storage = new MemoryStorage();
const target = new EventTarget();
Object.assign(globalThis, { window: {
  localStorage: storage,
  addEventListener: target.addEventListener.bind(target),
  dispatchEvent: target.dispatchEvent.bind(target),
} });
const tenant = 'sync-test-company';
const prefix = `live:${tenant}:`;
const version = '2026-09-23T10:00:00.000Z';
let data: Record<string, unknown> = {};
let versions: Record<string, string> = {};
let requests: Array<{ key: string; value: unknown; expectedUpdatedAt: string | null }[]> = [];
let failGet = false;
let conflict = false;
globalThis.fetch = async (_url, init) => {
  if (init?.method === 'PUT') {
    const { items } = JSON.parse(init.body as string);
    requests.push(items);
    if (conflict) return Response.json({ error: 'Another device changed this data.' }, { status: 409 });
    const nextVersions: Record<string, string> = {};
    for (const item of items) { data[item.key] = item.value; nextVersions[item.key] = version; }
    return Response.json({ versions: nextVersions });
  }
  if (failGet) return Response.json({ error: 'Unavailable' }, { status: 503 });
  return Response.json({ data, versions });
};
function reset() {
  stopTenantSync(); storage.data.clear(); requests = []; data = {}; versions = {}; failGet = false; conflict = false;
  storage.setItem('se__workspace', JSON.stringify({ mode: 'live', scope: tenant }));
}
async function run() {
  reset();
  storage.setItem(prefix + 'se-sales-v1', '[{"person":"stale"}]');
  storage.setItem(prefix + 'se-teams-v2', '[{"name":"sample team"}]');
  await hydrateTenant(tenant);
  assert.equal(storage.getItem(prefix + 'se-sales-v1'), null);
  assert.equal(storage.getItem(prefix + 'se-teams-v2'), null);
  assert.equal(requests.length, 0, 'empty company must never be seeded from a browser');

  reset();
  data = { 'se-sales-v1': [], 'se-commission-v2': { stores: [{ name: 'Only live store' }] } };
  versions = { 'se-sales-v1': version, 'se-commission-v2': version };
  storage.setItem('demo:se-sales-v1', '[{"person":"sample"}]');
  await hydrateTenant(tenant);
  storage.setItem(prefix + 'se-sales-v1', '[{"person":"real"}]');
  await flushTenantSync();
  assert.deepEqual(requests[0].map(item => item.key), ['se-sales-v1'], 'one edit must not upload every book');
  assert.equal(requests[0][0].expectedUpdatedAt, version);
  assert.equal(storage.getItem('demo:se-sales-v1'), '[{"person":"sample"}]');
  await flushTenantSync();
  assert.equal(requests.length, 1, 'acknowledged data must not be resent');

  storage.setItem(prefix + 'se-sales-v1', '[{"person":"unsaved edit"}]');
  data['se-sales-v1'] = [{ person: 'remote edit' }];
  await hydrateTenant(tenant);
  assert.match(storage.getItem(prefix + 'se-sales-v1')!, /unsaved edit/, 'polling must preserve pending edits');
  conflict = true;
  await assert.rejects(flushTenantSync(), /Another device/);
  assert.match(getSyncError(), /Another device/);
  assert.match(storage.getItem(prefix + 'se-sales-v1')!, /unsaved edit/);

  reset(); failGet = true;
  await assert.rejects(hydrateTenant(tenant), /Unable to load/);
  storage.setItem(prefix + 'se-sales-v1', '[]');
  await flushTenantSync();
  assert.equal(requests.length, 0, 'failed hydration cannot enable uploads');

  reset();
  storage.setItem('se__workspace', JSON.stringify({ mode: 'demo', scope: 'demo' }));
  await assert.rejects(hydrateTenant(tenant), /Workspace changed/);
  await flushTenantSync();
  assert.equal(requests.length, 0, 'demo never writes live data');

  assert.deepEqual(renamePersonBook([{ id: 'immutable-sale', person: 'Old name', store: 'Only store', qty: 4 }], 'Old name', 'New name'), [{ id: 'immutable-sale', person: 'New name', store: 'Only store', qty: 4 }]);
  assert.deepEqual(renamePersonBook({ '2026-09-23': { 'Old name': 'Only store|AM' } }, 'Old name', 'New name'), { '2026-09-23': { 'New name': 'Only store|AM' } });
  assert.deepEqual(renamePersonBook([{ name: 'Team A', lead: 'Old name', members: ['Old name'] }], 'Old name', 'New name'), [{ name: 'Team A', lead: 'New name', members: ['New name'] }]);
  assert.throws(() => renamePersonBook({ 'Old name': 2, 'New name': 3 }, 'Old name', 'New name'), /already has records/);

  const now = Date.now();
  assert.equal(SESSION_MAX_AGE, 3600);
  assert.equal(sessionIsCurrent({ sv: SESSION_VERSION, sessionExpiresAt: now + 1 }, now), true);
  assert.equal(sessionIsCurrent({ sv: SESSION_VERSION, sessionExpiresAt: now }, now), false);
  assert.equal(sessionIsCurrent({ sv: SESSION_VERSION - 1, sessionExpiresAt: now + 3600000 }, now), false);
  assert.equal(sessionIsCurrent({ sv: SESSION_VERSION }, now), false);
  stopTenantSync();
  console.log('tenant-sync: cache isolation, dirty-key saves, conflicts, refresh safety, and one-hour expiration passed');
}
void run().catch(error => { console.error(error); process.exitCode = 1; });
