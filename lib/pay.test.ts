// Run: npm run test:pay
// Locks the payout model down. It has been corrected several times, and every
// number here came from the owner directly.
import assert from 'assert';
import { computePay, computeOfficeTake } from './pay';
import { DEFAULT_COMMISSION } from '../components/dashboard/editable-sections';
import type { SaleEntry } from './sales';
import type { Person } from '../components/dashboard/roster';

// aggregateSales reads localStorage for late clock-outs and the schedule.
(globalThis as unknown as { window?: unknown }).window = undefined;

const C = DEFAULT_COMMISSION;
const today = new Date().toISOString().slice(0, 10);

const person = (name: string, role: Person['role'], team = ''): Person => ({
  id: name, name, role, stores: ['Costco 1018'], team, weeklyProfit: [], attendance: 100,
});

const sale = (who: string, plan: string, qty: number): SaleEntry => ({
  id: `${who}-${plan}-${qty}`, date: today, person: who, store: 'Costco 1018',
  plan, qty, nextUps: 0, insurance: 0,
});

// --- Office payout per line, at Tier 5 -------------------------------------
{
  const find = (n: string) => C.phonePlans.find(p => p.name === n)!;
  assert.strictEqual(find('Value 2.0').payout, 124, 'Value 2.0 office payout');
  assert.strictEqual(find('Extra 2.0').payout, 134, 'Extra 2.0 office payout');
  assert.strictEqual(find('Premium 2.0').payout, 144, 'Premium 2.0 office payout');
  assert.strictEqual(C.addOns.find(p => p.name === 'Next Up Anytime')!.payout, 15, 'Next Up adds $15');
  // A Value line with Next Up attached is what the owner quotes as $139.
  assert.strictEqual(find('Value 2.0').payout + 15, 139, 'Value + Next Up = $139');
}

// --- A rep earns a flat $40 a line, regardless of plan ---------------------
{
  const people = [person('Rep', 'REP')];
  const sales = [sale('Rep', 'Premium 2.0', 10)];
  const pay = computePay(people[0], { sales, commission: C, people, period: 'daily' });
  assert.strictEqual(pay.base, 400, 'rep: 10 lines x $40');
  assert.strictEqual(pay.bump, 0, 'a rep gets no per-line bump');
  assert.strictEqual(pay.override, 0, 'a rep gets no override');
}

// --- A Lead earns $45 a line on their OWN lines only -----------------------
{
  const people = [person('Lead', 'LEAD', 'Alpha'), person('Rep', 'REP', 'Alpha')];
  const sales = [sale('Lead', 'Value 2.0', 10), sale('Rep', 'Value 2.0', 10)];
  const pay = computePay(people[0], { sales, commission: C, people, period: 'daily' });
  assert.strictEqual(pay.base, 400, 'lead base: 10 x $40');
  assert.strictEqual(pay.bump, 50, 'lead bump: 10 x $5');
  assert.strictEqual(pay.total, 450, 'lead nets $45/line = $450');
  assert.strictEqual(pay.override, 0, 'a lead earns nothing off the reps');
}

// --- An ASM earns $45 on their own lines AND 3% of the whole team ----------
// This is the regression that mattered: only the override used to apply, so an
// ASM who sold personally was paid $40 a line instead of $45.
{
  const asm = person('Asm', 'ASM');
  const rep = person('Rep', 'REP', 'Alpha');
  const people = [asm, rep];
  const sales = [sale('Asm', 'Value 2.0', 10), sale('Rep', 'Value 2.0', 10)];
  const pay = computePay(asm, { sales, commission: C, people, period: 'daily' });
  assert.strictEqual(pay.base, 400, 'asm base: 10 x $40');
  assert.strictEqual(pay.bump, 50, 'asm own-line bump: 10 x $5 -> $45/line');
  assert.ok(pay.total >= 450, 'asm nets at least $45/line on own production');
}

// --- The office keeps the remainder, and it is derived, never typed --------
{
  const lead = person('Lead', 'LEAD', 'Alpha');
  const rep = person('Rep', 'REP', 'Alpha');
  const people = [lead, rep];
  const sales = [sale('Lead', 'Value 2.0', 10), sale('Rep', 'Value 2.0', 10)];
  const take = computeOfficeTake({ sales, commission: C, people, period: 'daily' });

  assert.strictEqual(take.generated, 20 * 124, 'office generated: 20 lines x $124');
  assert.strictEqual(take.repPay, 20 * 40, 'rep pay: 20 lines x $40');
  assert.strictEqual(take.leadBumps, 50, 'lead bump on 10 own lines');
  assert.strictEqual(
    take.owner,
    take.generated - take.repPay - take.leadBumps - take.asmOverrides,
    'owner is exactly the remainder'
  );
  assert.strictEqual(take.owner, 2480 - 800 - 50, 'owner keeps $1,630');
  assert.ok(take.margin > 0 && take.margin < 100, 'margin is a sane percentage');
}

// --- Nobody is ever paid more than the office collected --------------------
{
  const people = [person('A', 'ASM'), person('B', 'LEAD', 'Alpha'), person('C', 'REP', 'Alpha')];
  const sales = [sale('A', 'Value 2.0', 5), sale('B', 'Value 2.0', 5), sale('C', 'Value 2.0', 5)];
  const take = computeOfficeTake({ sales, commission: C, people, period: 'daily' });
  assert.ok(take.owner >= 0, `office take went negative: ${take.owner}`);
}

console.log('pay: all checks passed');
