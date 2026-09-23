import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { can } from '@/lib/permissions';
import { isSuperAdminEmail } from '@/lib/super-admins';

interface SessionUser {
  id: string;
  role: string;
  marketOwnerId: string;
  employeeId?: string;
  email?: string;
  /** Stamped into the JWT at sign-in; required for the branding capability. */
  isSuperAdmin?: boolean;
  subscriptionTier?: 'STANDARD' | 'WHITE_LABEL';
}

const themeSchema = z.object({
  companyName: z.string().min(1).max(100),
  logo: z.string().url().optional().or(z.literal('')),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  customDomain: z.string().optional().or(z.literal('')),
  featureFlags: z.object({
    hidePnL: z.boolean(),
    hideCommissionEngine: z.boolean(),
    hideTeamManagement: z.boolean(),
    hideGoalsAttendance: z.boolean(),
  }),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser | undefined;
    if (!user?.marketOwnerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const marketOwner = await prisma.marketOwner.findUnique({
      where: { id: user.marketOwnerId },
      select: { theme: true },
    });

    if (!marketOwner) {
      return NextResponse.json({ error: 'Market owner not found' }, { status: 404 });
    }

    return NextResponse.json({
      theme: marketOwner.theme,
    });
  } catch (error) {
    console.error('White-label GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser | undefined;
    if (!user?.marketOwnerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Branding/domain/seats are vendor-only per the Phase 2 matrix. This used to
    // be `role !== 'OWNER'`, which let any buyer who owns their company restyle
    // the product — the one surface that must stay ours.
    const actor = {
      role: user.role,
      // Email fallback covers sessions minted before isSuperAdmin was added.
      isSuperAdmin: user.isSuperAdmin ?? isSuperAdminEmail(user.email),
    };
    if (!can(actor, 'branding.manage')) {
      return NextResponse.json({ error: 'Forbidden: white-label settings are managed by the vendor' }, { status: 403 });
    }

    const body = await request.json();
    const validated = themeSchema.parse(body);

const marketOwner = await prisma.marketOwner.update({
      where: { id: user.marketOwnerId },
      data: {
        theme: validated,
      },
    });

    return NextResponse.json({ theme: marketOwner.theme });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    console.error('White-label PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
