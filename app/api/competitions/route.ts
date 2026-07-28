import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { currentActor } from '@/lib/archive';
import { can } from '@/lib/permissions';
import {
  listCompetitions, createCompetition, updateCompetition,
  COMP_METRICS, COMP_STATUSES, type CompStatus,
} from '@/lib/competitions';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

// Live competitions are configured client-side; these tables hold the durable
// record, especially ended comps. Reads require competition.view; writes require
// competition.manage (MANAGER+OWNER), matching the role matrix.

export async function GET(req: NextRequest) {
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  if (!can(actor, 'competition.view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
  }
  const statusParam = req.nextUrl.searchParams.get('status');
  const status = COMP_STATUSES.includes(statusParam as CompStatus) ? (statusParam as CompStatus) : undefined;
  const items = await listCompetitions(actor, status);
  return NextResponse.json({ items }, { headers: NO_STORE });
}

const createSchema = z.object({
  title: z.string().min(1).max(120),
  prize: z.string().max(200).default(''),
  metric: z.enum(COMP_METRICS),
  store: z.string().max(120).nullish(),
  periodStart: z.string().datetime().optional(),
});

export async function POST(req: NextRequest) {
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  if (!can(actor, 'competition.manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
  }
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid competition', details: parsed.error.flatten() }, { status: 400, headers: NO_STORE });
  }
  const item = await createCompetition(actor, parsed.data);
  if (!item) return NextResponse.json({ error: 'No company scope' }, { status: 400, headers: NO_STORE });
  return NextResponse.json({ item }, { status: 201, headers: NO_STORE });
}

const patchSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(120).optional(),
  prize: z.string().max(200).optional(),
  metric: z.enum(COMP_METRICS).optional(),
  store: z.string().max(120).nullish(),
});

export async function PATCH(req: NextRequest) {
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  if (!can(actor, 'competition.manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
  }
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid patch', details: parsed.error.flatten() }, { status: 400, headers: NO_STORE });
  }
  const { id, ...patch } = parsed.data;
  const item = await updateCompetition(actor, id, patch);
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE });
  return NextResponse.json({ item }, { headers: NO_STORE });
}
