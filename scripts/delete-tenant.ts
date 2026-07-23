// Remove a tenant and everything belonging to it.
//   npx tsx scripts/delete-tenant.ts --company "Acme Test Co" --confirm
//
// Refuses to run without --confirm. Prints exactly what it will remove first,
// because there is no undo and the rows are a customer's whole book.
import { prisma } from '../lib/db';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}
const slugify = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);

async function main() {
  const company = arg('company');
  if (!company) throw new Error('Pass --company "Their Co"');
  const slug = slugify(company);

  const owner = await prisma.marketOwner.findUnique({
    where: { slug },
    include: { users: true, teams: true },
  });
  if (!owner) throw new Error(`No tenant with slug "${slug}"`);

  console.log(`\n  Tenant  ${owner.name} (${slug})`);
  console.log(`  Users   ${owner.users.length}: ${owner.users.map(u => u.email).join(', ') || '(none)'}`);
  console.log(`  Teams   ${owner.teams.length}`);

  if (!process.argv.includes('--confirm')) {
    console.log('\n  Dry run. Re-run with --confirm to delete permanently.\n');
    return;
  }

  // Children first — every table points at MarketOwner, and some at User.
  const id = owner.id;
  await prisma.$transaction([
    prisma.attendance.deleteMany({ where: { user: { marketOwnerId: id } } }),
    prisma.commission.deleteMany({ where: { user: { marketOwnerId: id } } }),
    prisma.leaderboardEntry.deleteMany({ where: { marketOwnerId: id } }),
    prisma.goal.deleteMany({ where: { marketOwnerId: id } }),
    prisma.expense.deleteMany({ where: { marketOwnerId: id } }),
    prisma.roadtrip.deleteMany({ where: { marketOwnerId: id } }),
    prisma.commissionRule.deleteMany({ where: { marketOwnerId: id } }),
    prisma.user.updateMany({ where: { marketOwnerId: id }, data: { teamId: null } }),
    prisma.team.deleteMany({ where: { marketOwnerId: id } }),
    prisma.user.deleteMany({ where: { marketOwnerId: id } }),
    prisma.marketOwner.delete({ where: { id } }),
  ]);
  console.log(`\n  Deleted ${owner.name} and all of its records.\n`);
}

main()
  .catch(e => { console.error(`\n  Failed: ${e.message}\n`); process.exit(1); })
  .finally(() => prisma.$disconnect());
