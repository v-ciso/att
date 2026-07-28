import { prisma } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { Actor } from '@/lib/archive';
import { can, type Role } from '@/lib/permissions';

// Server-side document library. Files live in the PRIVATE Supabase Storage
// bucket `tenant-docs`; this module is the only thing that talks to it, so the
// tenant-prefixed path convention cannot drift between callers.
//
// Two invariants, both enforced here rather than in the UI:
//   1. The tenant is ALWAYS actor.marketOwnerId, never a request field. A
//      forged body cannot reach another company's shelf.
//   2. Storage paths are ALWAYS <marketOwnerId>/<docId>/<safeName>. Because the
//      company id is the first segment, a path traversal attempt still lands
//      inside the caller's own prefix.

export const DOC_BUCKET = 'tenant-docs';

export const DOC_KINDS = ['TRAINING', 'COMPLIANCE', 'PROMO', 'ADASM', 'OTHER'] as const;
export type DocKind = (typeof DOC_KINDS)[number];

export const MAX_DOC_BYTES = 25 * 1024 * 1024;

/** Formats we can render or parse. Mirrors the bucket's own allow-list. */
export const ALLOWED_DOC_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export interface DocumentDTO {
  id: string;
  title: string;
  kind: string;
  audienceRoles: string[];
  audiencePersonIds: string[];
  mimeType: string;
  sizeBytes: number;
  version: number;
  supersedesId: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  requiresAck: boolean;
  uploadedBy: string;
  createdAt: string;
  /** Present only for docs.manage seats: who has confirmed reading it. */
  acks?: Array<{ personId: string; personName: string; ackedAt: string }>;
  ackCount: number;
}

type DocRow = {
  id: string; title: string; kind: string; audienceRoles: string[];
  audiencePersonIds: string[]; mimeType: string; sizeBytes: number;
  version: number; supersedesId: string | null; effectiveFrom: Date | null;
  effectiveTo: Date | null; requiresAck: boolean; uploadedBy: string;
  createdAt: Date;
  acks?: Array<{ personId: string; personName: string; ackedAt: Date }>;
};

function toDTO(row: DocRow, includeAcks: boolean): DocumentDTO {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    audienceRoles: row.audienceRoles ?? [],
    audiencePersonIds: row.audiencePersonIds ?? [],
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    version: row.version,
    supersedesId: row.supersedesId,
    effectiveFrom: row.effectiveFrom ? row.effectiveFrom.toISOString() : null,
    effectiveTo: row.effectiveTo ? row.effectiveTo.toISOString() : null,
    requiresAck: row.requiresAck,
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt.toISOString(),
    ...(includeAcks && row.acks
      ? {
          acks: row.acks.map(a => ({
            personId: a.personId,
            personName: a.personName,
            ackedAt: a.ackedAt.toISOString(),
          })),
        }
      : {}),
    ackCount: row.acks?.length ?? 0,
  };
}

/**
 * Strips a filename down to something safe to put in a storage key. Keeps the
 * extension (the viewer keys off it) but drops directory separators, so
 * "../../etc/passwd.pdf" becomes "etcpasswd.pdf".
 */
export function safeFileName(name: string): string {
  const cleaned = String(name ?? '')
    .replace(/[/\\]+/g, '')
    .replace(/[^A-Za-z0-9._-]/g, '_')
    // Collapse runs of dots so no ".." (or "....") survives into a storage key.
    // The tenant prefix already contains any traversal, but a key that still
    // reads like a relative path is a trap for the next person to touch this.
    .replace(/\.{2,}/g, '.')
    .replace(/_{2,}/g, '_')
    // A leading dot would make the object hidden and is never meaningful here.
    .replace(/^[._-]+/, '')
    .slice(-120);
  return cleaned || 'file';
}

