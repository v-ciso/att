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
  inviteCode: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// Signup provisions a whole new tenant with an OWNER account, so it is closed
// by default: without SIGNUP_INVITE_CODE set, this endpoint refuses outright.
// Set that env var to hand a new customer a self-serve signup link.
export async function POST(request: NextRequest) {
  try {
    const expectedCode = process.env.SIGNUP_INVITE_CODE;
    const body = await request.json();
    const validated = registerSchema.parse(body);

    if (!expectedCode) {
      return NextResponse.json(
        { error: 'Self-serve signup is disabled. Contact your administrator for an account.' },
        { status: 403 }
      );
    }
    if (validated.inviteCode !== expectedCode) {
      return NextResponse.json(
        { error: 'Invalid invite code', field: 'inviteCode' },
        { status: 403 }
      );
    }

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
          // baseAmount = OFFICE payout per unit at Tier 5 (what AT&T deposits),
          // not the rep's cut. Next Up adds $15 on top of a line; Insurance $10.
          { marketOwnerId: marketOwner.id, category: 'PHONE', planName: 'Premium 2.0', baseAmount: 144, multiplier: 1 },
          { marketOwnerId: marketOwner.id, category: 'PHONE', planName: 'Extra 2.0', baseAmount: 134, multiplier: 1 },
          { marketOwnerId: marketOwner.id, category: 'PHONE', planName: 'Value 2.0', baseAmount: 124, multiplier: 1 },
          { marketOwnerId: marketOwner.id, category: 'PHONE', planName: 'Upgrades', baseAmount: 60, multiplier: 1 },
          { marketOwnerId: marketOwner.id, category: 'PHONE', planName: 'Next Up Anytime', baseAmount: 15, multiplier: 1 },
          { marketOwnerId: marketOwner.id, category: 'PHONE', planName: 'Insurance', baseAmount: 10, multiplier: 1 },
          // Fiber plans
          { marketOwnerId: marketOwner.id, category: 'FIBER', planName: 'Internet Air', baseAmount: 40, multiplier: 1 },
          { marketOwnerId: marketOwner.id, category: 'FIBER', planName: 'Fiber 300', baseAmount: 250, multiplier: 1 },
          { marketOwnerId: marketOwner.id, category: 'FIBER', planName: 'Fiber 500', baseAmount: 300, multiplier: 1 },
          { marketOwnerId: marketOwner.id, category: 'FIBER', planName: 'Fiber 1GIG', baseAmount: 360, multiplier: 1 },
          { marketOwnerId: marketOwner.id, category: 'FIBER', planName: 'Fiber 2GIG', baseAmount: 360, multiplier: 1 },
          { marketOwnerId: marketOwner.id, category: 'FIBER', planName: 'Fiber 5GIG', baseAmount: 400, multiplier: 1 },
          // Store multipliers
          { marketOwnerId: marketOwner.id, category: 'STORE', planName: 'COSTCO', baseAmount: 1, multiplier: 1 },
          { marketOwnerId: marketOwner.id, category: 'STORE', planName: 'TARGET', baseAmount: 1, multiplier: 1 },
          { marketOwnerId: marketOwner.id, category: 'STORE', planName: 'BJS', baseAmount: 1, multiplier: 1 },
          { marketOwnerId: marketOwner.id, category: 'STORE', planName: 'CUSTOM', baseAmount: 1, multiplier: 1 },
          // Overrides
          // Rep base is $40/line; a Lead adds $5 on top (=$45). The ASM takes
          // 3% of their whole team. The owner is the REMAINDER, not a fixed cut.
          { marketOwnerId: marketOwner.id, category: 'OVERRIDE', planName: 'REP', baseAmount: 40, overrideType: 'FLAT', overrideValue: 0, appliesToRole: 'REP' },
          { marketOwnerId: marketOwner.id, category: 'OVERRIDE', planName: 'LEAD', baseAmount: 0, overrideType: 'FLAT', overrideValue: 5, appliesToRole: 'LEAD' },
          { marketOwnerId: marketOwner.id, category: 'OVERRIDE', planName: 'ASM', baseAmount: 0, overrideType: 'PERCENT', overrideValue: 0.03, appliesToRole: 'ASM' },
          { marketOwnerId: marketOwner.id, category: 'OVERRIDE', planName: 'OWNER', baseAmount: 0, overrideType: 'PERCENT', overrideValue: 0, appliesToRole: 'OWNER' },
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