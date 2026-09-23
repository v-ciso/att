import { readWorkspace, storagePrefix, bucketBelongsTo, stampBucketOwner } from '@/lib/workspace';

// Existing feature components use a namespaced cache; Postgres is authoritative.
const KEYS = [
  'se-sales-v1', 'se-people-v1', 'se-teams-v2', 'se-commission-v2', 'se-pnl-v1',
  'se-attendance-v1', 'se-lateouts-v1', 'se-commit-v1', 'se-schedule-v1',
  'se-goals-v1', 'se-competitions-v1', 'se-promo-rules-v1', 'se-campaign-v1',
  'se-theme-v1', 'se-store-closed-v1', 'se-mtg-v1', 'se-competitions-archive-v1',
];
let installed = false;
let hydrating = false;
let activeTenant: string | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushing: Promise<void> | null = null;
let generation = 0;
let revision = 0;
const baseline = new Map<string, string | null>();
const versions = new Map<string, string | null>();
let syncError = '';
const listeners = new Set<() => void>();
export const subscribeSync = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getSyncError = () => syncError;
function reportError(message: string) { syncError = message; listeners.forEach(listener => listener()); }

function rawGet(prefix: string, key: string) { return window.localStorage.getItem(prefix + key); }
function ownsWorkspace(tenant: string) {
  const ws = readWorkspace();
  return ws.mode === 'live' && ws.scope === tenant && activeTenant === tenant;
}
function changedItems(tenant: string) {
  const prefix = storagePrefix({ mode: 'live', scope: tenant });
  return KEYS.flatMap(key => {
    const raw = rawGet(prefix, key);
    if (raw === null || raw === baseline.get(key)) return [];
    return [{ key, value: JSON.parse(raw) as unknown, expectedUpdatedAt: versions.get(key) ?? null, raw }];
  });
}

export function stopTenantSync() {
  generation++;
  activeTenant = null;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
  baseline.clear();
  versions.clear();
  reportError('');
}

export async function flushTenantSync(): Promise<void> {
  if (pushTimer) clearTimeout(pushTimer);
  if (pushing) await pushing;
  const tenant = activeTenant;
  if (!tenant || !ownsWorkspace(tenant)) return;
  if (syncError) throw new Error(syncError);
  const prefix = storagePrefix({ mode: 'live', scope: tenant });
  if (!bucketBelongsTo(prefix, tenant)) throw new Error('Workspace ownership changed. Reload before editing.');
  const items = changedItems(tenant);
  if (!items.length) return;
  const currentGeneration = generation;
  pushing = (async () => {
    try {
      const response = await fetch('/api/tenant-data', {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenant },
        body: JSON.stringify({ items: items.map(({ raw: _raw, ...item }) => item) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Changes could not be saved.');
      if (currentGeneration !== generation || !ownsWorkspace(tenant)) return;
      revision++;
      for (const item of items) {
        baseline.set(item.key, item.raw);
        versions.set(item.key, body.versions[item.key]);
      }
      reportError('');
    } catch (error) {
      if (currentGeneration === generation) reportError(error instanceof Error ? error.message : 'Could not save changes.');
      throw error;
    }
  })();
  try { await pushing; } finally { pushing = null; }
  if (currentGeneration === generation && ownsWorkspace(tenant) && changedItems(tenant).length) await flushTenantSync();
}

/** Read-only bootstrap. Old caches can never seed an empty company. */
export async function hydrateTenant(tenant: string): Promise<boolean> {
  const ws = readWorkspace();
  if (ws.mode !== 'live' || ws.scope !== tenant) throw new Error('Workspace changed. Reload to continue.');
  if (pushing || syncError) return true;
  const refreshing = activeTenant === tenant;
  const startedRevision = revision;
  const currentGeneration = generation;
  const prefix = storagePrefix(ws);
  const response = await fetch('/api/tenant-data', { cache: 'no-store', headers: { 'X-Tenant-Id': tenant } });
  if (!response.ok) throw new Error(response.status === 401 ? 'Your session expired. Sign in again.' : 'Unable to load live data. No cached data was used.');
  const { data, versions: serverVersions } = await response.json() as { data: Record<string, unknown>; versions: Record<string, string> };
  if (currentGeneration !== generation || readWorkspace().scope !== tenant || readWorkspace().mode !== 'live') throw new Error('Workspace changed.');
  if (pushing || startedRevision !== revision) return true;
  hydrating = true;
  try {
    for (const key of KEYS) {
      if (refreshing && rawGet(prefix, key) !== baseline.get(key)) continue;
      const raw = key in data ? JSON.stringify(data[key]) : null;
      if (raw === null) window.localStorage.removeItem(prefix + key);
      else window.localStorage.setItem(prefix + key, raw);
      baseline.set(key, raw);
      versions.set(key, serverVersions[key] ?? null);
    }
    stampBucketOwner(prefix, tenant);
    activeTenant = tenant;
    reportError('');
    window.dispatchEvent(new Event('se:data'));
  } finally { hydrating = false; }
  installTenantSync();
  return true;
}

export function installTenantSync() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('se:data', () => {
    if (hydrating || !activeTenant || !ownsWorkspace(activeTenant) || syncError) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => { void flushTenantSync().catch(() => {}); }, 300);
  });
  window.addEventListener('beforeunload', event => {
    if (activeTenant && ownsWorkspace(activeTenant) && (pushing || changedItems(activeTenant).length)) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
}
