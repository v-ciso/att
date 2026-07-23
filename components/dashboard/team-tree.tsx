'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, GripVertical, Network } from 'lucide-react';
import { useLocalState, TeamData, Editable } from './editable-sections';
import { Person, ROSTER_ROLE_LABELS } from './roster';

// Org builder: drag any employee chip onto a team's Lead/ASM slot or member
// area, or back to the Unassigned pool. Team membership lives on the PERSON
// (person.team), so the roster, leaderboard, meeting mode, and this tree all
// stay in sync automatically.

const TEAM_COLORS = ['blue', 'purple', 'cyan', 'yellow'];

const DEFAULT_TREE_TEAMS: TeamData[] = [
  { name: 'Team Alpha', change: '+12%', lines: 0, premium: 0, fiber: 0, progress: 78, color: 'blue', lead: 'Alex Thompson', asm: 'Jordan Reyes', members: [] },
  { name: 'Team Beta', change: '+8%', lines: 0, premium: 0, fiber: 0, progress: 64, color: 'purple', lead: 'Mike Chen', asm: 'Jordan Reyes', members: [] },
];

function PersonChip({ person, small }: { person: Person; small?: boolean }) {
  return (
    <span
      draggable
      onDragStart={e => e.dataTransfer.setData('text/plain', person.name)}
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-white/5 border border-border-subtle cursor-grab active:cursor-grabbing hover:border-border-strong hover:bg-white/10 transition-all select-none',
        small ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
      )}
      title={`${ROSTER_ROLE_LABELS[person.role]} · drag to a team, a Lead/ASM slot, or back to Unassigned`}
    >
      <GripVertical className="w-2.5 h-2.5 text-text-muted" />
      {person.name}
      <span className="text-[8px] text-text-muted uppercase">{person.role}</span>
    </span>
  );
}

interface TeamTreeProps {
  people: Person[];
  assignTeam: (name: string, team: string) => void;
}

