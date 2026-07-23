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

export type DataMode = 'demo' | 'live';

export interface Workspace {
  mode: DataMode;
  /** Tenant/account the LIVE bucket belongs to. Demo ignores this. */
  scope: string;
}

// Deliberately NOT `se-` prefixed: the shim must never rewrite its own config.
export const WORKSPACE_KEY = 'se__workspace';

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
  window.location.reload();
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
