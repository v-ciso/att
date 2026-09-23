import { prisma } from '@/lib/db';
import type { Actor } from '@/lib/archive';

// First-class competition history, scoped per company. Live comps stay a
// client-side derived view over sales; only ENDED comps are frozen here, so the
// historical record (winner, prize, numeric standings, the period it actually
// ran) survives a resync or a rename. The tenant is ALWAYS the session's
// marketOwnerId — never the request body — matching /api/tenant-data. A
// super-admin may read across companies (for the /admin recovery view) but the
// normal path is strictly own-company.

export const COMP_METRICS = ['lines', 'premium', 'internet', 'nextUps', 'revenue'] as const;
export type CompMetric = (typeof COMP_METRICS)[number];
export const COMP_STATUSES = ['active', 'ended', 'archived'] as const;
export type CompStatus = (typeof COMP_STATUSES)[number];

export interface StandingInput {
  personId: string;
  personName: string;
  store?: string | null;
  rank: number;
  value: number;
  metric: string;
}

export interface CompetitionDTO {
  id: string;
  title: string;
  prize: string;
  metric: string;
  store: string | null;
  periodStart: string;
  periodEnd: string | null;
  status: string;
  createdBy: string;
  endedAt: string | null;
  endedBy: string | null;
  createdAt: string;
  standings: Array<{
    personId: string; personName: string; store: string | null;
    rank: number; value: number; metric: string;
  }>;
}

function toDTO(row: {
  id: string; title: string; prize: string; metric: string; store: string | null;
  periodStart: Date; periodEnd: Date | null; status: string; createdBy: string;
  endedAt: Date | null; endedBy: string | null; createdAt: Date;
  standings?: Array<{ personId: string; personName: string; store: string | null; rank: number; value: number; metric: string }>;
}): CompetitionDTO {
  return {
    id: row.id,
    title: row.title,
    prize: row.prize,
    metric: row.metric,
    store: row.store,
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd ? row.periodEnd.toISOString() : null,
    status: row.status,
    createdBy: row.createdBy,
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    endedBy: row.endedBy ?? null,
    createdAt: row.createdAt.toISOString(),
    standings: (row.standings ?? [])
      .slice()
      .sort((a, b) => a.rank - b.rank)
      .map(s => ({ personId: s.personId, personName: s.personName, store: s.store, rank: s.rank, value: s.value, metric: s.metric })),
  };
}

/** The company an actor may operate on, or null if they have none. */
function scopeOf(actor: Actor): string | null {
  return actor.marketOwnerId;
}

/**
 * List competitions for the actor's company. Optional status filter. Standings
 * are included so the history view can show winners without an N+1 fetch.
 */
export async function listCompetitions(actor: Actor, status?: CompStatus): Promise<CompetitionDTO[]> {
  const marketOwnerId = scopeOf(actor);
  if (!marketOwnerId) return [];
  const rows = await prisma.competition.findMany({
    where: { marketOwnerId, ...(status ? { status } : {}) },
    include: { standings: true },
    orderBy: [{ endedAt: 'desc' }, { createdAt: 'desc' }],
  });
  return rows.map(toDTO);
}

export interface CreateCompetitionInput {
  title: string;
  prize: string;
  metric: string;
  store?: string | null;
  periodStart?: string; // ISO; defaults to now
}

/** Create a new (active) competition in the actor's company. */
export async function createCompetition(actor: Actor, input: CreateCompetitionInput): Promise<CompetitionDTO | null> {
  const marketOwnerId = scopeOf(actor);
  if (!marketOwnerId) return null;
  const row = await prisma.competition.create({
    data: {
      marketOwnerId,
      title: input.title,
      prize: input.prize,
      metric: input.metric,
      store: input.store ?? null,
      periodStart: input.periodStart ? new Date(input.periodStart) : new Date(),
      status: 'active',
      createdBy: actor.userId,
    },
    include: { standings: true },
  });
  return toDTO(row);
}

/** Patch editable fields. Scope-checked: only the owning company (or super). */
export async function updateCompetition(
  actor: Actor,
  id: string,
  patch: Partial<Pick<CreateCompetitionInput, 'title' | 'prize' | 'metric' | 'store'>>,
): Promise<CompetitionDTO | null> {
  const row = await prisma.competition.findUnique({ where: { id } });
  if (!row) return null;
  if (!actor.isSuperAdmin && row.marketOwnerId !== actor.marketOwnerId) return null;
  const updated = await prisma.competition.update({
    where: { id },
    data: {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.prize !== undefined ? { prize: patch.prize } : {}),
      ...(patch.metric !== undefined ? { metric: patch.metric } : {}),
      ...(patch.store !== undefined ? { store: patch.store } : {}),
    },
    include: { standings: true },
  });
  return toDTO(updated);
}

/**
 * End a competition: freeze the FULL numeric standings for the scope (not just
 * the top 3) and flip status to 'ended'. Idempotent-ish: re-ending replaces the
 * frozen standings so a correction is possible before archiving. Never deletes.
 */
export async function endCompetition(
  actor: Actor,
  id: string,
  standings: StandingInput[],
  periodEnd?: string,
): Promise<CompetitionDTO | null> {
  const row = await prisma.competition.findUnique({ where: { id } });
  if (!row) return null;
  if (!actor.isSuperAdmin && row.marketOwnerId !== actor.marketOwnerId) return null;

  const updated = await prisma.$transaction(async (tx) => {
    // Replace any prior frozen standings, then write the fresh snapshot.
    await tx.competitionStanding.deleteMany({ where: { competitionId: id } });
    if (standings.length) {
      await tx.competitionStanding.createMany({
        data: standings.map(s => ({
          competitionId: id,
          personId: s.personId,
          personName: s.personName,
          store: s.store ?? null,
          rank: s.rank,
          value: s.value,
          metric: s.metric,
        })),
      });
    }
    return tx.competition.update({
      where: { id },
      data: {
        status: 'ended',
        endedAt: new Date(),
        endedBy: actor.userId,
        periodEnd: periodEnd ? new Date(periodEnd) : new Date(),
      },
      include: { standings: true },
    });
  });
  return toDTO(updated);
}

/**
 * A per-person "competitions won" tally (rank 1 in an ended comp), feeding the
 * rep lifetime profile in Phase 5. Keyed by personId; personName is the latest
 * snapshot seen. Scoped to the actor's company.
 */
export async function competitionsWonByPerson(actor: Actor): Promise<Record<string, { personName: string; wins: number }>> {
  const marketOwnerId = scopeOf(actor);
  if (!marketOwnerId) return {};
  const winners = await prisma.competitionStanding.findMany({
    where: { rank: 1, competition: { marketOwnerId, status: 'ended' } },
    select: { personId: true, personName: true },
  });
  const out: Record<string, { personName: string; wins: number }> = {};
  for (const w of winners) {
    const cur = out[w.personId] ?? { personName: w.personName, wins: 0 };
    cur.wins += 1;
    cur.personName = w.personName;
    out[w.personId] = cur;
  }
  return out;
}
