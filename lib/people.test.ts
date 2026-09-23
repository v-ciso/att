/**
 * Identity + lifecycle helper tests (Phase 4).
 *
 * These guard the rules that keep a rep's history stable across a rename or a
 * rehire: employee codes are assigned once, never reissued (even after retire),
 * are deterministic in array order, and are idempotent so the roster's backfill
 * effect can run on every render without churning. They also pin the lifecycle
 * filters (active vs retired) and the rehire-by-name match that stops a returning
 * employee from getting a duplicate record.
 */
import assert from 'node:assert/strict';
import {
  personStatus, isActive, isRetired, activePeople,
  companyCodePrefix, codeSequence, nextEmployeeCode, assignEmployeeCodes,
  normalizeName, findRehireCandidate,
} from './people';
import type { Person } from '../components/dashboard/roster';

let passed = 0;
function it(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

const person = (over: Partial<Person>): Person =>
  ({ id: over.name ?? 'x', name: 'X', role: 'REP', stores: [], team: '', weeklyProfit: [], attendance: 0, hourlyWeekly: 0, ...over }) as unknown as Person;

console.log('status helpers');

it('treats a person with no status as active (pre-Phase-4 rows)', () => {
  assert.equal(personStatus(person({ name: 'a' })), 'active');
  assert.equal(isActive(person({ name: 'a' })), true);
  assert.equal(isRetired(person({ name: 'a' })), false);
});

it('reads explicit retired/archived status', () => {
  assert.equal(isRetired(person({ name: 'r', status: 'retired' })), true);
  assert.equal(isActive(person({ name: 'r', status: 'retired' })), false);
  assert.equal(isActive(person({ name: 'z', status: 'archived' })), false);
});

it('activePeople excludes retired and archived', () => {
  const list = [
    person({ name: 'a', status: 'active' }),
    person({ name: 'b', status: 'retired' }),
    person({ name: 'c' }),
    person({ name: 'd', status: 'archived' }),
  ];
  assert.deepEqual(activePeople(list).map(p => p.name), ['a', 'c']);
});

console.log('employee codes');

it('derives a 3-char company prefix, letters only', () => {
  assert.equal(companyCodePrefix('Sorami'), 'SOR');
  assert.equal(companyCodePrefix("BJ's Wholesale"), 'BJS');
  assert.equal(companyCodePrefix('AT'), 'ATX'); // padded to 3
  assert.equal(companyCodePrefix('123 !!'), 'EMP'); // no letters -> fallback
  assert.equal(companyCodePrefix(null), 'EMP');
});

it('parses the numeric suffix of a code', () => {
  assert.equal(codeSequence('SOR-0007'), 7);
  assert.equal(codeSequence('DEM-0123'), 123);
  assert.equal(codeSequence('nope'), null);
  assert.equal(codeSequence(undefined), null);
});

it('nextEmployeeCode is one past the highest in use, zero-padded', () => {
  const list = [{ employeeCode: 'SOR-0003' }, { employeeCode: 'SOR-0009' }, { employeeCode: undefined }];
  assert.equal(nextEmployeeCode(list, 'Sorami'), 'SOR-0010');
  assert.equal(nextEmployeeCode([], 'Sorami'), 'SOR-0001');
});

it('assignEmployeeCodes backfills only the missing, deterministically in order', () => {
  const list = [
    person({ name: 'a' }),
    person({ name: 'b', employeeCode: 'DEM-0005' }),
    person({ name: 'c' }),
  ];
  const out = assignEmployeeCodes(list, 'Demo Market');
  assert.equal(out[0].employeeCode, 'DEM-0006'); // continues past the highest (5)
  assert.equal(out[1].employeeCode, 'DEM-0005'); // untouched
  assert.equal(out[2].employeeCode, 'DEM-0007');
});

it('assignEmployeeCodes is idempotent (second run is a no-op)', () => {
  const once = assignEmployeeCodes([person({ name: 'a' }), person({ name: 'b' })], 'Demo Market');
  const twice = assignEmployeeCodes(once, 'Demo Market');
  assert.deepEqual(twice.map(p => p.employeeCode), once.map(p => p.employeeCode));
});

it('never reissues a retired person\'s code', () => {
  const list = [
    person({ name: 'gone', status: 'retired', employeeCode: 'DEM-0002' }),
    person({ name: 'new' }),
  ];
  const out = assignEmployeeCodes(list, 'Demo Market');
  assert.equal(out[1].employeeCode, 'DEM-0003'); // 0002 is taken even though retired
});

console.log('rehire matching');

it('normalizeName trims, collapses whitespace and lower-cases', () => {
  assert.equal(normalizeName('  Andre   Collins '), 'andre collins');
});

it('findRehireCandidate matches a retired person by name, ignoring active ones', () => {
  const list = [
    person({ name: 'Andre Collins', status: 'active' }),
    person({ name: 'Jamie Lee', status: 'retired', employeeCode: 'DEM-0008' }),
  ];
  assert.equal(findRehireCandidate(list, 'jamie lee')?.employeeCode, 'DEM-0008');
  assert.equal(findRehireCandidate(list, 'Andre Collins'), null); // active -> not a rehire
  assert.equal(findRehireCandidate(list, 'nobody'), null);
});

console.log(`\n${passed} passed`);
