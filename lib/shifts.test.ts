// Run: npm run test:shifts
import assert from 'assert';
import { storeCoverage } from './shifts';

// Closed store: never flagged, whatever is (or isn't) scheduled.
assert.strictEqual(storeCoverage([], true).status, 'closed');
assert.strictEqual(storeCoverage(['AM'], true).status, 'closed');

// Nobody scheduled and not closed = the loud one.
assert.strictEqual(storeCoverage([], false).status, 'unstaffed');

// The owner's example: one PM shift and nothing else -> morning is open.
assert.strictEqual(storeCoverage(['PM'], false).status, 'gap');
assert.strictEqual(storeCoverage(['PM'], false).label, 'No morning coverage');

// AM only -> evening open.
assert.strictEqual(storeCoverage(['AM'], false).status, 'gap');

// One person full day: covered, but thin -> confirm.
assert.strictEqual(storeCoverage(['FULL'], false).status, 'thin');

// Two people covering both halves = fine.
assert.strictEqual(storeCoverage(['AM', 'PM'], false).status, 'ok');
// The staffed example (2 AM, 1 swing, 2 PM) = ok.
assert.strictEqual(storeCoverage(['AM', 'AM', 'SWING', 'PM', 'PM'], false).status, 'ok');
// Two full-day people = ok (both halves, >1 body).
assert.strictEqual(storeCoverage(['FULL', 'FULL'], false).status, 'ok');
// A swing alone does not open or close the store.
assert.strictEqual(storeCoverage(['SWING'], false).status, 'gap');

// Body counts are right (FULL counts toward both halves).
const c = storeCoverage(['FULL', 'AM', 'PM'], false);
assert.strictEqual(c.am, 2);   // FULL + AM
assert.strictEqual(c.pm, 2);   // FULL + PM
assert.strictEqual(c.total, 3);

console.log('shifts: all checks passed');
