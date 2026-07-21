import { SaleEntry, Period, aggregateSales, PersonStats } from './sales';
import { CommissionState } from '@/components/dashboard/editable-sections';
import { Person } from '@/components/dashboard/roster';
import { TeamData } from '@/components/dashboard/editable-sections';

// Pay model (owner's rules, all editable in the Commission tab's Role Structure):
//   • Rep / Intern — base commission on their own sales (the rep cut).
//   • Lead — base on their OWN sales + a per-line BUMP on their own lines.
//     A lead does NOT earn off the reps; they just make a few dollars more
//     per line for themselves.
//   • ASM / AD — base on any own sales + an OVERRIDE off their team's whole
//     production (percent of generated, or a $/line, per the role rule's unit).
//   • Market Owner — the remainder of the office.

export interface PayBreakdown {
  base: number;      // rep commission on own sales
  bump: number;      // lead per-line bonus on own lines
  override: number;  // ASM override off team production
  total: number;
  lines: number;     // own phone lines
  teamRevenue: number; // team office generated (ASM only)
  notes: string[];
}

function findRule(commission: CommissionState, match: RegExp) {
  return commission.roles?.find(r => match.test(r.name));
}

function loadTeams(): TeamData[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('se-teams-v2') || '[]'); } catch { return []; }
}

export function computePay(
  person: Person,
  ctx: { sales: SaleEntry[]; commission: CommissionState; people: Person[]; period: Period }
): PayBreakdown {
  const agg = aggregateSales(ctx.sales, ctx.commission, { period: ctx.period });
  const statsByName = new Map(agg.perPerson.map(p => [p.person.toLowerCase(), p]));
  const own = statsByName.get(person.name.toLowerCase());

  const base = own?.commission ?? 0;
  const lines = own?.lines ?? 0;
  const notes: string[] = [];
  let bump = 0;
  let override = 0;
  let teamRevenue = 0;

  if (person.role === 'LEAD') {
    const rule = findRule(ctx.commission, /lead/i);
    const perLine = rule?.amount ?? 0;
    bump = perLine * lines;
    if (perLine > 0) notes.push(`Lead bump: ${lines} own lines × $${perLine} = $${bump.toFixed(0)}`);
  }

  if (person.role === 'ASM') {
    const rule = findRule(ctx.commission, /asm|ad\b/i);
    const teams = loadTeams();
    // Teams this ASM oversees (their name is in the ASM slot)
    const myTeams = teams.filter(t => t.asm?.toLowerCase() === person.name.toLowerCase());
    const memberNames = new Set<string>();
    myTeams.forEach(t => {
      ctx.people.filter(p => p.team === t.name).forEach(p => memberNames.add(p.name.toLowerCase()));
      if (t.lead) memberNames.add(t.lead.toLowerCase());
    });
    let teamLines = 0;
    memberNames.forEach(n => {
      const s = statsByName.get(n);
      if (s) { teamRevenue += s.revenue; teamLines += s.lines; }
    });
    const amt = rule?.amount ?? 0;
    const unit = rule?.unit ?? '';
    if (/%/.test(unit)) {
      override = (amt / 100) * teamRevenue;
      if (amt > 0) notes.push(`ASM override: ${amt}% of $${teamRevenue.toFixed(0)} team generated = $${override.toFixed(0)}`);
    } else {
      override = amt * teamLines;
      if (amt > 0) notes.push(`ASM override: ${teamLines} team lines × $${amt} = $${override.toFixed(0)}`);
    }
  }

  return { base, bump, override, total: base + bump + override, lines, teamRevenue, notes };
}
