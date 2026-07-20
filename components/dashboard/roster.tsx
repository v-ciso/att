'use client';

import { useEffect, useState } from 'react';
import { useLocalState, Editable, parseNum } from './editable-sections';
import { cn, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Trash2, TrendingUp, Award, UserPlus, Pencil, ChevronDown } from 'lucide-react';
import { TeamTree } from './team-tree';

// ---------------------------------------------------------------------------
// People — the single roster every view joins against. A person can work one
// or several stores (assigned from the Commission Engine's store list).
// ---------------------------------------------------------------------------

export const ROLE_LADDER = ['INTERN', 'REP', 'LEAD', 'ASM'] as const;
export type RosterRole = (typeof ROLE_LADDER)[number];

export const ROSTER_ROLE_LABELS: Record<RosterRole, string> = {
  INTERN: 'Intern',
  REP: 'Sales Rep',
  LEAD: 'Lead',
  ASM: 'ASM / AD',
};

const ROLE_BADGE: Record<RosterRole, string> = {
  INTERN: 'bg-gray-500/20 text-gray-400 border-gray-500/20',
  REP: 'bg-blue-500/20 text-blue-400 border-blue-500/20',
  LEAD: 'bg-purple-500/20 text-purple-400 border-purple-500/20',
  ASM: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20',
};

export interface Person {
  id: string;
  name: string;
  role: RosterRole;
  stores: string[]; // one or many; first = primary
  team: string; // team name, '' = unassigned
  weeklyProfit: number[];
  attendance: number; // manual fallback % (tracked records win when present)
}

export interface PromotionRules {
  profitPerWeek: number;
  weeks: number;
  minAttendance: number;
}

export const PEOPLE_KEY = 'se-people-v1';
export const PROMO_RULES_KEY = 'se-promo-rules-v1';

export const DEFAULT_PROMO_RULES: PromotionRules = {
  profitPerWeek: 5000,
  weeks: 2,
  minAttendance: 90,
};

export const DEFAULT_PEOPLE: Person[] = [
  { id: 'p1', name: 'Sarah Johnson', role: 'REP', stores: ['Costco'], team: 'Team Alpha', weeklyProfit: [5200, 5600], attendance: 96 },
  { id: 'p2', name: 'Mike Chen', role: 'REP', stores: ['Target'], team: 'Team Beta', weeklyProfit: [4100, 4800], attendance: 92 },
  { id: 'p3', name: 'Jessica Williams', role: 'REP', stores: ["BJ's"], team: 'Team Alpha', weeklyProfit: [3900, 4200], attendance: 88 },
  { id: 'p4', name: 'Alex Thompson', role: 'LEAD', stores: ['Costco', 'Target'], team: 'Team Alpha', weeklyProfit: [6100, 6400], attendance: 98 },
  { id: 'p5', name: 'Jordan Reyes', role: 'ASM', stores: ['Costco', 'Target', "BJ's"], team: '', weeklyProfit: [7000, 7300], attendance: 99 },
  { id: 'p6', name: 'Chris Lee', role: 'INTERN', stores: ['Costco'], team: 'Team Alpha', weeklyProfit: [1800, 2400], attendance: 94 },
  { id: 'p7', name: 'Dana White', role: 'INTERN', stores: ['Target'], team: '', weeklyProfit: [2100, 1900], attendance: 85 },
];

export function primaryStore(p: Person): string {
  return p.stores[0] ?? 'Costco';
}

export function loadPeople(): Person[] {
  if (typeof window === 'undefined') return DEFAULT_PEOPLE;
  try {
    const saved = localStorage.getItem(PEOPLE_KEY);
    if (!saved) return DEFAULT_PEOPLE;
    const raw = JSON.parse(saved) as Array<Person & { store?: string }>;
    // Migrate single `store` → `stores[]`
    return raw.map(p => ({
      ...p,
      stores: p.stores?.length ? p.stores : [p.store ?? 'Costco'],
    }));
  } catch {
    return DEFAULT_PEOPLE;
  }
}

export function loadPromoRules(): PromotionRules {
  if (typeof window === 'undefined') return DEFAULT_PROMO_RULES;
  try {
    const saved = localStorage.getItem(PROMO_RULES_KEY);
    return saved ? (JSON.parse(saved) as PromotionRules) : DEFAULT_PROMO_RULES;
  } catch {
    return DEFAULT_PROMO_RULES;
  }
}

