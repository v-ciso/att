import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

interface SessionUser {
  id: string;
  role: string;
  marketOwnerId: string;
  employeeId?: string;
  email?: string;
  subscriptionTier?: 'STANDARD' | 'WHITE_LABEL';
}

const teamSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  leadId: z.string().min(1),
  memberIds: z.array(z.string()).optional(),
  goals: z.object({
    linesTarget: z.number().int().min(0).optional(),
    premiumTarget: z.number().int().min(0).optional(),
    fiberTarget: z.number().int().min(0).optional(),
    revenueTarget: z.number().min(0).optional(),
    attendanceTarget: z.number().min(0).max(100).optional(),
  }).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser | undefined;
    if (!user?.marketOwnerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const teams = await prisma.team.findMany({
      where: { marketOwnerId: user.marketOwnerId },
      include: {
        lead: { select: { id: true, name: true, email: true, avatarUrl: true } },
        members: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } },
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(teams);
  } catch (error) {
    console.error('Teams GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser | undefined;
    if (!user?.marketOwnerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = teamSchema.parse(body);

    const team = await prisma.team.create({
      data: {
        ...validated,
        marketOwnerId: user.marketOwnerId,
        color: validated.color || '#3B82F6',
        goals: validated.goals || {},
      },
      include: {
        lead: { select: { id: true, name: true, email: true } },
        members: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    console.error('Teams POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}