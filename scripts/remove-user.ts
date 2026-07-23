// Remove a login when someone leaves the company.
//   npx tsx scripts/remove-user.ts --email person@theirco.com --confirm
//
// Their SALES HISTORY is untouched — it belongs to the company, not the login.
// Only the ability to sign in goes away, which frees a seat.
import { prisma } from '../lib/db';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg('email');
  if (!email) throw new Error('Pass --email person@theirco.com');

  const user = await prisma.user.findUnique({
    where: { email },
    include: { marketOwner: { select: { name: true, id: true } } },
  });
  if (!user) throw new Error(`No user with email "${email}"`);

  if (user.role === 'OWNER') {
    throw new Error(
      `${email} is the OWNER of ${user.marketOwner?.name}. Transfer ownership first ` +
      `(set another user to OWNER), or delete the whole tenant with delete-tenant.ts.`
    );
  }

  console.log(`\n  User    ${user.email}  role=${user.role}`);
  console.log(`  Tenant  ${user.marketOwner?.name ?? '(none)'}`);

  if (!process.argv.includes('--confirm')) {
    console.log('\n  Dry run. Re-run with --confirm to remove this login.\n');
    return;
  }

  // Attendance and Commission rows are keyed to the user, so they go with the
  // login. Leaderboard entries are keyed to the TENANT and survive — the
  // company keeps the production history of someone who has left.
  await prisma.$transaction([
    prisma.attendance.deleteMany({ where: { userId: user.id } }),
    prisma.commission.deleteMany({ where: { userId: user.id } }),
    prisma.leaderboardEntry.updateMany({ where: { userId: user.id }, data: { userId: null } }),
    prisma.goal.deleteMany({ where: { userId: user.id } }),
    prisma.user.delete({ where: { id: user.id } }),
  ]);

  const left = user.marketOwnerId
    ? await prisma.user.count({ where: { marketOwnerId: user.marketOwnerId } })
    : 0;
  console.log(`\n  Removed ${email}. ${left} login(s) remain on ${user.marketOwner?.name}.`);
  console.log('  Their logged production stays on the company leaderboard.\n');
}

main()
  .catch(e => { console.error(`\n  Failed: ${e.message}\n`); process.exit(1); })
  .finally(() => prisma.$disconnect());