/** `<marketOwnerId>/<docId>/<safeName>` — company id first, always. */
export function storagePathFor(marketOwnerId: string, docId: string, fileName: string): string {
  return `${marketOwnerId}/${docId}/${safeFileName(fileName)}`;
}

function tenantOf(actor: Actor): string | null {
  return actor.marketOwnerId ?? null;
}

/**
 * True when this actor is allowed to see this specific document.
 *
 * A doc with no audience restrictions is company-wide. Otherwise the actor must
 * match by role OR be named individually. Managers/owners always see
 * everything on their own shelf, since they are the ones publishing it.
 */
function visibleTo(
  doc: { audienceRoles: string[]; audiencePersonIds: string[] },
  actor: Actor,
  personId?: string | null
): boolean {
  if (can(actor, 'docs.manage')) return true;
  const roles = doc.audienceRoles ?? [];
  const people = doc.audiencePersonIds ?? [];
  if (roles.length === 0 && people.length === 0) return true;
  if (roles.includes(actor.role as Role)) return true;
  if (personId && people.includes(personId)) return true;
  return false;
}

/**
 * Documents on this company's shelf, newest first, excluding soft-deleted rows.
 * Non-managers get only what is aimed at them, filtered in the app layer after
 * the tenant-scoped query (Postgres array-overlap plus "empty means everyone"
 * plus the personId case is far clearer expressed here).
 */
export async function listDocuments(
  actor: Actor,
  opts?: { kind?: DocKind; personId?: string | null; includeExpired?: boolean }
): Promise<DocumentDTO[]> {
  const tenant = tenantOf(actor);
  if (!tenant) return [];

  const manage = can(actor, 'docs.manage');
  const rows = await prisma.document.findMany({
    where: {
      marketOwnerId: tenant,
      deletedAt: null,
      ...(opts?.kind ? { kind: opts.kind } : {}),
    },
    // Acks are always loaded: managers see the full list, everyone else only
    // gets the count (toDTO drops the names), which powers "you have read this".
    include: { acks: true },
    orderBy: [{ createdAt: 'desc' }],
  });

  const now = Date.now();
  return rows
    .filter(r => visibleTo(r, actor, opts?.personId))
    .filter(r => {
      // Expired promos stay for managers (history) but drop off the floor's
      // list, so a rep never pitches last cycle's offer.
      if (manage || opts?.includeExpired) return true;
      if (r.effectiveTo && r.effectiveTo.getTime() < now) return false;
      return true;
    })
    .map(r => toDTO(r as DocRow, manage));
}

/** A single doc, tenant-checked and audience-checked. Null when not permitted. */
export async function getDocument(
  actor: Actor,
  id: string,
  personId?: string | null
): Promise<(DocumentDTO & { storagePath: string }) | null> {
  const tenant = tenantOf(actor);
  if (!tenant) return null;
  const row = await prisma.document.findFirst({
    where: { id, marketOwnerId: tenant, deletedAt: null },
    include: { acks: true },
  });
  if (!row) return null;
  if (!visibleTo(row, actor, personId)) return null;
  return {
    ...toDTO(row as DocRow, can(actor, 'docs.manage')),
    storagePath: row.storagePath,
  };
}

/**
 * Uploads the bytes and records the metadata.
 *
 * The DB row is created FIRST so the doc id can seed the storage path, then the
 * upload runs; if the upload fails the row is removed, because a library entry
 * pointing at a missing object is worse than no entry at all.
 */
