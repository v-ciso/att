// Add an extra login to an EXISTING customer's company.
//
//   npx tsx scripts/add-user.ts --email person@theirco.com --company "Their Co" --role VIEWER
//
// Roles that matter commercially:
//   OWNER    full edit + branding + campaign (one per company; created by admin:create)
//   MANAGER  edit access to the company's data, no branding or billing
//   VIEWER   read-only — sees every screen, changes nothing
//
// Enforces the seat allowance the tenant was sold. Selling "up to 5 logins"
// and then not counting them is how a $494 account quietly becomes a $766 one.

import { prisma } from '../lib/db';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import type { Role } from '@prisma/client';
import { sendSeatInvite } from '../lib/email';

const ASSIGNABLE: Role[] = ['MANAGER', 'VIEWER', 'ASM', 'LEAD', 'REP', 'INTERN'];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function slugify(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
}

async function main() {
  const email = arg('email');
  const company = arg('company');
  const role = (arg('role') ?? 'VIEWER').toUpperCase() as Role;
  const name = arg('name') ?? email?.split('@')[0] ?? 'User';

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Pass a valid --email');
  if (!company) throw new Error('Pass --company "Their Co" so the user lands in the right tenant');
  if (!ASSIGNABLE.includes(role)) {
    throw new Error(`--role must be one of: ${ASSIGNABLE.join(', ')} (OWNER is set by admin:create)`);
  }

  const owner = await prisma.marketOwner.findUnique({ where: { slug: slugify(company) } });
  if (!owner) throw new Error(`No tenant named "${company}". Run admin:create for them first.`);

  const theme = (owner.theme ?? {}) as { seats?: number };
  const seats = typeof theme.seats === 'number' ? theme.seats : 1;
  const existing = await prisma.user.count({ where: { marketOwnerId: owner.id } });
  const alreadyThisUser = await prisma.user.findUnique({ where: { email } });
  const wouldBeNew = !alreadyThisUser || alreadyThisUser.marketOwnerId !== owner.id;

  if (wouldBeNew && existing >= seats) {
    throw new Error(
      `${owner.name} is on a ${seats}-seat plan and already has ${existing} user(s). ` +
      `Upgrade them first: npm run admin:create -- --email <their owner> --company "${company}" --tier team`
    );
  }

  const password = process.env.USER_PASSWORD ?? randomBytes(16).toString('hex');
  const generated = !process.env.USER_PASSWORD;
  if (password.length < 12) throw new Error('USER_PASSWORD must be at least 12 characters.');

  const user = await prisma.user.upsert({
    where: { email },
    update: { role, marketOwnerId: owner.id, passwordHash: await bcrypt.hash(password, 12) },
    create: {
      email,
      name,
      role,
      passwordHash: await bcrypt.hash(password, 12),
      employeeId: `${role}-${Date.now().toString(36).toUpperCase()}`,
      marketOwnerId: owner.id,
    },
  });

  const used = await prisma.user.count({ where: { marketOwnerId: owner.id } });
  console.log(`\n  Tenant    ${owner.name}`);
  console.log(`  User      ${user.email}  role=${user.role}`);
  console.log(`  Seats     ${used} / ${seats} used`);
  if (process.argv.includes('--email-them')) {
    const r = await sendSeatInvite({ to: email, company: owner.name, tempPassword: password, role });
    console.log(r.sent ? `  Emailed   invite sent to ${email}` : `  Email     NOT sent: ${r.reason}`);
  }
  if (generated) {
    console.log(`  Password  ${password}`);
    console.log('\n  ^ shown once. Send it to them and have them change it in Settings > Account.\n');
  } else {
    console.log('  Password  set from USER_PASSWORD.\n');
  }
}

main()
  .catch(e => { console.error(`\n  Failed: ${e.message}\n`); process.exit(1); })
  .finally(() => prisma.$disconnect());
