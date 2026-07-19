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

const leaderboardSchema = z.object({
  name: z.string().min(1).max(100),
  store: z.enum(['COSTCO', 'TARGET', 'BJS', 'CUSTOM']),
  lines: z.number().int().min(0),
  premium: z.number().int().min(0),
  fiber: z.number().int().min(0),
  commission: z.number().min(0),
  role: z.enum(['REP', 'LEAD', 'ASM', 'OWNER']),
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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const store = searchParams.get('store');
    const role = searchParams.get('role');

    const where: any = { marketOwnerId: user.marketOwnerId };
    if (store) where.store = store;
    if (role) where.role = role;

    const [entries, total] = await Promise.all([
      prisma.leaderboardEntry.findMany({
        where,
        orderBy: { rank: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, name: true, email: true } }, team: { select: { id: true, name: true, color: true } } },
      }),
      prisma.leaderboardEntry.count({ where }),
    ]);

    return NextResponse.json({ entries, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('Leaderboard GET error:', error);
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
    const validated = leaderboardSchema.parse(body);

    const maxRank = await prisma.leaderboardEntry.aggregate({
      where: { marketOwnerId: user.marketOwnerId },
      _max: { rank: true },
    });

    const entry = await prisma.leaderboardEntry.create({
      data: {
        ...validated,
        marketOwnerId: user.marketOwnerId,
        rank: (maxRank._max.rank || 0) + 1,
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    console.error('Leaderboard POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}