export async function createDocument(
  actor: Actor,
  input: {
    title: string;
    kind: DocKind;
    bytes: Buffer;
    fileName: string;
    mimeType: string;
    audienceRoles?: string[];
    audiencePersonIds?: string[];
    requiresAck?: boolean;
    effectiveFrom?: Date | null;
    effectiveTo?: Date | null;
    supersedesId?: string | null;
  }
): Promise<DocumentDTO> {
  const tenant = tenantOf(actor);
  if (!tenant) throw new Error('No company on this session');
  if (!ALLOWED_DOC_MIME.has(input.mimeType)) throw new Error(`Unsupported file type: ${input.mimeType}`);
  if (input.bytes.byteLength > MAX_DOC_BYTES) throw new Error('File is larger than 25MB');
  if (input.bytes.byteLength === 0) throw new Error('File is empty');

  // Superseding is only allowed within the caller's own company.
  let version = 1;
  if (input.supersedesId) {
    const prev = await prisma.document.findFirst({
      where: { id: input.supersedesId, marketOwnerId: tenant },
      select: { version: true },
    });
    if (!prev) throw new Error('The document this replaces was not found');
    version = prev.version + 1;
  }

  const row = await prisma.document.create({
    data: {
      marketOwnerId: tenant,
      title: input.title,
      kind: input.kind,
      audienceRoles: (input.audienceRoles ?? []) as Role[],
      audiencePersonIds: input.audiencePersonIds ?? [],
      storagePath: '', // set below, once we know the id
      mimeType: input.mimeType,
      sizeBytes: input.bytes.byteLength,
      version,
      supersedesId: input.supersedesId ?? null,
      effectiveFrom: input.effectiveFrom ?? null,
      effectiveTo: input.effectiveTo ?? null,
      requiresAck: input.requiresAck ?? false,
      uploadedBy: actor.email || actor.userId,
    },
    include: { acks: true },
  });

  const path = storagePathFor(tenant, row.id, input.fileName);
  const { error } = await supabaseAdmin()
    .storage.from(DOC_BUCKET)
    .upload(path, input.bytes, { contentType: input.mimeType, upsert: true });

  if (error) {
    await prisma.document.delete({ where: { id: row.id } }).catch(() => {});
    throw new Error(`Upload failed: ${error.message}`);
  }

  const saved = await prisma.document.update({
    where: { id: row.id },
    data: { storagePath: path },
    include: { acks: true },
  });
  return toDTO(saved as DocRow, true);
}

/**
 * Mints a short-lived signed URL. Expiry is deliberately tiny: long enough to
 * open the file, short enough that a copied link is useless by the time it is
 * pasted anywhere.
 */
export async function signedUrlFor(
  actor: Actor,
  id: string,
  personId?: string | null,
  expiresInSeconds = 60
): Promise<string | null> {
  const doc = await getDocument(actor, id, personId);
  if (!doc) return null;
  const { data, error } = await supabaseAdmin()
    .storage.from(DOC_BUCKET)
    .createSignedUrl(doc.storagePath, expiresInSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * Soft-deletes. The row and the stored object both survive, matching the
 * recycle-bin rule that nothing in this app is unrecoverable — a compliance
 * document especially should not vanish on one click.
 */
export async function deleteDocument(actor: Actor, id: string): Promise<boolean> {
  const tenant = tenantOf(actor);
  if (!tenant) return false;
  const row = await prisma.document.findFirst({
    where: { id, marketOwnerId: tenant, deletedAt: null },
    select: { id: true },
  });
  if (!row) return false;
  await prisma.document.update({
    where: { id: row.id },
    data: { deletedAt: new Date(), deletedBy: actor.email || actor.userId },
  });
  return true;
}

/**
 * Records that a person has read a doc. Idempotent via the unique
 * (documentId, personId) constraint, so a double-tap is one acknowledgement.
 */
export async function acknowledgeDocument(
  actor: Actor,
  id: string,
  personId: string,
  personName: string
): Promise<boolean> {
  const tenant = tenantOf(actor);
  if (!tenant || !personId) return false;
  const doc = await prisma.document.findFirst({
    where: { id, marketOwnerId: tenant, deletedAt: null },
    select: { id: true },
  });
  if (!doc) return false;
  await prisma.documentAck.upsert({
    where: { documentId_personId: { documentId: doc.id, personId } },
    create: { documentId: doc.id, personId, personName },
    update: { personName },
  });
  return true;
}
