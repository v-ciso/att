import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const registerSchema = z.object({
  companyName: z.string().min(1).max(100),
  ownerName: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  confirmPassword: z.string(),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  storeCount: z.string().optional(),
  tier: z.enum(['STANDARD', 'WHITE_LABEL']),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = registerSchema.parse(body);

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (existingUser) {
      return NextResponse.json({ error: 'Email already registered', field: 'email' }, { status: 400 });
    }

    // Check if slug is taken
    const existingOwner = await prisma.marketOwner.findUnique({
      where: { slug: validated.slug },
    });

    if (existingOwner) {
      return NextResponse.json({ error: 'Subdomain already taken', field: 'slug' }, { status: 400 });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(validated.password, 12);

    // Create market owner and user in transaction
    const result = await prisma.$transaction(async (tx) => {
      const marketOwner = await tx.marketOwner.create({
        data: {
          name: validated.companyName,
          slug: validated.slug,
          subscriptionTier: validated.tier as 'STANDARD' | 'WHITE_LABEL',
          theme: {
            companyName: validated.companyName,
            primaryColor: '#3B82F6',
            secondaryColor: '#A855F7',
            accentColor: '#06B6D4',
            featureFlags: {
              hidePnL: false,
              hideCommissionEngine: false,
              hideTeamManagement: false,
              hideGoalsAttendance: false,
            },
          },
        },
      });

      const user = await tx.user.create({
        data: {
          email: validated.email,
          passwordHash,
          name: validated.ownerName,
          role: 'OWNER',
          employeeId: `OWNER-${Date.now().toString(36).toUpperCase()}`,
          marketOwnerId: marketOwner.id,
        },
      });

      // Create default commission rules
      await tx.commissionRule.createMany({
        data: [
          // Phone plans
          { marketOwnerId: marketOwner.id, category: 'PHONE', planName: 'Premium 2.0', baseAmount: 35, multiplier: 1 },
          { marketOwnerId: marketOwner.id, category: 'PHONE', planName: 'Premium 2.0 + Next Up', baseAmount: 40, multiplier: 1 },
          { marketOwnerId: marketOwner.id, category: 'PHONE', planName: 'Extra 2.0', baseAmount: 30, multiplier: 1 },
          { marketOwnerId: marketOwner.id, category: 'PHONE', planName: 'Value 2.0', baseAmount: 20, multiplier: 1 },
          { marketOwnerId: marketOwner.id, category: 'PHONE', planName: 'Upgrades', baseAmount: 15, multiplier: 1 },
          { marketOwnerId: marketOwner.id, category: 'PHONE', planName: 'Next Up Anytime', baseAmount: 10, multiplier: 1 },
          // Fiber plans
          { marketOwnerId: marketOwner.id, category: 'FIBER', planName: 'Internet Air', baseAmount: 25, multiplier: 1 },
          { marketOwnerId: marketOwner.id, category: 'FIBER', planName: 'Fiber 300', baseAmount: 25, multiplier: 1 },
          { marketOwnerId: marketOwner.id, category: 'FIBER', planName: 'Fiber 500', baseAmount: 35, multiplier: 1 },
          { marketOwnerId: marketOwner.id, category: 'FIBER', planName: 'Fiber 1GIG', baseAmount: 50, multiplier: 1 },
          { marketOwnerId: marketOwner.id, category: 'FIBER', planName: 'Fiber 2GIG', baseAmount: 75, multiplier: 1 },
          { marketOwnerId: marketOwner.id, category: 'FIBER', planName: 'Fiber 5GIG', baseAmount: 100, multiplier: 1 },
          // Store multipliers
          { marketOwnerId: marketOwner.id, category: 'STORE', planName: 'COSTCO', baseAmount: 1, multiplier: 1 },
          { marketOwnerId: marketOwner.id, category: 'STORE', planName: 'TARGET', baseAmount: 1, multiplier: 1 },
          { marketOwnerId: marketOwner.id, category: 'STORE', planName: 'BJS', baseAmount: 1, multiplier: 1 },
          { marketOwnerId: marketOwner.id, category: 'STORE', planName: 'CUSTOM', baseAmount: 1, multiplier: 1 },
          // Overrides
          { marketOwnerId: marketOwner.id, category: 'OVERRIDE', planName: 'LEAD', baseAmount: 0, overrideType: 'FLAT', overrideValue: 5, appliesToRole: 'LEAD' },
          { marketOwnerId: marketOwner.id, category: 'OVERRIDE', planName: 'ASM', baseAmount: 0, overrideType: 'PERCENT', overrideValue: 0.10, appliesToRole: 'ASM' },
          { marketOwnerId: marketOwner.id, category: 'OVERRIDE', planName: 'OWNER', baseAmount: 0, overrideType: 'PERCENT', overrideValue: 0.15, appliesToRole: 'OWNER' },
        ],
      });

      // Create default goals
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
      weekStart.setHours(0, 0, 0, 0);

      await tx.goal.create({
        data: {
          marketOwnerId: marketOwner.id,
          period: 'WEEKLY',
          linesTarget: 1000,
          premiumTarget: 350,
          fiberTarget: 150,
          revenueTarget: 150000,
          attendanceTarget: 95,
          weekStart,
        },
      });

      return { marketOwner, user };
    });

    return NextResponse.json({ success: true, marketOwnerId: result.marketOwner.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldError = error.errors[0];
      return NextResponse.json({ error: fieldError.message, field: fieldError.path[0] }, { status: 400 });
    }
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}