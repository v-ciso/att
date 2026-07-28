// Run: npm run test:permissions
//
// Asserts the capability matrix against the Phase 2 spec table, row by row. The
// point is that a future edit to ROLE_CAPS can't silently widen a buyer's reach
// into vendor-only territory without a test going red.
import assert from 'assert';
import { can, canWrite, canSeeTab, type Actor } from './permissions';

const SUPER: Actor = { role: 'OWNER', isSuperAdmin: true };
const OWNER: Actor = { role: 'OWNER' };
const MANAGER: Actor = { role: 'MANAGER' };
const LEAD: Actor = { role: 'LEAD' };
const VIEWER: Actor = { role: 'VIEWER' };
const REP: Actor = { role: 'REP' };

// --- Row: Demo workspace — vendor only ------------------------------------
assert.strictEqual(can(SUPER, 'workspace.demo'), true);
for (const a of [OWNER, MANAGER, LEAD, VIEWER, REP]) {
  assert.strictEqual(can(a, 'workspace.demo'), false);
}

// --- Row: Admin Console / recovery / branding — vendor only ----------------
for (const cap of ['admin.console', 'admin.recoverAnyCompany', 'branding.manage'] as const) {
  assert.strictEqual(can(SUPER, cap), true);
  // A buyer who owns their company still must not reach platform controls.
  assert.strictEqual(can(OWNER, cap), false);
  assert.strictEqual(can(MANAGER, cap), false);
}

// --- Row: Own company recycle bin — super + owner only --------------------
assert.strictEqual(can(SUPER, 'company.recycleBin'), true);
assert.strictEqual(can(OWNER, 'company.recycleBin'), true);
assert.strictEqual(can(MANAGER, 'company.recycleBin'), false);
assert.strictEqual(can(LEAD, 'company.recycleBin'), false);

// --- Row: Hire / edit / retire reps ---------------------------------------
assert.strictEqual(can(OWNER, 'roster.manage'), true);
assert.strictEqual(can(MANAGER, 'roster.manage'), true);
// A lead never gets company-wide roster control, only their own team.
assert.strictEqual(can(LEAD, 'roster.manage'), false);
assert.strictEqual(can(VIEWER, 'roster.manage'), false);

// "Leads can only add team members for themselves if given access": off by
// default, granted per user row.
assert.strictEqual(can(LEAD, 'roster.manageOwnTeam'), false);
assert.strictEqual(can(LEAD, 'roster.manageOwnTeam', { allowAddTeamMembers: true }), true);
// The flag is meaningless for roles that already hold the capability outright.
assert.strictEqual(can(OWNER, 'roster.manageOwnTeam'), true);
// ...and it must never promote a read-only seat.
assert.strictEqual(can(VIEWER, 'roster.manageOwnTeam', { allowAddTeamMembers: true }), false);

// --- Row: Log sales, attendance, schedule ---------------------------------
assert.strictEqual(canWrite(SUPER), true);
assert.strictEqual(canWrite(OWNER), true);
assert.strictEqual(canWrite(MANAGER), true);
assert.strictEqual(canWrite(LEAD), true);
// VIEWER is read-only by contract — this is what middleware rejects writes on.
assert.strictEqual(canWrite(VIEWER), false);
assert.strictEqual(canWrite(REP), false);
assert.strictEqual(canWrite(null), false);
assert.strictEqual(canWrite(undefined), false);

// --- Row: Commission engine / P&L ----------------------------------------
assert.strictEqual(can(OWNER, 'commission.manage'), true);
// Manager and viewer see the numbers but cannot run the engine.
assert.strictEqual(can(MANAGER, 'commission.manage'), false);
assert.strictEqual(can(MANAGER, 'commission.view'), true);
assert.strictEqual(can(VIEWER, 'commission.manage'), false);
assert.strictEqual(can(VIEWER, 'commission.view'), true);
// Spec table: LEAD is "no" for commission and P&L.
assert.strictEqual(can(LEAD, 'commission.view'), false);
assert.strictEqual(can(LEAD, 'pnl.view'), false);

// --- Row: Reset a company user's password --------------------------------
assert.strictEqual(can(OWNER, 'company.resetUserPassword'), true);
assert.strictEqual(can(MANAGER, 'company.resetUserPassword'), false);
assert.strictEqual(can(LEAD, 'company.resetUserPassword'), false);

// --- Settings: owner yes, manager no -------------------------------------
assert.strictEqual(can(OWNER, 'settings.view'), true);
assert.strictEqual(can(MANAGER, 'settings.view'), false);
// Super-admin must not be locked out of Settings by holding a non-OWNER row.
assert.strictEqual(can({ role: 'VIEWER', isSuperAdmin: true }, 'settings.view'), true);

// --- Fail closed ----------------------------------------------------------
assert.strictEqual(can(null, 'pnl.view'), false);
assert.strictEqual(can(undefined, 'pnl.view'), false);
assert.strictEqual(can({}, 'pnl.view'), false);
// Roles in the enum but absent from the spec table get the least-privilege set
// rather than inheriting an editor's rights.
assert.strictEqual(can(REP, 'pnl.view'), false);
assert.strictEqual(can({ role: 'INTERN' }, 'data.write'), false);
// An unrecognised role string must never be treated as privileged.
assert.strictEqual(can({ role: 'ADMIN' }, 'data.write'), false);
assert.strictEqual(can({ role: '' }, 'data.write'), false);

// --- Tab gating mirrors the capabilities ---------------------------------
// Ungated tabs stay visible to everyone, including read-only seats.
for (const tab of ['dashboard', 'tracker', 'roster', 'leaderboard']) {
  assert.strictEqual(canSeeTab(VIEWER, tab), true);
}
assert.strictEqual(canSeeTab(undefined, undefined), true);
// Gated tabs follow the matrix.
assert.strictEqual(canSeeTab(OWNER, 'pnl'), true);
assert.strictEqual(canSeeTab(LEAD, 'pnl'), false);
assert.strictEqual(canSeeTab(LEAD, 'commission'), false);
assert.strictEqual(canSeeTab(VIEWER, 'commission'), true);
assert.strictEqual(canSeeTab(MANAGER, 'import'), true);
assert.strictEqual(canSeeTab(VIEWER, 'import'), false);
assert.strictEqual(canSeeTab(MANAGER, 'settings'), false);
assert.strictEqual(canSeeTab(OWNER, 'settings'), true);
// An unknown tab is not secretly privileged.
assert.strictEqual(canSeeTab(VIEWER, 'not-a-tab'), true);

console.log('permissions: all checks passed');
