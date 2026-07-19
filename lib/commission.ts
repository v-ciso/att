import { CommissionRule, Role, StoreType } from '@prisma/client';

export interface PlanPayout {
  planName: string;
  baseAmount: number;
  category: 'PHONE' | 'FIBER' | 'ADDON';
}

export interface CommissionBreakdown {
  repId: string;
  repName: string;
  role: Role;
  lines: CommissionLine[];
  grossCommission: number;
  overrideEarned: number;
  netCommission: number;
}

export interface CommissionLine {
  planName: string;
  category: 'PHONE' | 'FIBER' | 'ADDON';
  quantity: number;
  baseRate: number;
  storeMultiplier: number;
  lineTotal: number;
}

export interface OverrideRule {
  role: Role;
  type: 'FLAT' | 'PERCENT';
  value: number;
  appliesTo: Role[];
}

const DEFAULT_STORE_MULTIPLIERS: Record<StoreType, number> = {
  COSTCO: 1.0,
  TARGET: 1.0,
  BJS: 1.0,
  CUSTOM: 1.0,
};

const DEFAULT_PHONE_PLANS: PlanPayout[] = [
  { planName: 'Premium 2.0', baseAmount: 35, category: 'PHONE' },
  { planName: 'Premium 2.0 + Next Up', baseAmount: 40, category: 'PHONE' },
  { planName: 'Extra 2.0', baseAmount: 30, category: 'PHONE' },
  { planName: 'Value 2.0', baseAmount: 20, category: 'PHONE' },
  { planName: 'Upgrades', baseAmount: 15, category: 'PHONE' },
  { planName: 'Next Up Anytime', baseAmount: 10, category: 'ADDON' },
];

const DEFAULT_FIBER_PLANS: PlanPayout[] = [
  { planName: 'Internet Air', baseAmount: 25, category: 'FIBER' },
  { planName: 'Fiber 300', baseAmount: 25, category: 'FIBER' },
  { planName: 'Fiber 500', baseAmount: 35, category: 'FIBER' },
  { planName: 'Fiber 1GIG', baseAmount: 50, category: 'FIBER' },
  { planName: 'Fiber 2GIG', baseAmount: 75, category: 'FIBER' },
  { planName: 'Fiber 5GIG', baseAmount: 100, category: 'FIBER' },
];

const DEFAULT_OVERRIDES: OverrideRule[] = [
  { role: 'REP', type: 'FLAT', value: 0, appliesTo: [] },
  { role: 'INTERN', type: 'FLAT', value: 0, appliesTo: [] },
  { role: 'LEAD', type: 'FLAT', value: 5, appliesTo: ['REP', 'INTERN'] },
  { role: 'ASM', type: 'PERCENT', value: 0.10, appliesTo: ['LEAD', 'REP', 'INTERN'] },
  { role: 'OWNER', type: 'PERCENT', value: 0.15, appliesTo: ['ASM', 'LEAD', 'REP', 'INTERN'] },
];

export function getPlanPayout(
  planName: string,
  rules: CommissionRule[]
): PlanPayout | null {
  const rule = rules.find(r => r.planName.toLowerCase() === planName.toLowerCase() && r.isActive);
  if (rule) {
    return { planName: rule.planName, baseAmount: rule.baseAmount, category: rule.category as 'PHONE' | 'FIBER' | 'ADDON' };
  }

  const phoneMatch = DEFAULT_PHONE_PLANS.find(p => p.planName.toLowerCase() === planName.toLowerCase());
  if (phoneMatch) return phoneMatch;

  const fiberMatch = DEFAULT_FIBER_PLANS.find(p => p.planName.toLowerCase() === planName.toLowerCase());
  if (fiberMatch) return fiberMatch;

  return null;
}

export function getStoreMultiplier(store: StoreType, rules: CommissionRule[]): number {
  const rule = rules.find(r => r.category === 'STORE' && r.planName === store && r.isActive);
  return rule?.multiplier ?? DEFAULT_STORE_MULTIPLIERS[store] ?? 1.0;
}

export function getOverrideRules(rules: CommissionRule[]): OverrideRule[] {
  const overrideRules = rules
    .filter(r => r.category === 'OVERRIDE' && r.isActive && r.appliesToRole)
    .map(r => ({
      role: r.appliesToRole!,
      type: r.overrideType!,
      value: r.overrideValue!,
      appliesTo: getSubordinateRoles(r.appliesToRole!),
    }));

  if (overrideRules.length === 0) return DEFAULT_OVERRIDES;
  return overrideRules;
}

function getSubordinateRoles(role: Role): Role[] {
  const hierarchy: Record<Role, Role[]> = {
    OWNER: ['ASM', 'LEAD', 'REP', 'INTERN'],
    ASM: ['LEAD', 'REP', 'INTERN'],
    LEAD: ['REP', 'INTERN'],
    REP: [],
    INTERN: [],
  };
  return hierarchy[role] || [];
}

