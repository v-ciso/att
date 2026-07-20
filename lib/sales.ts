// Sales engine — the derived-data core.
// The owner only enters WHAT was sold (plans, next-ups, insurance per rep per
// day) in the Daily Tracker; every number elsewhere (revenue, leaderboard,
// KPIs, product mix, P&L commission, meeting stats) derives from these entries
// priced through the editable Commission Engine.

import { CommissionState, DEFAULT_COMMISSION } from '@/components/dashboard/editable-sections';
import { Person } from '@/components/dashboard/roster';

export interface SaleEntry {
  id: string;
  date: string; // YYYY-MM-DD
  person: string; // roster name
  store: string;
  plan: string; // commission engine plan name (phone or internet)
  qty: number;
  nextUps: number; // Next Up Anytime attached
  insurance: number; // Insurance attached
}

export type Period = 'daily' | 'weekly' | 'monthly' | 'all';

export const PERIOD_LABELS: Record<Period, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  all: 'All Time',
};

export const SALES_KEY = 'se-sales-v1';

export function loadSales(): SaleEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(SALES_KEY);
    return saved ? (JSON.parse(saved) as SaleEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveSales(entries: SaleEntry[]) {
  localStorage.setItem(SALES_KEY, JSON.stringify(entries));
}

export function loadCommission(): CommissionState {
  if (typeof window === 'undefined') return DEFAULT_COMMISSION;
  try {
    const saved = localStorage.getItem('se-commission-v2');
    if (!saved) return DEFAULT_COMMISSION;
    const state = JSON.parse(saved) as CommissionState;
    // Normalize: items saved before the office/rep split get a rep cut of 0
    (['phonePlans', 'addOns', 'internet'] as const).forEach(list => {
      state[list] = (state[list] ?? []).map(item => ({ ...item, rep: item.rep ?? 0 }));
    });
    return state;
  } catch {
    return DEFAULT_COMMISSION;
  }
}

export function todayStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function inPeriod(dateStr: string, period: Period): boolean {
  if (period === 'all') return true;
  const date = new Date(dateStr + 'T12:00:00');
  const now = new Date();
  const msPerDay = 86400000;
  const diffDays = Math.floor((now.getTime() - date.getTime()) / msPerDay);
  // Daily covers yesterday + today: production is logged the morning after,
  // so the morning meeting reviews yesterday's numbers.
  if (period === 'daily') return dateStr === todayStr() || dateStr === todayStr(-1);
  if (period === 'weekly') return diffDays >= 0 && diffDays < 7;
  return diffDays >= 0 && diffDays < 30; // monthly
}

// Effective OFFICE payout for a plan: tier discount + the ENTRY's store
// multiplier apply to the office total. The rep's cut is the flat dollar
// amount the owner typed — never scaled or calculated.
export function planPayout(
  commission: CommissionState,
  planName: string,
  storeName?: string,
  kind: 'office' | 'rep' = 'office'
): number {
  const all = [...commission.phonePlans, ...commission.internet, ...commission.addOns];
  const plan = all.find(p => p.name === planName);
  if (!plan) return 0;
  if (kind === 'rep') return Math.max(0, plan.rep ?? 0);
  const mult = storeName
    ? commission.stores.find(s => s.name.toLowerCase() === storeName.toLowerCase())?.multiplier ?? 1
    : 1;
  return Math.max(0, (plan.payout - (5 - commission.tier) * commission.tierDelta) * mult);
}

export interface RevenuePart {
  label: string;
  amount: number;
}

// Money for one entry: OFFICE total (direct deposit generated) with its
// visible breakdown, plus the rep's commission at the owner's typed rates.
export function entryRevenue(
  entry: SaleEntry,
  commission: CommissionState
): { total: number; repTotal: number; parts: RevenuePart[] } {
  const parts: RevenuePart[] = [];
  const planPer = planPayout(commission, entry.plan, entry.store);
  if (entry.qty > 0) parts.push({ label: `${entry.qty} × ${entry.plan} @ $${planPer} office`, amount: entry.qty * planPer });
  if (entry.nextUps > 0) {
    const per = planPayout(commission, 'Next Up Anytime', entry.store);
    parts.push({ label: `${entry.nextUps} × Next Up @ $${per} office`, amount: entry.nextUps * per });
  }
  if (entry.insurance > 0) {
    const per = planPayout(commission, 'Insurance', entry.store);
    parts.push({ label: `${entry.insurance} × Insurance @ $${per} office`, amount: entry.insurance * per });
  }
  const repTotal =
    entry.qty * planPayout(commission, entry.plan, entry.store, 'rep') +
    entry.nextUps * planPayout(commission, 'Next Up Anytime', entry.store, 'rep') +
    entry.insurance * planPayout(commission, 'Insurance', entry.store, 'rep');
  return { total: parts.reduce((a, b) => a + b.amount, 0), repTotal, parts };
}

export function isPhonePlan(commission: CommissionState, planName: string): boolean {
  return commission.phonePlans.some(p => p.name === planName);
}

export interface PersonStats {
  person: string;
  store: string;
  lines: number;
  premium: number;
  internet: number;
  nextUps: number;
  insurance: number;
  revenue: number;    // office total generated (direct deposit)
  commission: number; // the rep's cut at the owner's typed rates
}

export interface Aggregate {
  lines: number; // phone lines
  premium: number;
  internet: number;
  nextUps: number;
  insurance: number;
  revenue: number;    // office total generated
  commission: number; // total rep commissions
  perPerson: PersonStats[]; // sorted by revenue desc
  perPlan: Map<string, { qty: number; nextUps: number; revenue: number }>;
  perDay: Map<string, number>; // date -> office revenue
}

export function aggregateSales(
  sales: SaleEntry[],
  commission: CommissionState,
  opts: { period: Period; stores?: string[]; date?: string }
): Aggregate {
  const storeSet = opts.stores && opts.stores.length ? new Set(opts.stores.map(s => s.toLowerCase())) : null;
  const filtered = sales.filter(e =>
    // A specific picked date (e.g. "last Monday") overrides the period window
    (opts.date ? e.date === opts.date : inPeriod(e.date, opts.period)) &&
    (!storeSet || storeSet.has(e.store.toLowerCase()))
  );

  const agg: Aggregate = {
    lines: 0, premium: 0, internet: 0, nextUps: 0, insurance: 0, revenue: 0, commission: 0,
    perPerson: [], perPlan: new Map(), perDay: new Map(),
  };
  const personMap = new Map<string, PersonStats>();

  for (const e of filtered) {
    const phone = isPhonePlan(commission, e.plan);
    const { total, repTotal } = entryRevenue(e, commission);
    if (phone) agg.lines += e.qty; else agg.internet += e.qty;
    if (e.plan.toLowerCase().includes('premium')) agg.premium += e.qty;
    agg.nextUps += e.nextUps;
    agg.insurance += e.insurance;
    agg.revenue += total;
    agg.commission += repTotal;

    const ps = personMap.get(e.person) ?? {
      person: e.person, store: e.store, lines: 0, premium: 0, internet: 0, nextUps: 0, insurance: 0, revenue: 0, commission: 0,
    };
    if (phone) ps.lines += e.qty; else ps.internet += e.qty;
    if (e.plan.toLowerCase().includes('premium')) ps.premium += e.qty;
    ps.nextUps += e.nextUps;
    ps.insurance += e.insurance;
    ps.revenue += total;
    ps.commission += repTotal;
    personMap.set(ps.person, ps);

    const pp = agg.perPlan.get(e.plan) ?? { qty: 0, nextUps: 0, revenue: 0 };
    pp.qty += e.qty;
    pp.nextUps += e.nextUps;
    pp.revenue += total;
    agg.perPlan.set(e.plan, pp);

    agg.perDay.set(e.date, (agg.perDay.get(e.date) ?? 0) + total);
  }

  agg.perPerson = Array.from(personMap.values()).sort((a, b) => b.revenue - a.revenue);
  return agg;
}

// ---------------------------------------------------------------------------
// Attendance: marked per person per date in the Daily Tracker
// ---------------------------------------------------------------------------

export type AttendanceStatus = 'P' | 'L' | 'A'; // Present / Late / Absent
export const ATTENDANCE_KEY = 'se-attendance-v1';
export type AttendanceBook = Record<string, Record<string, AttendanceStatus>>; // date -> person -> status

export function loadAttendance(): AttendanceBook {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(ATTENDANCE_KEY) || '{}') as AttendanceBook;
  } catch {
    return {};
  }
}

