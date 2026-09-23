import { NextRequest, NextResponse } from 'next/server';
import { currentActor } from '@/lib/archive';
import { can } from '@/lib/permissions';
import { signedUrlFor } from '@/lib/docs';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

// The only way to read a stored file. The bucket is private, so there is no
// public URL to leak; this mints a 60-second signed URL after re-checking the
// caller's company AND the document's audience. Never cached.

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  if (!can(actor, 'docs.view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
  }

  const { id } = await ctx.params;
  const personId = req.nextUrl.searchParams.get('personId');

  const url = await signedUrlFor(actor, id, personId, 60);
  // Indistinguishable 404 for "no such doc" and "not yours": a probe should not
  // be able to confirm that another company's document id exists.
  if (!url) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE });
  }
  return NextResponse.json({ url, expiresIn: 60 }, { headers: NO_STORE });
}
