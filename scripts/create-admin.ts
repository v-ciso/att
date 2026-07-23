// Provision a customer: their tenant, their branding, and their OWNER login.
//
//   npm run admin:create -- --email owner@theirco.com --company "Their Co" \
//     --campaign b2b --logo ./their-logo.png --tier team
//
// Flags (all optional except --email):
//   --company   display name; also derives the tenant slug
//   --name      the person's name on the account          (default "Owner")
//   --campaign  retail | b2b   — decides the PAY MODEL     (default retail)
//   --tier      single | team  — seat allowance            (default single)
//   --logo      path to a PNG/JPG/SVG under 512KB, embedded as a data URL
//   --theme     obsidian-gold | command-blue | emerald     (default gold)
//
// Password comes from ADMIN_PASSWORD if set; otherwise a strong one is
// generated and printed ONCE. It is never written to a file.
// Re-running with the same email resets that account's password.
//
// This is deliberately a terminal command on the vendor's machine. None of it
// is reachable from the customer's live site — they cannot change their own
// campaign, tier, or seat count, because those are commercial terms.

import { prisma } from '../lib/db';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { readFileSync, statSync } from 'fs';
import { extname } from 'path';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
}

const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp',
};

// Logos ride along in the tenant's theme JSON, so they must stay small — the
// row is read on every page load.
function readLogo(path: string): string {
  const ext = extname(path).toLowerCase();
  const mime = MIME[ext];
  if (!mime) throw new Error(`Unsupported logo type "${ext}". Use png, jpg, svg, or webp.`);
  const bytes = statSync(path).size;
  if (bytes > 512 * 1024) throw new Error(`Logo is ${Math.round(bytes / 1024)}KB — keep it under 512KB.`);
  return `data:${mime};base64,${readFileSync(path).toString('base64')}`;
}

const THEMES: Record<string, { primary: string; secondary: string }> = {
  'obsidian-gold': { primary: '#E7C24A', secondary: '#B8860B' },
  'command-blue': { primary: '#3B82F6', secondary: '#1D4ED8' },
  'emerald': { primary: '#10B981', secondary: '#047857' },
};

async function main() {
  const email = arg('email');
  const company = arg('company') ?? 'Sales Engine';
  const name = arg('name') ?? 'Owner';
  const campaignArg = (arg('campaign') ?? 'retail').toLowerCase();
  const tierArg = (arg('tier') ?? 'single').toLowerCase();
  const themeArg = (arg('theme') ?? 'obsidian-gold').toLowerCase();
  const logoPath = arg('logo');

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error('Pass a valid --email, e.g. --email owner@theirco.com');
  }
  if (!['retail', 'b2b'].includes(campaignArg)) throw new Error('--campaign must be retail or b2b');
  if (!['single', 'team'].includes(tierArg)) throw new Error('--tier must be single or team');
  if (!THEMES[themeArg]) throw new Error(`--theme must be one of: ${Object.keys(THEMES).join(', ')}`);

  const campaign = campaignArg === 'b2b' ? 'AT&T B2B' : 'AT&T Retail EDM';
  const seats = tierArg === 'team' ? 5 : 1;
  const palette = THEMES[themeArg];
  const logoUrl = logoPath ? readLogo(logoPath) : undefined;

  // A generated password is 32 hex chars; bcrypt silently truncates past 72
  // bytes, so anything supplied longer than that is rejected rather than
  // becoming a shorter password than the operator thinks it is.
  const password = process.env.ADMIN_PASSWORD ?? randomBytes(16).toString('hex');
  const generated = !process.env.ADMIN_PASSWORD;
  if (Buffer.byteLength(password) > 72) throw new Error('ADMIN_PASSWORD must be 72 bytes or fewer.');
  if (password.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters.');

  const slug = slugify(company) || 'sales-engine';
  const passwordHash = await bcrypt.hash(password, 12);

  const theme = {
    companyName: company,
    primaryColor: palette.primary,
    secondaryColor: palette.secondary,
    preset: themeArg,
    ...(logoUrl ? { logoUrl, logoLocked: true } : {}),
    // Commercial terms, set by the vendor. The customer's app reads these; the
    // customer cannot edit them from their own site.
    campaign,
    seats,
    featureFlags: {
      hidePnL: false,
      hideCommissionEngine: false,
      hideTeamManagement: false,
      hideGoalsAttendance: false,
    },
  };

  const existing = await prisma.marketOwner.findUnique({ where: { slug } });
  const owner = existing
    ? await prisma.marketOwner.update({
        where: { slug },
        data: { name: company, subscriptionTier: tierArg === 'team' ? 'WHITE_LABEL' : 'STANDARD', theme },
      })
    : await prisma.marketOwner.create({
        data: { name: company, slug, subscriptionTier: tierArg === 'team' ? 'WHITE_LABEL' : 'STANDARD', theme },
      });

  // Re-running this to change a logo or tier must NOT reset a live customer's
  // password — that would lock them out of their own account without warning.
  // Resetting is opt-in via --reset-password.
  const priorUser = await prisma.user.findUnique({ where: { email } });
  const resetPassword = process.argv.includes('--reset-password');
  const willSetPassword = !priorUser || resetPassword;

  const user = priorUser
    ? await prisma.user.update({
        where: { email },
        data: {
          role: 'OWNER',
          marketOwnerId: owner.id,
          ...(willSetPassword ? { passwordHash } : {}),
        },
      })
    : await prisma.user.create({
        data: {
          email,
          passwordHash,
          name,
          role: 'OWNER',
          employeeId: `OWNER-${Date.now().toString(36).toUpperCase()}`,
          marketOwnerId: owner.id,
        },
      });

  console.log(`\n  Tenant     ${owner.name}  (slug: ${owner.slug})`);
  console.log(`  Campaign   ${campaign}${campaignArg === 'b2b' ? '  — 50% split, no base pay, areas not stores' : '  — office payout, $40/line base'}`);
  console.log(`  Seats      ${seats}  (${tierArg})`);
  console.log(`  Branding   ${themeArg}${logoUrl ? ' + logo embedded (locked)' : ' (no logo supplied)'}`);
  console.log(`  Admin      ${user.email}  role=OWNER`);
  if (!willSetPassword) {
    console.log('  Password   unchanged (existing account). Use --reset-password to issue a new one.\n');
  } else if (generated) {
    console.log(`  Password   ${password}`);
    console.log('\n  ^ shown once. Save it in a password manager now.\n');
  } else {
    console.log('  Password   set from ADMIN_PASSWORD.\n');
  }
  if (seats > 1) {
    console.log(`  Add their extra users with:`);
    console.log(`    npx tsx scripts/add-user.ts --email person@theirco.com --company "${company}" --role VIEWER\n`);
  }
}

main()
  .catch((e) => {
    console.error(`\n  Failed: ${e.message}\n`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
