import { NextRequest, NextResponse } from 'next/server';
import { currentActor } from '@/lib/archive';
import { can } from '@/lib/permissions';
import {
  listDocuments, createDocument, DOC_KINDS, MAX_DOC_BYTES,
  ALLOWED_DOC_MIME, type DocKind,
} from '@/lib/docs';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

// Reads require docs.view (every signed-in seat, then filtered per-document by
// audience). Writes require docs.manage (OWNER + MANAGER only), so a lead or ASM
// cannot publish company-wide material.

export async function GET(req: NextRequest) {
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  if (!can(actor, 'docs.view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
  }

  const kindParam = req.nextUrl.searchParams.get('kind');
  const kind = DOC_KINDS.includes(kindParam as DocKind) ? (kindParam as DocKind) : undefined;
  // The caller's own person id, so individually-targeted docs resolve. It is a
  // filter input only — it can never widen access beyond the audience check.
  const personId = req.nextUrl.searchParams.get('personId');

  const items = await listDocuments(actor, { kind, personId });
  return NextResponse.json({ items }, { headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  if (!can(actor, 'docs.manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400, headers: NO_STORE });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400, headers: NO_STORE });
  }
  if (file.size > MAX_DOC_BYTES) {
    return NextResponse.json(
      { error: `File is larger than ${Math.round(MAX_DOC_BYTES / 1024 / 1024)}MB` },
      { status: 413, headers: NO_STORE }
    );
  }
  const mimeType = file.type || 'application/octet-stream';
  if (!ALLOWED_DOC_MIME.has(mimeType)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${mimeType}. Upload a PDF, image, spreadsheet or Word doc.` },
      { status: 415, headers: NO_STORE }
    );
  }

  const kindRaw = String(form.get('kind') ?? 'OTHER');
  const kind = (DOC_KINDS.includes(kindRaw as DocKind) ? kindRaw : 'OTHER') as DocKind;
  const title = String(form.get('title') ?? '').trim().slice(0, 200) || file.name;

  // Audience arrives as JSON arrays; a malformed value falls back to
  // company-wide rather than failing the upload.
  const parseList = (key: string): string[] => {
    try {
      const raw = form.get(key);
      if (!raw) return [];
      const parsed = JSON.parse(String(raw));
      return Array.isArray(parsed) ? parsed.map(String).filter(Boolean).slice(0, 200) : [];
    } catch {
      return [];
    }
  };

  const parseDate = (key: string): Date | null => {
    const raw = form.get(key);
    if (!raw) return null;
    const d = new Date(String(raw));
    return Number.isNaN(d.getTime()) ? null : d;
  };

  try {
    const doc = await createDocument(actor, {
      title,
      kind,
      bytes: Buffer.from(await file.arrayBuffer()),
      fileName: file.name,
      mimeType,
      audienceRoles: parseList('audienceRoles'),
      audiencePersonIds: parseList('audiencePersonIds'),
      requiresAck: String(form.get('requiresAck') ?? '') === 'true',
      effectiveFrom: parseDate('effectiveFrom'),
      effectiveTo: parseDate('effectiveTo'),
      supersedesId: (String(form.get('supersedesId') ?? '') || null) as string | null,
    });
    return NextResponse.json({ doc }, { headers: NO_STORE });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 400, headers: NO_STORE });
  }
}
