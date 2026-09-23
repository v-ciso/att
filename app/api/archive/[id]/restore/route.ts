import { NextResponse } from 'next/server';
import { can } from '@/lib/permissions';
import { currentActor, restoreArchive } from '@/lib/archive';

// Restore an archived entity. Returns the payload so the client can re-insert
// it into the relevant TenantData blob (roster, competitions, ...). Scope is
// enforced in restoreArchive: a non-super actor can only restore their own
// company's items.

const NO_STORE = { 'Cache-Control': 'no-store, private' } as const;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  if (!can(actor, 'company.recycleBin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
  }

  const { id } = await ctx.params;
  const item = await restoreArchive(actor, id);
  if (!item) return NextResponse.json({ error: 'Not found or already restored' }, { status: 404, headers: NO_STORE });
  return NextResponse.json({ item }, { headers: NO_STORE });
}
