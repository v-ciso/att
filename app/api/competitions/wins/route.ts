import { NextResponse } from 'next/server';
import { currentActor } from '@/lib/archive';
import { can } from '@/lib/permissions';
import { competitionsWonByPerson } from '@/lib/competitions';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

// First-place finishes across every ended competition, keyed by personId. The
// rep profile reads this so a "3 comps won" badge stays true to the frozen
// standings instead of being tallied into the roster row and drifting.
export async function GET() {
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  if (!can(actor, 'competition.view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: NO_STORE });
  }
  const wins = await competitionsWonByPerson(actor);
  return NextResponse.json({ wins }, { headers: NO_STORE });
}
