// Read-only sanity check on the accounts the login page will authenticate
// against. Prints no secrets. Run: npx tsx scripts/check-admin.ts
import { prisma } from '../lib/db';

async function main() {
  const users = await prisma.user.findMany({
    select: { email: true, role: true, passwordHash: true, marketOwner: { select: { name: true, slug: true } } },
    orderBy: { createdAt: 'asc' },
  });

  if (users.length === 0) {
    console.log('  No accounts yet. Run: npm run admin:create -- --email you@company.com --company "Your Co"');
    return;
  }

  for (const u of users) {
    // $2a/$2b = bcrypt; the cost factor is the number between the 2nd and 3rd $.
    const cost = /^\$2[aby]\$(\d\d)\$/.exec(u.passwordHash)?.[1] ?? '??';
    console.log(
      `  ${u.email.padEnd(30)} role=${String(u.role).padEnd(6)} ` +
      `tenant=${u.marketOwner?.slug ?? '(none)'} bcrypt=cost-${cost}`
    );
  }
  console.log(`\n  ${users.length} account(s). Only role=OWNER can switch to Live data.\n`);
}

main().finally(() => prisma.$disconnect());
