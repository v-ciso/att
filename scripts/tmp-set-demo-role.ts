// TEMPORARY verification helper: flips the demo seat's role so the Owner/Manager
// side of the document library (upload, delete, ack counts) can be exercised in
// a real browser. Delete this file once Phase 6 is signed off.
//
//   npx tsx scripts/tmp-set-demo-role.ts MANAGER
//   npx tsx scripts/tmp-set-demo-role.ts ASM      <- restores the original
import { prisma } from '@/lib/db';

async function main() {
  const role = (process.argv[2] ?? '').toUpperCase();
  const allowed = ['OWNER', 'MANAGER', 'VIEWER', 'ASM', 'LEAD', 'REP', 'INTERN'];
  if (!allowed.includes(role)) {
    console.error(`Pass one of: ${allowed.join(', ')}`);
    process.exit(1);
  }

  const user = await prisma.user.findFirst({
    where: { email: 'demo@fieldos.app' },
    select: { id: true, role: true, name: true },
  });
  if (!user) {
    console.error('demo@fieldos.app not found');
    process.exit(1);
  }

  console.log(`before: ${user.name} = ${user.role}`);
  await prisma.user.update({ where: { id: user.id }, data: { role: role as never } });
  const after = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  console.log(`after : ${user.name} = ${after?.role}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
