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

export type Period = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all';

export const PERIOD_LABELS: Record<Period, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
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

// Cross-component reactivity: any write dispatches this so every view (which
// listens in the dashboard) recomputes immediately — no stale stores/sales.
export function notifyDataChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('se:data'));
}

export function saveSales(entries: SaleEntry[]) {
  localStorage.setItem(SALES_KEY, JSON.stringify(entries));
  notifyDataChanged();
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
    if (typeof state.latePenaltyPerLine !== 'number') state.latePenaltyPerLine = 15;
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
  if (period === 'monthly') return diffDays >= 0 && diffDays < 30;
  return diffDays >= 0 && diffDays < 365; // yearly
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
  const qty = Number(entry.qty) || 0;
  const nextUps = Number(entry.nextUps) || 0;
  const insurance = Number(entry.insurance) || 0;
  const planPer = planPayout(commission, entry.plan, entry.store);
  if (qty > 0) parts.push({ label: `${qty} × ${entry.plan} @ $${planPer} office`, amount: qty * planPer });
  if (nextUps > 0) {
    const per = planPayout(commission, 'Next Up Anytime', entry.store);
    parts.push({ label: `${nextUps} × Next Up @ $${per} office`, amount: nextUps * per });
  }
  if (insurance > 0) {
    const per = planPayout(commission, 'Insurance', entry.store);
    parts.push({ label: `${insurance} × Insurance @ $${per} office`, amount: insurance * per });
  }
  const repTotal =
    qty * planPayout(commission, entry.plan, entry.store, 'rep') +
    nextUps * planPayout(commission, 'Next Up Anytime', entry.store, 'rep') +
    insurance * planPayout(commission, 'Insurance', entry.store, 'rep');
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
  revenue: number;     // office total generated (direct deposit), net of chargebacks
  commission: number;  // the rep's cut at the owner's typed rates, net of chargebacks
  chargebacks: number; // GPS late clock-out charges attributed to this rep
}

export interface Aggregate {
  lines: number; // phone lines
  premium: number;
  internet: number;
  nextUps: number;
  insurance: number;
  revenue: number;     // office total generated, net of chargebacks
  commission: number;  // total rep commissions, net of chargebacks
  chargebacks: number; // total late clock-out charges in the window
  perPerson: PersonStats[]; // sorted by revenue desc
  perPlan: Map<string, { qty: number; nextUps: number; revenue: number; commission: number }>;
  perDay: Map<string, number>; // date -> office revenue
}

// ---------------------------------------------------------------------------
// Late clock-outs: { date: [{ person, store }] } — the GPS chargeback marks
// ---------------------------------------------------------------------------

export interface LateOut { person: string; store: string }
export type LateOutBook = Record<string, LateOut[]>;
export const LATEOUT_KEY = 'se-lateouts-v1';

export function loadLateOuts(): LateOutBook {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(LATEOUT_KEY) || '{}') as LateOutBook;
  } catch {
    return {};
  }
}

export function saveLateOuts(book: LateOutBook) {
  localStorage.setItem(LATEOUT_KEY, JSON.stringify(book));
  notifyDataChanged();
}

