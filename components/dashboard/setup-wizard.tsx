'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Plus, Trash2, Store as StoreIcon, Users, Layers, Check } from 'lucide-react';
import { RETAILERS } from '@/lib/shifts';
import {
  Person, RosterRole, ROLE_LADDER, ROSTER_ROLE_LABELS, PEOPLE_KEY,
} from './roster';
import { CommissionState, DEFAULT_COMMISSION, TeamData } from './editable-sections';
import { notifyDataChanged } from '@/lib/sales';

// Shown once, on a LIVE workspace that has no roster yet. A brand-new owner
// otherwise lands on an empty dashboard with no idea what to fill in first.
// Everything captured here is editable later in Roster / Commission.
export const SETUP_DONE_KEY = 'se-setup-done-v1';

interface DraftStore { retailer: string; number: string }
interface DraftPerson { name: string; role: RosterRole; store: string; team: string }

const STEPS = [
  { key: 'stores', label: 'Your stores', icon: StoreIcon },
  { key: 'teams', label: 'Teams', icon: Layers },
  { key: 'people', label: 'Your people', icon: Users },
] as const;

export function SetupWizard({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [stores, setStores] = useState<DraftStore[]>([{ retailer: 'Costco', number: '' }]);
  const [teams, setTeams] = useState<string[]>([]);
  const [people, setPeople] = useState<DraftPerson[]>([{ name: '', role: 'REP', store: '', team: '' }]);

  const storeNames = stores
    .filter(s => s.retailer)
    .map(s => `${s.retailer}${s.number.trim() ? ` ${s.number.trim()}` : ''}`);

  const namedPeople = people.filter(p => p.name.trim());

  const finish = () => {
    // Stores feed the Commission Engine, which is what every payout is priced
    // through — so they must exist before any sale can be logged.
    const commissionRaw = localStorage.getItem('se-commission-v2');
    const commission: CommissionState = commissionRaw
      ? JSON.parse(commissionRaw)
      : { ...DEFAULT_COMMISSION };
    commission.stores = storeNames.length
      ? storeNames.map(name => ({ name, multiplier: 1 }))
      : DEFAULT_COMMISSION.stores;
    commission.storeIndex = 0;
    localStorage.setItem('se-commission-v2', JSON.stringify(commission));

    const roster: Person[] = namedPeople.map((p, i) => ({
      id: `u${Date.now().toString(36)}${i}`,
      name: p.name.trim(),
      role: p.role,
      stores: p.store ? [p.store] : storeNames.slice(0, 1),
      team: p.team,
      weeklyProfit: [],
      attendance: 100,
      hourlyWeekly: 0,
    }));
    localStorage.setItem(PEOPLE_KEY, JSON.stringify(roster));

    // Teams carry no invented production — the numbers derive from real sales.
    const teamRows: TeamData[] = teams.filter(Boolean).map((name, i) => ({
      name,
      change: '—',
      lines: 0, premium: 0, fiber: 0, progress: 0,
      color: (['blue', 'purple', 'cyan', 'yellow'] as const)[i % 4],
      lead: '',
      asm: '',
      members: roster.filter(r => r.team === name).map(r => r.name),
    }));
    localStorage.setItem('se-teams-v2', JSON.stringify(teamRows));

    localStorage.setItem(SETUP_DONE_KEY, '1');
    notifyDataChanged();
    onDone();
  };

  const skip = () => {
    localStorage.setItem(SETUP_DONE_KEY, '1');
    onDone();
  };

  const canAdvance =
    step === 0 ? storeNames.length > 0 :
    step === 1 ? true :
    namedPeople.length > 0;

  const body = (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label="Set up your market">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div className="relative w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto glass border border-border-strong rounded-t-2xl sm:rounded-2xl bg-bg-secondary/95 p-5 sm:p-7 animate-scale-in">
        <h2 className="text-xl sm:text-2xl font-bold neon-brand">Let&apos;s set up your market</h2>
        <p className="text-xs text-text-secondary mt-1">
          Three quick questions. You can change any of it later — nothing here is locked in.
        </p>

        <div className="flex items-center gap-2 my-5">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2 flex-1">
              <div
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap',
                  i === step ? 'text-white' : i < step ? 'text-accent-green' : 'text-text-muted'
                )}
                style={i === step ? { background: 'var(--brand-soft)' } : undefined}
              >
                {i < step ? <Check className="w-3 h-3" /> : <s.icon className="w-3 h-3" />}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <div className="h-px flex-1 bg-border-subtle" />}
            </div>
          ))}
        </div>

        {step === 0 && (
          <Section
            hint="Add every store you run. Brand plus store number, because two Costcos are two different stores."
            onAdd={() => setStores(s => [...s, { retailer: 'Costco', number: '' }])}
            addLabel="Add store"
          >
            {stores.map((s, i) => (
              <Row key={i} onRemove={stores.length > 1 ? () => setStores(v => v.filter((_, j) => j !== i)) : undefined}>
                <select
                  value={s.retailer}
                  onChange={e => setStores(v => v.map((x, j) => j === i ? { ...x, retailer: e.target.value } : x))}
                  className="input-base flex-1 min-w-0"
                  aria-label={`Store ${i + 1} retailer`}
                >
                  {RETAILERS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <input
                  value={s.number}
                  onChange={e => setStores(v => v.map((x, j) => j === i ? { ...x, number: e.target.value } : x))}
                  placeholder="Store # (e.g. 1018)"
                  className="input-base flex-1 min-w-0"
                  aria-label={`Store ${i + 1} number`}
                />
              </Row>
            ))}
          </Section>
        )}

        {step === 1 && (
          <Section
            hint="Optional. Teams group your reps under a lead — skip this if you run everyone as one group."
            onAdd={() => setTeams(t => [...t, ''])}
            addLabel="Add team"
          >
            {teams.length === 0 && (
              <p className="text-xs text-text-muted p-3 rounded-xl bg-white/5">
                No teams yet. That&apos;s fine — you can build them later on the Roster tab.
              </p>
            )}
            {teams.map((t, i) => (
              <Row key={i} onRemove={() => setTeams(v => v.filter((_, j) => j !== i))}>
                <input
                  value={t}
                  onChange={e => setTeams(v => v.map((x, j) => j === i ? e.target.value : x))}
                  placeholder="Team name"
                  className="input-base flex-1"
                  aria-label={`Team ${i + 1} name`}
                />
              </Row>
            ))}
          </Section>
        )}

        {step === 2 && (
          <Section
            hint="Everyone who sells. Their title sets the pay rules — a Lead earns a per-line bump, an ASM earns an override."
            onAdd={() => setPeople(p => [...p, { name: '', role: 'REP', store: storeNames[0] ?? '', team: '' }])}
            addLabel="Add person"
          >
            {people.map((p, i) => (
              <Row key={i} onRemove={people.length > 1 ? () => setPeople(v => v.filter((_, j) => j !== i)) : undefined}>
                <input
                  value={p.name}
                  onChange={e => setPeople(v => v.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                  placeholder="Full name"
                  className="input-base flex-1 min-w-0"
                  aria-label={`Person ${i + 1} name`}
                />
                <select
                  value={p.role}
                  onChange={e => setPeople(v => v.map((x, j) => j === i ? { ...x, role: e.target.value as RosterRole } : x))}
                  className="input-base w-[7.5rem]"
                  aria-label={`Person ${i + 1} title`}
                >
                  {ROLE_LADDER.map(r => <option key={r} value={r}>{ROSTER_ROLE_LABELS[r]}</option>)}
                </select>
                <select
                  value={p.store}
                  onChange={e => setPeople(v => v.map((x, j) => j === i ? { ...x, store: e.target.value } : x))}
                  className="input-base w-[8.5rem]"
                  aria-label={`Person ${i + 1} store`}
                >
                  <option value="">Store…</option>
                  {storeNames.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {teams.filter(Boolean).length > 0 && (
                  <select
                    value={p.team}
                    onChange={e => setPeople(v => v.map((x, j) => j === i ? { ...x, team: e.target.value } : x))}
                    className="input-base w-[8rem]"
                    aria-label={`Person ${i + 1} team`}
                  >
                    <option value="">No team</option>
                    {teams.filter(Boolean).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                )}
              </Row>
            ))}
          </Section>
        )}

        <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-border-subtle">
          <button onClick={skip} className="text-xs text-text-muted hover:text-white transition-colors">
            Skip — I&apos;ll set it up myself
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && <Button variant="ghost" size="sm" onClick={() => setStep(s => s - 1)}>Back</Button>}
            {step < STEPS.length - 1 ? (
              <Button size="sm" onClick={() => setStep(s => s + 1)} disabled={!canAdvance}>Next</Button>
            ) : (
              <Button size="sm" onClick={finish} disabled={!canAdvance}>Finish setup</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(body, document.body);
}

function Section({ hint, onAdd, addLabel, children }: {
  hint: string; onAdd: () => void; addLabel: string; children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-text-secondary mb-3">{hint}</p>
      <div className="space-y-2">{children}</div>
      <button
        onClick={onAdd}
        className="mt-3 flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs text-text-secondary hover:text-white hover:bg-white/5 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> {addLabel}
      </button>
    </div>
  );
}

function Row({ children, onRemove }: { children: React.ReactNode; onRemove?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {children}
      {onRemove && (
        <button
          onClick={onRemove}
          className="p-2 rounded-lg text-text-muted hover:text-accent-red hover:bg-accent-red/10 transition-all"
          aria-label="Remove row"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
