'use client';

import type { CompetitionDTO, StandingInput } from '@/lib/competitions';

// Thin fetch wrappers for the competitions API. Every call is same-origin and
// cookie-authed; the server derives the tenant from the session. These resolve
// to null (never throw) on a non-2xx so callers can degrade gracefully — a
// failed end-save must never lose the live comp.

export type { CompetitionDTO } from '@/lib/competitions';

async function readJson<T>(res: Response, key: string): Promise<T | null> {
  if (!res.ok) return null;
  try {
    const j = await res.json();
    return (j?.[key] ?? null) as T | null;
  } catch {
    return null;
  }
}

/** List competitions, optionally filtered by status. Returns [] on failure. */
export async function fetchCompetitions(status?: 'active' | 'ended' | 'archived'): Promise<CompetitionDTO[]> {
  const qs = status ? `?status=${status}` : '';
  const res = await fetch(`/api/competitions${qs}`, { credentials: 'same-origin', cache: 'no-store' });
  const items = await readJson<CompetitionDTO[]>(res, 'items');
  return items ?? [];
}

export async function createCompetitionApi(input: {
  title: string; prize: string; metric: string; store?: string | null; periodStart?: string;
}): Promise<CompetitionDTO | null> {
  const res = await fetch('/api/competitions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(input),
  });
  return readJson<CompetitionDTO>(res, 'item');
}

export async function updateCompetitionApi(id: string, patch: {
  title?: string; prize?: string; metric?: string; store?: string | null;
}): Promise<CompetitionDTO | null> {
  const res = await fetch('/api/competitions', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ id, ...patch }),
  });
  return readJson<CompetitionDTO>(res, 'item');
}

export async function endCompetitionApi(
  id: string,
  standings: StandingInput[],
  periodEnd?: string,
): Promise<CompetitionDTO | null> {
  const res = await fetch(`/api/competitions/${id}/end`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ standings, periodEnd }),
  });
  return readJson<CompetitionDTO>(res, 'item');
}
