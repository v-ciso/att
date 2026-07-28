import { prisma } from '../lib/db';

async function main() {
  const users = await prisma.user.findMany({
    where: { marketOwner: { name: 'Demo Market' } },
    select: { email: true, role: true, disabled: true },
    orderBy: { role: 'asc' },
  });
  console.log('DEMO MARKET USERS', JSON.stringify(users, null, 2));
  const owners = await prisma.user.findMany({
    where: { role: 'OWNER' },
    select: { email: true, marketOwner: { select: { name: true } } },
    take: 10,
  });
  console.log('OWNERS', JSON.stringify(owners, null, 2));

  const archives = await prisma.dataArchive.findMany({
    select: { kind: true, label: true, restoredAt: true, purgedAt: true, marketOwnerId: true, deletedBy: true },
    orderBy: { deletedAt: 'desc' },
    take: 10,
  });
  console.log('ARCHIVES', JSON.stringify(archives, null, 2));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
