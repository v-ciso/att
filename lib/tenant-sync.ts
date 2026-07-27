import {
  readWorkspace, storagePrefix, bucketBelongsTo, stampBucketOwner,
} from '@/lib/workspace';

// Bridges the app's localStorage-backed state to the per-tenant Postgres store.
//
// The app keeps reading/writing localStorage synchronously (no rewrite of the
// ~15 feature components). localStorage is now a per-device CACHE; the server
// is the source of truth. On a fresh device we hydrate the cache from the
// server, so the user's real book appears. On every edit we push the changed
// keys back. DEMO mode never touches the server.
//
// UPLOAD SAFETY RULE: local data is only ever pushed to the server when the
// cached bucket is *provably* the signed-in tenant's (ownership stamp matches).
// An unstamped or foreign bucket is treated as untrusted and the tenant starts
// from the server's state instead. Without this rule, a browser that had been
// signed in as company A would seed company B's empty rows with A's book —
// which is precisely the leak this replaces.

const KEYS = [
  'se-sales-v1', 'se-people-v1', 'se-teams-v2', 'se-commission-v2', 'se-pnl-v1',
  'se-attendance-v1', 'se-lateouts-v1', 'se-commit-v1', 'se-schedule-v1',
  'se-goals-v1', 'se-competitions-v1', 'se-promo-rules-v1', 'se-campaign-v1',
  'se-theme-v1', 'se-store-closed-v1', 'se-mtg-v1', 'se-competitions-archive-v1',
];

let installed = false;
let hydrating = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
/** Tenant this tab is allowed to sync. Set by hydrateTenant(). */
let activeTenant: string | null = null;

// Read/write the raw, workspace-prefixed keys directly, bypassing the shim, so
// hydration writes never re-trigger our own push listener in a loop.
function rawGet(prefix: string, key: string): string | null {
  try { return window.localStorage.getItem(prefix + key); } catch { return null; }
}
function rawSet(prefix: string, key: string, value: string) {
  try { window.localStorage.setItem(prefix + key, value); } catch { /* quota */ }
}
function rawRemove(prefix: string, key: string) {
  try { window.localStorage.removeItem(prefix + key); } catch { /* ignore */ }
}

async function pushAll(prefix: string, tenant: string) {
  // Belt and braces: never upload a bucket we can't attribute to this tenant.
  if (!bucketBelongsTo(prefix, tenant)) {
    console.log('[v0] refusing to push unattributed bucket', { prefix });
    return;
  }
  const items: Array<{ key: string; value: unknown }> = [];
  for (const key of KEYS) {
    const raw = rawGet(prefix, key);
    if (raw == null) continue;
    try { items.push({ key, value: JSON.parse(raw) }); } catch { /* skip corrupt */ }
  }
  if (!items.length) return;
  await fetch('/api/tenant-data', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': tenant },
    body: JSON.stringify({ items }),
  }).catch(() => { /* offline — the next edit retries */ });
}

/** Drop every cached feature key in a bucket (not the ownership stamp). */
function clearBucketKeys(prefix: string) {
  for (const key of KEYS) rawRemove(prefix, key);
}

/**
 * Called once when a LIVE dashboard mounts. Pulls the tenant's data from the
 * server into the local cache.
 *
 * If the server is empty, we only seed it from local storage when the local
 * bucket is stamped as belonging to this same tenant (a genuine pre-migration
 * browser). Otherwise the cache is foreign or unverifiable, so we clear it and
 * start clean — an empty new company is correct; inheriting another company's
 * roster is not.
 */
export async function hydrateTenant(tenantId?: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const ws = readWorkspace();
  if (ws.mode !== 'live') return; // demo stays local-only

  // The session tenant is authoritative. If the caller passed one and it
  // disagrees with the workspace pointer, abort — reconcileWorkspace() is
  // about to reload the page with the correct prefix anyway.
  if (tenantId && ws.scope !== tenantId) {
    console.log('[v0] hydrate aborted, scope mismatch', { ws: ws.scope, session: tenantId });
    return;
  }

  const tenant = tenantId ?? ws.scope;
  const prefix = storagePrefix(ws);
  activeTenant = tenant;

  hydrating = true;
  try {
    const res = await fetch('/api/tenant-data', { headers: { 'X-Tenant-Id': tenant } });
    if (!res.ok) return; // not signed in / no tenant — stay on local cache
    const { data } = (await res.json()) as { data: Record<string, unknown> };
    const serverKeys = Object.keys(data ?? {});
    const trusted = bucketBelongsTo(prefix, tenant);

    if (serverKeys.length === 0) {
      if (trusted) {
        // First run for this tenant on the server: seed from this device's own
        // verified book so a pre-migration account loses nothing.
        await pushAll(prefix, tenant);
      } else {
        // Foreign or unstamped cache with an empty server: start clean, then
        // claim the bucket for this tenant going forward.
        clearBucketKeys(prefix);
        stampBucketOwner(prefix, tenant);
      }
    } else {
      if (!trusted) {
        // Server has the truth and the cache is untrusted — discard the cache
        // wholesale rather than merging unknown local keys into this tenant.
        clearBucketKeys(prefix);
        stampBucketOwner(prefix, tenant);
      }
      for (const key of KEYS) {
        if (key in data) rawSet(prefix, key, JSON.stringify(data[key]));
      }
      // Only a trusted bucket may contribute local-only keys upward.
      if (trusted) {
        const localOnly = KEYS.filter(k => !(k in data) && rawGet(prefix, k) != null);
        if (localOnly.length) await pushAll(prefix, tenant);
      }
    }
    stampBucketOwner(prefix, tenant);
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
    // Never push before hydrateTenant() has established which tenant owns this
    // tab, and never push if the pointer has drifted from it since.
    if (!activeTenant || ws.scope !== activeTenant) return;
    const prefix = storagePrefix(ws);
    const tenant = activeTenant;
    if (pushTimer) clearTimeout(pushTimer);
    // ponytail: debounce, last-write-wins per key. No offline conflict merge —
    // acceptable while a company is one or few concurrent editors; revisit with
    // per-key version stamps if simultaneous editing becomes common.
    pushTimer = setTimeout(() => { pushAll(prefix, tenant); }, 1500);
  });
}
