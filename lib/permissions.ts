// The single capability matrix. Imported by the sidebar, the dashboard tabs,
// middleware and the API routes so there is exactly one answer to "may this
// seat do that" — previously `CAN_WRITE` was inlined in middleware.ts while the
// nav showed every link to every role, so the two disagreed by construction.
//
// Client-safe on purpose: no server-only imports, so the sidebar (a client
// component) and middleware can share it. It contains no secrets — only the
// role→capability mapping, which the server re-checks on every request.
//
// UI hiding is a hint, never a permission. Every capability consumed by a route
// handler must also be enforced there.

/** Mirrors `enum Role` in prisma/schema.prisma. */
export type Role = 'OWNER' | 'MANAGER' | 'VIEWER' | 'ASM' | 'LEAD' | 'REP' | 'INTERN';

export type Capability =
  // Platform-level: founder/staff only, never a buyer.
  | 'workspace.demo'
  | 'admin.console'
  | 'admin.recoverAnyCompany'
  | 'branding.manage'
  // Company-level.
  | 'company.recycleBin'
  | 'company.resetUserPassword'
  | 'roster.manage'
  | 'roster.manageOwnTeam'
  | 'data.write'
  | 'commission.manage'
  | 'commission.view'
  | 'pnl.view'
  | 'settings.view'
  | 'import.use';

export interface Actor {
  role?: Role | string | null;
  isSuperAdmin?: boolean | null;
}

/**
 * Capabilities granted by each role, before the super-admin override.
 *
 * ASM is treated as a LEAD with company-wide reach, and REP/INTERN get the
 * least-privilege set: the Role enum has more members than the spec's matrix, so
 * anything unlisted must fail closed rather than inherit an editor's rights.
 */
const ROLE_CAPS: Record<Role, Capability[]> = {
  OWNER: [
    'company.recycleBin',
    'company.resetUserPassword',
    'roster.manage',
    'roster.manageOwnTeam',
    'data.write',
    'commission.manage',
    'commission.view',
    'pnl.view',
    'settings.view',
    'import.use',
  ],
  // Edit access to their company's data, but commission/P&L are read-only and
  // branding, seats and domain stay off-limits.
  MANAGER: [
    'roster.manage',
    'roster.manageOwnTeam',
    'data.write',
    'commission.view',
    'pnl.view',
    'import.use',
  ],
  ASM: ['roster.manageOwnTeam', 'data.write', 'commission.view', 'pnl.view'],
  // "Leads can only add team members for themselves if given access" — the
  // roster capability is gated behind allowAddTeamMembers in `can()` below.
  LEAD: ['roster.manageOwnTeam', 'data.write'],
  // Read-only by contract: can see every screen, can change nothing.
  VIEWER: ['commission.view', 'pnl.view'],
  REP: [],
  INTERN: [],
};

/** Capabilities that belong to the platform owner and can never be delegated. */
const SUPER_ONLY: Capability[] = [
  'workspace.demo',
  'admin.console',
  'admin.recoverAnyCompany',
  'branding.manage',
];

/**
 * The one authorization check.
 *
 * `allowAddTeamMembers` is the per-user flag from the user row that lets a
 * specific LEAD/ASM hire onto their own team; it defaults to off, so a lead
 * cannot grow the roster until someone grants it.
 */
export function can(
  actor: Actor | null | undefined,
  capability: Capability,
  opts?: { allowAddTeamMembers?: boolean }
): boolean {
  if (!actor) return false;

  // Super-admin is additive: it unlocks the platform capabilities on top of
  // whatever the seat's own role allows, so the founder is never locked out of
  // their own tenant by holding a non-OWNER role row.
  if (actor.isSuperAdmin) return true;

  // Nobody but a super-admin reaches these, regardless of role.
  if (SUPER_ONLY.includes(capability)) return false;

  const role = actor.role as Role | undefined;
  if (!role || !(role in ROLE_CAPS)) return false;

  if (
    capability === 'roster.manageOwnTeam' &&
    (role === 'LEAD' || role === 'ASM') &&
    !opts?.allowAddTeamMembers
  ) {
    return false;
  }

  return ROLE_CAPS[role].includes(capability);
}

/**
 * Roles allowed to mutate data at all. Used by middleware to reject writes at
 * the edge — a read-only seat that can still POST is not read-only.
 */
export function canWrite(actor: Actor | null | undefined): boolean {
  return can(actor, 'data.write');
}

/**
 * Capability required to see each nav entry / dashboard tab, keyed by the `tab`
 * value in nav-items.ts (`settings` covers the standalone /settings page).
 * Anything absent from this map is visible to every signed-in seat.
 */
export const TAB_CAPABILITY: Partial<Record<string, Capability>> = {
  pnl: 'pnl.view',
  commission: 'commission.view',
  import: 'import.use',
  recycle: 'company.recycleBin',
  settings: 'settings.view',
};

/** True when this actor may see the given tab / nav entry. */
export function canSeeTab(actor: Actor | null | undefined, tab?: string | null): boolean {
  if (!tab) return true;
  const required = TAB_CAPABILITY[tab];
  return required ? can(actor, required) : true;
}