export function TeamTree({ people, assignTeam }: TeamTreeProps) {
  const { state: teams, setState: setTeams, reset } = useLocalState<TeamData[]>('se-teams-v2', DEFAULT_TREE_TEAMS);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const byName = (name: string) => people.find(p => p.name.toLowerCase() === name.toLowerCase());

  const unassigned = people.filter(p =>
    !p.team && !teams.some(t => t.lead.toLowerCase() === p.name.toLowerCase() || t.asm.toLowerCase() === p.name.toLowerCase())
  );

  const membersOf = (team: TeamData) =>
    people.filter(p =>
      p.team === team.name &&
      p.name.toLowerCase() !== team.lead.toLowerCase() &&
      p.name.toLowerCase() !== team.asm.toLowerCase()
    );

  const dropProps = (zone: string, onDropName: (name: string) => void) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragOver(zone); },
    onDragLeave: () => setDragOver(prev => (prev === zone ? null : prev)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(null);
      const name = e.dataTransfer.getData('text/plain');
      if (name) onDropName(name);
    },
  });

  // Clear a name from any Lead/ASM slot it occupies (so the top two can be
  // pulled out of a team, not just regular members)
  const clearSlots = (name: string) =>
    setTeams(prev => prev.map(t => ({
      ...t,
      lead: t.lead.toLowerCase() === name.toLowerCase() ? 'Drop a Lead here' : t.lead,
      asm: t.asm.toLowerCase() === name.toLowerCase() ? 'Drop an ASM here' : t.asm,
    })));

  const unassign = (name: string) => {
    clearSlots(name);
    assignTeam(name, '');
  };

  const setSlot = (teamIndex: number, slot: 'lead' | 'asm', name: string) => {
    setTeams(prev => prev.map((t, i) => (i === teamIndex ? { ...t, [slot]: name } : t)));
    const team = teams[teamIndex];
    if (team) assignTeam(name, team.name);
  };

  const addTeam = () =>
    setTeams(prev => [...prev, {
      name: `Team ${String.fromCharCode(65 + (prev.length % 26))}`,
      change: '+0%', lines: 0, premium: 0, fiber: 0, progress: 0,
      color: TEAM_COLORS[prev.length % TEAM_COLORS.length],
      lead: 'Drop a Lead here', asm: 'Drop an ASM here', members: [],
    }]);

  const removeTeam = (index: number) => {
    const team = teams[index];
    if (team) people.filter(p => p.team === team.name).forEach(p => assignTeam(p.name, ''));
    setTeams(prev => prev.filter((_, i) => i !== index));
  };

  const borderColors: Record<string, string> = {
    blue: 'border-accent-blue/25',
    purple: 'border-accent-purple/25',
    cyan: 'border-accent-cyan/25',
    yellow: 'border-accent-yellow/25',
  };

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-secondary flex items-center gap-2">
          <Network className="w-4 h-4" />
          Team Builder <span className="text-[10px] text-text-muted font-normal">(drag people between teams — who falls under who)</span>
        </h3>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={addTeam}><Plus className="w-3.5 h-3.5" /> Add Team</Button>
          <Button variant="ghost" size="sm" onClick={reset}>↻</Button>
        </div>
      </div>

      {/* Unassigned pool */}
      <div
        {...dropProps('pool', name => unassign(name))}
        className={cn(
          'p-3 rounded-xl border border-dashed mb-3 transition-all min-h-[52px]',
          dragOver === 'pool' ? 'border-accent-blue bg-accent-blue/10' : 'border-border-strong bg-white/[0.02]'
        )}
      >
        <p className="text-[9px] text-text-muted uppercase tracking-wider mb-1.5">
          Unassigned ({unassigned.length}) — drag onto a team below · drop here to unassign
        </p>
        <div className="flex flex-wrap gap-1.5">
          {unassigned.map(p => <PersonChip key={p.id} person={p} />)}
          {unassigned.length === 0 && <span className="text-[10px] text-text-muted">Everyone is on a team 🎉</span>}
        </div>
      </div>

      {/* Team org tree */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {teams.map((team, ti) => {
          const asm = byName(team.asm);
          const lead = byName(team.lead);
          const members = membersOf(team);
          return (
            <div
              key={ti}
              {...dropProps(`team-${ti}`, name => assignTeam(name, team.name))}
              className={cn(
                'group relative p-4 rounded-xl glass border transition-all',
                borderColors[team.color] ?? borderColors.blue,
                dragOver === `team-${ti}` && 'ring-2 ring-accent-blue/50 bg-accent-blue/5'
              )}
            >
              <button
                onClick={() => removeTeam(ti)}
                className="absolute top-2 right-2 p-1 rounded-lg text-text-muted opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:text-accent-red hover:bg-accent-red/10 transition-all"
                aria-label={`Remove ${team.name}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <Editable
                value={team.name}
                onCommit={v => {
                  const newName = v.trim();
                  if (!newName || newName === team.name) return;
                  people.filter(p => p.team === team.name).forEach(p => assignTeam(p.name, newName));
                  setTeams(prev => prev.map((t, i) => (i === ti ? { ...t, name: newName } : t)));
                }}
                className="font-semibold text-sm block mb-2"
              />

              {/* ASM level */}
              <div
                {...dropProps(`asm-${ti}`, name => setSlot(ti, 'asm', name))}
                className={cn('group/slot flex items-center gap-2 p-1.5 rounded-lg transition-all', dragOver === `asm-${ti}` && 'bg-accent-yellow/10 ring-1 ring-accent-yellow/40')}
              >
                <span className="text-[9px] text-accent-yellow uppercase tracking-wider w-10">ASM</span>
                {asm ? (
                  <>
                    <PersonChip person={asm} small />
                    <button
                      onClick={() => unassign(asm.name)}
                      className="text-[10px] text-text-muted opacity-100 md:opacity-0 md:group-hover/slot:opacity-100 hover:text-accent-red transition-all"
                      aria-label={`Remove ${asm.name} as ASM`}
                      title="Unassign"
                    >
                      ×
                    </button>
                  </>
                ) : <span className="text-[10px] text-text-muted italic">{team.asm}</span>}
              </div>

              {/* Lead level */}
              <div className="ml-4 border-l border-border-strong pl-3">
                <div
                  {...dropProps(`lead-${ti}`, name => setSlot(ti, 'lead', name))}
                  className={cn('group/slot flex items-center gap-2 p-1.5 rounded-lg transition-all', dragOver === `lead-${ti}` && 'bg-accent-purple/10 ring-1 ring-accent-purple/40')}
                >
                  <span className="text-[9px] text-accent-purple uppercase tracking-wider w-10">Lead</span>
                  {lead ? (
                    <>
                      <PersonChip person={lead} small />
                      <button
                        onClick={() => unassign(lead.name)}
                        className="text-[10px] text-text-muted opacity-100 md:opacity-0 md:group-hover/slot:opacity-100 hover:text-accent-red transition-all"
                        aria-label={`Remove ${lead.name} as Lead`}
                        title="Unassign"
                      >
                        ×
                      </button>
                    </>
                  ) : <span className="text-[10px] text-text-muted italic">{team.lead}</span>}
                </div>

                {/* Members level */}
                <div className="ml-4 border-l border-border-subtle pl-3 py-1 space-y-1">
                  {members.map(m => (
                    <div key={m.id} className="flex items-center gap-2">
                      <span className="text-[9px] text-text-muted uppercase tracking-wider w-10">{m.role === 'INTERN' ? 'Intern' : 'Rep'}</span>
                      <PersonChip person={m} small />
                    </div>
                  ))}
                  {members.length === 0 && (
                    <p className="text-[10px] text-text-muted italic py-1">Drop reps &amp; interns here</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
