// Derived lifetime history for a single rep.
//
// Every number here is COMPUTED from data that already exists — sales entries,
// the attendance book, the roster row's lifecycle fields. Nothing in this file
// stores anything, and nothing here should ever be persisted back: duplicating
// a rep's totals into their profile is exactly how the old pre-formatted
// competition strings drifted out of sync with reality. If a sale is corrected
// in the Daily Tracker, the profile has to move with it, so the profile reads
// through these helpers on every render instead of caching.
//
// No React, no storage, no server imports — pure functions over plain data, so
// the same code serves the drawer, a future export, and the unit tests.
import type { Person } from '@/components/dashboard/roster';
import { personStatus } from '@/lib/people';
import {
  type AttendanceBook,
  type AttendanceStatus,
  type AttendanceMark,
  type SaleEntry,
  markOf,
  markStatus,
} from '@/lib/sales';

// --- Attendance ------------------------------------------------------------

export interface AttendanceDay {
  date: string;
  status: AttendanceStatus;
  /** Audit trail, when the mark was written after the trail existed. */
  markedBy?: string;
  markedAt?: string;
  editedFrom?: AttendanceStatus;
}

export interface AttendanceHistory {
  /** Every marked day for this rep, newest first. */
  days: AttendanceDay[];
  counts: Record<AttendanceStatus, number>;
  /** Days with any mark at all. 0 means "never tracked". */
  tracked: number;
  /**
   * Reliability %: Present and Excused both count as kept commitments, Late
   * counts as half, Absent as zero. Matches the roster's promotion maths so a
   * rep can't show 90% here and 70% on the roadmap.
   */
  pct: number;
  /** Consecutive most-recent days marked Present, for a "on a roll" signal. */
  presentStreak: number;
  /** Marks that were corrected after the fact, newest first. */
  corrections: AttendanceDay[];
}

const EMPTY_COUNTS: Record<AttendanceStatus, number> = { P: 0, L: 0, A: 0, E: 0 };

/**
 * Pull one rep's full attendance record out of the book.
 *
 * The book is keyed date -> person NAME (that predates employee codes), so this
 * takes the name to match on and normalises it the same way everywhere else
 * does. Legacy bare-string marks are read through markStatus/markOf so days
 * recorded before the audit trail still count.
 */
export function attendanceHistory(book: AttendanceBook, name: string): AttendanceHistory {
  const target = String(name ?? '').trim().toLowerCase();
  const days: AttendanceDay[] = [];

  for (const [date, byPerson] of Object.entries(book ?? {})) {
    for (const [person, stored] of Object.entries(byPerson ?? {})) {
      if (person.trim().toLowerCase() !== target) continue;
      const status = markStatus(stored);
      if (!status) continue;
      const audit: AttendanceMark | undefined = markOf(stored);
      days.push({
        date,
        status,
        markedBy: audit?.markedBy,
        markedAt: audit?.markedAt,
        editedFrom: audit?.editedFrom,
      });
    }
  }

  days.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); // newest first

  const counts = { ...EMPTY_COUNTS };
  for (const d of days) counts[d.status] += 1;

  const tracked = days.length;
  const credit = counts.P + counts.E + counts.L * 0.5;
  const pct = tracked === 0 ? 0 : Math.round((credit / tracked) * 100);

  let presentStreak = 0;
  for (const d of days) {
    if (d.status === 'P') presentStreak += 1;
    else break;
  }

  return {
    days,
    counts,
    tracked,
    pct,
    presentStreak,
    corrections: days.filter(d => d.editedFrom && d.editedFrom !== d.status),
  };
}

// --- Tenure timeline -------------------------------------------------------

export type TimelineKind = 'hired' | 'rehired' | 'retired';

export interface TimelineEvent {
  kind: TimelineKind;
  date: string;
  note?: string;
}

/**
 * Hire / rehire / retire events in chronological order.
 *
 * Deliberately limited to what the roster actually records. A full role-ladder
 * history (promoted from RSC to Lead on such a date) needs an append-only audit
 * log, which lands in Phase 7 — inventing one from the current role would be a
 * guess, and a profile that guesses is worse than one that says nothing.
 */
export function tenureTimeline(person: Pick<Person, 'hiredAt' | 'retiredAt' | 'retiredReason' | 'rehiredAt'>): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  if (person.hiredAt) events.push({ kind: 'hired', date: person.hiredAt });
  for (const d of person.rehiredAt ?? []) {
    if (d) events.push({ kind: 'rehired', date: d });
  }
  if (person.retiredAt) {
    events.push({ kind: 'retired', date: person.retiredAt, note: person.retiredReason || undefined });
  }
  return events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * Whole days between the first hire date and either retirement or today.
 * Returns null when there is no hire date to measure from, so the UI can stay
 * silent rather than render a confident "0 days".
 */
export function tenureDays(
  person: Pick<Person, 'hiredAt' | 'retiredAt' | 'rehiredAt' | 'status'>,
  today = new Date()
): number | null {
  if (!person.hiredAt) return null;
  const start = Date.parse(`${person.hiredAt}T00:00:00Z`);
  if (Number.isNaN(start)) return null;
  const endSource = personStatus(person) === 'retired' && person.retiredAt ? person.retiredAt : null;
  const end = endSource ? Date.parse(`${endSource}T00:00:00Z`) : today.getTime();
  if (Number.isNaN(end) || end < start) return 0;
  return Math.floor((end - start) / 86_400_000);
}

// --- Stores worked ---------------------------------------------------------

/**
 * Every store this rep has actually rung a sale in, plus their currently
 * assigned stores. Union of the two: a rep who just transferred has an assigned
 * store with no sales yet, and a rep who covered a shift elsewhere has sales in
 * a store they were never assigned to. Both belong on a lifetime record.
 */
export function storesWorked(sales: SaleEntry[], person: Pick<Person, 'name' | 'stores'>): string[] {
  const target = String(person.name ?? '').trim().toLowerCase();
  const set = new Set<string>();
  for (const s of person.stores ?? []) {
    if (s) set.add(s);
  }
  for (const s of sales ?? []) {
    if (s.store && s.person?.trim().toLowerCase() === target) set.add(s.store);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/** Date of this rep's first and most recent recorded sale, or null. */
export function salesSpan(sales: SaleEntry[], name: string): { first: string; last: string } | null {
  const target = String(name ?? '').trim().toLowerCase();
  const dates = (sales ?? [])
    .filter(s => s.person?.trim().toLowerCase() === target && s.date)
    .map(s => s.date)
    .sort();
  if (!dates.length) return null;
  return { first: dates[0], last: dates[dates.length - 1] };
}
