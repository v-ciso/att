import { NextRequest, NextResponse } from 'next/server';
import { currentActor } from '@/lib/archive';
import { listAuditLog, listPlatformAuditLog } from '@/lib/audit';

const NO_STORE = { 'Cache-Control': 'no-store, private' } as const;

/**
 * Company owners can inspect their own security trail. Super-admins may inspect
 * the whole platform or pass a company id to narrow the result. No tenant id
 * supplied by a customer is ever trusted.
 */
export async function GET(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401, headers: NO_STORE });
  }
  if (!actor.isSuperAdmin && actor.role !== 'OWNER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
  }

  const action = request.nextUrl.searchParams.get('action')?.trim() || undefined;
  const requestedCompany = request.nextUrl.searchParams.get('marketOwnerId')?.trim() || undefined;
  const rows = actor.isSuperAdmin
    ? requestedCompany
      ? await listAuditLog(requestedCompany, { action, limit: 150 })
      : await listPlatformAuditLog({ action, limit: 150 })
    : actor.marketOwnerId
      ? await listAuditLog(actor.marketOwnerId, { action, limit: 150 })
      : [];

  return NextResponse.json({ rows }, { headers: NO_STORE });
}
