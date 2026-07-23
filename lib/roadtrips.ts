// Roadtrip money: a ONE-TIME charge the office fronts, reimbursed by the parent
// company about two weeks later. Cost and reimbursement land in DIFFERENT
// periods, so they are never netted against each other in the same window.
//
// Pure functions, no React — see roadtrips.test.ts for the check.

export const REIMBURSE_LAG_DAYS = 14;

export type PnlView = 'daily' | 'weekly' | 'monthly' | 'yearly';

// "The last N days ending today" — the same windows lib/sales.ts uses for
// derived sales, so both halves of the P&L agree on what "this week" means.
const VIEW_WINDOW_DAYS: Record<PnlView, number> = { daily: 1, weekly: 7, monthly: 30, yearly: 365 };

export interface RoadtripItem {
  name: string;
  amount: number;
  date?: string; // YYYY-MM-DD; missing on pre-existing saved data → today
}

export interface RoadtripTotals {
  /** Cost incurred inside the window — the full hit, paid up front. */
  cost: number;
  /** Reimbursements actually RECEIVED inside the window (trip date + lag). */
  received: number;
  /** Owed but still inside the wait — not revenue yet. */
  outstanding: number;
}

export function isoToday(now = new Date()): string {
  return toIso(now);
}

function toIso(d: Date): string {
  // Local calendar date, not UTC: a trip logged at 8pm EST is still that day.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Whole days from `dateStr` until `now`. Negative = the date is in the future. */
export function daysSince(dateStr: string, now = new Date()): number {
  const then = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(then.getTime())) return 0;
  const today = new Date(now);
  today.setHours(12, 0, 0, 0);
  return Math.round((today.getTime() - then.getTime()) / 86400000);
}

export function shiftDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  d.setDate(d.getDate() + days);
  return toIso(d);
}

export function inWindow(dateStr: string, view: PnlView, now = new Date()): boolean {
  const age = daysSince(dateStr, now);
  return age >= 0 && age < VIEW_WINDOW_DAYS[view];
}

export function roadtripTotals(
  trips: RoadtripItem[],
  rate: number,
  view: PnlView,
  now = new Date()
): RoadtripTotals {
  return trips.reduce<RoadtripTotals>((acc, trip) => {
    const date = trip.date || isoToday(now);
    const amount = Number(trip.amount) || 0;
    const payDate = shiftDays(date, REIMBURSE_LAG_DAYS);
    const paid = daysSince(payDate, now) >= 0;

    if (inWindow(date, view, now)) acc.cost += amount;
    if (paid && inWindow(payDate, view, now)) acc.received += amount * rate;
    if (!paid) acc.outstanding += amount * rate;
    return acc;
  }, { cost: 0, received: 0, outstanding: 0 });
}
