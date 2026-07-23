// Run: npm run test:roadtrips
import assert from 'assert';
import { roadtripTotals, shiftDays, isoToday, REIMBURSE_LAG_DAYS } from './roadtrips';

const NOW = new Date('2026-07-22T12:00:00');
const today = isoToday(NOW);
const RATE = 0.6;

// A trip taken today: full cost hits now, nothing has been paid back yet.
{
  const t = roadtripTotals([{ name: 'Orlando', amount: 4200, date: today }], RATE, 'weekly', NOW);
  assert.strictEqual(t.cost, 4200, 'cost lands in the week of the trip');
  assert.strictEqual(t.received, 0, 'reimbursement has NOT arrived yet');
  assert.strictEqual(t.outstanding, 2520, '60% is owed but still in the 14-day wait');
}

// The same trip, 14 days later: the money has landed.
{
  const tripDate = shiftDays(today, -REIMBURSE_LAG_DAYS);
  const t = roadtripTotals([{ name: 'Orlando', amount: 4200, date: tripDate }], RATE, 'weekly', NOW);
  assert.strictEqual(t.cost, 0, 'the cost is now outside the 7-day window');
  assert.strictEqual(t.received, 2520, 'reimbursement is recognized on day 14');
  assert.strictEqual(t.outstanding, 0, 'nothing outstanding once paid');
}

// The regression this replaced: cost and reimbursement must NOT net out in the
// same window. A trip taken today leaves the week genuinely down $4,200.
{
  const t = roadtripTotals([{ name: 'Orlando', amount: 4200, date: today }], RATE, 'weekly', NOW);
  assert.strictEqual(t.received - t.cost, -4200, 'the week of a trip is cash-flow negative');
}

// Monthly view sees both halves when the trip is old enough.
{
  const tripDate = shiftDays(today, -20);
  const t = roadtripTotals([{ name: 'Tampa', amount: 1000, date: tripDate }], RATE, 'monthly', NOW);
  assert.strictEqual(t.cost, 1000, 'cost is inside the 30-day window');
  assert.strictEqual(t.received, 600, 'reimbursement (day 14) is also inside it');
}

// Pre-existing saved rows have no date — treated as today, never as revenue.
{
  const t = roadtripTotals([{ name: 'Legacy', amount: 500 }], RATE, 'monthly', NOW);
  assert.strictEqual(t.cost, 500);
  assert.strictEqual(t.received, 0, 'undated rows must not fabricate received money');
  assert.strictEqual(t.outstanding, 300);
}

// A future-dated trip is a plan, not a cost yet.
{
  const t = roadtripTotals([{ name: 'Planned', amount: 900, date: shiftDays(today, 5) }], RATE, 'monthly', NOW);
  assert.strictEqual(t.cost, 0, 'a trip that has not happened costs nothing yet');
  assert.strictEqual(t.received, 0);
  assert.strictEqual(t.outstanding, 540, 'still owed once it happens');
}

// Rate is applied to the reimbursement only, never to the cost.
{
  const t = roadtripTotals([{ name: 'Zero-rate', amount: 800, date: today }], 0, 'weekly', NOW);
  assert.strictEqual(t.cost, 800, 'a 0% rate still costs full price');
  assert.strictEqual(t.outstanding, 0);
}

console.log('roadtrips: all checks passed');