// Attendance marked in the Daily Tracker beats the manual roster number.
// Score: Present = 1, Late = 0.5, Absent = 0 over the last 30 marked days.
export function attendanceFromRecords(name: string): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const book = JSON.parse(localStorage.getItem('se-attendance-v1') || '{}') as Record<string, Record<string, 'P' | 'L' | 'A'>>;
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    let score = 0, days = 0;
    for (const [date, marks] of Object.entries(book)) {
      if (date < cutoff) continue;
      const status = marks[name];
      if (!status) continue;
      days++;
      if (status === 'P') score += 1;
      else if (status === 'L') score += 0.5;
    }
    if (days === 0) return null;
    return Math.round((score / days) * 1000) / 10;
  } catch {
    return null;
  }
}

export function effectiveAttendance(person: Person): { pct: number; tracked: boolean } {
  const rec = attendanceFromRecords(person.name);
  return rec === null ? { pct: person.attendance, tracked: false } : { pct: rec, tracked: true };
}

// Promotion readiness — attendance uses tracked records when they exist, so
// marking Late/Absent in the Daily Tracker feeds the road to ownership.
export function promotionStatus(person: Person, rules: PromotionRules) {
  const nextRole = ROLE_LADDER[ROLE_LADDER.indexOf(person.role) + 1];
  const att = effectiveAttendance(person);
  if (!nextRole) return { ready: false, progress: 100, nextRole: null as string | null, label: 'Top of ladder', attendance: att };
  const recent = person.weeklyProfit.slice(-rules.weeks);
  const weeksMet = recent.filter(p => p >= rules.profitPerWeek).length;
  const attendanceOk = att.pct >= rules.minAttendance;
  const ready = weeksMet >= rules.weeks && attendanceOk;
  const progress = Math.min(100, Math.round(
    ((weeksMet / rules.weeks) * 70) + (attendanceOk ? 30 : (att.pct / rules.minAttendance) * 30)
  ));
  return {
    ready,
    progress,
    nextRole: ROSTER_ROLE_LABELS[nextRole],
    label: ready ? `Ready for ${ROSTER_ROLE_LABELS[nextRole]}` : `${progress}% to ${ROSTER_ROLE_LABELS[nextRole]}`,
    attendance: att,
  };
}

let personCounter = 100;

