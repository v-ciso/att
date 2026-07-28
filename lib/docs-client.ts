// Browser-side helpers for the document library. Every function fails soft —
// returning null/[]/false rather than throwing — so a dropped connection or a
// 403 degrades the Library view instead of blanking the dashboard.

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
  acks?: Array<{ personId: string; personName: string; ackedAt: string }>;
  ackCount: number;
}

async function readJson<T>(res: Response, key: string): Promise<T | null> {
  if (!res.ok) return null;
  try {
    const body = await res.json();
    return (body?.[key] ?? null) as T | null;
  } catch {
    return null;
  }
}

export async function fetchDocuments(opts?: { kind?: string; personId?: string | null }): Promise<DocumentDTO[]> {
  const qs = new URLSearchParams();
  if (opts?.kind) qs.set('kind', opts.kind);
  if (opts?.personId) qs.set('personId', opts.personId);
  const res = await fetch(`/api/docs${qs.toString() ? `?${qs}` : ''}`, {
    credentials: 'same-origin',
    cache: 'no-store',
  });
  return (await readJson<DocumentDTO[]>(res, 'items')) ?? [];
}

/**
 * Uploads a file. Returns the created doc, or an { error } so the caller can
 * show the server's actual reason (wrong type, too big) instead of a generic
 * failure.
 */
export async function uploadDocument(input: {
  file: File;
  title: string;
  kind: string;
  audienceRoles?: string[];
  audiencePersonIds?: string[];
  requiresAck?: boolean;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  supersedesId?: string | null;
}): Promise<{ doc?: DocumentDTO; error?: string }> {
  const form = new FormData();
  form.set('file', input.file);
  form.set('title', input.title);
  form.set('kind', input.kind);
  form.set('audienceRoles', JSON.stringify(input.audienceRoles ?? []));
  form.set('audiencePersonIds', JSON.stringify(input.audiencePersonIds ?? []));
  form.set('requiresAck', String(!!input.requiresAck));
  if (input.effectiveFrom) form.set('effectiveFrom', input.effectiveFrom);
  if (input.effectiveTo) form.set('effectiveTo', input.effectiveTo);
  if (input.supersedesId) form.set('supersedesId', input.supersedesId);

  try {
    const res = await fetch('/api/docs', { method: 'POST', credentials: 'same-origin', body: form });
    const body = await res.json().catch(() => null);
    if (!res.ok) return { error: body?.error ?? `Upload failed (${res.status})` };
    return { doc: body?.doc as DocumentDTO };
  } catch {
    return { error: 'Upload failed — check your connection and try again.' };
  }
}

/**
 * Same-origin URL for a document's bytes.
 *
 * Deliberately NOT a storage signed URL: the browser fetching a third-party
 * host is the first thing to break on a corporate VPN or locked-down carrier
 * network, which is where these documents actually get opened. The route
 * re-checks audience on every read, so this is safe to build synchronously.
 */
export function documentFileUrl(
  id: string,
  opts?: { personId?: string | null; download?: boolean }
): string {
  const qs = new URLSearchParams();
  if (opts?.personId) qs.set('personId', opts.personId);
  if (opts?.download) qs.set('download', '1');
  const suffix = qs.toString() ? `?${qs}` : '';
  return `/api/docs/${encodeURIComponent(id)}/file${suffix}`;
}

export async function deleteDocumentApi(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/docs/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function acknowledgeDocumentApi(
  id: string,
  personId: string,
  personName: string
): Promise<boolean> {
  try {
    const res = await fetch(`/api/docs/${encodeURIComponent(id)}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personId, personName }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Human-readable file size for the library list. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
