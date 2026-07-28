/**
 * Integration test for the recycle-bin lifecycle at the data layer, run against
 * a throwaway tenant that is deleted at the end (cascade removes its archives
 * and tenant-data). Exercises the exact functions the API routes call, so it
 * covers scope isolation and the restore→reinsert path without a browser or a
 * live role. Run: `npx tsx scripts/test-archive-lifecycle.ts`.
 */
import { prisma } from '../lib/db';
import { recordArchive, listArchives, restoreArchive, purgeArchive, type Actor } from '../lib/archive';

let failures = 0;
function check(name: string, cond: boolean) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

async function main() {
  // Two disposable companies so we can prove cross-tenant isolation.
  const stamp = Date.now();
  const a = await prisma.marketOwner.create({ data: { name: `__test_A_${stamp}`, slug: `test-a-${stamp}`, theme: {} } });
  const b = await prisma.marketOwner.create({ data: { name: `__test_B_${stamp}`, slug: `test-b-${stamp}`, theme: {} } });

  const ownerA: Actor = { userId: 'userA', email: 'a@test.local', role: 'OWNER', marketOwnerId: a.id, isSuperAdmin: false };
  const ownerB: Actor = { userId: 'userB', email: 'b@test.local', role: 'OWNER', marketOwnerId: b.id, isSuperAdmin: false };
  const superA: Actor = { userId: 'root', email: 'root@test.local', role: 'OWNER', marketOwnerId: a.id, isSuperAdmin: true };

  try {
    // Seed A's roster with one person, then archive them.
    const person = { id: 'p_test_1', name: 'Test Rep', employeeCode: 'TST-0001', status: 'active', role: 'REP', stores: [], team: '', weeklyProfit: [], attendance: 100 };
    await prisma.tenantData.create({ data: { marketOwnerId: a.id, key: 'se-people-v1', value: [person] } });

    const rec = await recordArchive(ownerA, { kind: 'PERSON', refId: person.id, label: 'Test Rep (TST-0001)', payload: person });
    check('recordArchive returns an item', !!rec?.id);

    // A sees it; B must not.
    const listA = await listArchives(ownerA, {});
    const listB = await listArchives(ownerB, {});
    check('owner A sees 1 archived item', listA.length === 1);
    check('owner B sees none of A\'s items (tenant isolation)', listB.length === 0);

    // B cannot restore A's item.
    const crossRestore = await restoreArchive(ownerB, rec!.id);
    check('owner B cannot restore A\'s item', crossRestore === null);

    // Simulate the roster having lost the person (as the UI does on archive).
    await prisma.tenantData.update({ where: { marketOwnerId_key: { marketOwnerId: a.id, key: 'se-people-v1' } }, data: { value: [] } });

    // A restores → the person must reappear in tenant-data, de-duped.
    const restored = await restoreArchive(ownerA, rec!.id);
    check('owner A restore succeeds', !!restored?.restoredAt);
    const roster = await prisma.tenantData.findUnique({ where: { marketOwnerId_key: { marketOwnerId: a.id, key: 'se-people-v1' } } });
    const list = Array.isArray(roster?.value) ? roster!.value as Array<{ id: string }> : [];
    check('restore re-inserts the person into the roster', list.length === 1 && list[0].id === person.id);

    // Double-restore is a no-op (already restored) and must not duplicate.
    const second = await restoreArchive(ownerA, rec!.id);
    check('second restore is rejected (already restored)', second === null);

    // Purge: only super may, and it is permanent.
    const ownerPurge = await purgeArchive(ownerA, rec!.id, 'test');
    check('owner A cannot purge (super-only)', ownerPurge === false);
    const superPurge = await purgeArchive(superA, rec!.id, 'test cleanup');
    check('super can purge', superPurge === true);
    const purgedRow = await prisma.dataArchive.findUnique({ where: { id: rec!.id } });
    check('purge sets purgedAt and scrubs payload', !!purgedRow?.purgedAt && JSON.stringify(purgedRow?.payload) === JSON.stringify({ purged: true }));
  } finally {
    await prisma.marketOwner.delete({ where: { id: a.id } });
    await prisma.marketOwner.delete({ where: { id: b.id } });
    await prisma.$disconnect();
  }

  console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
