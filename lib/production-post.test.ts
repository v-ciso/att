import assert from 'node:assert/strict';
import { canonicalPlan, formatProductionPost, productionWindow } from './production-post';
import { entryRevenue, planPayout } from './sales';
import { DEFAULT_COMMISSION } from '../components/dashboard/editable-sections';
import type { SaleEntry } from './sales';
import { normalizeRole, promotionStatus, DEFAULT_PROMO_RULES, DEFAULT_PEOPLE } from '../components/dashboard/roster';

const base: SaleEntry = { id: 'a', date: '2026-09-21', person: 'Ben', store: 'Costco 1018', plan: 'Premium 2.0', qty: 2, nextUps: 1, insurance: 0 };
const sales: SaleEntry[] = [base,
  { ...base, id: 'b', plan: 'Upgrades', qty: 1, nextUps: 0, upgradePlan: 'Premium 2.0' },
  { ...base, id: 'c', plan: 'Fiber 1000', qty: 1, nextUps: 0, convergedQty: 1, convergedBonusPerBundle: 50 },
  { ...base, id: 'd', date: '2026-09-27', plan: 'Extra 2.0', qty: 1, nextUps: 0 },
  { ...base, id: 'e', date: '2026-09-28', person: 'Excluded' },
];
assert.equal(canonicalPlan('🅿️'), 'Premium 2.0');
assert.equal(canonicalPlan('X'), 'Extra 2.0');
assert.equal(canonicalPlan('$'), 'Value 2.0');
assert.equal(canonicalPlan('Fiber 1000'), 'Fiber 1GIG');
assert.deepEqual(productionWindow('2026-09-27', 'weekly'), { start: '2026-09-21', end: '2026-09-27' });
assert.throws(() => productionWindow('2026-02-30', 'daily'));
const daily = formatProductionPost(sales, { date: '2026-09-21', period: 'daily' });
assert.match(daily, /2 🅿️ Premium 2.0/);
assert.match(daily, /Upgrade 1 \/ 🅿️ Premium 2.0/);
assert.match(daily, /1 Fiber 1000/);
assert.match(daily, /TOTAL · 2 new lines · 1 upgrades · 1 internet/);
assert.match(daily, /\$50.00 office bonus each/);
assert.doesNotMatch(daily, /Excluded|Extra/);
assert.match(formatProductionPost(sales, { date: '2026-09-24', period: 'weekly' }), /3 new lines/);
assert.match(formatProductionPost(sales, { date: '2026-09-21', period: 'daily', stores: ['Other store'] }), /No production/);
assert.match(formatProductionPost([{ ...sales[2], convergedBonusPerBundle: undefined }], { date: '2026-09-21', period: 'daily' }), /bonus pending/);
assert.equal(planPayout(DEFAULT_COMMISSION, 'Fiber 1000', undefined, 'office', 'AT&T Retail EDM'), 360);
assert.equal(entryRevenue(sales[2], DEFAULT_COMMISSION).total, 410);
assert.equal(entryRevenue({ ...sales[2], convergedBonusPerBundle: undefined }, DEFAULT_COMMISSION).total, 360);
assert.equal(entryRevenue({ ...sales[2], convergedBonusPerBundle: -50 }, DEFAULT_COMMISSION).total, 360);
assert.equal(entryRevenue({ ...sales[2], convergedQty: 20 }, DEFAULT_COMMISSION).total, 410);
assert.equal(entryRevenue(sales[2], DEFAULT_COMMISSION).repTotal, 40);
assert.equal(entryRevenue({ ...sales[1], upgradePlanBonus: 15 }, DEFAULT_COMMISSION).total, 75);
assert.equal(entryRevenue({ ...sales[1], upgradePlanBonus: 15 }, DEFAULT_COMMISSION).repTotal, 15);
assert.equal(normalizeRole('OWNER'), 'OWNER');
assert.equal(promotionStatus({ ...DEFAULT_PEOPLE[0], role: 'OWNER' }, DEFAULT_PROMO_RULES).nextRole, null);
assert.equal(promotionStatus({ ...DEFAULT_PEOPLE[0], role: 'ASM' }, DEFAULT_PROMO_RULES).nextRole, null);
console.log('Production sharing, aliases, dates, upgrades, converged bonuses and owner role passed.');
