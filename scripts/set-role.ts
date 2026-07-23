// Change an account's role.
//   npx tsx scripts/set-role.ts --email demo@fieldos.app --role ASM
//
// Role is the security boundary: only OWNER can switch to Live data or open
// Settings (see middleware.ts + components/dashboard/workspace-switcher.tsx).
// A shared/demo login must therefore never be OWNER.
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();
const ROLES: Role[] = ['OWNER', 'ASM', 'LEAD', 'REP', 'INTERN'];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg('email');
  const role = arg('role')?.toUpperCase() as Role | undefined;

  if (!email) throw new Error('Pass --email');
  if (!role || !ROLES.includes(role)) throw new Error(`Pass --role one of: ${ROLES.join(', ')}`);

  const user = await prisma.user.update({ where: { email }, data: { role } });
  console.log(`  ${user.email} -> role=${user.role}`);
}

main()
  .catch((e) => {
    console.error(`  Failed: ${e.message}`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
