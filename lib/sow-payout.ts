import { canonicalPlan } from '@/lib/production-post';

export const SOW_EFFECTIVE_DATE = '2026-09-01';
export const RETAILERS = ['Costco', 'Costco Business Center', 'BJs', 'Target', 'Fred Meyer', 'Kroger', 'HEB', 'AAFES', 'BrandsMart', 'Walmart'] as const;
export type Retailer = typeof RETAILERS[number];
export interface PayoutDetails {
  date: string; store: string; plan: string; qty: number; nextUps: number; insurance: number;
  retailer?: Retailer; newLineTier?: number; upgradeTier?: number; byod?: boolean;
  autoBillPay?: boolean; ecEligible?: boolean; protectionFour?: number; voipPort?: boolean;
}
export function retailerFor(store: string): Retailer | undefined {
  const text = store.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (text.includes('costcobusiness')) return 'Costco Business Center';
  return RETAILERS.find(retailer => text.includes(retailer.toLowerCase().replace(/[^a-z0-9]/g, '')));
}
const baseTier3: Record<Retailer, number> = { Costco: 99.5, 'Costco Business Center': 102.5, BJs: 122.5, Target: 180, 'Fred Meyer': 175.5, Kroger: 155.5, HEB: 105.5, AAFES: 105.5, BrandsMart: 105.5, Walmart: 105.5 };
const byodBase: Record<Retailer, number> = { Costco: 50, 'Costco Business Center': 55, BJs: 75, Target: 58, 'Fred Meyer': 56, Kroger: 56, HEB: 56, AAFES: 56, BrandsMart: 56, Walmart: 56 };
const count = (value: number | undefined, max = Infinity) => Math.min(max, Math.max(0, Math.floor(Number(value) || 0)));

/** Office estimates only. Unknown eligibility never earns a conditional bonus. */
export function sowPayout(entry: PayoutDetails) {
  const parts: { label: string; amount: number }[] = [];
  const warnings: string[] = [];
  const qty = count(entry.qty);
  const add = (label: string, units: number, rate: number) => { if (units && rate) parts.push({ label: `${units} × ${label} @ $${rate.toFixed(2)}`, amount: Math.round(units * rate * 100) / 100 }); };
  const plan = canonicalPlan(entry.plan).toLowerCase();
  const retailer = entry.retailer ?? retailerFor(entry.store);
  let base = 0;
  let ec = 0;
  const internet = /fiber|internet/.test(plan);
  const upgrade = plan === 'upgrades';
  const accessory = /tablet|wearable/.test(plan);
  if (entry.voipPort && !internet) return { total: 0, parts, warnings: ['VoIP ports are disqualified from payment.'] };
  if (internet) {
    if (/upgrade/.test(plan)) base = 50;
    else if (/air/.test(plan)) { base = entry.autoBillPay ? 90 : 60; ec = 5; }
    else {
      const rates = /(?:1gig|2gig|5gig|1000)/.test(plan) ? [344, 294] : /500/.test(plan) ? [309, 259] : /300/.test(plan) ? [294, 244] : /100/.test(plan) ? [99, 79] : /50|75/.test(plan) ? [89, 69] : /3-49/.test(plan) ? [29, 9] : null;
      if (rates) { base = rates[entry.autoBillPay ? 0 : 1]; ec = 20; }
      else warnings.push('Internet product has no rate in the supplied SOW.');
    }
    if (entry.autoBillPay === undefined && !/upgrade/.test(plan)) warnings.push('Autopay unknown: using the no-autopay rate.');
  } else if (accessory) {
    base = entry.byod ? 0 : 20;
  } else if (!retailer) {
    warnings.push('Select a supported retailer before this wireless sale can be priced.');
  } else if (upgrade) {
    const tier = entry.upgradeTier === 1 ? 1 : 2;
    base = retailer === 'Costco' ? (tier === 1 ? 28.2 : 32) : (tier === 1 ? 35.2 : 39);
    ec = 10;
    if (entry.upgradeTier === undefined) warnings.push('Upgrade tier not supplied: SOW default tier 2 estimated.');
  } else if (/premium|extra|value|starter|byod|new line|port/.test(plan)) {
    const tier = Math.min(5, Math.max(1, entry.newLineTier ?? 3));
    base = entry.byod || /byod/.test(plan) ? byodBase[retailer] : baseTier3[retailer] + (tier - 3) * 5;
    if (!entry.byod && !/byod/.test(plan) && entry.newLineTier === undefined) warnings.push('New-line tier not supplied: SOW default tier 3 estimated.');
    add('Unlimited feature bonus', qty, /premium/.test(plan) ? 15 : /extra/.test(plan) ? 10 : 0);
    ec = 15;
  } else warnings.push('Product has no rate in the supplied SOW.');
  add(`${entry.plan} base`, qty, base);
  if (ec && entry.ecEligible) add('Eligible EC bonus', qty, ec);
  if (ec && entry.ecEligible === undefined) warnings.push('EC eligibility unknown: bonus excluded.');
  if (!internet && !accessory && retailer && base) {
    add('Next Up', count(entry.nextUps, qty), 15);
    if (['Costco', 'Costco Business Center', 'BJs', 'Kroger'].includes(retailer)) {
      const four = count(entry.protectionFour, qty);
      add('Protect Advantage 4', four, 40);
      add('Protect Advantage 1', count(entry.insurance, qty - four), 10);
    } else if (entry.insurance || entry.protectionFour) warnings.push('Protection payout is not specified for this retailer.');
  }
  return { total: Math.round(parts.reduce((sum, part) => sum + part.amount, 0) * 100) / 100, parts, warnings };
}
