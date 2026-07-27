// Run: npm run test:workspace
//
// Regression tests for the cross-tenant isolation invariant. A real leak
// happened here: one company's roster was written into another company's rows
// because the LIVE storage prefix was not corrected when a second user signed
// in on the same browser. These tests pin the fixed behaviour.

import assert from 'assert';

// ---------------------------------------------------------------------------
// Minimal localStorage + location stub so the module under test can run in node
// ---------------------------------------------------------------------------
let reloads = 0;

class MemoryStorage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  key(i: number) { return Array.from(this.map.keys())[i] ?? null; }
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { this.map.set(k, String(v)); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
}

const storage = new MemoryStorage();
(globalThis as Record<string, unknown>).window = {
  localStorage: storage,
  location: { reload: () => { reloads++; } },
};

// Required (not imported) so the window stub above is in place first — the
// module reads `typeof window` at call time, but this keeps the order explicit.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const workspace = require('./workspace') as typeof import('./workspace');
const {
  storagePrefix, readWorkspace, setWorkspace, reconcileWorkspace,
  bucketBelongsTo, stampBucketOwner, purgeAllLiveBuckets, clearWorkspaceData,
  DEFAULT_WORKSPACE, WORKSPACE_KEY,
} = workspace;

const TENANT_A = 'cmrwv7ev60000dyjwi6q3he7h'; // Sorami
const TENANT_B = 'cms29c6hy0000l1laft065ckh'; // Miraso

function reset() {
  storage.clear();
  reloads = 0;
}

// --- prefixes are actually distinct per tenant ------------------------------
reset();
assert.strictEqual(storagePrefix({ mode: 'demo', scope: 'demo' }), 'demo:');
assert.strictEqual(storagePrefix({ mode: 'live', scope: TENANT_A }), `live:${TENANT_A}:`);
assert.notStrictEqual(
  storagePrefix({ mode: 'live', scope: TENANT_A }),
  storagePrefix({ mode: 'live', scope: TENANT_B }),
  'two tenants must never share a storage prefix'
);

// --- a fresh browser starts in demo, never in someone's live book -----------
reset();
assert.deepStrictEqual(readWorkspace(), DEFAULT_WORKSPACE);

// --- THE LEAK: live bucket already pointing at another tenant ---------------
// Old behaviour: `if (mode !== 'live')` meant this mismatch was left in place.
reset();
setWorkspace({ mode: 'live', scope: TENANT_A });
reloads = 0;
const corrected = reconcileWorkspace(TENANT_B);
assert.strictEqual(corrected, true, 'a tenant mismatch must be corrected');
assert.strictEqual(readWorkspace().scope, TENANT_B, 'scope must follow the session');
assert.strictEqual(reloads, 1, 'a corrected scope must force a reload');

// --- already correct: no correction, no reload loop -------------------------
reset();
setWorkspace({ mode: 'live', scope: TENANT_A });
reloads = 0;
assert.strictEqual(reconcileWorkspace(TENANT_A), false, 'no correction when already correct');
assert.strictEqual(reloads, 0, 'must not reload when nothing changed — that is an infinite loop');

// --- demo -> live for a customer still reconciles ---------------------------
reset();
setWorkspace({ mode: 'demo', scope: 'demo' });
reloads = 0;
assert.strictEqual(reconcileWorkspace(TENANT_A), true);
assert.strictEqual(readWorkspace().mode, 'live');
assert.strictEqual(readWorkspace().scope, TENANT_A);

// --- bucket ownership stamps: the sync layer's push guard -------------------
reset();
setWorkspace({ mode: 'live', scope: TENANT_A });
const prefixA = storagePrefix({ mode: 'live', scope: TENANT_A });
assert.strictEqual(bucketBelongsTo(prefixA, TENANT_A), true, 'own bucket is trusted');
assert.strictEqual(
  bucketBelongsTo(prefixA, TENANT_B), false,
  "another tenant must never be able to push tenant A's cached bucket"
);
// Unstamped (pre-fix browser) is untrusted rather than assumed-mine.
reset();
assert.strictEqual(
  bucketBelongsTo('live:whatever:', TENANT_A), false,
  'an unstamped bucket must be treated as untrusted'
);

// --- sign-out leaves no company book behind --------------------------------
reset();
setWorkspace({ mode: 'live', scope: TENANT_A });
storage.setItem(`live:${TENANT_A}:se-people-v1`, '[{"name":"Christy Nguyen"}]');
storage.setItem(`live:${TENANT_B}:se-people-v1`, '[{"name":"Someone Else"}]');
storage.setItem('demo:se-people-v1', '[{"name":"Sarah Johnson"}]');
stampBucketOwner(`live:${TENANT_A}:`, TENANT_A);

purgeAllLiveBuckets();

assert.strictEqual(
  storage.getItem(`live:${TENANT_A}:se-people-v1`), null,
  'live data must be gone after sign-out'
);
assert.strictEqual(
  storage.getItem(`live:${TENANT_B}:se-people-v1`), null,
  'every tenant bucket must be gone, not just the active one'
);
assert.strictEqual(
  storage.getItem(WORKSPACE_KEY), null,
  'the workspace pointer must be cleared so the next user starts clean'
);
assert.strictEqual(
  storage.getItem('demo:se-people-v1'), '[{"name":"Sarah Johnson"}]',
  'demo sample data is not anyone\u2019s book — leave it alone'
);
assert.strictEqual(
  bucketBelongsTo(`live:${TENANT_A}:`, TENANT_A), false,
  'ownership stamps must be purged too, or a stale bucket stays trusted'
);

// --- clearWorkspaceData only clears the bucket it was asked to --------------
reset();
storage.setItem(`live:${TENANT_A}:se-sales-v1`, '[1]');
storage.setItem(`live:${TENANT_B}:se-sales-v1`, '[2]');
clearWorkspaceData({ mode: 'live', scope: TENANT_A });
assert.strictEqual(storage.getItem(`live:${TENANT_A}:se-sales-v1`), null);
assert.strictEqual(
  storage.getItem(`live:${TENANT_B}:se-sales-v1`), '[2]',
  'clearing one company must not touch another'
);

console.log('workspace: all isolation checks passed');
