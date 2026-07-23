// Creates (or updates) the OWNER account for a tenant.
//
//   npm run admin:create -- --email you@company.com --company "Sorami"
//
// Password comes from ADMIN_PASSWORD if set; otherwise a strong one is
// generated and printed ONCE. It is never written to a file.
// Re-running with the same email resets that account's password.

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
}

async function main() {
  const email = arg('email');
  const company = arg('company') ?? 'Sales Engine';
  const name = arg('name') ?? 'Owner';

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error('Pass a valid --email, e.g. --email you@company.com');
  }

  // A generated password is 32 hex chars; bcrypt silently truncates past 72
  // bytes, so anything supplied longer than that is rejected rather than
  // becoming a shorter password than the operator thinks it is.
  const password = process.env.ADMIN_PASSWORD ?? randomBytes(16).toString('hex');
  const generated = !process.env.ADMIN_PASSWORD;
  if (Buffer.byteLength(password) > 72) throw new Error('ADMIN_PASSWORD must be 72 bytes or fewer.');
  if (password.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters.');

  const slug = slugify(company) || 'sales-engine';
  const passwordHash = await bcrypt.hash(password, 12);

  const owner =
    (await prisma.marketOwner.findUnique({ where: { slug } })) ??
    (await prisma.marketOwner.create({
      data: {
        name: company,
        slug,
        subscriptionTier: 'WHITE_LABEL',
        theme: {
          companyName: company,
          primaryColor: '#E7C24A',
          secondaryColor: '#B8860B',
          preset: 'obsidian-gold',
          featureFlags: {
            hidePnL: false,
            hideCommissionEngine: false,
            hideTeamManagement: false,
            hideGoalsAttendance: false,
          },
        },
      },
    }));

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: 'OWNER', marketOwnerId: owner.id },
    create: {
      email,
      passwordHash,
      name,
      role: 'OWNER',
      employeeId: `OWNER-${Date.now().toString(36).toUpperCase()}`,
      marketOwnerId: owner.id,
    },
  });

  console.log(`\n  Tenant   ${owner.name}  (slug: ${owner.slug})`);
  console.log(`  Admin    ${user.email}  role=OWNER`);
  if (generated) {
    console.log(`  Password ${password}`);
    console.log('\n  ^ shown once. Save it in a password manager now.\n');
  } else {
    console.log('  Password set from ADMIN_PASSWORD.\n');
  }
}

main()
  .catch((e) => {
    console.error(`\n  Failed: ${e.message}\n`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
