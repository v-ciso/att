import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// Extended session user type for API routes
interface SessionUser {
  id: string;
  role: string;
  marketOwnerId: string;
  employeeId?: string;
  subscriptionTier?: 'STANDARD' | 'WHITE_LABEL';
}

const attendanceSchema = z.object({
  userId: z.string(),
  date: z.string().datetime(),
  status: z.enum(['PRESENT', 'LATE', 'ABSENT', 'EXCUSED', 'ROADTRIP']),
  checkInTime: z.string().datetime().optional(),
  checkOutTime: z.string().datetime().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser | undefined;
    if (!user?.marketOwnerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const teamId = searchParams.get('teamId');

    const where: any = { user: { marketOwnerId: user.marketOwnerId } };
    if (userId) where.userId = userId;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const attendance = await prisma.attendance.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, role: true, teamId: true, team: { select: { id: true, name: true } } } },
      },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json(attendance);
  } catch (error) {
    console.error('Attendance GET error:', error);
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
    const validated = attendanceSchema.parse(body);

    const dbUser = await prisma.user.findFirst({
      where: { id: validated.userId, marketOwnerId: user.marketOwnerId },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const attendance = await prisma.attendance.upsert({
      where: {
        userId_date: {
          userId: validated.userId,
          date: new Date(validated.date),
        },
      },
      update: {
        status: validated.status,
        checkInTime: validated.checkInTime ? new Date(validated.checkInTime) : undefined,
        checkOutTime: validated.checkOutTime ? new Date(validated.checkOutTime) : undefined,
      },
      create: {
        userId: validated.userId,
        date: new Date(validated.date),
        status: validated.status,
        checkInTime: validated.checkInTime ? new Date(validated.checkInTime) : undefined,
        checkOutTime: validated.checkOutTime ? new Date(validated.checkOutTime) : undefined,
      },
    });

    return NextResponse.json(attendance, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    console.error('Attendance POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}