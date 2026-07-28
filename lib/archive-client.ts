'use client';

import type { ArchiveItem, ArchiveKind } from '@/lib/archive';

// Thin browser wrapper over /api/archive. Keeps the fetch shape in one place so
// the roster, competitions, and recovery portal all speak to the recycle bin
// the same way. Every call is same-origin and credentialed by the session
// cookie; the server re-checks scope and capability.

export type { ArchiveItem, ArchiveKind };

export async function archiveEntity(input: {
  kind: ArchiveKind;
  refId: string;
  label: string;
  payload: unknown;
  reason?: string;
}): Promise<ArchiveItem | null> {
  try {
    const res = await fetch('/api/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    const { item } = await res.json();
    return item as ArchiveItem;
  } catch {
    return null;
  }
}

export async function fetchArchives(opts?: {
  kind?: ArchiveKind;
  marketOwnerId?: string;
}): Promise<ArchiveItem[]> {
  const qs = new URLSearchParams();
  if (opts?.kind) qs.set('kind', opts.kind);
  if (opts?.marketOwnerId) qs.set('marketOwnerId', opts.marketOwnerId);
  const res = await fetch(`/api/archive${qs.toString() ? `?${qs}` : ''}`);
  if (!res.ok) return [];
  const { items } = await res.json();
  return items as ArchiveItem[];
}

export async function restoreEntity(id: string): Promise<ArchiveItem | null> {
  const res = await fetch(`/api/archive/${id}/restore`, { method: 'POST' });
  if (!res.ok) return null;
  const { item } = await res.json();
  return item as ArchiveItem;
}

export async function purgeEntity(id: string, reason: string, confirmCompany: string): Promise<boolean> {
  const res = await fetch(`/api/archive/${id}/purge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, confirmCompany }),
  });
  return res.ok;
}
