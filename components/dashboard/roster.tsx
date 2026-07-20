'use client';

import { useEffect, useState } from 'react';
import { useLocalState, Editable, parseNum } from './editable-sections';
import { cn, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Trash2, TrendingUp, Award, UserPlus, Pencil } from 'lucide-react';
import { TeamTree } from './team-tree';

// ---------------------------------------------------------------------------
// People — the single roster every view joins against (leaderboard, teams,
// profiles, promotion roadmap). Persisted to localStorage until the shared
// database phase.
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
  store: string;
  team: string; // team name, '' = unassigned
  weeklyProfit: number[]; // most recent weeks, newest last
  attendance: number; // %
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
  { id: 'p1', name: 'Sarah Johnson', role: 'REP', store: 'Costco', team: 'Team Alpha', weeklyProfit: [5200, 5600], attendance: 96 },
  { id: 'p2', name: 'Mike Chen', role: 'REP', store: 'Costco', team: 'Team Beta', weeklyProfit: [4100, 4800], attendance: 92 },
  { id: 'p3', name: 'Jessica Williams', role: 'REP', store: 'Costco', team: 'Team Gamma', weeklyProfit: [3900, 4200], attendance: 88 },
  { id: 'p4', name: 'Alex Thompson', role: 'LEAD', store: 'Costco', team: 'Team Alpha', weeklyProfit: [6100, 6400], attendance: 98 },
  { id: 'p5', name: 'Jordan Reyes', role: 'ASM', store: 'Costco', team: '', weeklyProfit: [7000, 7300], attendance: 99 },
  { id: 'p6', name: 'Chris Lee', role: 'INTERN', store: 'Costco', team: 'Team Alpha', weeklyProfit: [1800, 2400], attendance: 94 },
  { id: 'p7', name: 'Dana White', role: 'INTERN', store: 'Costco', team: '', weeklyProfit: [2100, 1900], attendance: 85 },
];

export function loadPeople(): Person[] {
  if (typeof window === 'undefined') return DEFAULT_PEOPLE;
  try {
    const saved = localStorage.getItem(PEOPLE_KEY);
    return saved ? (JSON.parse(saved) as Person[]) : DEFAULT_PEOPLE;
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

// Promotion readiness: last `weeks` weeks all >= profitPerWeek AND attendance >= min
export function promotionStatus(person: Person, rules: PromotionRules) {
  const nextRole = ROLE_LADDER[ROLE_LADDER.indexOf(person.role) + 1];
  if (!nextRole) return { ready: false, progress: 100, nextRole: null as string | null, label: 'Top of ladder' };
  const recent = person.weeklyProfit.slice(-rules.weeks);
  const weeksMet = recent.filter(p => p >= rules.profitPerWeek).length;
  const attendanceOk = person.attendance >= rules.minAttendance;
  const ready = weeksMet >= rules.weeks && attendanceOk;
  const progress = Math.min(100, Math.round(
    ((weeksMet / rules.weeks) * 70) + (attendanceOk ? 30 : (person.attendance / rules.minAttendance) * 30)
  ));
  return {
    ready,
    progress,
    nextRole: ROSTER_ROLE_LABELS[nextRole],
    label: ready ? `Ready for ${ROSTER_ROLE_LABELS[nextRole]}` : `${progress}% to ${ROSTER_ROLE_LABELS[nextRole]}`,
  };
}

let personCounter = 100;

export function RosterManager({ onOpenProfile }: { onOpenProfile: (name: string) => void }) {
  const { state: people, setState: setPeople, reset: resetPeople } = useLocalState<Person[]>(PEOPLE_KEY, DEFAULT_PEOPLE);
  const { state: rules, setState: setRules, reset: resetRules } = useLocalState<PromotionRules>(PROMO_RULES_KEY, DEFAULT_PROMO_RULES);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Store options come from the Commission Engine's store list
  const [storeOptions, setStoreOptions] = useState<string[]>(['Costco', 'Target', "BJ's"]);
  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem('se-commission-v2') || 'null');
      if (c?.stores?.length) setStoreOptions(c.stores.map((s: { name: string }) => s.name));
    } catch { /* keep defaults */ }
  }, []);

  const edit = (id: string, patch: Partial<Person>) =>
    setPeople(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)));

  const assignTeam = (name: string, team: string) =>
    setPeople(prev => prev.map(p => (p.name.toLowerCase() === name.toLowerCase() ? { ...p, team } : p)));

  const addPerson = () =>
    setPeople(prev => [...prev, {
      id: `p${Date.now()}-${personCounter++}`,
      name: 'New Employee', role: 'INTERN', store: storeOptions[0] ?? 'Costco', team: '',
      weeklyProfit: [0, 0], attendance: 100,
    }]);

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
          <Button size="sm" onClick={addPerson}><UserPlus className="w-3.5 h-3.5" /> Add Employee</Button>
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
          attendance. Ladder: Intern → Sales Rep → Lead → ASM/AD → Market Owner.
        </p>
      </div>

      {/* People table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] text-text-muted uppercase tracking-wider border-b border-border-subtle">
              <th className="pb-2 pr-2">Employee</th>
              <th className="pb-2 pr-2">Role</th>
              <th className="pb-2 pr-2">Store</th>
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
                    <select
                      value={person.store}
                      onChange={(e) => edit(person.id, { store: e.target.value })}
                      className="bg-bg-tertiary border border-border-subtle rounded-lg px-2 py-1 text-[11px] text-text-secondary focus:outline-none focus:border-accent-blue/50 cursor-pointer"
                      aria-label={`Store for ${person.name}`}
                    >
                      {!storeOptions.includes(person.store) && <option value={person.store}>{person.store}</option>}
                      {storeOptions.map(store => <option key={store} value={store}>{store}</option>)}
                    </select>
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
                    <Editable value={String(person.attendance)} onCommit={(v) => edit(person.id, { attendance: Math.min(100, Math.max(0, parseNum(v))) })} />%
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
        when someone meets the roadmap rules a green Promote button appears
      </p>

      <TeamTree people={people} assignTeam={assignTeam} />
    </div>
  );
}
