import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { isSuperAdminEmail } from '@/lib/super-admins';

// Server-side recycle bin. Every rep/store/competition removal and every full
// tenant snapshot lands in DataArchive as a JSON payload, scoped to a company.
// The one rule that makes this safe (same as /api/tenant-data): the tenant is
// ALWAYS taken from the session, never from the request body. A super-admin is
// the only actor who may reach across companies, and only to restore or purge.

export const ARCHIVE_KINDS = ['PERSON', 'STORE', 'COMPETITION', 'TENANT_SNAPSHOT'] as const;
export type ArchiveKind = (typeof ARCHIVE_KINDS)[number];

export interface Actor {
  userId: string;
  email: string;
  role: string;
  marketOwnerId: string | null;
  isSuperAdmin: boolean;
}

/** The signed-in actor, or null if not authenticated. */
export async function currentActor(): Promise<Actor | null> {
  const session = await getServerSession(authOptions);
  const u = session?.user;
  if (!u?.id) return null;
  return {
    userId: u.id,
    email: u.email ?? '',
    role: (u.role as string) ?? '',
    marketOwnerId: u.marketOwnerId ?? null,
    // Trust the token's stamp, but re-derive from the email too so a stale
    // token can never downgrade a founder below their own recovery powers.
    isSuperAdmin: !!u.isSuperAdmin || isSuperAdminEmail(u.email),
  };
}

/** Shape sent to the recovery UI. Payload is included for preview. */
export interface ArchiveItem {
  id: string;
  marketOwnerId: string;
  kind: string;
  refId: string;
  label: string;
  payload: unknown;
  deletedBy: string;
  deletedAt: string;
  reason: string | null;
  companyName?: string;
}

function toItem(row: {
  id: string; marketOwnerId: string; kind: string; refId: string; label: string;
  payload: unknown; deletedBy: string; deletedAt: Date; reason: string | null;
  marketOwner?: { name: string } | null;
}): ArchiveItem {
  return {
    id: row.id,
    marketOwnerId: row.marketOwnerId,
    kind: row.kind,
    refId: row.refId,
    label: row.label,
    payload: row.payload,
    deletedBy: row.deletedBy,
    deletedAt: row.deletedAt.toISOString(),
    reason: row.reason,
    companyName: row.marketOwner?.name,
  };
}

/**
 * Record an archived entity. Scoped to the actor's OWN company — there is no
 * cross-company archiving. Requires a company context, so a super-admin with no
 * marketOwnerId cannot archive into a tenant they are only visiting.
 */
export async function recordArchive(
  actor: Actor,
  input: { kind: ArchiveKind; refId: string; label: string; payload: unknown; reason?: string }
): Promise<ArchiveItem> {
  if (!actor.marketOwnerId) throw new Error('No company context for archive');
  const row = await prisma.dataArchive.create({
    data: {
      marketOwnerId: actor.marketOwnerId,
      kind: input.kind,
      refId: input.refId,
      label: input.label,
      payload: input.payload as object,
      deletedBy: actor.userId,
      reason: input.reason,
    },
  });
  return toItem(row);
}

/**
 * The active recycle bin (not yet restored, not yet purged). An OWNER sees only
 * their own company; a super-admin may target any company or list all.
 */
export async function listArchives(
  actor: Actor,
  opts?: { marketOwnerId?: string; kind?: ArchiveKind }
): Promise<ArchiveItem[]> {
  // Decide the tenant scope. A non-super actor is pinned to their own company
  // regardless of what they ask for.
  let scope: string | undefined;
  if (actor.isSuperAdmin) {
    scope = opts?.marketOwnerId; // undefined = all companies
  } else {
    if (!actor.marketOwnerId) return [];
    scope = actor.marketOwnerId;
  }

  const rows = await prisma.dataArchive.findMany({
    where: {
      ...(scope ? { marketOwnerId: scope } : {}),
      ...(opts?.kind ? { kind: opts.kind } : {}),
      restoredAt: null,
      purgedAt: null,
    },
    orderBy: { deletedAt: 'desc' },
    include: actor.isSuperAdmin ? { marketOwner: { select: { name: true } } } : undefined,
    take: 500,
  });
  return rows.map(toItem);
}

/**
 * Mark an archived item restored and hand its payload back so the caller can
 * re-insert the entity. Scope-checked: a non-super actor can only restore items
 * belonging to their own company. Returns null if not found or out of scope.
 */
export async function restoreArchive(actor: Actor, id: string): Promise<ArchiveItem | null> {
  const row = await prisma.dataArchive.findUnique({ include: { marketOwner: { select: { name: true } } }, where: { id } });
  if (!row || row.restoredAt || row.purgedAt) return null;
  if (!actor.isSuperAdmin && row.marketOwnerId !== actor.marketOwnerId) return null;

  const updated = await prisma.dataArchive.update({
    where: { id },
    data: { restoredAt: new Date(), restoredBy: actor.userId },
    include: { marketOwner: { select: { name: true } } },
  });
  return toItem(updated);
}

/**
 * Permanent purge — super-admin only, requires a reason. The audit fields and
 * the label survive so the recovery log still shows that something existed and
 * who destroyed it, but the payload is dropped so the data itself is gone.
 */
export async function purgeArchive(actor: Actor, id: string, reason: string): Promise<boolean> {
  if (!actor.isSuperAdmin) return false;
  const row = await prisma.dataArchive.findUnique({ where: { id } });
  if (!row || row.purgedAt) return false;
  await prisma.dataArchive.update({
    where: { id },
    data: { purgedAt: new Date(), purgedBy: actor.userId, reason, payload: { purged: true } },
  });
  return true;
}