export function calculateLineCommission(
  planName: string,
  store: StoreType,
  quantity: number,
  rules: CommissionRule[]
): CommissionLine {
  const plan = getPlanPayout(planName, rules);
  const multiplier = getStoreMultiplier(store, rules);

  if (!plan) {
    return {
      planName,
      category: 'PHONE',
      quantity,
      baseRate: 0,
      storeMultiplier: multiplier,
      lineTotal: 0,
    };
  }

  const baseRate = plan.baseAmount * multiplier;
  return {
    planName,
    category: plan.category,
    quantity,
    baseRate,
    storeMultiplier: multiplier,
    lineTotal: baseRate * quantity,
  };
}

export function calculateRepCommission(
  lines: CommissionLine[],
  role: Role,
  overrideRules: OverrideRule[]
): { grossCommission: number; overrideEarned: number } {
  const grossCommission = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const overrideRule = overrideRules.find(r => r.role === role);
  let overrideEarned = 0;

  if (overrideRule) {
    if (overrideRule.type === 'FLAT') {
      const totalLines = lines.reduce((sum, line) => sum + line.quantity, 0);
      overrideEarned = overrideRule.value * totalLines;
    }
  }

  return { grossCommission, overrideEarned };
}

export function calculateTeamOverrides(
  leaderRole: Role,
  subordinateCommissions: CommissionBreakdown[],
  overrideRules: OverrideRule[]
): number {
  const overrideRule = overrideRules.find(r => r.role === leaderRole);
  if (!overrideRule) return 0;

  let total = 0;
  for (const sub of subordinateCommissions) {
    if (overrideRule.appliesTo.includes(sub.role)) {
      if (overrideRule.type === 'FLAT') {
        total += overrideRule.value * sub.lines.reduce((sum, l) => sum + l.quantity, 0);
      } else if (overrideRule.type === 'PERCENT') {
        total += sub.grossCommission * overrideRule.value;
      }
    }
  }
  return total;
}

export function calculateFullCommission(
  leaderboardEntries: Array<{
    id: string;
    name: string;
    role: Role;
    store: StoreType;
    lines: number;
    premium: number;
    fiber: number;
    commission: number;
    teamId?: string;
    userId?: string;
  }>,
  rules: CommissionRule[]
): CommissionBreakdown[] {
  const overrideRules = getOverrideRules(rules);
  const results: CommissionBreakdown[] = [];

  const entriesByTeam = new Map<string, typeof leaderboardEntries>();
  for (const entry of leaderboardEntries) {
    const key = entry.teamId || `solo-${entry.id}`;
    if (!entriesByTeam.has(key)) entriesByTeam.set(key, []);
    entriesByTeam.get(key)!.push(entry);
  }

  for (const [teamKey, entries] of Array.from(entriesByTeam)) {
    const lead = entries.find(e => e.role === 'LEAD' || e.role === 'ASM' || e.role === 'OWNER');
    const reps = entries.filter(e => e.role === 'REP' || e.role === 'INTERN');

    for (const rep of reps) {
      const phoneLines: CommissionLine[] = [];
      if (rep.premium > 0) phoneLines.push(calculateLineCommission('Premium 2.0', rep.store, rep.premium, rules));
      if (rep.lines > rep.premium + rep.fiber) {
        phoneLines.push(calculateLineCommission('Extra 2.0', rep.store, rep.lines - rep.premium - rep.fiber, rules));
      }
      if (rep.fiber > 0) {
        phoneLines.push(calculateLineCommission('Fiber 1GIG', rep.store, rep.fiber, rules));
      }

      const { grossCommission, overrideEarned } = calculateRepCommission(phoneLines, rep.role, overrideRules);
      results.push({
        repId: rep.userId || rep.id,
        repName: rep.name,
        role: rep.role,
        lines: phoneLines,
        grossCommission,
        overrideEarned,
        netCommission: grossCommission + overrideEarned,
      });
    }

    if (lead) {
      const { grossCommission, overrideEarned } = calculateRepCommission(
        [], lead.role, overrideRules
      );
      const teamOverride = calculateTeamOverrides(lead.role, results.filter(r => r.repId !== lead!.userId), overrideRules);
      results.push({
        repId: lead.userId || lead.id,
        repName: lead.name,
        role: lead.role,
        lines: [],
        grossCommission,
        overrideEarned: overrideEarned + teamOverride,
        netCommission: grossCommission + overrideEarned + teamOverride,
      });
    }
  }

  return results;
}

export function previewCommission(
  planName: string,
  store: StoreType,
  quantity: number,
  role: Role,
  rules: CommissionRule[]
): { lineTotal: number; override: number; total: number } {
  const line = calculateLineCommission(planName, store, quantity, rules);
  const overrideRules = getOverrideRules(rules);
  const { overrideEarned } = calculateRepCommission([line], role, overrideRules);
  return {
    lineTotal: line.lineTotal,
    override: overrideEarned,
    total: line.lineTotal + overrideEarned,
  };
}