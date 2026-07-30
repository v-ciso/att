import { prisma } from '@/lib/db';
import type { NextRequest } from 'next/server';

/**
 * Append-only audit trail. See AuditLog in prisma/schema.prisma.
 *
 * Every function here swallows its own errors. An audit write is bookkeeping
 * that runs *after* the real work has already committed, so letting it throw
 * would turn a successful role change into a 500 and leave the caller thinking
 * it failed — the worst of both worlds, since the change stuck anyway. Failures
 * are logged loudly instead so they surface without breaking the request.
 */

/** Dotted verbs, kept in one place so the trail stays greppable. */
export type AuditAction =
  | 'auth.login'
  | 'auth.login_failed'
  | 'auth.locked_out'
  | 'auth.logout'
  | 'user.created'
  | 'user.role_changed'
  | 'user.disabled'
  | 'user.enabled'
  | 'user.deleted'
  | 'company.disabled'
  | 'company.enabled'
  | 'doc.created'
  | 'doc.deleted'
  | 'data.archived'
  | 'data.restored'
  | 'settings.updated';

export type AuditActor = {
  id?: string | null;
  email: string;
  role: string;
  marketOwnerId?: string | null;
};

type AuditInput = {
  action: AuditAction;
  actor: AuditActor;
  targetType?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
  /** Pass the request so the row records where the action came from. */
  req?: NextRequest | Request | null;
  /**
   * Explicit overrides for callers that have no real Request to hand. NextAuth's
   * `authorize` is the motivating case: it receives a plain object whose
   * `headers` is a POJO, not a Headers instance, so `.get()` does not exist
   * there and silently yielded null on every sign-in row.
   */
  ip?: string | null;
  userAgent?: string | null;
};

/**
 * Best-effort extraction of the caller's address.
 *
 * x-forwarded-for is a comma-separated chain and the LEFTMOST entry is the
 * original client; taking the last one would record our own proxy on every
 * request. It is client-supplied and therefore spoofable, so treat it as a
 * useful hint for an investigation, not as proof of origin.
 */
export function clientIp(req?: NextRequest | Request | null): string | null {
  const fwd = readHeader(req, 'x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  return readHeader(req, 'x-real-ip');
}

/**
 * Read one header from either a real Request (Headers instance) or the plain
 * object NextAuth passes into `authorize`. Handling only the former is what made
 * every sign-in row record a null address.
 */
function readHeader(req: unknown, name: string): string | null {
  const headers = (req as { headers?: unknown } | null | undefined)?.headers;
  if (!headers) return null;
  if (typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get(name);
  }
  const bag = headers as Record<string, string | string[] | undefined>;
  // Node lowercases incoming header names, but do not bet the audit trail on it.
  const hit = bag[name] ?? bag[name.toLowerCase()];
  if (Array.isArray(hit)) return hit[0] ?? null;
  return hit ?? null;
}

/** Write one row. Never throws. */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        actorId: input.actor.id ?? null,
        actorEmail: input.actor.email,
        actorRole: input.actor.role,
        marketOwnerId: input.actor.marketOwnerId ?? null,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        meta: (input.meta ?? undefined) as never,
        ip: input.ip ?? clientIp(input.req),
        userAgent:
          (input.userAgent ?? readHeader(input.req, 'user-agent'))?.slice(0, 300) ?? null,
      },
    });
  } catch (err) {
    console.error('[audit] failed to record', input.action, err);
  }
}

/**
 * Read the trail for one tenant, newest first.
 *
 * marketOwnerId is required rather than optional: an audit reader that returns
 * every tenant's rows when the caller forgets to scope it is a cross-tenant
 * leak, and this is exactly the table where that hurts most. Platform-wide
 * reads go through listPlatformAuditLog instead, which is explicit about it.
 */
export async function listAuditLog(
  marketOwnerId: string,
  opts?: { limit?: number; action?: string },
) {
  const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 500);
  try {
    return await prisma.auditLog.findMany({
      where: {
        marketOwnerId,
        ...(opts?.action ? { action: opts.action } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  } catch (err) {
    console.error('[audit] read failed', err);
    return [];
  }
}
