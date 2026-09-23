// Unit tests for the derived rep lifetime history.
// Pure functions over plain data, so no DB and no React - run with
// `npm run test:rep-history`.
import {
  attendanceHistory,
  tenureTimeline,
  tenureDays,
  storesWorked,
  salesSpan,
} from './rep-history';
import type { AttendanceBook, SaleEntry } from './sales';
import type { Person } from '@/components/dashboard/roster';

let failures = 0;
function check(label: string, cond: boolean) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`);
  if (!cond) failures++;
}

// --- attendanceHistory -----------------------------------------------------

const book: AttendanceBook = {
  '2026-07-20': { 'Sarah Johnson': 'P', 'Mike Chen': 'A' },
  '2026-07-21': { 'Sarah Johnson': { status: 'L', markedBy: 'mgr', markedAt: 'x' } },
  '2026-07-22': {
    'Sarah Johnson': { status: 'E', markedBy: 'mgr', markedAt: 'y', editedFrom: 'A' },
  },
  '2026-07-23': { 'Sarah Johnson': 'P' },
  '2026-07-24': { 'Sarah Johnson': 'P' },
};

const h = attendanceHistory(book, 'Sarah Johnson');
check('counts only the requested person', h.tracked === 5);
check('tallies each status', h.counts.P === 3 && h.counts.L === 1 && h.counts.E === 1 && h.counts.A === 0);
check('newest day first', h.days[0].date === '2026-07-24');
// P(3) + E(1) + L(0.5) = 4.5 / 5 = 90%
check('reliability gives Late half credit', h.pct === 90);
check('present streak counts back from today only', h.presentStreak === 2);
check('surfaces corrected marks', h.corrections.length === 1 && h.corrections[0].editedFrom === 'A');
check('keeps the audit trail', h.days[0].markedBy === undefined && h.corrections[0].markedBy === 'mgr');

const legacy = attendanceHistory({ '2026-07-20': { Bob: 'P' } }, 'Bob');
check('reads legacy bare-string marks', legacy.tracked === 1 && legacy.pct === 100);

check('untracked rep reports 0 rather than NaN', attendanceHistory(book, 'Nobody').pct === 0);
check('whitespace-insensitive name match', attendanceHistory(book, '  sarah   johnson ').tracked === 5);
check('empty book is safe', attendanceHistory({}, 'Sarah Johnson').tracked === 0);

// A rep who is Absent every day should read 0%, not silently pass.
const allAbsent = attendanceHistory({ d1: { X: 'A' }, d2: { X: 'A' } }, 'X');
check('all-absent reads 0%', allAbsent.pct === 0 && allAbsent.presentStreak === 0);

// --- tenureTimeline / tenureDays ------------------------------------------

const rehired = {
  hiredAt: '2024-01-10',
  retiredAt: '2026-03-01',
  retiredReason: 'Moved out of state',
  rehiredAt: ['2025-06-01'],
  status: 'retired' as const,
};

const tl = tenureTimeline(rehired);
check('timeline is chronological', tl.map(e => e.kind).join(',') === 'hired,rehired,retired');
check('retire event carries the reason', tl[2].note === 'Moved out of state');
check('no hire date yields no events', tenureTimeline({ hiredAt: undefined, retiredAt: undefined, retiredReason: undefined, rehiredAt: undefined }).length === 0);

check('tenure measures to retirement for a retired rep', tenureDays(rehired) === 781);
check(
  'tenure measures to today for an active rep',
  tenureDays({ hiredAt: '2026-07-01', status: 'active', retiredAt: undefined, rehiredAt: undefined }, new Date('2026-07-28T00:00:00Z')) === 27
);
check('missing hire date returns null, not 0', tenureDays({ hiredAt: undefined, status: 'active', retiredAt: undefined, rehiredAt: undefined }) === null);
check('garbage hire date returns null', tenureDays({ hiredAt: 'not-a-date', status: 'active', retiredAt: undefined, rehiredAt: undefined }) === null);
// A retired-but-no-date rep must fall back to today rather than going negative.
check(
  'retired with no date falls back to today',
  (tenureDays({ hiredAt: '2026-07-01', status: 'retired', retiredAt: undefined, rehiredAt: undefined }, new Date('2026-07-10T00:00:00Z')) ?? -1) === 9
);

// --- storesWorked / salesSpan ---------------------------------------------

const sales = [
  { id: '1', date: '2026-07-02', person: 'Sarah Johnson', store: 'Costco 1018', lines: 2 },
  { id: '2', date: '2026-07-05', person: 'Sarah Johnson', store: 'Target 2450', lines: 1 },
  { id: '3', date: '2026-07-09', person: 'Mike Chen', store: "BJ's 610", lines: 3 },
  { id: '4', date: '2026-07-01', person: 'Sarah Johnson', store: 'Costco 1018', lines: 1 },
] as unknown as SaleEntry[];

const person = { name: 'Sarah Johnson', stores: ['Costco 1018', 'Costco 1020'] } as Pick<Person, 'name' | 'stores'>;
const worked = storesWorked(sales, person);
check('unions assigned stores with stores actually sold in', worked.join('|') === 'Costco 1018|Costco 1020|Target 2450');
check("excludes another rep's store", !worked.includes("BJ's 610"));

const span = salesSpan(sales, 'Sarah Johnson');
check('sales span finds earliest and latest', span?.first === '2026-07-01' && span?.last === '2026-07-05');
check('no sales yields null span', salesSpan(sales, 'Nobody') === null);

console.log(failures === 0 ? '\nAll rep-history tests passed.' : `\n${failures} test(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
