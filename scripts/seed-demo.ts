import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding demo data...');

  const demoEmail = 'demo@fieldos.app';
  const existingOwner = await prisma.marketOwner.findUnique({ where: { slug: 'demo-market' } });
  if (existingOwner) {
    console.log('Demo data already exists. Skipping.');
    await prisma.$disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash('demo123456', 12);

  const marketOwner = await prisma.marketOwner.create({
    data: {
      name: 'Demo Market',
      slug: 'demo-market',
      subscriptionTier: 'WHITE_LABEL',
      theme: {
        companyName: 'Demo Wireless',
        primaryColor: '#3B82F6',
        secondaryColor: '#A855F7',
        accentColor: '#06B6D4',
        featureFlags: { hidePnL: false, hideCommissionEngine: false, hideTeamManagement: false, hideGoalsAttendance: false },
      },
    },
  });

  console.log(`Created market owner: ${marketOwner.id}`);

  const ownerUser = await prisma.user.create({
    data: {
      email: demoEmail,
      passwordHash,
      name: 'Demo Owner',
      // Deliberately NOT OWNER: this login has a shared, well-known password.
      // OWNER can reach Live data and Settings, so the demo account must not be
      // one. Use `npm run admin:create` for a real owner account.
      role: 'ASM',
      employeeId: 'DEMO-OWNER-001',
      marketOwnerId: marketOwner.id,
    },
  });

  console.log(`Created owner user: ${ownerUser.id}`);

  const teamLead = await prisma.user.create({
    data: {
      email: 'lead@demo.fieldos.app',
      passwordHash,
      name: 'Alex Thompson',
      role: 'LEAD',
      employeeId: 'DEMO-LEAD-001',
      marketOwnerId: marketOwner.id,
    },
  });

  const rep1 = await prisma.user.create({
    data: {
      email: 'rep1@demo.fieldos.app',
      passwordHash,
      name: 'Sarah Johnson',
      role: 'REP',
      employeeId: 'DEMO-REP-001',
      marketOwnerId: marketOwner.id,
    },
  });

  const rep2 = await prisma.user.create({
    data: {
      email: 'rep2@demo.fieldos.app',
      passwordHash,
      name: 'Mike Chen',
      role: 'REP',
      employeeId: 'DEMO-REP-002',
      marketOwnerId: marketOwner.id,
    },
  });

  await prisma.team.create({
    data: {
      name: 'Team Alpha',
      color: '#3B82F6',
      leadId: teamLead.id,
      marketOwnerId: marketOwner.id,
      goals: { linesTarget: 250, premiumTarget: 80, fiberTarget: 35 },
    },
  });

  await prisma.commissionRule.createMany({
    data: [
      { marketOwnerId: marketOwner.id, category: 'PHONE', planName: 'Premium 2.0', baseAmount: 35 },
      { marketOwnerId: marketOwner.id, category: 'PHONE', planName: 'Premium 2.0 + Next Up', baseAmount: 40 },
      { marketOwnerId: marketOwner.id, category: 'PHONE', planName: 'Extra 2.0', baseAmount: 30 },
      { marketOwnerId: marketOwner.id, category: 'PHONE', planName: 'Value 2.0', baseAmount: 20 },
      { marketOwnerId: marketOwner.id, category: 'FIBER', planName: 'Fiber 300', baseAmount: 25 },
      { marketOwnerId: marketOwner.id, category: 'FIBER', planName: 'Fiber 500', baseAmount: 35 },
      { marketOwnerId: marketOwner.id, category: 'FIBER', planName: 'Fiber 1GIG', baseAmount: 50 },
      { marketOwnerId: marketOwner.id, category: 'STORE', planName: 'COSTCO', baseAmount: 1, multiplier: 1 },
      { marketOwnerId: marketOwner.id, category: 'STORE', planName: 'TARGET', baseAmount: 1, multiplier: 1 },
      { marketOwnerId: marketOwner.id, category: 'STORE', planName: 'BJS', baseAmount: 1, multiplier: 1 },
      { marketOwnerId: marketOwner.id, category: 'OVERRIDE', planName: 'LEAD', baseAmount: 0, overrideType: 'FLAT', overrideValue: 5, appliesToRole: 'LEAD' },
      { marketOwnerId: marketOwner.id, category: 'OVERRIDE', planName: 'OWNER', baseAmount: 0, overrideType: 'PERCENT', overrideValue: 0.15, appliesToRole: 'OWNER' },
    ],
  });

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);

  await prisma.goal.create({
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

  await prisma.leaderboardEntry.createMany({
    data: [
      { marketOwnerId: marketOwner.id, userId: rep1.id, rank: 1, name: 'Sarah Johnson', store: 'COSTCO', lines: 12, premium: 8, fiber: 3, commission: 480, role: 'REP' },
      { marketOwnerId: marketOwner.id, userId: rep2.id, rank: 2, name: 'Mike Chen', store: 'TARGET', lines: 10, premium: 6, fiber: 4, commission: 410, role: 'REP' },
      { marketOwnerId: marketOwner.id, rank: 3, name: 'Jessica Williams', store: 'BJS', lines: 9, premium: 5, fiber: 3, commission: 375, role: 'REP' },
    ],
  });

  await prisma.expense.createMany({
    data: [
      { marketOwnerId: marketOwner.id, category: 'RENT', amount: 18000, description: 'Store rent - Feb 2026', date: new Date('2026-02-01') },
      { marketOwnerId: marketOwner.id, category: 'PAYROLL', amount: 65000, description: 'Rep commissions - Feb 2026', date: new Date('2026-02-15') },
      { marketOwnerId: marketOwner.id, category: 'TRAVEL', amount: 3500, description: 'Gas + tolls', date: new Date('2026-02-10') },
      { marketOwnerId: marketOwner.id, category: 'MARKETING', amount: 2000, description: 'Local event sponsorship', date: new Date('2026-02-05') },
    ],
  });

  console.log('Demo data seeded successfully!');
  console.log('Email: demo@fieldos.app');
  console.log('Password: demo123456');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
