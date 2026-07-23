'use client';

import { cn, formatCurrency } from '@/lib/utils';
import { Editable, useLocalState, CommissionState } from './editable-sections';
import { SaleEntry, aggregateSales } from '@/lib/sales';
import { Button } from '@/components/ui/button';
import { Trophy, Gift, Plus, Trash2 } from 'lucide-react';

// Competitions to keep the floor engaged. Have as many as you want — one for
// all stores, or one per store. Each ranks its scope by an editable metric
// over the current month, derived from the Daily Tracker.

type CompMetric = 'lines' | 'premium' | 'internet' | 'nextUps' | 'revenue';
const METRIC_LABELS: Record<CompMetric, string> = {
  lines: 'Phone Lines',
  premium: 'Premium Lines',
  internet: 'Internet',
  nextUps: 'Next Ups',
  revenue: 'Office Generated',
};
const METRIC_ORDER: CompMetric[] = ['lines', 'premium', 'internet', 'nextUps', 'revenue'];

interface Comp {
  id: string;
  title: string;
  prize: string;
  metric: CompMetric;
  store: string; // '' = all stores
}

const DEFAULT_COMPS: Comp[] = [
  { id: 'c1', title: 'Line King of the Month', prize: '$250 bonus + front parking spot', metric: 'lines', store: '' },
];

const RANK_STYLES = ['text-accent-yellow', 'text-text-secondary', 'text-accent-orange'];
const MEDALS = ['🥇', '🥈', '🥉'];

