// Workspace = which bucket of localStorage the app reads and writes.
//
// Every feature in this app persists to a `se-*` localStorage key (sales,
// roster, commission, schedule, P&L, ...). Rather than thread a namespace
// through all ~30 call sites, one shim in the root layout rewrites `se-*` keys
// to `<prefix>se-*` before they ever hit storage. That single seam is what
// makes DEMO vs LIVE — and one tenant vs another — actually separate data.
//
// The shim is installed by a blocking inline script (see app/layout.tsx) so it
// is in place before React mounts and any effect reads storage.
//
// ISOLATION INVARIANT (learned the hard way — this caused a real cross-tenant
// leak): the LIVE prefix must ALWAYS equal the signed-in session's tenant id.
// The previous version only corrected `scope` when the mode wasn't already
// 'live', so signing in as user B on a browser left Live by user A kept A's
// prefix — and the sync layer then pushed A's cached book into B's rows.
// `reconcileWorkspace()` below now rewrites the scope on ANY mismatch, and
// every live bucket is stamped with the tenant it belongs to so the sync layer
// can refuse to upload a bucket that isn't the current tenant's.

export type DataMode = 'demo' | 'live';

export interface Workspace {
  mode: DataMode;
  /** Tenant/account the LIVE bucket belongs to. Demo ignores this. */
  scope: string;
}

// Deliberately NOT `se-` prefixed: the shim must never rewrite its own config.
export const WORKSPACE_KEY = 'se__workspace';

/**
 * Per-bucket ownership stamp. Written unprefixed (outside the shim's reach) as
 * `se__owner:<prefix>` so we can ask "which tenant does this cached bucket
 * actually belong to?" without trusting the current workspace pointer.
 */
const OWNER_STAMP_PREFIX = 'se__owner:';

export const DEFAULT_WORKSPACE: Workspace = { mode: 'demo', scope: 'demo' };

export function storagePrefix(ws: Workspace): string {
  return ws.mode === 'live' ? `live:${ws.scope || 'default'}:` : 'demo:';
}

export function readWorkspace(): Workspace {
  if (typeof window === 'undefined') return DEFAULT_WORKSPACE;
  try {
    const raw = window.localStorage.getItem(WORKSPACE_KEY);
    if (!raw) return DEFAULT_WORKSPACE;
    const parsed = JSON.parse(raw) as Partial<Workspace>;
    return {
      mode: parsed.mode === 'live' ? 'live' : 'demo',
      scope: parsed.scope || 'demo',
    };
  } catch {
    return DEFAULT_WORKSPACE;
  }
}

// Switching buckets reloads on purpose: the storage prefix is captured once at
// page load, and React state still holds the old workspace's numbers. A reload
// is the only way to guarantee no demo figure leaks into a live view.
export function setWorkspace(ws: Workspace) {
  window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(ws));
  if (ws.mode === 'live') stampBucketOwner(storagePrefix(ws), ws.scope);
  window.location.reload();
}

/** Record which tenant a live bucket belongs to. Idempotent. */
export function stampBucketOwner(prefix: string, tenant: string) {
  try {
    window.localStorage.setItem(OWNER_STAMP_PREFIX + prefix, tenant);
  } catch {
    /* quota — sync layer falls back to "unknown owner" and starts empty */
  }
}

/**
 * Which tenant owns the cached bucket at `prefix`?
 * `null` means unstamped (pre-fix browser) — treat as untrusted.
 */
export function readBucketOwner(prefix: string): string | null {
  try {
    return window.localStorage.getItem(OWNER_STAMP_PREFIX + prefix);
  } catch {
    return null;
  }
}

/**
 * True when the cached bucket at `prefix` is provably this tenant's. Used by
 * the sync layer to decide whether local data may be pushed to the server.
 */
export function bucketBelongsTo(prefix: string, tenant: string): boolean {
  return readBucketOwner(prefix) === tenant;
}

/**
 * Force the LIVE workspace to match the signed-in session, whatever it
 * currently says. Returns true if a correction was made (caller should expect
 * the reload that `setWorkspace` triggers).
 *
 * Called on every session change, not just when the mode is wrong — that
 * "only if not already live" shortcut is exactly what allowed the leak.
 */
export function reconcileWorkspace(sessionTenantId: string): boolean {
  if (typeof window === 'undefined') return false;
  const current = readWorkspace();
  const target: Workspace = { mode: 'live', scope: sessionTenantId };

  if (current.mode === 'live' && current.scope === sessionTenantId) {
    // Already correct — make sure the bucket is stamped (older browsers).
    stampBucketOwner(storagePrefix(target), sessionTenantId);
    return false;
  }

  // Wrong tenant in a live bucket: drop the stale pointer before switching so
  // nothing can read the previous tenant's numbers in the gap before reload.
  if (current.mode === 'live' && current.scope !== sessionTenantId) {
    console.log('[v0] workspace scope mismatch — correcting', {
      was: current.scope,
      now: sessionTenantId,
    });
  }

  setWorkspace(target);
  return true;
}

// Seed data (sample reps, sample teams, sample P&L lines) is a DEMO device. A
// live account must start empty, or the owner sees invented staff and invented
// money on day one and cannot tell which numbers are real.
//
//   const people = seedForWorkspace(DEFAULT_PEOPLE, []);
//
// Returns `demoValue` only in the demo workspace; `liveValue` otherwise.
export function seedForWorkspace<T>(demoValue: T, liveValue: T): T {
  return readWorkspace().mode === 'demo' ? demoValue : liveValue;
}

/** Wipe just the active bucket — used by "Reset demo data". */
export function clearWorkspaceData(ws: Workspace) {
  const prefix = storagePrefix(ws);
  const doomed: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith(prefix)) doomed.push(key);
  }
  // Collected first, then removed — removing during the scan shifts indices.
  doomed.forEach(key => window.localStorage.removeItem(key));
}

/**
 * Remove EVERY live bucket, its ownership stamp, and the workspace pointer.
 * Called on sign-out so a shared or handed-over browser cannot carry one
 * company's cached book into the next person's session. Demo data is left
 * alone — it is sample content, not anyone's book.
 */
export function purgeAllLiveBuckets() {
  if (typeof window === 'undefined') return;
  const doomed: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key) continue;
    if (key.startsWith('live:') || key.startsWith(OWNER_STAMP_PREFIX + 'live:')) {
      doomed.push(key);
    }
  }
  doomed.forEach(key => window.localStorage.removeItem(key));
  try {
    window.localStorage.removeItem(WORKSPACE_KEY);
  } catch {
    /* ignore */
  }
}

// The shim source, kept here so the prefix rules live in exactly one file.
// Stringified into a blocking <script> by the root layout.
export const WORKSPACE_SHIM = `(function(){
try{
  var raw=localStorage.getItem(${JSON.stringify(WORKSPACE_KEY)});
  var ws=raw?JSON.parse(raw):null;
  var mode=(ws&&ws.mode==='live')?'live':'demo';
  var scope=(ws&&ws.scope)||'demo';
  var p=mode==='live'?('live:'+scope+':'):'demo:';
  var proto=Storage.prototype,g=proto.getItem,s=proto.setItem,r=proto.removeItem;
  function m(k){return (typeof k==='string'&&k.lastIndexOf('se-',0)===0)?p+k:k;}
  proto.getItem=function(k){return g.call(this,m(k));};
  proto.setItem=function(k,v){return s.call(this,m(k),v);};
  proto.removeItem=function(k){return r.call(this,m(k));};
}catch(e){}
})();`;
