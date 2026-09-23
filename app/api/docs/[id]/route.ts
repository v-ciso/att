import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { currentActor } from '@/lib/archive';
import { can } from '@/lib/permissions';
import { deleteDocument, acknowledgeDocument } from '@/lib/docs';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

// DELETE soft-deletes (docs.manage only). POST records an acknowledgement, which
// any seat that can see the doc may do for themselves.

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  if (!can(actor, 'docs.manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
  }
  const { id } = await ctx.params;
  const ok = await deleteDocument(actor, id);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE });
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}

const ackSchema = z.object({
  personId: z.string().min(1).max(120),
  personName: z.string().min(1).max(200),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  if (!can(actor, 'docs.view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
  }

  const parsed = ackSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'personId and personName are required' }, { status: 400, headers: NO_STORE });
  }

  const { id } = await ctx.params;
  const ok = await acknowledgeDocument(actor, id, parsed.data.personId, parsed.data.personName);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE });
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
