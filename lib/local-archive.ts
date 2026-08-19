'use client';

// Demo-workspace recycle bin.
//
// The server-side DataArchive table is the REAL company's recycle bin: it is
// scoped by session tenant and has no idea which localStorage bucket (demo vs
// live) the browser was showing when the archive happened. Archiving a sample
// rep while playing in Demo therefore used to land in the live bin — sample
// names sitting next to real employees in a legal-retention surface.
//
// Fix: while the workspace is in demo mode, archives go HERE instead — a plain
// `se-*` localStorage key, which the workspace shim automatically prefixes
// into the `demo:` bucket. Demo archives never touch the server, never appear
// in the live bin, and reset along with the rest of the sandbox.

import type { ArchiveKind } from '@/lib/archive';

const KEY = 'se-recycle-v1';

export interface LocalArchiveItem {
  id: string;
  kind: ArchiveKind;
  refId: string;
  label: string;
  payload: unknown;
  reason?: string;
  deletedAt: string; // ISO
}

function readAll(): LocalArchiveItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LocalArchiveItem[]) : [];
  } catch {
    return [];
  }
}

function writeAll(items: LocalArchiveItem[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* quota — demo data, acceptable to drop */
  }
}

export function localArchiveAdd(input: {
  kind: ArchiveKind;
  refId: string;
  label: string;
  payload: unknown;
  reason?: string;
}): LocalArchiveItem {
  const item: LocalArchiveItem = {
    id: `la_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...input,
    deletedAt: new Date().toISOString(),
  };
  writeAll([item, ...readAll()]);
  return item;
}

export function localArchiveList(): LocalArchiveItem[] {
  return readAll();
}

/** Remove the entry and return it so the caller can restore the payload. */
export function localArchiveTake(id: string): LocalArchiveItem | null {
  const items = readAll();
  const found = items.find((i) => i.id === id) ?? null;
  if (found) writeAll(items.filter((i) => i.id !== id));
  return found;
}

export function localArchivePurge(id: string): boolean {
  const items = readAll();
  const next = items.filter((i) => i.id !== id);
  if (next.length === items.length) return false;
  writeAll(next);
  return true;
}