// Schedule lookup: which store a rep is scheduled at on a given date ('' = none)
export function scheduledStore(person: string, date: string): string {
  if (typeof window === 'undefined') return '';
  try {
    const sched = JSON.parse(localStorage.getItem('se-schedule-v1') || '{}') as Record<string, Record<string, string>>;
    const v = sched[date]?.[person];
    // value is "store|SHIFT" (or 'OFF'/legacy plain store)
    return v && v !== 'OFF' ? v.split('|')[0] : '';
  } catch {
    return '';
  }
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
    lines: 0, premium: 0, internet: 0, nextUps: 0, insurance: 0, revenue: 0, commission: 0, chargebacks: 0,
    perPerson: [], perPlan: new Map(), perDay: new Map(),
  };
  const personMap = new Map<string, PersonStats>();
  // store|date -> PHONE LINES sold that day at that store. The GPS late
  // clock-out charge is per line only (internet does not count); if a store
  // did zero lines that day there is no chargeback.
  const storeDayLines = new Map<string, number>();

  for (const e of filtered) {
    // Defensive: skip malformed entries (missing plan/store/person) so one bad
    // record can never crash the whole dashboard.
    if (!e || !e.plan || !e.store || !e.person) continue;
    const qty = Number(e.qty) || 0;
    const nextUps = Number(e.nextUps) || 0;
    const insurance = Number(e.insurance) || 0;
    const phone = isPhonePlan(commission, e.plan);
    const { total, repTotal } = entryRevenue(e, commission);
    if (phone) {
      agg.lines += qty;
      const key = `${e.store.toLowerCase()}|${e.date}`;
      storeDayLines.set(key, (storeDayLines.get(key) ?? 0) + qty);
    } else {
      agg.internet += qty;
    }
    if (e.plan.toLowerCase().includes('premium')) agg.premium += qty;
    agg.nextUps += nextUps;
    agg.insurance += insurance;
    agg.revenue += total;
    agg.commission += repTotal;

    const ps = personMap.get(e.person) ?? {
      person: e.person, store: e.store, lines: 0, premium: 0, internet: 0, nextUps: 0, insurance: 0, revenue: 0, commission: 0, chargebacks: 0,
    };
    if (phone) ps.lines += qty; else ps.internet += qty;
    if (e.plan.toLowerCase().includes('premium')) ps.premium += qty;
    ps.nextUps += nextUps;
    ps.insurance += insurance;
    ps.revenue += total;
    ps.commission += repTotal;
    personMap.set(ps.person, ps);

    const pp = agg.perPlan.get(e.plan) ?? { qty: 0, nextUps: 0, revenue: 0, commission: 0 };
    pp.qty += qty;
    pp.nextUps += nextUps;
    pp.revenue += total;
    pp.commission += repTotal;
    agg.perPlan.set(e.plan, pp);

    agg.perDay.set(e.date, (agg.perDay.get(e.date) ?? 0) + total);
  }

  // GPS late clock-out chargebacks: penalty × the store's lines that day,
  // split between everyone who clocked out late at that store that day.
  // Deducted from the late rep's generated AND commission (their paycheck),
  // and from the office totals — AT&T charges the office for the whole day.
  const lateBook = loadLateOuts();
  const rate = commission.latePenaltyPerLine ?? 15;
  for (const [date, lateOuts] of Object.entries(lateBook)) {
    const dateIncluded = opts.date ? date === opts.date : inPeriod(date, opts.period);
    if (!dateIncluded) continue;
    // group by store to split between that store's late reps
    const byStore = new Map<string, LateOut[]>();
    for (const lo of lateOuts) {
      if (storeSet && !storeSet.has(lo.store.toLowerCase())) continue;
      const key = lo.store.toLowerCase();
      byStore.set(key, [...(byStore.get(key) ?? []), lo]);
    }
    for (const [storeKey, group] of Array.from(byStore.entries())) {
      const linesThatDay = storeDayLines.get(`${storeKey}|${date}`) ?? 0;
      if (linesThatDay === 0) continue; // no lines → no chargeback
      const chargePerRep = (linesThatDay * rate) / group.length;
      for (const lo of group) {
        const ps = personMap.get(lo.person) ?? {
          person: lo.person, store: lo.store, lines: 0, premium: 0, internet: 0, nextUps: 0, insurance: 0, revenue: 0, commission: 0, chargebacks: 0,
        };
        ps.chargebacks += chargePerRep;
        ps.revenue -= chargePerRep;
        ps.commission -= chargePerRep;
        personMap.set(ps.person, ps);
        agg.chargebacks += chargePerRep;
        agg.revenue -= chargePerRep;
        agg.commission -= chargePerRep;
      }
    }
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
  notifyDataChanged();
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
