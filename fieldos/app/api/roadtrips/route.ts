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

const roadtripSchema = z.object({
  name: z.string().min(1).max(100),
  location: z.string().min(1).max(200),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  totalCost: z.number().min(0),
  reimbursed: z.number().min(0).optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REIMBURSED', 'DENIED']).default('PENDING'),
  attendees: z.array(z.string()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser | undefined;
    if (!user?.marketOwnerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = { marketOwnerId: user.marketOwnerId };
    if (startDate || endDate) {
      where.startDate = {};
      if (startDate) where.startDate.gte = new Date(startDate);
      if (endDate) where.startDate.lte = new Date(endDate);
    }

    const roadtrips = await prisma.roadtrip.findMany({
      where,
      orderBy: { startDate: 'desc' },
    });

    return NextResponse.json(roadtrips);
  } catch (error) {
    console.error('Roadtrips GET error:', error);
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
    const validated = roadtripSchema.parse(body);

    const roadtrip = await prisma.roadtrip.create({
      data: {
        ...validated,
        marketOwnerId: user.marketOwnerId,
        startDate: new Date(validated.startDate),
        endDate: new Date(validated.endDate),
        reimbursed: validated.reimbursed ?? validated.totalCost * 0.6,
      },
    });

    return NextResponse.json(roadtrip, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    console.error('Roadtrips POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}