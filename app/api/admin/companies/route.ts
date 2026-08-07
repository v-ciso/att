import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/admin';
import { provisionCompany, setCompanyDisabled, setCompanySeats } from '@/lib/provision';
import { z } from 'zod';
import { blankAsUndefined, fields, parseBody } from '@/lib/api-validation';
import { audit, clientIp } from '@/lib/audit';

// Vendor admin surface. Every handler re-checks super-admin — the middleware
// gate is defence in depth, not the only lock.

const createCompanySchema = z.object({
  companyName: fields.name,
  ownerEmail: fields.email,
  // The console's form submits these blank when the vendor leaves them alone,
  // and provisionCompany derives a name and generates a temp password in that
  // case. Requiring them here would break company creation.
  ownerName: blankAsUndefined(fields.name),
  password: blankAsUndefined(fields.password),
  // Constrained to the two campaign types provisionCompany actually accepts;
  // a free string here would have been rejected downstream at runtime.
  campaign: z.enum(['retail', 'b2b']).optional(),
  // Seat count drives billing, so it must be a positive whole number. It was
  // passed through unchecked, which allowed 0, -5, or 1e9 seats.
  seats: fields.count.optional(),
  // A named preset, not an arbitrary object: provisionCompany looks this up in
  // THEME_PRESETS, so an unknown name would silently yield no theme.
  theme: z.enum(['obsidian-gold', 'command-blue', 'emerald']).optional(),
  // The console inlines the logo as a base64 data URL, so this is legitimately
  // huge — a 512KB image is roughly 700,000 characters. The client caps the file
  // at 512KB; allow ~1MB of encoded text so a valid upload is never rejected,
  // while still refusing an unbounded string.
  logoUrl: blankAsUndefined(z.string().trim().url().max(1_048_576)),
});

const updateCompanySchema = z.object({
  id: fields.id,
  seats: fields.count.optional(),
  disabled: z.boolean().optional(),
});

export async function GET() {
  if (!(await requireSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const companies = await prisma.marketOwner.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, slug: true, disabled: true, subscriptionTier: true, theme: true, createdAt: true,
      users: { select: { id: true, email: true, name: true, role: true, disabled: true, authId: true }, orderBy: { createdAt: 'asc' } },
    },
  });

  const shaped = companies.map(c => {
    const theme = (c.theme ?? {}) as { seats?: number; campaign?: string };
    return {
      id: c.id, name: c.name, slug: c.slug, disabled: c.disabled,
      tier: c.subscriptionTier, seats: theme.seats ?? 1, campaign: theme.campaign ?? 'AT&T Retail EDM',
      createdAt: c.createdAt,
      users: c.users.map(u => ({ ...u, authBackend: u.authId ? 'supabase' : 'bcrypt' })),
    };
  });
  return NextResponse.json({ companies: shaped });
}

export async function POST(request: NextRequest) {
  const adminEmail = await requireSuperAdmin();
  if (!adminEmail) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const parsed = await parseBody(request, createCompanySchema);
  if (!parsed.ok) return parsed.response;

  try {
    const result = await provisionCompany(parsed.data);
    await audit({
      action: 'company.created',
      actor: { email: adminEmail, role: 'SUPER_ADMIN', marketOwnerId: result.marketOwnerId },
      targetType: 'MarketOwner',
      targetId: result.marketOwnerId,
      meta: { slug: result.slug, seats: result.seats, campaign: result.campaign },
      ip: clientIp(request),
      userAgent: request.headers.get('user-agent'),
    });
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to create company' }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const adminEmail = await requireSuperAdmin();
  if (!adminEmail) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const parsed = await parseBody(request, updateCompanySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  try {
    if (typeof body.seats === 'number') {
      const result = await setCompanySeats(body.id, body.seats);
      await audit({
        action: 'company.seats_changed',
        actor: { email: adminEmail, role: 'SUPER_ADMIN', marketOwnerId: body.id },
        targetType: 'MarketOwner', targetId: body.id, meta: { seats: result.seats },
        ip: clientIp(request), userAgent: request.headers.get('user-agent'),
      });
      return NextResponse.json({ success: true, ...result });
    }
    if (typeof body.disabled === 'boolean') {
      const result = await setCompanyDisabled(body.id, body.disabled);
      await audit({
        action: body.disabled ? 'company.suspended' : 'company.reinstated',
        actor: { email: adminEmail, role: 'SUPER_ADMIN', marketOwnerId: body.id },
        targetType: 'MarketOwner', targetId: body.id,
        ip: clientIp(request), userAgent: request.headers.get('user-agent'),
      });
      return NextResponse.json({ success: true, ...result });
    }
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 400 });
  }
}
