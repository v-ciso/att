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
  subscriptionTier?: 'STANDARD' | 'WHITE_LABEL';
}

const goalSchema = z.object({
  period: z.enum(['WEEKLY', 'MONTHLY']),
  linesTarget: z.number().int().min(0),
  premiumTarget: z.number().int().min(0),
  fiberTarget: z.number().int().min(0),
  revenueTarget: z.number().min(0),
  attendanceTarget: z.number().min(0).max(100),
  weekStart: z.string().datetime(),
  userId: z.string().optional(),
  teamId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser | undefined;
    if (!user?.marketOwnerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period');
    const userId = searchParams.get('userId');
    const teamId = searchParams.get('teamId');

    const where: any = { marketOwnerId: user.marketOwnerId };
    if (period) where.period = period;
    if (userId) where.userId = userId;
    if (teamId) where.teamId = teamId;

    const goals = await prisma.goal.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, role: true } },
        team: { select: { id: true, name: true, color: true } },
      },
      orderBy: { weekStart: 'desc' },
    });

    return NextResponse.json(goals);
  } catch (error) {
    console.error('Goals GET error:', error);
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
    const validated = goalSchema.parse(body);

    const goal = await prisma.goal.create({
      data: {
        ...validated,
        marketOwnerId: user.marketOwnerId,
        weekStart: new Date(validated.weekStart),
      },
      include: {
        user: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(goal, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    console.error('Goals POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}