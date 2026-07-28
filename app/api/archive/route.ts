import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { can } from '@/lib/permissions';
import {
  currentActor, listArchives, recordArchive, ARCHIVE_KINDS,
} from '@/lib/archive';

// Recovery API. GET lists the recycle bin (own company, or any/all for a
// super-admin); POST records an archived entity. Both re-check capability here
// — the middleware gate and the UI hiding are hints, not the lock.

const NO_STORE = { 'Cache-Control': 'no-store, private' } as const;

const createSchema = z.object({
  kind: z.enum(ARCHIVE_KINDS),
  refId: z.string().min(1).max(200),
  label: z.string().min(1).max(300),
  payload: z.unknown(),
  reason: z.string().max(500).optional(),
});

export async function GET(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

  // Own-company recycle bin needs company.recycleBin; the cross-company view is
  // super-admin only and is enforced inside listArchives by the isSuperAdmin
  // scope, but we still require the base capability to see any bin at all.
  if (!can(actor, 'company.recycleBin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
  }

  const url = new URL(request.url);
  const kindParam = url.searchParams.get('kind') ?? undefined;
  const kind = (ARCHIVE_KINDS as readonly string[]).includes(kindParam ?? '')
    ? (kindParam as (typeof ARCHIVE_KINDS)[number])
    : undefined;
  // Only a super-admin may scope to another company; for everyone else this is
  // ignored and listArchives pins to their own tenant.
  const marketOwnerId = actor.isSuperAdmin
    ? url.searchParams.get('marketOwnerId') ?? undefined
    : undefined;

  const items = await listArchives(actor, { marketOwnerId, kind });
  return NextResponse.json({ items }, { headers: NO_STORE });
}

export async function POST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });

  // Archiving is a roster/data mutation; a read-only seat cannot do it.
  if (!can(actor, 'roster.manage') && !can(actor, 'data.write')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
  }
  if (!actor.marketOwnerId) {
    return NextResponse.json({ error: 'No company context' }, { status: 400, headers: NO_STORE });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: NO_STORE }); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.flatten() }, { status: 400, headers: NO_STORE });
  }

  // z.unknown() types payload as optional; archives always carry one, so pin it
  // to null when absent to satisfy the required column rather than silently drop.
  const item = await recordArchive(actor, { ...parsed.data, payload: parsed.data.payload ?? null });
  return NextResponse.json({ item }, { status: 201, headers: NO_STORE });
}
