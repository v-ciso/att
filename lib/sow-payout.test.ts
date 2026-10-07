import assert from 'node:assert/strict';
import { formatCurrency } from './utils';
assert.equal(formatCurrency(99.5), '$99.5');
assert.equal(formatCurrency(28.2), '$28.2');
import { RETAILERS, retailerFor, sowPayout, type PayoutDetails } from './sow-payout';
const entry: PayoutDetails = { date: '2026-10-07', store: 'Costco 1018', plan: 'Value 2.0', qty: 1, nextUps: 0, insurance: 0 };
const price = (changes: Partial<PayoutDetails> = {}) => sowPayout({ ...entry, ...changes }).total;
assert.equal(price(), 99.5);
assert.equal(price({ plan: 'Premium 2.0', ecEligible: true, nextUps: 1, insurance: 1, newLineTier: 5 }), 164.5);
assert.equal(price({ plan: 'Extra 2.0', byod: true, ecEligible: true }), 75);
assert.equal(price({ plan: 'Upgrades', upgradeTier: 1 }), 28.2);
assert.equal(price({ plan: 'Upgrades', store: 'Target 2450', upgradeTier: 2, ecEligible: true }), 49);
assert.equal(price({ plan: 'Internet Air' }), 60);
assert.equal(price({ plan: 'Internet Air', autoBillPay: true, ecEligible: true }), 95);
for (const [plan, withAbp, withoutAbp] of [['Fiber 300', 294, 244], ['Fiber 500', 309, 259], ['Fiber 1GIG', 344, 294], ['Fiber 2GIG', 344, 294], ['Fiber 5GIG', 344, 294]] as const) {
  assert.equal(price({ plan, autoBillPay: true, ecEligible: true }), withAbp + 20);
  assert.equal(price({ plan }), withoutAbp);
}
assert.equal(price({ plan: 'Internet Upgrade', ecEligible: true }), 50);
assert.equal(price({ plan: 'Tablet' }), 20);
assert.equal(price({ plan: 'Tablet', byod: true }), 0);
assert.equal(price({ voipPort: true, ecEligible: true, nextUps: 1 }), 0);
assert.equal(price({ store: 'Unknown location' }), 0);
assert.equal(price({ store: 'Unknown location', retailer: 'Costco' }), 99.5);
assert.equal(retailerFor('Costco Business Center 23'), 'Costco Business Center');
assert.equal(retailerFor("BJ's 42"), 'BJs');
for (const retailer of RETAILERS) {
  for (let tier = 1; tier <= 5; tier++) {
    const base = [99.5, 102.5, 122.5, 180, 175.5, 155.5, 105.5, 105.5, 105.5, 105.5][RETAILERS.indexOf(retailer)];
    assert.equal(price({ retailer, newLineTier: tier, qty: 4 }), (base + (tier - 3) * 5) * 4);
    assert.equal(price({ retailer, newLineTier: tier, nextUps: 1 }) - price({ retailer, newLineTier: tier }), 15, 'tiers must not discount add-ons');
  }
}
assert.equal(price({ protectionFour: 1 }), 139.5);
assert.equal(price({ store: 'Target 100', insurance: 1 }), 180, 'unsupported retailer protection cannot invent money');
assert.equal(sowPayout(entry).warnings.length, 2);
assert.equal(price({ qty: 3, plan: 'Upgrades', upgradeTier: 1 }), 84.6, 'currency rounds to cents');
console.log('SOW payout matrix: tiers, retailers, BYOD, internet, EC, protection, VoIP, and rounding passed');
