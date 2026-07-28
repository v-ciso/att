import { NextRequest, NextResponse } from 'next/server';
import { currentActor } from '@/lib/archive';
import { can } from '@/lib/permissions';
import { documentBytes } from '@/lib/docs';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

/**
 * Streams a document's bytes from our own origin.
 *
 * The viewer used to fetch the storage domain directly with a signed URL, which
 * meant rendering depended on the browser being able to reach a third-party
 * host — the exact thing corporate VPNs and carrier networks block, and the
 * exact networks these reps are on. Serving from here removes that dependency,
 * keeps the storage token server-side, and re-runs the audience check on every
 * read instead of trusting a token minted earlier.
 *
 * `?download=1` switches to an attachment disposition for the Download button.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  if (!can(actor, 'docs.view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
  }

  const { id } = await ctx.params;
  const personId = req.nextUrl.searchParams.get('personId');
  const asDownload = req.nextUrl.searchParams.get('download') === '1';

  const file = await documentBytes(actor, id, personId);
  // Same indistinguishable 404 as the signed-URL route: a probe must not be
  // able to tell "no such document" from "not yours".
  if (!file) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE });
  }

  const ext = (file.mimeType.split('/')[1] ?? 'bin').replace(/[^a-z0-9.]/gi, '');
  const downloadName = /\.[a-z0-9]+$/i.test(file.fileName) ? file.fileName : `${file.fileName}.${ext}`;

  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      'Content-Type': file.mimeType,
      'Content-Length': String(file.bytes.length),
      'Content-Disposition': `${asDownload ? 'attachment' : 'inline'}; filename="${downloadName.replace(/"/g, '')}"`,
      // Private material: never let a shared cache or CDN hold a copy.
      'Cache-Control': 'no-store, private',
      // Defence in depth if a doc is ever opened in a top-level tab.
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; object-src 'none'",
    },
  });
}