function CompCard({
  comp, sales, commission, storeOptions, compact, onEdit, onRemove,
}: {
  comp: Comp;
  sales: SaleEntry[];
  commission: CommissionState;
  storeOptions: string[];
  compact: boolean;
  onEdit: (patch: Partial<Comp>) => void;
  onRemove: () => void;
}) {
  const agg = aggregateSales(sales, commission, { period: 'monthly', stores: comp.store ? [comp.store] : undefined });
  const metricValue = (p: (typeof agg.perPerson)[number]) =>
    comp.metric === 'revenue' ? p.revenue : (p[comp.metric] as number);

  const ranked = agg.perPerson
    .map(p => ({ person: p.person, store: p.store, value: metricValue(p) }))
    .filter(p => p.value > 0)
    .sort((a, b) => b.value - a.value);

  const fmt = (v: number) => (comp.metric === 'revenue' ? formatCurrency(v) : String(v));
  const monthName = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="p-4 rounded-xl glass border border-border-subtle">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h3 className={cn('font-bold neon-brand flex items-center gap-2', compact ? 'text-base' : 'text-lg')}>
            <Trophy className={compact ? 'w-4 h-4' : 'w-5 h-5'} style={{ color: 'var(--brand)' }} />
            <Editable value={comp.title} onCommit={(v) => onEdit({ title: v.trim() || comp.title })} />
          </h3>
          <p className="text-xs text-text-secondary mt-0.5 flex flex-wrap items-center gap-x-1.5">
            {monthName} · ranked by{' '}
            <button
              onClick={() => onEdit({ metric: METRIC_ORDER[(METRIC_ORDER.indexOf(comp.metric) + 1) % METRIC_ORDER.length] })}
              className="font-medium hover:underline" style={{ color: 'var(--brand)' }}
              title="Click to change the metric"
            >
              {METRIC_LABELS[comp.metric]}
            </button>
            {' · '}
            <select
              value={comp.store}
              onChange={(e) => onEdit({ store: e.target.value })}
              className="bg-bg-tertiary border border-border-subtle rounded px-1.5 py-0.5 text-[11px] text-[color:var(--brand)] focus:outline-none cursor-pointer"
              aria-label="Competition store scope"
            >
              <option value="">All stores</option>
              {storeOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-border-subtle">
            <Gift className="w-4 h-4" style={{ color: 'var(--brand)' }} />
            <Editable value={comp.prize} onCommit={(v) => onEdit({ prize: v.trim() || comp.prize })} className="text-sm font-semibold text-white" />
          </div>
          <button onClick={onRemove} className="p-1.5 rounded-lg text-text-muted hover:text-accent-red hover:bg-accent-red/10 transition-all" aria-label={`Remove ${comp.title}`}>
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {ranked.length === 0 ? (
        <p className="text-xs text-text-muted p-3 rounded-xl bg-white/5 text-center">
          No production {comp.store ? `at ${comp.store}` : ''} this month yet — standings fill in from the Daily Tracker.
        </p>
      ) : (
        <>
          {/* Ranked left-to-right, 1 then 2 then 3. The classic podium puts the
              winner in the MIDDLE, which reads as "he's in second place" to
              anyone glancing at it on a screen during a meeting. Explicit rank
              numbers remove the ambiguity entirely. */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[0, 1, 2].map(slot => {
              const r = ranked[slot];
              if (!r) return <div key={slot} />;
              const heights = compact ? ['h-18', 'h-14', 'h-10'] : ['h-28', 'h-20', 'h-16'];
              return (
                <div key={slot} className="flex flex-col items-center justify-end">
                  <span className="text-2xl mb-1" aria-hidden="true">{MEDALS[slot]}</span>
                  <div className={cn('w-full rounded-t-xl bg-white/5 border border-border-subtle flex flex-col items-center justify-center p-2 gap-0.5', heights[slot])}>
                    <span className={cn('text-[10px] font-bold', RANK_STYLES[slot])}>#{slot + 1}</span>
                    <span className="text-xs font-bold text-center break-words leading-tight w-full">{r.person || '—'}</span>
                    <span className={cn('text-sm font-bold', RANK_STYLES[slot])}>{fmt(r.value)}</span>
                  </div>
                </div>
              );
            })}
          </div>
          {ranked.length > 3 && (
            <div className="space-y-1">
              {ranked.slice(3).map((r, i) => (
                <div key={r.person} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white/[0.03] text-xs">
                  <span className="flex items-center gap-2">
                    <span className="text-text-muted w-5">#{i + 4}</span>
                    <span className="font-medium">{r.person}</span>
                    <span className="text-text-muted text-[10px]">{r.store}</span>
                  </span>
                  <span className="font-semibold" style={{ color: 'var(--brand)' }}>{fmt(r.value)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

let compCounter = 1;

export function Competition({ sales, commission, storeOptions, compact = false }: {
  sales: SaleEntry[];
  commission: CommissionState;
  storeOptions: string[];
  compact?: boolean;
}) {
  const { state: comps, setState: setComps } = useLocalState<Comp[]>('se-competitions-v1', DEFAULT_COMPS);

  const edit = (id: string, patch: Partial<Comp>) =>
    setComps(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)));
  const remove = (id: string) => setComps(prev => (prev.length > 1 ? prev.filter(c => c.id !== id) : prev));
  const add = () =>
    setComps(prev => [...prev, {
      id: `c${Date.now()}-${compCounter++}`,
      title: 'New Competition', prize: 'Prize', metric: 'lines', store: '',
    }]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className={cn('font-bold neon-brand', compact ? 'text-lg' : 'text-xl')}>
          {compact ? 'Competitions' : 'Monthly Competitions'}
        </h2>
        <Button size="sm" onClick={add}><Plus className="w-3.5 h-3.5" /> New Competition</Button>
      </div>
      <div className="space-y-3">
        {comps.map(comp => (
          <CompCard
            key={comp.id}
            comp={comp}
            sales={sales}
            commission={commission}
            storeOptions={storeOptions}
            compact={compact}
            onEdit={(patch) => edit(comp.id, patch)}
            onRemove={() => remove(comp.id)}
          />
        ))}
      </div>
      {!compact && (
        <p className="mt-3 text-xs text-text-secondary">
          Add one for all stores or one per store. Click any title, prize, metric, or store to edit — the same controls appear in Meeting Mode.
        </p>
      )}
    </div>
  );
}
