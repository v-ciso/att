'use client';

import { useEffect } from 'react';
import { cn, formatCurrency, getInitials } from '@/lib/utils';
import { loadPeople, loadPromoRules, promotionStatus, ROSTER_ROLE_LABELS, ROLE_LADDER } from './roster';
import { Period, PERIOD_LABELS, aggregateSales, loadSales, loadCommission } from '@/lib/sales';

export function ProfileDrawer({ name, period, onClose }: { name: string; period: Period; onClose: () => void }) {
  const person = loadPeople().find(p => p.name.trim().toLowerCase() === name.trim().toLowerCase());
  const rules = loadPromoRules();
  const status = person ? promotionStatus(person, rules) : null;
  const roleIndex = person ? ROLE_LADDER.indexOf(person.role) : -1;
  const profitMax = person ? Math.max(...person.weeklyProfit, rules.profitPerWeek) : 1;

  // Live stats for this person over the selected period, derived from sales entries
  const agg = aggregateSales(loadSales(), loadCommission(), { period });
  const stats = agg.perPerson.find(p => p.person.trim().toLowerCase() === name.trim().toLowerCase());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={`${name} profile`}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg glass border border-border-strong rounded-t-2xl sm:rounded-2xl p-6 animate-scale-in bg-bg-secondary/95 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center font-bold">
              {getInitials(name)}
            </div>
            <div>
              <h3 className="text-lg font-bold">{name}</h3>
              <p className="text-xs text-text-secondary">
                {person
                  ? `${ROSTER_ROLE_LABELS[person.role]} · ${person.store}${person.team ? ` · ${person.team}` : ' · no team'}`
                  : 'Not in roster yet'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-all" aria-label="Close">✕</button>
        </div>

        {/* Period production, derived from the Daily Tracker */}
        <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">{PERIOD_LABELS[period]} Production</p>
        {stats ? (
          <div className="grid grid-cols-5 gap-2 mb-4">
            {[
              { label: 'Lines', value: String(stats.lines), color: 'text-accent-blue' },
              { label: 'Premium', value: String(stats.premium), color: 'text-accent-purple' },
              { label: 'Internet', value: String(stats.internet), color: 'text-accent-cyan' },
              { label: 'Next Up', value: String(stats.nextUps), color: 'text-accent-red' },
              { label: 'Payout', value: formatCurrency(stats.revenue), color: 'text-accent-green' },
            ].map(s => (
              <div key={s.label} className="p-2 rounded-xl bg-white/5 text-center">
                <p className="text-[9px] text-text-muted uppercase tracking-wider">{s.label}</p>
                <p className={cn('text-sm font-bold', s.color)}>{s.value}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-text-muted p-3 rounded-xl bg-white/5 mb-4">
            No sales logged for this period — add them in the <span className="text-accent-blue">Daily Tracker</span>.
          </p>
        )}

        {person && status ? (
          <>
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Leadership Roadmap</p>
            <div className="flex items-center gap-1 mb-4">
              {ROLE_LADDER.map((role, i) => (
                <div key={role} className="flex-1 flex items-center gap-1">
                  <div className={cn(
                    'flex-1 text-center py-1.5 rounded-lg text-[10px] font-semibold border transition-all',
                    i < roleIndex && 'bg-accent-green/10 text-accent-green border-accent-green/30',
                    i === roleIndex && 'bg-accent-blue/20 text-accent-blue border-accent-blue/40 shadow-neon-blue',
                    i > roleIndex && 'bg-white/5 text-text-muted border-border-subtle'
                  )}>
                    {ROSTER_ROLE_LABELS[role]}
                  </div>
                  {i < ROLE_LADDER.length - 1 && <span className="text-text-muted text-[10px]">→</span>}
                </div>
              ))}
            </div>

            <div className={cn('p-3 rounded-xl border mb-4', status.ready ? 'bg-accent-green/10 border-accent-green/30' : 'bg-white/5 border-border-subtle')}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold">{status.ready ? '🎉 ' : ''}{status.label}</span>
                <span className="text-[10px] text-text-muted">
                  needs {formatCurrency(rules.profitPerWeek)}/wk × {rules.weeks} wks + {rules.minAttendance}% attendance
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-bg-tertiary">
                <div className={cn('h-full rounded-full', status.ready ? 'bg-accent-green' : 'bg-gradient-to-r from-accent-blue to-accent-green')} style={{ width: `${status.progress}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-white/5">
                <p className="text-[9px] text-text-muted uppercase tracking-wider mb-2">Weekly Profit (roadmap)</p>
                <div className="flex items-end gap-2 h-14">
                  {person.weeklyProfit.map((w, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full rounded-t bg-accent-green/80" style={{ height: `${Math.max(6, (w / profitMax) * 100)}%`, opacity: w >= rules.profitPerWeek ? 1 : 0.45 }} />
                      <span className="text-[8px] text-text-muted">{formatCurrency(w)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white/5 flex flex-col items-center justify-center">
                <p className="text-[9px] text-text-muted uppercase tracking-wider mb-1">Attendance</p>
                <p className={cn('text-2xl font-bold', person.attendance >= rules.minAttendance ? 'text-accent-green' : 'text-accent-yellow')}>
                  {person.attendance}%
                </p>
                <p className="text-[9px] text-text-muted">target {rules.minAttendance}%</p>
              </div>
            </div>
          </>
        ) : (
          <p className="text-xs text-text-secondary p-3 rounded-xl bg-white/5">
            This rep isn&apos;t in the roster yet. Add them on the <span className="text-accent-blue font-medium">Roster</span> tab
            (same name) to track their store, team, promotions, and leadership roadmap here.
          </p>
        )}
      </div>
    </div>
  );
}