export function saveAttendance(book: AttendanceBook) {
  localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(book));
}

export function attendanceForDate(book: AttendanceBook, date: string) {
  const day = book[date] ?? {};
  const statuses = Object.values(day);
  return {
    present: statuses.filter(s => s === 'P').length,
    late: statuses.filter(s => s === 'L').length,
    absent: statuses.filter(s => s === 'A').length,
    marked: statuses.length,
  };
}

// Demo data: a few weeks of plausible entries for the current roster
export function generateDemoSales(people: Person[], commission: CommissionState): SaleEntry[] {
  const sellers = people.filter(p => p.role !== 'ASM');
  const plans = [...commission.phonePlans.map(p => p.name), ...commission.internet.map(p => p.name)];
  const entries: SaleEntry[] = [];
  let id = 0;
  // Deterministic pseudo-random so demo data is stable per generation
  let seed = Date.now() % 100000;
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

  for (let day = 0; day < 21; day++) {
    const date = todayStr(-day);
    for (const person of sellers) {
      if (rand() < 0.2) continue; // day off
      const numEntries = 1 + Math.floor(rand() * 2);
      for (let n = 0; n < numEntries; n++) {
        const plan = plans[Math.floor(rand() * plans.length)];
        const qty = 1 + Math.floor(rand() * 5);
        const phone = commission.phonePlans.some(p => p.name === plan);
        const stores = person.stores?.length ? person.stores : ['Costco'];
        entries.push({
          id: `demo-${date}-${person.id}-${id++}`,
          date,
          person: person.name,
          store: stores[Math.floor(rand() * stores.length)],
          plan,
          qty,
          nextUps: phone ? Math.floor(rand() * (qty + 1)) : 0,
          insurance: phone ? Math.floor(rand() * Math.max(1, qty - 1)) : 0,
        });
      }
    }
  }
  return entries;
}
