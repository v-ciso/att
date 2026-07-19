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

const expenseSchema = z.object({
  category: z.enum(['PAYROLL', 'RENT', 'TRAVEL', 'ROADTRIP', 'MARKETING', 'SOFTWARE', 'OTHER']),
  amount: z.number().min(0),
  description: z.string().min(1).max(500),
  date: z.string().datetime(),
  isRecurring: z.boolean().default(false),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser | undefined;
    if (!user?.marketOwnerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const category = searchParams.get('category');
    const startDate = month ? new Date(month + '-01') : undefined;
    const endDate = month ? new Date(new Date(month + '-01').setMonth(new Date(month + '-01').getMonth() + 1)) : undefined;

    const where: any = { marketOwnerId: user.marketOwnerId };
    if (category) where.category = category;
    if (startDate && endDate) {
      where.date = { gte: startDate, lt: endDate };
    }

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    return NextResponse.json(expenses);
  } catch (error) {
    console.error('Expenses GET error:', error);
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
    const validated = expenseSchema.parse(body);

    const expense = await prisma.expense.create({
      data: {
        ...validated,
        marketOwnerId: user.marketOwnerId,
        date: new Date(validated.date),
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    console.error('Expenses POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}