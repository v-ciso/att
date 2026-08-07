import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { createAuthUser, setAuthPassword, deleteAuthUser, supabaseAuthReady } from '@/lib/supabase-admin';
import type { Role } from '@prisma/client';

// One place that creates tenants and logins, used by the admin API (and usable
// by the CLI scripts). New accounts go into Supabase Auth so they appear in the
// Authentication tab and can be given OAuth / MFA from the console. If Supabase
// Auth is not configured, it falls back to a bcrypt hash so provisioning still
// works — never leave the vendor unable to create an account.

const THEME_PRESETS: Record<string, { primary: string; secondary: string }> = {
  'obsidian-gold': { primary: '#E7C24A', secondary: '#B8860B' },
  'command-blue': { primary: '#3B82F6', secondary: '#1D4ED8' },
  emerald: { primary: '#10B981', secondary: '#047857' },
};

export function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
}

export function generatePassword(): string {
  return randomBytes(12).toString('base64url'); // ~16 chars, URL-safe
}

// Set both auth backends coherently: a Supabase authId when available, always a
// bcrypt hash as the offline fallback / rollback path.
async function credentialFields(email: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 12);
  if (!supabaseAuthReady()) return { passwordHash, authId: null as string | null };
  const { id } = await createAuthUser(email, password);
  return { passwordHash, authId: id };
}

export interface CompanyInput {
  companyName: string;
  ownerEmail: string;
  ownerName?: string;
  password?: string;              // vendor-typed temp password; generated if absent
  campaign?: 'retail' | 'b2b';
  seats?: number;                 // how many logins allowed; base 1, no cap
  theme?: keyof typeof THEME_PRESETS;
  logoUrl?: string;
}

