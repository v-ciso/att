import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canWrite } from '@/lib/permissions';

// The tenant's data container. Every read and write is scoped to the caller's
// OWN marketOwnerId, taken from the SESSION and never from the request body.
// That single rule is the isolation guarantee: a signed-in user can only ever
// touch their own company's rows, so company A cannot reach company B's data.

interface SessionUser { id: string; role: string; marketOwnerId?: string }

async function tenantId(): Promise<{ id: string; role: string } | null> {
  const session = await getServerSession(authOptions);
  const u = session?.user as SessionUser | undefined;
  if (!u?.marketOwnerId) return null;
  return { id: u.marketOwnerId, role: u.role };
}

// Only these keys are accepted — the app's known operational data. A client
// cannot invent arbitrary keys to bloat a tenant's storage.
const ALLOWED_KEYS = new Set([
  'se-sales-v1', 'se-people-v1', 'se-teams-v2', 'se-commission-v2', 'se-pnl-v1',
  'se-attendance-v1', 'se-lateouts-v1', 'se-commit-v1', 'se-schedule-v1',
  'se-goals-v1', 'se-competitions-v1', 'se-promo-rules-v1', 'se-campaign-v1',
  'se-theme-v1', 'se-store-closed-v1', 'se-mtg-v1', 'se-competitions-archive-v1',
]);

/**
 * Defence in depth against client-side scope drift.
 *
 * The session still decides which rows are touched — this header can never
 * widen access. But a client that *thinks* it is company A while holding a
 * session for company B is a bug we want to fail loudly rather than let it
 * silently overwrite B's book with A's cache (the original leak). 409 tells the
 * client to re-reconcile and reload.
 */
function tenantMismatch(request: NextRequest, sessionTenant: string): boolean {
  const claimed = request.headers.get('X-Tenant-Id');
  return !!claimed && claimed !== sessionTenant;
}

// Authenticated payloads must never be cached by a proxy or the browser —
// a shared machine could otherwise replay another company's data.
const NO_STORE = { 'Cache-Control': 'no-store, private' } as const;

export async function GET(request: NextRequest) {
  const t = await tenantId();
  if (!t) return NextResponse.json({ error: 'No tenant' }, { status: 401, headers: NO_STORE });

  if (tenantMismatch(request, t.id)) {
    return NextResponse.json(
      { error: 'Tenant scope mismatch', expected: t.id },
      { status: 409, headers: NO_STORE }
    );
  }

  const rows = await prisma.tenantData.findMany({
    where: { marketOwnerId: t.id },
    select: { key: true, value: true },
  });
  const data: Record<string, unknown> = {};
  for (const r of rows) data[r.key] = r.value;
  return NextResponse.json({ data }, { headers: NO_STORE });
}

export async function PUT(request: NextRequest) {
  const t = await tenantId();
  if (!t) return NextResponse.json({ error: 'No tenant' }, { status: 401, headers: NO_STORE });
  // Read-only roles are already blocked at the edge for mutating methods, but
  // re-check here so this route is safe on its own.
  //
  // Was `role === 'VIEWER'`, which only named one of the read-only roles: REP and
  // INTERN are equally read-only in the matrix and could still PUT. canWrite()
  // covers every seat that lacks data.write, now and as roles are added.
  if (!canWrite({ role: t.role })) {
    return NextResponse.json({ error: 'Read-only' }, { status: 403, headers: NO_STORE });
  }

  // A write from a client whose idea of "my company" disagrees with its session
  // is rejected outright. This is the server half of the leak fix.
  if (tenantMismatch(request, t.id)) {
    console.log('[v0] rejected cross-tenant write attempt', {
      claimed: request.headers.get('X-Tenant-Id'),
      session: t.id,
    });
    return NextResponse.json(
      { error: 'Tenant scope mismatch — reload required', expected: t.id },
      { status: 409, headers: NO_STORE }
    );
  }

  const body = await request.json().catch(() => null);
  const items: Array<{ key: string; value: unknown }> = Array.isArray(body?.items) ? body.items : [];
  if (!items.length) return NextResponse.json({ saved: 0 }, { headers: NO_STORE });

  const valid = items.filter(i => typeof i.key === 'string' && ALLOWED_KEYS.has(i.key));

  await prisma.$transaction(
    valid.map(i =>
      prisma.tenantData.upsert({
        where: { marketOwnerId_key: { marketOwnerId: t.id, key: i.key } },
        create: { marketOwnerId: t.id, key: i.key, value: i.value as object },
        update: { value: i.value as object },
      })
    )
  );
  return NextResponse.json({ saved: valid.length }, { headers: NO_STORE });
}
