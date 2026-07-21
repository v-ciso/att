'use client';

import { cn, formatCurrency } from '@/lib/utils';
import { Editable, useLocalState } from './editable-sections';
import { Aggregate } from '@/lib/sales';
import { Trophy, Gift } from 'lucide-react';

// Monthly competition to keep the floor engaged. Ranks everyone by a chosen
// metric over the current month (derived from the Daily Tracker). Title,
// prize, and metric are editable — right here and in Meeting Mode.

type CompMetric = 'lines' | 'premium' | 'internet' | 'nextUps' | 'revenue';
const METRIC_LABELS: Record<CompMetric, string> = {
  lines: 'Phone Lines',
  premium: 'Premium Lines',
  internet: 'Internet',
  nextUps: 'Next Ups',
  revenue: 'Office Generated',
};
const METRIC_ORDER: CompMetric[] = ['lines', 'premium', 'internet', 'nextUps', 'revenue'];

interface CompConfig {
  title: string;
  prize: string;
  metric: CompMetric;
}

const DEFAULT_COMP: CompConfig = {
  title: 'Line King of the Month',
  prize: '$250 bonus + front parking spot',
  metric: 'lines',
};

const RANK_STYLES = ['text-accent-yellow', 'text-text-secondary', 'text-accent-orange'];
const MEDALS = ['🥇', '🥈', '🥉'];

export function Competition({ monthly, compact = false }: { monthly: Aggregate; compact?: boolean }) {
  const { state: cfg, setState: setCfg } = useLocalState<CompConfig>('se-competition-v1', DEFAULT_COMP);

  const metricValue = (p: Aggregate['perPerson'][number]) =>
    cfg.metric === 'revenue' ? p.revenue : (p[cfg.metric] as number);

  const ranked = [...monthly.perPerson]
    .map(p => ({ person: p.person, store: p.store, value: metricValue(p) }))
    .filter(p => p.value > 0)
    .sort((a, b) => b.value - a.value);

  const fmt = (v: number) => (cfg.metric === 'revenue' ? formatCurrency(v) : String(v));
  const monthName = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className={cn('font-bold neon-brand flex items-center gap-2', compact ? 'text-lg' : 'text-xl')}>
            <Trophy className={compact ? 'w-4 h-4' : 'w-5 h-5'} style={{ color: 'var(--brand)' }} />
            <Editable value={cfg.title} onCommit={(v) => setCfg(c => ({ ...c, title: v.trim() || c.title }))} />
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            {monthName} · ranked by{' '}
            <button
              onClick={() => setCfg(c => ({ ...c, metric: METRIC_ORDER[(METRIC_ORDER.indexOf(c.metric) + 1) % METRIC_ORDER.length] }))}
              className="text-accent-blue font-medium hover:underline"
              title="Click to change the metric"
            >
              {METRIC_LABELS[cfg.metric]}
            </button>
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl glass border border-border-subtle">
          <Gift className="w-4 h-4" style={{ color: 'var(--brand)' }} />
          <span className="text-xs text-text-secondary">Prize:</span>
          <Editable value={cfg.prize} onCommit={(v) => setCfg(c => ({ ...c, prize: v.trim() || c.prize }))} className="text-sm font-semibold text-white" />
        </div>
      </div>

      {ranked.length === 0 ? (
        <p className="text-xs text-text-muted p-4 rounded-xl bg-white/5 text-center">
          No production this month yet — log sales in the Daily Tracker and the standings fill in automatically.
        </p>
      ) : (
        <>
          {/* Podium */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[1, 0, 2].map(slot => {
              const r = ranked[slot];
              if (!r) return <div key={slot} />;
              const heights = compact ? ['h-16', 'h-20', 'h-12'] : ['h-20', 'h-28', 'h-16'];
              return (
                <div key={slot} className="flex flex-col items-center justify-end">
                  <span className="text-2xl mb-1">{MEDALS[slot]}</span>
                  <div className={cn('w-full rounded-t-xl glass border border-border-subtle flex flex-col items-center justify-center p-2', heights[slot])}>
                    <span className="text-xs font-bold text-center truncate w-full">{r.person}</span>
                    <span className={cn('text-sm font-bold', RANK_STYLES[slot])}>{fmt(r.value)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rest of the field */}
          {ranked.length > 3 && (
            <div className="space-y-1">
              {ranked.slice(3).map((r, i) => (
                <div key={r.person} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white/[0.03] text-xs">
                  <span className="flex items-center gap-2">
                    <span className="text-text-muted w-5">#{i + 4}</span>
                    <span className="font-medium">{r.person}</span>
                    <span className="text-text-muted text-[10px]">{r.store}</span>
                  </span>
                  <span className="font-semibold text-accent-blue">{fmt(r.value)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {!compact && (
        <p className="mt-3 text-xs text-text-secondary">
          Click the title, prize, or metric to edit — same controls appear in Meeting Mode so you can update it live each morning.
        </p>
      )}
    </div>
  );
}
