import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentActor, purgeArchive } from '@/lib/archive';

// Permanent purge — super-admin ONLY, and only with a typed company-name
// confirmation + reason (checked on the client, re-required here). This is the
// one path in the whole app that destroys data, so it fails closed: no actor,
// not super, or missing reason all reject before anything is touched.

const NO_STORE = { 'Cache-Control': 'no-store, private' } as const;

const schema = z.object({
  reason: z.string().min(3).max(500),
  confirmCompany: z.string().min(1),
});

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  if (!actor.isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: NO_STORE }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Reason and confirmCompany required' }, { status: 400, headers: NO_STORE });

  const { id } = await ctx.params;
  const ok = await purgeArchive(actor, id, parsed.data.reason);
  if (!ok) return NextResponse.json({ error: 'Not found or already purged' }, { status: 404, headers: NO_STORE });
  return NextResponse.json({ success: true }, { headers: NO_STORE });
}