// Seats are whatever the vendor decides to grant — the base plan is one login,
// but there is no upper cap. Clamp only to a sane minimum of 1.
function normalizeSeats(seats?: number): number {
  const n = Math.floor(Number(seats));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export async function provisionCompany(input: CompanyInput) {
  const email = input.ownerEmail.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Invalid owner email');
  if (!input.companyName.trim()) throw new Error('Company name is required');

  const slug = slugify(input.companyName) || 'company';
  if (await prisma.marketOwner.findUnique({ where: { slug } })) {
    throw new Error(`A company named "${input.companyName}" already exists (slug ${slug}).`);
  }
  if (await prisma.user.findUnique({ where: { email } })) {
    throw new Error(`${email} is already a user. Use a different owner email.`);
  }

  const password = input.password?.trim() || generatePassword();
  if (password.length < 8) throw new Error('Temporary password must be at least 8 characters.');

  const campaign = input.campaign === 'b2b' ? 'AT&T B2B' : 'AT&T Retail EDM';
  const seats = normalizeSeats(input.seats);
  const preset = input.theme && THEME_PRESETS[input.theme] ? input.theme : 'obsidian-gold';
  const palette = THEME_PRESETS[preset];

  const theme = {
    companyName: input.companyName,
    primaryColor: palette.primary,
    secondaryColor: palette.secondary,
    preset,
    ...(input.logoUrl ? { logoUrl: input.logoUrl, logoLocked: true } : {}),
    campaign,
    seats,
    featureFlags: { hidePnL: false, hideCommissionEngine: false, hideTeamManagement: false, hideGoalsAttendance: false },
  };

  const cred = await credentialFields(email, password);
  try {
    const owner = await prisma.marketOwner.create({
      data: { name: input.companyName, slug, subscriptionTier: seats > 1 ? 'WHITE_LABEL' : 'STANDARD', theme },
    });
    // Seed this tenant's operational data so a brand-new live account starts
    // clean (empty roster, no demo furniture) in the DB itself, and carries the
    // branding (name + logo + colours) so their dashboard shows THEIR company.
    await seedTenantData(owner.id, campaign, theme);
    await prisma.user.create({
      data: {
        email,
        name: input.ownerName?.trim() || 'Owner',
        role: 'OWNER',
        passwordHash: cred.passwordHash,
        authId: cred.authId,
        employeeId: `OWNER-${Date.now().toString(36).toUpperCase()}`,
        marketOwnerId: owner.id,
      },
    });
    return { marketOwnerId: owner.id, slug, ownerEmail: email, tempPassword: password, seats, campaign, authBackend: cred.authId ? 'supabase' : 'bcrypt' as const };
  } catch (e) {
    // Roll back the Supabase auth user if the DB write failed, so we never leave
    // an orphan in the Authentication tab.
    if (cred.authId) await deleteAuthUser(cred.authId);
    throw e;
  }
}

const ASSIGNABLE: Role[] = ['MANAGER', 'VIEWER', 'ASM', 'LEAD', 'REP', 'INTERN'];

export async function addCompanyUser(input: {
  marketOwnerId: string; email: string; name?: string; role: Role; password?: string;
}) {
  const email = input.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Invalid email');
  if (!ASSIGNABLE.includes(input.role)) throw new Error(`Role must be one of: ${ASSIGNABLE.join(', ')}`);

  const owner = await prisma.marketOwner.findUnique({ where: { id: input.marketOwnerId } });
  if (!owner) throw new Error('Company not found');

  const seats = (owner.theme as { seats?: number })?.seats ?? 1;
  const used = await prisma.user.count({ where: { marketOwnerId: owner.id } });
  const dupe = await prisma.user.findUnique({ where: { email } });
  if (dupe && dupe.marketOwnerId === owner.id) throw new Error(`${email} is already on this company.`);
  if (dupe) throw new Error(`${email} already belongs to another company.`);
  if (used >= seats) throw new Error(`${owner.name} is on a ${seats}-seat plan and already has ${used} user(s).`);

  const password = input.password?.trim() || generatePassword();
  if (password.length < 8) throw new Error('Temporary password must be at least 8 characters.');

  const cred = await credentialFields(email, password);
  try {
    const user = await prisma.user.create({
      data: {
        email,
        name: input.name?.trim() || email.split('@')[0],
        role: input.role,
        passwordHash: cred.passwordHash,
        authId: cred.authId,
        employeeId: `${input.role}-${Date.now().toString(36).toUpperCase()}`,
        marketOwnerId: owner.id,
      },
    });
    return { userId: user.id, email: user.email, role: user.role, tempPassword: password, seatsUsed: used + 1, seats };
  } catch (e) {
    if (cred.authId) await deleteAuthUser(cred.authId);
    throw e;
  }
}

interface StoreRule { name: string; multiplier: number }

// The vendor sets up a client's stores during handoff. Stores live inside the
// tenant's se-commission-v2 blob in TenantData; read it, merge, write it back.
export async function getTenantStores(marketOwnerId: string): Promise<StoreRule[]> {
  const row = await prisma.tenantData.findUnique({
    where: { marketOwnerId_key: { marketOwnerId, key: 'se-commission-v2' } },
  });
  const commission = (row?.value ?? {}) as { stores?: StoreRule[] };
  return commission.stores ?? [];
}

export async function setTenantStores(marketOwnerId: string, stores: StoreRule[]): Promise<StoreRule[]> {
  const clean = stores
    .map(s => ({ name: String(s.name).trim(), multiplier: Number(s.multiplier) || 1 }))
    .filter(s => s.name);
  const row = await prisma.tenantData.findUnique({
    where: { marketOwnerId_key: { marketOwnerId, key: 'se-commission-v2' } },
  });
  const commission = { ...((row?.value ?? {}) as object), stores: clean, storeIndex: 0 };
  await prisma.tenantData.upsert({
    where: { marketOwnerId_key: { marketOwnerId, key: 'se-commission-v2' } },
    create: { marketOwnerId, key: 'se-commission-v2', value: commission },
    update: { value: commission },
  });
  return clean;
}

export async function setCompanyDisabled(marketOwnerId: string, disabled: boolean) {
  const owner = await prisma.marketOwner.update({ where: { id: marketOwnerId }, data: { disabled } });
  return { slug: owner.slug, disabled: owner.disabled };
}

// Change how many logins a company may have. Cannot drop below the number
// already in use, or existing users would be silently over the limit.
export async function setCompanySeats(marketOwnerId: string, seats: number) {
  const n = normalizeSeats(seats);
  const owner = await prisma.marketOwner.findUniqueOrThrow({ where: { id: marketOwnerId } });
  const used = await prisma.user.count({ where: { marketOwnerId } });
  if (n < used) throw new Error(`This company already has ${used} logins — set seats to ${used} or more.`);
  const theme = { ...(owner.theme as Record<string, unknown>), seats: n };
  await prisma.marketOwner.update({ where: { id: marketOwnerId }, data: { theme } });
  return { seats: n, used };
}

// The clean starting point for a new tenant. Empty collections so no invented
// staff or money appears; the client fills the commission plan payouts from its
// own liveDefault. Kept as JSON blobs matching the app's localStorage shapes.
// No 'use client' import here — this runs server-side.
async function seedTenantData(marketOwnerId: string, campaign: string, theme?: object) {
  const seed: Record<string, unknown> = {
    'se-people-v1': [],
    'se-teams-v2': [],
    'se-sales-v1': [],
    'se-competitions-v1': [],
    'se-schedule-v1': {},
    'se-attendance-v1': {},
    'se-campaign-v1': campaign,
    // The client's ThemeProvider reads se-theme-v1; seeding it means the owner's
    // company name, logo, and colours show the moment they sign in.
    ...(theme ? { 'se-theme-v1': theme } : {}),
  };
  await prisma.$transaction(
    Object.entries(seed).map(([key, value]) =>
      prisma.tenantData.upsert({
        where: { marketOwnerId_key: { marketOwnerId, key } },
        create: { marketOwnerId, key, value: value as object },
        update: {}, // never clobber existing tenant data on re-run
      })
    )
  );
}

// Issue a new temporary password for any user (owner or manager). Updates both
// backends: Supabase Auth if the account lives there, always the bcrypt hash as
// the fallback. Returns the new password once.
export async function resetUserPassword(userId: string, password?: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');
  const pw = password?.trim() || generatePassword();
  if (pw.length < 8) throw new Error('Password must be at least 8 characters.');
  if (Buffer.byteLength(pw) > 72) throw new Error('Password must be 72 bytes or fewer.');

  if (user.authId) await setAuthPassword(user.authId, pw);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(pw, 12) } });
  return { userId: user.id, marketOwnerId: user.marketOwnerId, email: user.email, tempPassword: pw };
}

export async function removeCompanyUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');
  if (user.role === 'OWNER') throw new Error('Cannot remove the OWNER. Transfer ownership or disable the whole company.');

  if (user.authId) await deleteAuthUser(user.authId);
  await prisma.$transaction([
    prisma.attendance.deleteMany({ where: { userId } }),
    prisma.commission.deleteMany({ where: { userId } }),
    prisma.leaderboardEntry.updateMany({ where: { userId }, data: { userId: null } }),
    prisma.goal.deleteMany({ where: { userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
  return { userId: user.id, marketOwnerId: user.marketOwnerId, email: user.email };
}
