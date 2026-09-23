import type { SaleEntry } from './sales';

export function canonicalPlan(name: string): string {
  const compact = name.trim().toLowerCase().replace(/\s+/g, ' ');
  if (/^(?:fiber|internet)\s*(?:1000|1\s*g(?:ig|bps)?)(?:\s*mbps)?$/i.test(compact)) return 'Fiber 1GIG';
  if (/^(?:🅿️?|p|premium(?: 2\.0)?)$/iu.test(compact)) return 'Premium 2.0';
  if (/^(?:x|extra(?: 2\.0)?)$/i.test(compact)) return 'Extra 2.0';
  if (/^(?:\$|v|value(?: 2\.0)?)$/i.test(compact)) return 'Value 2.0';
  if (/^upgrades?$/i.test(compact)) return 'Upgrades';
  return name.trim();
}

export function productionPlanLabel(plan: string): string {
  const name = canonicalPlan(plan);
  if (name === 'Premium 2.0') return '🅿️ Premium 2.0';
  if (name === 'Extra 2.0') return 'X Extra 2.0';
  if (name === 'Value 2.0') return 'V Value 2.0';
  if (name === 'Fiber 1GIG') return 'Fiber 1000';
  return name;
}

export function productionWindow(anchor: string, period: 'daily' | 'weekly') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor)) throw new Error('Choose a valid production date.');
  const date = new Date(`${anchor}T12:00:00Z`);
  if (!Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== anchor) throw new Error('Choose a valid production date.');
  if (period === 'daily') return { start: anchor, end: anchor };
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  const start = date.toISOString().slice(0, 10);
  date.setUTCDate(date.getUTCDate() + 6);
  return { start, end: date.toISOString().slice(0, 10) };
}

export function formatProductionPost(sales: SaleEntry[], options: { date: string; period: 'daily' | 'weekly'; stores?: string[] }) {
  const { start, end } = productionWindow(options.date, options.period);
  const stores = new Set(options.stores?.map(store => store.toLowerCase()));
  const entries = sales.filter(entry => entry.date >= start && entry.date <= end && (!stores.size || stores.has(entry.store.toLowerCase())));
  const heading = options.period === 'daily' ? `DAILY PRODUCTION · ${start}` : `WEEKLY PRODUCTION · ${start} – ${end} (Mon–Sun)`;
  const lines = [heading, options.stores?.length ? options.stores.join(' / ') : 'All stores'];
  const reps = [...new Set(entries.map(entry => entry.person))].sort((a, b) => a.localeCompare(b));
  let newLines = 0, upgrades = 0, internet = 0, nextUps = 0, insurance = 0, bundles = 0;
  for (const person of reps) {
    lines.push('', person);
    const groups = new Map<string, number>();
    for (const entry of entries.filter(row => row.person === person)) {
      const plan = canonicalPlan(entry.plan);
      const label = plan === 'Upgrades' ? `Upgrade / ${entry.upgradePlan ? productionPlanLabel(entry.upgradePlan) : 'plan not recorded'}` : productionPlanLabel(plan);
      const group = `${label} · ${entry.store}`;
      groups.set(group, (groups.get(group) ?? 0) + entry.qty);
      if (plan === 'Upgrades') upgrades += entry.qty;
      else if (/fiber|internet|^air$/i.test(plan)) internet += entry.qty;
      else newLines += entry.qty;
      nextUps += entry.nextUps || 0;
      insurance += entry.insurance || 0;
      if (entry.nextUps) groups.set('Next Up', (groups.get('Next Up') ?? 0) + entry.nextUps);
      if (entry.insurance) groups.set('Insurance', (groups.get('Insurance') ?? 0) + entry.insurance);
      if (entry.convergedQty) {
        bundles += entry.convergedQty;
        const amount = entry.convergedBonusPerBundle;
        const bonus = typeof amount === 'number' && Number.isFinite(amount) && amount >= 0 ? `$${amount.toFixed(2)} office bonus each` : 'office bonus pending';
        const bundleLabel = `Converged fiber + wireless bundle · ${bonus}`;
        groups.set(bundleLabel, (groups.get(bundleLabel) ?? 0) + entry.convergedQty);
      }
    }
    for (const [label, qty] of groups) {
      lines.push(label.startsWith('Upgrade / ') ? `Upgrade ${qty} / ${label.slice('Upgrade / '.length)}` : `${qty} ${label}`);
    }
  }
  lines.push('', entries.length ? `TOTAL · ${newLines} new lines · ${upgrades} upgrades · ${internet} internet\n${nextUps} Next Up · ${insurance} insurance · ${bundles} converged bundles` : 'No production logged for this period.');
  lines.push('Tracker activity only — not confirmed DD or rep pay.');
  return lines.join('\n');
}
