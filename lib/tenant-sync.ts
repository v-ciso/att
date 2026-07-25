import { readWorkspace, storagePrefix } from '@/lib/workspace';

// Bridges the app's localStorage-backed state to the per-tenant Postgres store.
//
// The app keeps reading/writing localStorage synchronously (no rewrite of the
// ~15 feature components). localStorage is now a per-device CACHE; the server
// is the source of truth. On a fresh device we hydrate the cache from the
// server, so the user's real book appears. On every edit we push the changed
// keys back. DEMO mode never touches the server.

const KEYS = [
  'se-sales-v1', 'se-people-v1', 'se-teams-v2', 'se-commission-v2', 'se-pnl-v1',
  'se-attendance-v1', 'se-lateouts-v1', 'se-commit-v1', 'se-schedule-v1',
  'se-goals-v1', 'se-competitions-v1', 'se-promo-rules-v1', 'se-campaign-v1',
  'se-theme-v1',
];

let installed = false;
let hydrating = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;

// Read/write the raw, workspace-prefixed keys directly, bypassing the shim, so
// hydration writes never re-trigger our own push listener in a loop.
function rawGet(prefix: string, key: string): string | null {
  try { return window.localStorage.getItem(prefix + key); } catch { return null; }
}
function rawSet(prefix: string, key: string, value: string) {
  try { window.localStorage.setItem(prefix + key, value); } catch { /* quota */ }
}

async function pushAll(prefix: string) {
  const items: Array<{ key: string; value: unknown }> = [];
  for (const key of KEYS) {
    const raw = rawGet(prefix, key);
    if (raw == null) continue;
    try { items.push({ key, value: JSON.parse(raw) }); } catch { /* skip corrupt */ }
  }
  if (!items.length) return;
  await fetch('/api/tenant-data', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  }).catch(() => { /* offline — the next edit retries */ });
}

/**
 * Called once when a LIVE dashboard mounts. Pulls the tenant's data from the
 * server into the local cache. If the server is empty but the browser already
 * has data (an existing account being migrated), it seeds the server instead —
 * so nobody loses the book they built before the migration.
 */
export async function hydrateTenant(): Promise<void> {
  if (typeof window === 'undefined') return;
  const ws = readWorkspace();
  if (ws.mode !== 'live') return; // demo stays local-only
  const prefix = storagePrefix(ws);

  hydrating = true;
  try {
    const res = await fetch('/api/tenant-data');
    if (!res.ok) return; // not signed in / no tenant — stay on local cache
    const { data } = (await res.json()) as { data: Record<string, unknown> };
    const serverKeys = Object.keys(data ?? {});

    if (serverKeys.length === 0) {
      // First run for this tenant: seed the server from whatever is local.
      await pushAll(prefix);
    } else {
      // Server wins per key it holds; local-only keys are pushed up so a
      // half-synced browser doesn't lose anything.
      for (const key of KEYS) {
        if (key in data) rawSet(prefix, key, JSON.stringify(data[key]));
      }
      const localOnly = KEYS.filter(k => !(k in data) && rawGet(prefix, k) != null);
      if (localOnly.length) await pushAll(prefix);
    }
    // Tell every view to re-read from the freshly hydrated cache.
    window.dispatchEvent(new Event('se:data'));
  } finally {
    hydrating = false;
  }
}

/** Installs the debounced push listener. Idempotent. */
export function installTenantSync(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('se:data', () => {
    if (hydrating) return; // our own hydration writes must not echo back
    const ws = readWorkspace();
    if (ws.mode !== 'live') return;
    const prefix = storagePrefix(ws);
    if (pushTimer) clearTimeout(pushTimer);
    // ponytail: debounce, last-write-wins per key. No offline conflict merge —
    // acceptable while a company is one or few concurrent editors; revisit with
    // per-key version stamps if simultaneous editing becomes common.
    pushTimer = setTimeout(() => { pushAll(prefix); }, 1500);
  });
}
