import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { currentActor } from '@/lib/archive';
import { can } from '@/lib/permissions';
import { endCompetition, COMP_METRICS } from '@/lib/competitions';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

const standingSchema = z.object({
  personId: z.string().min(1),
  personName: z.string().min(1).max(120),
  store: z.string().max(120).nullish(),
  rank: z.number().int().min(1),
  value: z.number(),
  metric: z.enum(COMP_METRICS),
});

const endSchema = z.object({
  standings: z.array(standingSchema).max(1000),
  periodEnd: z.string().datetime().optional(),
});

// "End & save": freeze the full numeric standings and flip status to 'ended'.
// The comp is never deleted — this is the durable historical record.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  if (!can(actor, 'competition.manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
  }
  const body = await req.json().catch(() => null);
  const parsed = endSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid standings', details: parsed.error.flatten() }, { status: 400, headers: NO_STORE });
  }
  const item = await endCompetition(actor, id, parsed.data.standings, parsed.data.periodEnd);
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE });
  return NextResponse.json({ item }, { headers: NO_STORE });
}