// Compact multi-select for a person's stores
function StoresPicker({ value, options, onChange, label }: { value: string[]; options: string[]; onChange: (stores: string[]) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const all = Array.from(new Set([...options, ...value]));
  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 bg-bg-tertiary border border-border-subtle rounded-lg px-2 py-1 text-[11px] text-text-secondary hover:text-white hover:border-border-strong transition-all"
        aria-label={label}
      >
        {value.length ? value.join(', ') : 'Pick stores'}
        <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-40 w-40 p-1.5 rounded-xl bg-bg-secondary border border-border-strong shadow-glass space-y-0.5">
            {all.map(store => {
              const active = value.includes(store);
              return (
                <button
                  key={store}
                  onClick={() => {
                    const next = active ? value.filter(s => s !== store) : [...value, store];
                    if (next.length) onChange(next); // a person always has ≥1 store
                  }}
                  className={cn(
                    'w-full text-left px-2 py-1 rounded-lg text-[11px] transition-colors flex items-center justify-between',
                    active ? 'bg-accent-blue/20 text-accent-blue' : 'text-text-secondary hover:bg-white/5 hover:text-white'
                  )}
                >
                  {store} {active && '✓'}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// Pop-up for adding an employee: name, role, stores, team
function AddEmployeeModal({ storeOptions, teamOptions, onAdd, onClose }: {
  storeOptions: string[];
  teamOptions: string[];
  onAdd: (p: Omit<Person, 'id'>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<RosterRole>('INTERN');
  const [stores, setStores] = useState<string[]>(storeOptions.slice(0, 1));
  const [team, setTeam] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = () => {
    if (!name.trim()) return;
    onAdd({ name: name.trim(), role, stores: stores.length ? stores : [storeOptions[0] ?? 'Costco'], team, weeklyProfit: [0, 0], attendance: 100 });
    onClose();
  };

  const selectClass = 'w-full bg-bg-tertiary border border-border-subtle rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent-blue/50';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Add employee">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm glass border border-border-strong rounded-2xl p-6 animate-scale-in bg-bg-secondary/95">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2"><UserPlus className="w-5 h-5 text-accent-green" /> Add Employee</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-all" aria-label="Close">✕</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label-base">Name</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit(); }}
              placeholder="First Last"
              className={selectClass}
            />
          </div>
          <div>
            <label className="label-base">Role</label>
            <select value={role} onChange={e => setRole(e.target.value as RosterRole)} className={selectClass}>
              {ROLE_LADDER.map(r => <option key={r} value={r}>{ROSTER_ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          <div>
            <label className="label-base">Stores (one or several)</label>
            <StoresPicker value={stores} options={storeOptions} onChange={setStores} label="Stores for new employee" />
          </div>
          <div>
            <label className="label-base">Team</label>
            <select value={team} onChange={e => setTeam(e.target.value)} className={selectClass}>
              <option value="">Unassigned</option>
              {teamOptions.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <Button className="w-full" onClick={submit} disabled={!name.trim()}>Add to roster</Button>
        </div>
      </div>
    </div>
  );
}

export function RosterManager({ onOpenProfile }: { onOpenProfile: (name: string) => void }) {
  const { state: people, setState: setPeople, reset: resetPeople } = useLocalState<Person[]>(PEOPLE_KEY, DEFAULT_PEOPLE);
  const { state: rules, setState: setRules, reset: resetRules } = useLocalState<PromotionRules>(PROMO_RULES_KEY, DEFAULT_PROMO_RULES);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // Store options come from the Commission Engine's store list
  const [storeOptions, setStoreOptions] = useState<string[]>(['Costco', 'Target', "BJ's"]);
  const [teamOptions, setTeamOptions] = useState<string[]>([]);
  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem('se-commission-v2') || 'null');
      if (c?.stores?.length) setStoreOptions(c.stores.map((s: { name: string }) => s.name));
    } catch { /* keep defaults */ }
    try {
      const teams = JSON.parse(localStorage.getItem('se-teams-v2') || '[]');
      setTeamOptions(teams.map((t: { name: string }) => t.name));
    } catch { /* none */ }
  }, []);

  const edit = (id: string, patch: Partial<Person>) =>
    setPeople(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)));

  const assignTeam = (name: string, team: string) =>
    setPeople(prev => prev.map(p => (p.name.toLowerCase() === name.toLowerCase() ? { ...p, team } : p)));

  const addPerson = (p: Omit<Person, 'id'>) =>
    setPeople(prev => [...prev, { ...p, id: `p${Date.now()}-${personCounter++}` }]);

  const removePerson = (id: string) => setPeople(prev => prev.filter(p => p.id !== id));

  const promote = (id: string) =>
    setPeople(prev => prev.map(p => {
      if (p.id !== id) return p;
      const next = ROLE_LADDER[ROLE_LADDER.indexOf(p.role) + 1];
      return next ? { ...p, role: next } : p;
    }));

  const editWeek = (id: string, weekIndex: number, value: string) =>
    setPeople(prev => prev.map(p => p.id === id
      ? { ...p, weeklyProfit: p.weeklyProfit.map((w, i) => (i === weekIndex ? parseNum(value) : w)) }
      : p));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-xl font-bold neon-text-green">Roster &amp; Promotions</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setShowAdd(true)}><UserPlus className="w-3.5 h-3.5" /> Add Employee</Button>
          <Button variant="ghost" size="sm" onClick={() => { resetPeople(); resetRules(); }}>↻ Reset</Button>
        </div>
      </div>

      {/* Promotion rules — the leadership roadmap criteria, all editable */}
      <div className="p-4 rounded-xl glass border border-accent-green/20 mb-4">
        <h4 className="font-semibold text-sm mb-1 flex items-center gap-2 text-accent-green">
          <Award className="w-4 h-4" /> Leadership Roadmap Rules
        </h4>
        <p className="text-xs text-text-secondary">
          An employee is promotion-ready when they hit{' '}
          <span className="text-accent-green font-semibold">
            $<Editable value={String(rules.profitPerWeek)} onCommit={(v) => setRules(r => ({ ...r, profitPerWeek: parseNum(v) }))} />
          </span>{' '}
          profit per week for{' '}
          <span className="text-accent-green font-semibold">
            <Editable value={String(rules.weeks)} onCommit={(v) => setRules(r => ({ ...r, weeks: Math.max(1, parseNum(v)) }))} />
          </span>{' '}
          straight week(s) with at least{' '}
          <span className="text-accent-green font-semibold">
            <Editable value={String(rules.minAttendance)} onCommit={(v) => setRules(r => ({ ...r, minAttendance: parseNum(v) }))} />%
          </span>{' '}
          attendance. Attendance marked in the Daily Tracker counts automatically (Present 100% · Late 50% · Absent 0%).
        </p>
      </div>

      {/* People table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] text-text-muted uppercase tracking-wider border-b border-border-subtle">
              <th className="pb-2 pr-2">Employee</th>
              <th className="pb-2 pr-2">Role</th>
              <th className="pb-2 pr-2">Stores</th>
              <th className="pb-2 pr-2">Team</th>
              <th className="pb-2 pr-2">Wk-1 Profit</th>
              <th className="pb-2 pr-2">Wk-2 Profit</th>
              <th className="pb-2 pr-2">Attend.</th>
              <th className="pb-2 pr-2">Roadmap</th>
              <th className="pb-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {people.map(person => {
              const status = promotionStatus(person, rules);
              return (
                <tr key={person.id} className="group hover:bg-white/5 transition-colors">
                  <td className="py-2 pr-2 font-medium">
                    {editingId === person.id ? (
                      <Editable
                        value={person.name}
                        onCommit={(v) => { edit(person.id, { name: v.trim() || person.name }); setEditingId(null); }}
                      />
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => onOpenProfile(person.name)}
                          className="hover:text-accent-blue transition-colors text-left"
                          title="View profile, stats & roadmap"
                        >
                          {person.name}
                        </button>
                        <button
                          onClick={() => setEditingId(person.id)}
                          className="p-0.5 rounded text-text-muted opacity-0 group-hover:opacity-100 hover:text-white transition-all"
                          aria-label={`Rename ${person.name}`}
                          title="Rename"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    <button
                      onClick={() => {
                        const i = ROLE_LADDER.indexOf(person.role);
                        edit(person.id, { role: ROLE_LADDER[(i + 1) % ROLE_LADDER.length] });
                      }}
                      className={cn('px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-wider transition-all hover:brightness-125', ROLE_BADGE[person.role])}
                      title="Click to cycle role"
                    >
                      {ROSTER_ROLE_LABELS[person.role]}
                    </button>
                  </td>
                  <td className="py-2 pr-2">
                    <StoresPicker
                      value={person.stores}
                      options={storeOptions}
                      onChange={(stores) => edit(person.id, { stores })}
                      label={`Stores for ${person.name}`}
                    />
                  </td>
                  <td className="py-2 pr-2 text-text-secondary">
                    <Editable value={person.team || '—'} onCommit={(v) => edit(person.id, { team: v.trim() === '—' ? '' : v.trim() })} />
                  </td>
                  <td className="py-2 pr-2 text-accent-green">
                    $<Editable value={String(person.weeklyProfit[0] ?? 0)} onCommit={(v) => editWeek(person.id, 0, v)} />
                  </td>
                  <td className="py-2 pr-2 text-accent-green">
                    $<Editable value={String(person.weeklyProfit[1] ?? 0)} onCommit={(v) => editWeek(person.id, 1, v)} />
                  </td>
                  <td className="py-2 pr-2">
                    {status.attendance.tracked ? (
                      <span className="text-accent-green" title="Calculated from Daily Tracker marks (last 30 days)">
                        {status.attendance.pct}% <span className="text-[8px] uppercase text-text-muted">tracked</span>
                      </span>
                    ) : (
                      <>
                        <Editable value={String(person.attendance)} onCommit={(v) => edit(person.id, { attendance: Math.min(100, Math.max(0, parseNum(v))) })} />%
                      </>
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    {status.nextRole === null ? (
                      <span className="text-[10px] text-text-muted">{status.label}</span>
                    ) : status.ready ? (
                      <button
                        onClick={() => promote(person.id)}
                        className="px-2 py-0.5 rounded-full bg-accent-green/20 text-accent-green border border-accent-green/30 text-[10px] font-semibold hover:bg-accent-green/30 transition-all flex items-center gap-1"
                        title={`Promote to ${status.nextRole}`}
                      >
                        <TrendingUp className="w-3 h-3" /> {status.label} — Promote
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5 min-w-[110px]">
                        <div className="flex-1 h-1 rounded-full bg-bg-tertiary">
                          <div className="h-full rounded-full bg-gradient-to-r from-accent-blue to-accent-green" style={{ width: `${status.progress}%` }} />
                        </div>
                        <span className="text-[9px] text-text-muted whitespace-nowrap">{status.label}</span>
                      </div>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => removePerson(person.id)}
                      className="p-1.5 rounded-lg text-text-muted opacity-0 group-hover:opacity-100 hover:text-accent-red hover:bg-accent-red/10 transition-all"
                      aria-label={`Remove ${person.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-text-secondary">
        Click a name for their profile &amp; stats · pencil to rename · click a role badge to change role ·
        stores &amp; teams update every board automatically
      </p>

      <TeamTree people={people} assignTeam={assignTeam} />

      {showAdd && (
        <AddEmployeeModal
          storeOptions={storeOptions}
          teamOptions={teamOptions}
          onAdd={addPerson}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}
