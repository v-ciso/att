'use client';

import { useEffect, useState } from 'react';
import { cn, formatCurrency } from '@/lib/utils';
import { Plus, Trash2, Smartphone, Wifi, Gift, Users, DollarSign, Receipt, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ---------------------------------------------------------------------------
// Shared: localStorage-backed state + inline-editable value
// ---------------------------------------------------------------------------

export function useLocalState<T>(key: string, defaultValue: T) {
  const [state, setState] = useState<T>(defaultValue);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) setState(JSON.parse(saved));
    } catch {
      // corrupted storage — keep defaults
    }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (loaded) localStorage.setItem(key, JSON.stringify(state));
  }, [state, loaded, key]);

  const reset = () => {
    setState(defaultValue);
    localStorage.removeItem(key);
  };

  return { state, setState, reset } as const;
}

export function parseNum(value: string): number {
  const n = parseFloat(value.replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

interface EditableProps {
  value: string;
  onCommit: (value: string) => void;
  className?: string;
}

export function Editable({ value, onCommit, className }: EditableProps) {
  return (
    <span
      contentEditable
      suppressContentEditableWarning
      className={cn('outline-none focus:bg-white/10 focus:px-1 rounded transition-colors cursor-text', className)}
      onBlur={(e) => onCommit(e.currentTarget.textContent ?? '')}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          (e.currentTarget as HTMLElement).blur();
        }
      }}
    >
      {value}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Commission / payout engine
// ---------------------------------------------------------------------------

interface PayItem {
  name: string;
  payout: number; // $ at the TOP tier (Tier 5)
}

interface RoleRule {
  name: string;
  amount: number;
  unit: string;
}

interface StoreRule {
  name: string;
  multiplier: number;
}

interface CommissionState {
  tier: number; // 1..5 — payouts drop by tierDelta per tier below 5
  tierDelta: number;
  storeIndex: number;
  stores: StoreRule[];
  phonePlans: PayItem[];
  addOns: PayItem[];
  internet: PayItem[];
  roles: RoleRule[];
}

const DEFAULT_COMMISSION: CommissionState = {
  tier: 5,
  tierDelta: 5,
  storeIndex: 0,
  stores: [
    { name: 'Costco', multiplier: 1.0 },
    { name: 'Target', multiplier: 1.0 },
    { name: "BJ's", multiplier: 1.0 },
  ],
  phonePlans: [
    { name: 'Premium 2.0', payout: 35 },
    { name: 'Extra 2.0', payout: 30 },
    { name: 'Value 2.0', payout: 20 },
    { name: 'Upgrades', payout: 15 },
  ],
  addOns: [
    { name: 'Next Up Anytime', payout: 10 },
    { name: 'Insurance', payout: 7 },
  ],
  internet: [
    { name: 'Internet Air', payout: 20 },
    { name: 'Fiber 300', payout: 25 },
    { name: 'Fiber 500', payout: 35 },
    { name: 'Fiber 1GIG', payout: 50 },
    { name: 'Fiber 2GIG', payout: 75 },
    { name: 'Fiber 5GIG', payout: 100 },
  ],
  roles: [
    { name: 'Sales Rep / Intern', amount: 0, unit: 'base payout' },
    { name: 'Lead', amount: 5, unit: '$/line over rep' },
    { name: 'ASM / AD', amount: 3, unit: '% of team production' },
    { name: 'Market Owner', amount: 100, unit: '% of office payout' },
  ],
};

function PayItemList({
  title,
  icon: Icon,
  color,
  items,
  effective,
  onEdit,
  onAdd,
  onRemove,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  items: PayItem[];
  effective: (base: number) => number;
  onEdit: (index: number, field: 'name' | 'payout', value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'text-accent-blue border-accent-blue/20',
    purple: 'text-accent-purple border-accent-purple/20',
    cyan: 'text-accent-cyan border-accent-cyan/20',
    yellow: 'text-accent-yellow border-accent-yellow/20',
  };

  return (
    <div className={cn('p-4 rounded-xl glass border', colorClasses[color]?.split(' ')[1])}>
      <div className="flex items-center justify-between mb-3">
        <h4 className={cn('font-semibold text-sm flex items-center gap-2', colorClasses[color]?.split(' ')[0])}>
          <Icon className="w-4 h-4" /> {title}
        </h4>
        <button
          onClick={onAdd}
          className="p-1 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-all"
          aria-label={`Add item to ${title}`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="space-y-1.5 text-xs">
        {items.map((item, i) => (
          <div key={i} className="group flex items-center justify-between gap-2">
            <Editable value={item.name} onCommit={(v) => onEdit(i, 'name', v)} className="flex-1 min-w-0" />
            <span className="flex items-center gap-1.5">
              <span className="text-accent-green font-semibold">
                $<Editable value={String(item.payout)} onCommit={(v) => onEdit(i, 'payout', v)} />
              </span>
              {effective(item.payout) !== item.payout && (
                <span className="text-text-muted">→ {formatCurrency(effective(item.payout))}</span>
              )}
              <button
                onClick={() => onRemove(i)}
                className="p-0.5 rounded text-text-muted opacity-0 group-hover:opacity-100 hover:text-accent-red transition-all"
                aria-label={`Remove ${item.name}`}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CommissionEngine() {
  const { state, setState, reset } = useLocalState<CommissionState>('se-commission-v1', DEFAULT_COMMISSION);
  const store = state.stores[state.storeIndex] ?? state.stores[0];
  const effective = (base: number) =>
    Math.max(0, (base - (5 - state.tier) * state.tierDelta) * (store?.multiplier ?? 1));

  const editList =
    (list: 'phonePlans' | 'addOns' | 'internet') =>
    (index: number, field: 'name' | 'payout', value: string) => {
      setState(prev => ({
        ...prev,
        [list]: prev[list].map((item, i) =>
          i === index
            ? field === 'payout'
              ? { ...item, payout: parseNum(value) }
              : { ...item, name: value.trim() || item.name }
            : item
        ),
      }));
    };

  const addTo = (list: 'phonePlans' | 'addOns' | 'internet') => () =>
    setState(prev => ({ ...prev, [list]: [...prev[list], { name: 'New Item', payout: 0 }] }));

  const removeFrom = (list: 'phonePlans' | 'addOns' | 'internet') => (index: number) =>
    setState(prev => ({ ...prev, [list]: prev[list].filter((_, i) => i !== index) }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-xl font-bold neon-text-blue">Commission Engine</h2>
        <Button variant="ghost" size="sm" onClick={reset}>↻ Reset to defaults</Button>
      </div>

      {/* Tier + store controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div className="p-4 rounded-xl glass border border-border-subtle">
          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">
            Payout Tier <span className="normal-case">(Tier 5 = highest; −$
            <Editable value={String(state.tierDelta)} onCommit={(v) => setState(p => ({ ...p, tierDelta: parseNum(v) }))} /> per tier below)</span>
          </p>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map(t => (
              <button
                key={t}
                onClick={() => setState(p => ({ ...p, tier: t }))}
                className={cn('tab-btn', state.tier === t ? 'active' : 'inactive')}
              >
                Tier {t}
              </button>
            ))}
          </div>
        </div>
        <div className="p-4 rounded-xl glass border border-border-subtle">
          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Store (click name/multiplier to edit)</p>
          <div className="flex flex-wrap gap-1.5">
            {state.stores.map((s, i) => (
              <button
                key={i}
                onClick={() => setState(p => ({ ...p, storeIndex: i }))}
                className={cn('tab-btn flex items-center gap-1', state.storeIndex === i ? 'active' : 'inactive')}
              >
                <Editable
                  value={s.name}
                  onCommit={(v) => setState(p => ({ ...p, stores: p.stores.map((st, j) => j === i ? { ...st, name: v.trim() || st.name } : st) }))}
                />
                <span className="text-text-muted">
                  ×<Editable
                    value={String(s.multiplier)}
                    onCommit={(v) => setState(p => ({ ...p, stores: p.stores.map((st, j) => j === i ? { ...st, multiplier: parseNum(v) || 1 } : st) }))}
                  />
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Payout lists */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <PayItemList title="Phone Lines" icon={Smartphone} color="blue" items={state.phonePlans}
          effective={effective} onEdit={editList('phonePlans')} onAdd={addTo('phonePlans')} onRemove={removeFrom('phonePlans')} />
        <PayItemList title="Internet" icon={Wifi} color="cyan" items={state.internet}
          effective={effective} onEdit={editList('internet')} onAdd={addTo('internet')} onRemove={removeFrom('internet')} />
        <PayItemList title="Add-Ons" icon={Gift} color="purple" items={state.addOns}
          effective={effective} onEdit={editList('addOns')} onAdd={addTo('addOns')} onRemove={removeFrom('addOns')} />
      </div>

      {/* Role structure */}
      <div className="p-4 rounded-xl glass border border-accent-yellow/20">
        <h4 className="font-semibold text-sm mb-3 flex items-center gap-2 text-accent-yellow">
          <Users className="w-4 h-4" /> Role Structure
          <span className="text-[10px] text-text-muted font-normal normal-case">Sales Rep / Intern → Lead → ASM / AD → Market Owner</span>
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
          {state.roles.map((role, i) => (
            <div key={i} className="p-3 rounded-lg bg-white/5">
              <Editable
                value={role.name}
                onCommit={(v) => setState(p => ({ ...p, roles: p.roles.map((r, j) => j === i ? { ...r, name: v.trim() || r.name } : r) }))}
                className="font-medium block"
              />
              <span className="text-accent-green font-bold text-sm">
                <Editable
                  value={String(role.amount)}
                  onCommit={(v) => setState(p => ({ ...p, roles: p.roles.map((r, j) => j === i ? { ...r, amount: parseNum(v) } : r) }))}
                />
              </span>{' '}
              <Editable
                value={role.unit}
                onCommit={(v) => setState(p => ({ ...p, roles: p.roles.map((r, j) => j === i ? { ...r, unit: v.trim() || r.unit } : r) }))}
                className="text-text-muted"
              />
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-xs text-text-secondary">
        Showing <span className="text-accent-blue font-medium">Tier {state.tier}</span> payouts at{' '}
        <span className="text-accent-blue font-medium">{store?.name}</span> — click any name or number to edit. Changes save automatically.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// P&L editor with roadtrip reimbursement
// ---------------------------------------------------------------------------

interface MoneyItem {
  name: string;
  amount: number;
}

interface PnlState {
  revenue: MoneyItem[];
  expenses: MoneyItem[];
  roadtrips: MoneyItem[];
  reimburseRate: number; // 0..100 (%)
}

const DEFAULT_PNL: PnlState = {
  revenue: [
    { name: 'Commission', amount: 142500 },
    { name: 'Bonuses', amount: 12300 },
  ],
  expenses: [
    { name: 'Payroll', amount: 85000 },
    { name: 'Rent', amount: 18000 },
    { name: 'Travel', amount: 8500 },
    { name: 'Marketing', amount: 3200 },
    { name: 'Software', amount: 1100 },
    { name: 'Other', amount: 5100 },
  ],
  roadtrips: [
    { name: 'Orlando roadtrip', amount: 4200 },
  ],
  reimburseRate: 60,
};

function MoneyList({
  title,
  icon: Icon,
  color,
  items,
  onEdit,
  onAdd,
  onRemove,
  footer,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: 'green' | 'red' | 'orange';
  items: MoneyItem[];
  onEdit: (index: number, field: 'name' | 'amount', value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  footer?: React.ReactNode;
}) {
  const colorClasses = {
    green: 'text-accent-green',
    red: 'text-accent-red',
    orange: 'text-accent-orange',
  };

  return (
    <div className="p-4 rounded-xl glass border border-border-subtle">
      <div className="flex items-center justify-between mb-3">
        <h3 className={cn('text-sm font-semibold flex items-center gap-2', colorClasses[color])}>
          <Icon className="w-4 h-4" /> {title}
        </h3>
        <button
          onClick={onAdd}
          className="p-1 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-all"
          aria-label={`Add ${title} item`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="space-y-1.5 text-sm">
        {items.map((item, i) => (
          <div key={i} className="group flex items-center justify-between gap-2 p-2 rounded-lg bg-white/5">
            <Editable value={item.name} onCommit={(v) => onEdit(i, 'name', v)} className="flex-1 min-w-0" />
            <span className="flex items-center gap-1.5">
              <span className={cn('font-semibold', colorClasses[color])}>
                $<Editable value={String(item.amount)} onCommit={(v) => onEdit(i, 'amount', v)} />
              </span>
              <button
                onClick={() => onRemove(i)}
                className="p-0.5 rounded text-text-muted opacity-0 group-hover:opacity-100 hover:text-accent-red transition-all"
                aria-label={`Remove ${item.name}`}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </span>
          </div>
        ))}
      </div>
      {footer}
    </div>
  );
}

export function PnlEditor() {
  const { state, setState, reset } = useLocalState<PnlState>('se-pnl-v1', DEFAULT_PNL);

  const editList =
    (list: 'revenue' | 'expenses' | 'roadtrips') =>
    (index: number, field: 'name' | 'amount', value: string) =>
      setState(prev => ({
        ...prev,
        [list]: prev[list].map((item, i) =>
          i === index
            ? field === 'amount'
              ? { ...item, amount: parseNum(value) }
              : { ...item, name: value.trim() || item.name }
            : item
        ),
      }));

  const addTo = (list: 'revenue' | 'expenses' | 'roadtrips', name: string) => () =>
    setState(prev => ({ ...prev, [list]: [...prev[list], { name, amount: 0 }] }));

  const removeFrom = (list: 'revenue' | 'expenses' | 'roadtrips') => (index: number) =>
    setState(prev => ({ ...prev, [list]: prev[list].filter((_, i) => i !== index) }));

  const rate = Math.min(100, Math.max(0, state.reimburseRate)) / 100;
  const roadtripCost = state.roadtrips.reduce((a, b) => a + b.amount, 0);
  const reimbursement = roadtripCost * rate;
  const totalRevenue = state.revenue.reduce((a, b) => a + b.amount, 0) + reimbursement;
  const totalExpenses = state.expenses.reduce((a, b) => a + b.amount, 0) + roadtripCost;
  const net = totalRevenue - totalExpenses;
  const margin = totalRevenue > 0 ? ((net / totalRevenue) * 100).toFixed(1) : '0.0';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-xl font-bold neon-text-cyan">Profit &amp; Loss</h2>
        <Button variant="ghost" size="sm" onClick={reset}>↻ Reset to defaults</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MoneyList
          title="Revenue" icon={DollarSign} color="green" items={state.revenue}
          onEdit={editList('revenue')} onAdd={addTo('revenue', 'New revenue')} onRemove={removeFrom('revenue')}
          footer={
            <div className="mt-2 p-2 rounded-lg bg-accent-green/5 border border-accent-green/20 flex justify-between text-xs">
              <span className="text-text-secondary">Roadtrip reimbursement</span>
              <span className="text-accent-green font-semibold">{formatCurrency(reimbursement)}</span>
            </div>
          }
        />
        <MoneyList
          title="Expenses" icon={Receipt} color="red" items={state.expenses}
          onEdit={editList('expenses')} onAdd={addTo('expenses', 'New expense')} onRemove={removeFrom('expenses')}
        />
        <MoneyList
          title="Roadtrips" icon={MapPin} color="orange" items={state.roadtrips}
          onEdit={editList('roadtrips')} onAdd={addTo('roadtrips', 'New roadtrip')} onRemove={removeFrom('roadtrips')}
          footer={
            <p className="mt-2 text-[11px] text-text-secondary">
              AT&amp;T / parent company reimburses{' '}
              <span className="text-accent-orange font-semibold">
                <Editable value={String(state.reimburseRate)} onCommit={(v) => setState(p => ({ ...p, reimburseRate: parseNum(v) }))} />%
              </span>{' '}
              of roadtrip costs — auto-added to revenue.
            </p>
          }
        />
      </div>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl glass border border-border-subtle text-center">
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Revenue</p>
          <p className="text-xl font-bold text-accent-green">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="p-4 rounded-xl glass border border-border-subtle text-center">
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Expenses</p>
          <p className="text-xl font-bold text-accent-red">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className={cn('p-4 rounded-xl glass border text-center', net >= 0 ? 'border-accent-green/30 bg-accent-green/5' : 'border-accent-red/30 bg-accent-red/5')}>
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Net Profit</p>
          <p className={cn('text-xl font-bold', net >= 0 ? 'neon-text-green' : 'text-accent-red')}>{formatCurrency(net)}</p>
        </div>
        <div className="p-4 rounded-xl glass border border-border-subtle text-center">
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Margin</p>
          <p className="text-xl font-bold text-accent-cyan">{margin}%</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Teams editor (used in Meeting Mode)
// ---------------------------------------------------------------------------

export interface TeamData {
  name: string;
  change: string;
  lines: number;
  premium: number;
  fiber: number;
  progress: number;
  color: string;
}

const TEAM_COLORS = ['blue', 'purple', 'cyan', 'yellow'];

const DEFAULT_TEAMS: TeamData[] = [
  { name: 'Team Alpha', change: '+12%', lines: 34, premium: 18, fiber: 6, progress: 78, color: 'blue' },
  { name: 'Team Beta', change: '+8%', lines: 28, premium: 14, fiber: 5, progress: 64, color: 'purple' },
  { name: 'Team Gamma', change: '+5%', lines: 22, premium: 10, fiber: 4, progress: 52, color: 'cyan' },
  { name: 'Team Delta', change: '+15%', lines: 41, premium: 22, fiber: 9, progress: 92, color: 'yellow' },
];

export function TeamsEditor() {
  const { state: teams, setState: setTeams, reset } = useLocalState<TeamData[]>('se-teams-v1', DEFAULT_TEAMS);

  const edit = (index: number, field: keyof TeamData, value: string) =>
    setTeams(prev => prev.map((t, i) => {
      if (i !== index) return t;
      if (field === 'lines' || field === 'premium' || field === 'fiber' || field === 'progress') {
        return { ...t, [field]: Math.max(0, parseNum(value)) };
      }
      return { ...t, [field]: value.trim() || t[field] };
    }));

  const addTeam = () =>
    setTeams(prev => [...prev, {
      name: `Team ${String.fromCharCode(65 + (prev.length % 26))}`,
      change: '+0%', lines: 0, premium: 0, fiber: 0, progress: 0,
      color: TEAM_COLORS[prev.length % TEAM_COLORS.length],
    }]);

  const removeTeam = (index: number) => setTeams(prev => prev.filter((_, i) => i !== index));

  const borderColors: Record<string, string> = {
    blue: 'border-accent-blue/10',
    purple: 'border-accent-purple/10',
    cyan: 'border-accent-cyan/10',
    yellow: 'border-accent-yellow/10',
  };
  const progressColors: Record<string, string> = {
    blue: 'bg-accent-blue',
    purple: 'bg-accent-purple',
    cyan: 'bg-accent-cyan',
    yellow: 'bg-accent-yellow',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-secondary flex items-center gap-2">
          <Users className="w-4 h-4" />
          Teams Overview <span className="text-[10px] text-text-muted font-normal">(click any value to edit)</span>
        </h3>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={addTeam}><Plus className="w-3.5 h-3.5" /> Add Team</Button>
          <Button variant="ghost" size="sm" onClick={reset}>↻</Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {teams.map((team, i) => (
          <div key={i} className={cn('group glass rounded-xl p-4 border relative', borderColors[team.color] ?? borderColors.blue)}>
            <button
              onClick={() => removeTeam(i)}
              className="absolute top-2 right-2 p-1 rounded-lg text-text-muted opacity-0 group-hover:opacity-100 hover:text-accent-red hover:bg-accent-red/10 transition-all"
              aria-label={`Remove ${team.name}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <div className="flex justify-between items-center mb-2 pr-6">
              <Editable value={team.name} onCommit={(v) => edit(i, 'name', v)} className="font-medium" />
              <Editable value={team.change} onCommit={(v) => edit(i, 'change', v)} className="text-xs text-accent-green" />
            </div>
            <div className="flex justify-between text-xs text-text-secondary">
              <span>Lines: <Editable value={String(team.lines)} onCommit={(v) => edit(i, 'lines', v)} className="text-white" /></span>
              <span>Premium: <Editable value={String(team.premium)} onCommit={(v) => edit(i, 'premium', v)} className="text-white" /></span>
              <span>Fiber: <Editable value={String(team.fiber)} onCommit={(v) => edit(i, 'fiber', v)} className="text-white" /></span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1 rounded-full bg-gray-700">
                <div
                  className={cn('h-full rounded-full transition-all', progressColors[team.color] ?? progressColors.blue)}
                  style={{ width: `${Math.min(100, team.progress)}%` }}
                />
              </div>
              <span className="text-[10px] text-text-muted">
                <Editable value={String(team.progress)} onCommit={(v) => edit(i, 'progress', v)} />%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
