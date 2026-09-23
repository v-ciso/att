/**
 * Attendance model tests.
 *
 * The point of these is the storage migration. Marks used to be a bare string
 * ('P') and now carry an audit trail ({ status, markedBy, markedAt }). Both
 * shapes have to stay readable forever, because a book written before the change
 * still sits in real browsers. A reader that indexes the raw value instead of
 * going through markStatus() silently treats an object as "no mark" — or worse,
 * counts the day but scores it zero. That is exactly the bug this file guards.
 */
import assert from 'node:assert/strict';
import { markStatus, markOf, attendanceForDate, type AttendanceBook } from './sales';
import { summarise } from '../components/dashboard/attendance-sheet';
import type { Person } from '../components/dashboard/roster';

let passed = 0;
function it(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

const person = (name: string): Person =>
  ({ id: name, name, role: 'rep', stores: ['S1'], team: 'A', weeklyProfit: [], attendance: 0, hourlyWeekly: 0 }) as unknown as Person;

console.log('markStatus / markOf');

it('reads the legacy bare-string mark', () => {
  assert.equal(markStatus('P'), 'P');
  assert.deepEqual(markOf('L'), { status: 'L' });
});

it('reads the audited object mark', () => {
  assert.equal(markStatus({ status: 'A', markedBy: 'sam', markedAt: 't' }), 'A');
  assert.equal(markOf({ status: 'E' })?.status, 'E');
});

it('treats missing marks as undefined rather than throwing', () => {
  assert.equal(markStatus(undefined), undefined);
  assert.equal(markStatus(null), undefined);
  assert.equal(markOf(undefined), undefined);
});

console.log('attendanceForDate');

it('counts a day that mixes legacy strings and audited objects', () => {
  const book: AttendanceBook = {
    '2026-01-05': {
      a: 'P',
      b: { status: 'P', markedBy: 'x', markedAt: 't' },
      c: 'L',
      d: { status: 'A', markedBy: 'x', markedAt: 't' },
      e: { status: 'E', markedBy: 'x', markedAt: 't' },
    },
  };
  const s = attendanceForDate(book, '2026-01-05');
  assert.equal(s.present, 2, 'object marks must count, not just strings');
  assert.equal(s.late, 1);
  assert.equal(s.absent, 1);
  assert.equal(s.excused, 1);
  assert.equal(s.marked, 5);
});

console.log('summarise');

const people = [person('Marcus'), person('Jasmine'), person('Andre')];

/** Build a book over the N days ending at `end`. */
function book(end: string, spec: Record<string, (i: number) => unknown>): AttendanceBook {
  const out: AttendanceBook = {};
  for (let i = 0; i < 14; i++) {
    const d = new Date(`${end}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    out[key] = {};
    for (const [name, f] of Object.entries(spec)) {
      const v = f(i);
      if (v) (out[key] as Record<string, unknown>)[name] = v;
    }
  }
  return out;
}

it('scores audited object marks identically to legacy strings', () => {
  const end = '2026-01-14';
  // Marcus: 8 Present + 2 Absent as OBJECTS. Jasmine: the same mix as STRINGS.
  const b = book(end, {
    Marcus: i => (i < 10 ? { status: i < 8 ? 'P' : 'A', markedBy: 'x', markedAt: 't' } : null),
    Jasmine: i => (i < 10 ? (i < 8 ? 'P' : 'A') : null),
  });
  const [m, j] = summarise(people, 'month', b, end);
  assert.equal(m.present, 8, 'object marks must be counted');
  assert.equal(m.absent, 2);
  assert.equal(m.score, 80, 'object marks must score the same as strings');
  assert.equal(j.score, 80);
  assert.equal(m.score, j.score, 'storage shape must not change the score');
});

it('weights Late at half a day', () => {
  const end = '2026-01-14';
  const b = book(end, { Marcus: i => (i < 8 ? (i < 4 ? 'P' : 'L') : null) });
  const [m] = summarise(people, 'month', b, end);
  assert.equal(m.present, 4);
  assert.equal(m.late, 4);
  assert.equal(m.score, 75); // (4 + 4*0.5) / 8
});

it('excludes Excused from the score instead of scoring it zero', () => {
  const end = '2026-01-14';
  // 2 Present + 3 Excused. Excused must leave the score at 100, not drag it to 40.
  const b = book(end, {
    Marcus: i => (i < 5 ? { status: i < 2 ? 'P' : 'E', markedBy: 'x', markedAt: 't' } : null),
  });
  const [m] = summarise(people, 'month', b, end);
  assert.equal(m.present, 2);
  assert.equal(m.excused, 3);
  assert.equal(m.score, 100, 'an approved absence must not read as unreliability');
  assert.equal(m.marked, 5, 'excused days are still shown as marked');
});

it('reports an unmarked rep as zero rather than NaN', () => {
  const [, , andre] = summarise(people, 'month', {}, '2026-01-14');
  assert.equal(andre.marked, 0);
  assert.equal(andre.score, 0);
  assert.ok(!Number.isNaN(andre.score));
});

it('ignores marks outside the requested span', () => {
  const b: AttendanceBook = {
    '2025-01-01': { Marcus: 'A' }, // far outside
    '2026-01-14': { Marcus: 'P' },
  };
  const [m] = summarise(people, 'month', b, '2026-01-14');
  assert.equal(m.absent, 0, 'stale marks must not leak into the window');
  assert.equal(m.present, 1);
});

console.log(`\n${passed} assertions passed`);
