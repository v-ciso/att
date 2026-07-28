'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn, formatCurrency } from '@/lib/utils';
import { Editable, useLocalState, CommissionState } from './editable-sections';
import { SaleEntry, aggregateSales } from '@/lib/sales';
import { Button } from '@/components/ui/button';
import { Trophy, Gift, Plus, Trash2, Archive, History } from 'lucide-react';
import { useConfirm } from '@/hooks/use-confirm';
import { useAnnounce } from '@/components/a11y/announcer';
import { useActor } from '@/lib/use-actor';
import { can } from '@/lib/permissions';
import { normalizeName } from '@/lib/people';
import { archiveEntity } from '@/lib/archive-client';
import {
  fetchCompetitions, createCompetitionApi, updateCompetitionApi, endCompetitionApi,
  type CompetitionDTO,
} from '@/lib/competitions-client';

// Competitions to keep the floor engaged. Live comps are a derived view over
// live sales (config only, in TenantData). Ending one FREEZES the full numeric
// standings into first-class per-company tables via /api/competitions, so the
// historical record survives a resync or a rename — no more pre-formatted
// "$1,240" strings or unconfirmed permanent deletes.

type CompMetric = 'lines' | 'premium' | 'internet' | 'nextUps' | 'revenue';
const METRIC_LABELS: Record<CompMetric, string> = {
  lines: 'Phone Lines',
  premium: 'Premium Lines',
  internet: 'Internet',
  nextUps: 'Next Ups',
  revenue: 'Office Generated',
};
const METRIC_ORDER: CompMetric[] = ['lines', 'premium', 'internet', 'nextUps', 'revenue'];

// A live competition's config. Standings are always recomputed from sales, so
// nothing numeric is persisted here — only the definition.
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
const MEDALS = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];

// A minimal person shape for name -> stable id resolution, read from the roster.
interface RosterPerson { id: string; name: string; employeeCode?: string }

interface RankedRow { personId: string; personName: string; store: string; value: number }

