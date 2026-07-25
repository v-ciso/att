import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/admin';
import { provisionCompany, setCompanyDisabled, setCompanySeats } from '@/lib/provision';

// Vendor admin surface. Every handler re-checks super-admin — the middleware
// gate is defence in depth, not the only lock.

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
  if (!(await requireSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const body = await request.json();
    const result = await provisionCompany({
      companyName: body.companyName,
      ownerEmail: body.ownerEmail,
      ownerName: body.ownerName,
      password: body.password,
      campaign: body.campaign,
      seats: body.seats,
      theme: body.theme,
      logoUrl: body.logoUrl,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to create company' }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await requireSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    if (typeof body.seats === 'number') {
      const result = await setCompanySeats(body.id, body.seats);
      return NextResponse.json({ success: true, ...result });
    }
    if (typeof body.disabled === 'boolean') {
      const result = await setCompanyDisabled(body.id, body.disabled);
      return NextResponse.json({ success: true, ...result });
    }
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 400 });
  }
}
