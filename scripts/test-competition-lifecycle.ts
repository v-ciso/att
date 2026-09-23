import { prisma } from '@/lib/db';
import type { Actor } from '@/lib/archive';
import {
  listCompetitions, createCompetition, updateCompetition, endCompetition,
  competitionsWonByPerson,
} from '@/lib/competitions';

// Integration test for the per-company competition tables. Uses two throwaway
// tenants to prove tenant isolation, the end-and-freeze snapshot, and the
// wins-by-person tally that feeds the rep profile. Cleans up after itself.

let pass = 0, fail = 0;
function check(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`  FAIL ${name}`); }
}

async function main() {
  const stamp = Date.now();
  const a = await prisma.marketOwner.create({ data: { name: `__comp_A_${stamp}`, slug: `comp-a-${stamp}`, theme: {} } });
  const b = await prisma.marketOwner.create({ data: { name: `__comp_B_${stamp}`, slug: `comp-b-${stamp}`, theme: {} } });
  const ownerA: Actor = { userId: 'ua', email: 'a@t.local', role: 'OWNER', marketOwnerId: a.id, isSuperAdmin: false };
  const ownerB: Actor = { userId: 'ub', email: 'b@t.local', role: 'OWNER', marketOwnerId: b.id, isSuperAdmin: false };

  try {
    const comp = await createCompetition(ownerA, { title: 'Line King', prize: '$250', metric: 'lines', store: null });
    check('create returns an active comp', !!comp && comp.status === 'active');

    // Tenant isolation on read.
    check('owner B does not see owner A comps', (await listCompetitions(ownerB)).length === 0);
    check('owner A sees exactly one comp', (await listCompetitions(ownerA)).length === 1);

    // Cross-tenant edit denial.
    const crossEdit = await updateCompetition(ownerB, comp!.id, { title: 'Hijacked' });
    check('owner B cannot edit owner A comp', crossEdit === null);
    const okEdit = await updateCompetition(ownerA, comp!.id, { prize: '$500' });
    check('owner A can edit own comp', okEdit?.prize === '$500');

    // End & freeze full numeric standings.
    const ended = await endCompetition(ownerA, comp!.id, [
      { personId: 'emp-1', personName: 'Andre', store: 'North', rank: 1, value: 42, metric: 'lines' },
      { personId: 'emp-2', personName: 'Bea', store: 'North', rank: 2, value: 30, metric: 'lines' },
      { personId: 'emp-3', personName: 'Cy', store: 'South', rank: 3, value: 11, metric: 'lines' },
    ]);
    check('end flips status to ended', ended?.status === 'ended');
    check('end freezes all standings numerically', ended?.standings.length === 3 && ended?.standings[0].value === 42);
    check('end sets endedAt', !!ended?.endedAt);

    // Ended filter + isolation.
    const endedList = await listCompetitions(ownerA, 'ended');
    check('ended filter returns the frozen comp', endedList.length === 1 && endedList[0].standings.length === 3);

    // Re-ending replaces standings (correction path), never duplicates.
    const reEnded = await endCompetition(ownerA, comp!.id, [
      { personId: 'emp-1', personName: 'Andre', store: 'North', rank: 1, value: 50, metric: 'lines' },
    ]);
    check('re-end replaces standings (no dupes)', reEnded?.standings.length === 1 && reEnded?.standings[0].value === 50);

    // Wins-by-person tally feeds the rep profile.
    const wins = await competitionsWonByPerson(ownerA);
    check('wins tally credits the rank-1 person', wins['emp-1']?.wins === 1 && wins['emp-1']?.personName === 'Andre');
    check('wins tally excludes non-winners', !wins['emp-2']);
  } finally {
    await prisma.competition.deleteMany({ where: { marketOwnerId: { in: [a.id, b.id] } } });
    await prisma.marketOwner.deleteMany({ where: { id: { in: [a.id, b.id] } } });
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  if (fail) process.exit(1);
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