function CompCard({
  comp, sales, commission, storeOptions, compact, canManage, resolveId, onEdit, onRemove, onEnd,
}: {
  comp: Comp;
  sales: SaleEntry[];
  commission: CommissionState;
  storeOptions: string[];
  compact: boolean;
  canManage: boolean;
  resolveId: (name: string) => string;
  onEdit: (patch: Partial<Comp>) => void;
  onRemove: () => void;
  onEnd: (ranked: RankedRow[], metric: CompMetric) => void;
}) {
  const agg = aggregateSales(sales, commission, { period: 'monthly', stores: comp.store ? [comp.store] : undefined });
  const metricValue = (p: (typeof agg.perPerson)[number]) =>
    comp.metric === 'revenue' ? p.revenue : (p[comp.metric] as number);

  const ranked: RankedRow[] = agg.perPerson
    .map(p => ({ personName: p.person, personId: resolveId(p.person), store: p.store, value: metricValue(p) }))
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
            {canManage ? (
              <Editable label="Competition title" value={comp.title} onCommit={(v) => onEdit({ title: v.trim() || comp.title })} />
            ) : (
              <span>{comp.title}</span>
            )}
          </h3>
          <p className="text-xs text-text-secondary mt-0.5 flex flex-wrap items-center gap-x-1.5">
            {monthName} {'\u00B7'} ranked by{' '}
            {canManage ? (
              <button
                onClick={() => onEdit({ metric: METRIC_ORDER[(METRIC_ORDER.indexOf(comp.metric) + 1) % METRIC_ORDER.length] })}
                className="font-medium hover:underline" style={{ color: 'var(--brand)' }}
                title="Click to change the metric"
              >
                {METRIC_LABELS[comp.metric]}
              </button>
            ) : (
              <span className="font-medium" style={{ color: 'var(--brand)' }}>{METRIC_LABELS[comp.metric]}</span>
            )}
            {' \u00B7 '}
            {canManage ? (
              <select
                value={comp.store}
                onChange={(e) => onEdit({ store: e.target.value })}
                className="bg-bg-tertiary border border-border-subtle rounded px-1.5 py-0.5 text-[11px] text-[color:var(--brand)] focus:outline-none cursor-pointer"
                aria-label="Competition store scope"
              >
                <option value="">All stores</option>
                {storeOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <span style={{ color: 'var(--brand)' }}>{comp.store || 'All stores'}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-border-subtle">
            <Gift className="w-4 h-4" style={{ color: 'var(--brand)' }} />
            {canManage ? (
              <Editable label="Competition prize" value={comp.prize} onCommit={(v) => onEdit({ prize: v.trim() || comp.prize })} className="text-sm font-semibold text-white" />
            ) : (
              <span className="text-sm font-semibold text-white">{comp.prize}</span>
            )}
          </div>
          {!compact && canManage && (
            <button
              onClick={() => onEnd(ranked, comp.metric)}
              className="px-2 py-1.5 rounded-lg text-[11px] text-accent-green border border-accent-green/40 hover:bg-accent-green/10 transition-all"
              title="Freeze the final standings to history and end this competition"
            >
              End &amp; save
            </button>
          )}
          {canManage && (
            <button onClick={onRemove} className="p-1.5 rounded-lg text-text-muted hover:text-accent-red hover:bg-accent-red/10 transition-all" aria-label={`Archive ${comp.title} to recycle bin`} title="Archive to recycle bin (restorable)">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {ranked.length === 0 ? (
        <p className="text-xs text-text-muted p-3 rounded-xl bg-white/5 text-center">
          No production {comp.store ? `at ${comp.store}` : ''} this month yet — standings fill in from the Daily Tracker.
        </p>
      ) : (
        <>
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
                    <span className="text-xs font-bold text-center break-words leading-tight w-full">{r.personName || '\u2014'}</span>
                    <span className={cn('text-sm font-bold', RANK_STYLES[slot])}>{fmt(r.value)}</span>
                  </div>
                </div>
              );
            })}
          </div>
          {ranked.length > 3 && (
            <div className="space-y-1">
              {ranked.slice(3).map((r, i) => (
                <div key={r.personId} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white/[0.03] text-xs">
                  <span className="flex items-center gap-2">
                    <span className="text-text-muted w-5">#{i + 4}</span>
                    <span className="font-medium">{r.personName}</span>
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

// -- Past competitions history, read from the API ---------------------------

function fmtValue(metric: string, v: number) {
  return metric === 'revenue' ? formatCurrency(v) : String(v);
}

function PastCompetitions({ items, loading }: { items: CompetitionDTO[]; loading: boolean }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [store, setStore] = useState('');

  const stores = useMemo(() => {
    const s = new Set<string>();
    for (const c of items) if (c.store) s.add(c.store);
    return Array.from(s).sort();
  }, [items]);

  const filtered = useMemo(() => items.filter(c => {
    const ended = c.endedAt ? c.endedAt.slice(0, 10) : (c.periodEnd?.slice(0, 10) ?? '');
    if (from && ended && ended < from) return false;
    if (to && ended && ended > to) return false;
    if (store && (c.store ?? 'All stores') !== store) return false;
    return true;
  }), [items, from, to, store]);

  return (
    <div className="mt-5 pt-4 border-t border-border-subtle">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-text-secondary flex items-center gap-1.5">
          <History className="w-4 h-4" aria-hidden="true" /> Past competitions
        </h3>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1">
            <span className="text-text-muted">From</span>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="bg-bg-tertiary border border-border-subtle rounded px-1.5 py-1 text-xs" aria-label="Filter from date" />
          </label>
          <label className="flex items-center gap-1">
            <span className="text-text-muted">To</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="bg-bg-tertiary border border-border-subtle rounded px-1.5 py-1 text-xs" aria-label="Filter to date" />
          </label>
          <select value={store} onChange={e => setStore(e.target.value)} className="bg-bg-tertiary border border-border-subtle rounded px-1.5 py-1 text-xs" aria-label="Filter by store">
            <option value="">All stores</option>
            {stores.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-text-muted p-3">Loading history…</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-text-muted p-3 rounded-xl bg-white/[0.03]">No ended competitions match these filters.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => {
            const winner = c.standings.find(s => s.rank === 1) ?? c.standings[0];
            const runnersUp = c.standings.filter(s => s.rank === 2 || s.rank === 3).sort((a, b) => a.rank - b.rank);
            const endedOn = c.endedAt ? c.endedAt.slice(0, 10) : (c.periodEnd?.slice(0, 10) ?? '—');
            return (
              <div key={c.id} className="p-3 rounded-xl bg-white/[0.03] border border-border-subtle">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold">
                    {c.title}{' '}
                    <span className="text-xs text-text-muted font-normal">
                      {'\u00B7'} {c.store ?? 'All stores'} {'\u00B7'} {METRIC_LABELS[c.metric as CompMetric] ?? c.metric} {'\u00B7'} ended {endedOn}
                    </span>
                  </span>
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent-green/15 text-accent-green border border-accent-green/25">
                    Saved
                  </span>
                </div>
                {winner && (
                  <p className="text-xs text-text-secondary mt-1">
                    {MEDALS[0]} {winner.personName} ({fmtValue(c.metric, winner.value)})
                    {runnersUp[0] && ` \u00B7 ${MEDALS[1]} ${runnersUp[0].personName} (${fmtValue(c.metric, runnersUp[0].value)})`}
                    {runnersUp[1] && ` \u00B7 ${MEDALS[2]} ${runnersUp[1].personName} (${fmtValue(c.metric, runnersUp[1].value)})`}
                  </p>
                )}
                <p className="text-[10px] text-text-muted mt-0.5">Prize: {c.prize} {'\u00B7'} {c.standings.length} ranked</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Competition({ sales, commission, storeOptions, compact = false }: {
  sales: SaleEntry[];
  commission: CommissionState;
  storeOptions: string[];
  compact?: boolean;
}) {
  const { state: comps, setState: setComps } = useLocalState<Comp[]>('se-competitions-v1', DEFAULT_COMPS, []);
  // Roster, read-only here, only to resolve a sales name to a stable personId so
  // frozen standings survive a later rename. Unmatched names fall back to the
  // normalized name as the id, which is stable enough for a one-off entry.
  const { state: people } = useLocalState<RosterPerson[]>('se-people-v1', [], []);
  const [past, setPast] = useState<CompetitionDTO[]>([]);
  const [pastLoading, setPastLoading] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const { confirm, confirmDialog } = useConfirm();
  const announce = useAnnounce();
  const actor = useActor();
  const canManage = can(actor, 'competition.manage');

  const resolveId = useCallback((name: string): string => {
    const key = normalizeName(name);
    const match = people.find(p => normalizeName(p.name) === key);
    return match?.id ?? `name:${key}`;
  }, [people]);

  const loadPast = useCallback(async () => {
    setPastLoading(true);
    try {
      setPast(await fetchCompetitions('ended'));
    } finally {
      setPastLoading(false);
    }
  }, []);

  // Load history once the panel is first opened, and refresh after an end-save.
  useEffect(() => {
    if (showPast) void loadPast();
  }, [showPast, loadPast]);

  const edit = (id: string, patch: Partial<Comp>) =>
    setComps(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)));

  // Removing a competition archives it to the company recycle bin rather than
  // hard-deleting it: nothing in this app is unrecoverable. The live standings
  // are derived from sales so they are not frozen here (that is what "End &
  // save" is for) — but the comp's own setup is restorable if this was a
  // mis-click. Local config is dropped only after the server confirms.
  const remove = async (id: string) => {
    const c = comps.find(x => x.id === id);
    if (!c) return;
    if (!(await confirm({
      title: `Archive the "${c.title}" competition?`,
      description: 'Its standings are NOT frozen into history — use "End & save" for that. The setup moves to the recycle bin, where an owner can restore it.',
      confirmLabel: 'Archive competition',
      destructive: true,
    }))) return;
    const saved = await archiveEntity({ kind: 'COMPETITION', refId: c.id, label: c.title, payload: c });
    if (!saved) {
      await confirm({
        title: 'Archive failed',
        description: `"${c.title}" could not be moved to the recycle bin, so it is still on the floor. You may not have permission, or the connection dropped.`,
        confirmLabel: 'OK',
        hideCancel: true,
      });
      return;
    }
    setComps(prev => prev.filter(x => x.id !== id));
  };

  // End & save: create the comp server-side if it only ever lived client-side,
  // then freeze the full numeric standings and flip it to 'ended'. The live
  // config is only removed once the server confirms — a failed save keeps the
  // comp on the floor so no results are lost.
  const endAndSave = async (comp: Comp, ranked: RankedRow[], metric: CompMetric) => {
    if (!ranked.length && !(await confirm({
      title: 'End with no standings?',
      description: 'There is no production recorded for this competition yet. Ending it now saves an empty result. Continue?',
      confirmLabel: 'End anyway',
    }))) return;

    const created = await createCompetitionApi({
      title: comp.title, prize: comp.prize, metric, store: comp.store || null,
    });
    if (!created) {
      announce('Could not save the competition. It is still on the floor.');
      await confirm({
        title: 'Save failed',
        description: 'The competition could not be frozen to history, so it is still active. You may not have permission, or the connection dropped. Try again.',
        confirmLabel: 'OK', hideCancel: true,
      });
      return;
    }
    const standings = ranked.map((r, i) => ({
      personId: r.personId, personName: r.personName, store: r.store || null,
      rank: i + 1, value: r.value, metric,
    }));
    const ended = await endCompetitionApi(created.id, standings);
    if (!ended) {
      announce('Standings could not be saved. The competition is still on the floor.');
      await confirm({
        title: 'Save failed',
        description: 'The final standings could not be frozen. The competition is still active so you can try ending it again.',
        confirmLabel: 'OK', hideCancel: true,
      });
      return;
    }
    setComps(prev => (prev.length > 1 ? prev.filter(x => x.id !== comp.id) : prev));
    announce(`${comp.title} ended and saved to history.`);
    setShowPast(true);
    void loadPast();
  };

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
        <div className="flex items-center gap-2">
          {!compact && (
            <Button variant={showPast ? 'primary' : 'secondary'} size="sm" aria-pressed={showPast} onClick={() => setShowPast(v => !v)}>
              <History className="w-3.5 h-3.5" /> History
            </Button>
          )}
          {canManage && <Button size="sm" onClick={add}><Plus className="w-3.5 h-3.5" /> New Competition</Button>}
        </div>
      </div>
      <div className="space-y-3">
        {comps.length === 0 && (
          <p className="text-sm text-text-muted p-4 rounded-xl bg-white/[0.03] text-pretty">
            {canManage
              ? 'No competitions running. Start one to get the floor moving \u2014 standings fill in automatically from the Daily Tracker.'
              : 'No competitions are running right now.'}
          </p>
        )}
        {comps.map(comp => (
          <CompCard
            key={comp.id}
            comp={comp}
            sales={sales}
            commission={commission}
            storeOptions={storeOptions}
            compact={compact}
            canManage={canManage}
            resolveId={resolveId}
            onEdit={(patch) => edit(comp.id, patch)}
            onRemove={() => remove(comp.id)}
            onEnd={(ranked, metric) => endAndSave(comp, ranked, metric)}
          />
        ))}
      </div>

      {showPast && !compact && <PastCompetitions items={past} loading={pastLoading} />}

      {!compact && (
        <p className="mt-3 text-xs text-text-secondary flex items-center gap-1.5">
          <Archive className="w-3.5 h-3.5" aria-hidden="true" />
          &quot;End &amp; save&quot; freezes the full standings into your company history; it is never deleted.
        </p>
      )}

      {confirmDialog}
    </div>
  );
}
