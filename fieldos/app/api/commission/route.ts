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

const commissionRuleSchema = z.object({
  category: z.enum(['PHONE', 'FIBER', 'OVERRIDE', 'STORE']),
  planName: z.string().min(1),
  baseAmount: z.number().min(0),
  multiplier: z.number().min(0).default(1),
  overrideType: z.enum(['FLAT', 'PERCENT']).optional(),
  overrideValue: z.number().optional(),
  appliesToRole: z.enum(['OWNER', 'ASM', 'LEAD', 'REP', 'INTERN']).optional(),
  isActive: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser | undefined;
    if (!user?.marketOwnerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rules = await prisma.commissionRule.findMany({
      where: { marketOwnerId: user.marketOwnerId },
      orderBy: [{ category: 'asc' }, { planName: 'asc' }],
    });

    return NextResponse.json(rules);
  } catch (error) {
    console.error('Commission rules GET error:', error);
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
    const validated = commissionRuleSchema.parse(body);

    const rule = await prisma.commissionRule.create({
      data: {
        ...validated,
        marketOwnerId: user.marketOwnerId,
      },
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 });
    }
    console.error('Commission rules POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}