'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CalendarCheck, Maximize2, Minimize2 } from 'lucide-react';
import { useLocalState } from './editable-sections';
import { todayStr } from '@/lib/sales';
import { Person } from './roster';

// Who's where, next 7 days. Its own component so it can live as a tab, be
// presented fullscreen, and stay in sync (writes se-schedule-v1, which the
// Daily Tracker cross-references to lock each sale to the scheduled store).
export function ScheduleBoard({ people, storeOptions, compact = false }: { people: Person[]; storeOptions: string[]; compact?: boolean }) {
  const { state: schedule, setState: setSchedule } = useLocalState<Record<string, Record<string, string>>>('se-schedule-v1', {});
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => todayStr(i)), []);
  const setShift = (date: string, person: string, store: string) =>
    setSchedule(prev => ({ ...prev, [date]: { ...(prev[date] ?? {}), [person]: store } }));

  const panelRef = useRef<HTMLDivElement>(null);
  const [fs, setFs] = useState(false);
  useEffect(() => {
    const onFs = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);
  const present = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else panelRef.current?.requestFullscreen?.().catch(() => {});
  };

  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const lines: string[] = ['📅 Schedule'];
    for (const d of days) {
      const label = new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
      const day = schedule[d] ?? {};
      const byStore = new Map<string, string[]>();
      const off: string[] = [];
      people.forEach(p => {
        const s = day[p.name];
        if (!s) return;
        if (s === 'OFF') off.push(p.name);
        else byStore.set(s, [...(byStore.get(s) ?? []), p.name]);
      });
      if (byStore.size === 0 && off.length === 0) continue;
      lines.push(`\n${label}`);
      Array.from(byStore.entries()).forEach(([store, names]) => lines.push(`  ${store}: ${names.join(', ')}`));
      if (off.length) lines.push(`  OFF: ${off.join(', ')}`);
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* clipboard blocked */ }
  };

  const cell = fs ? 'text-sm py-1.5' : compact ? 'text-[11px]' : 'text-xs';

  return (
    <div ref={panelRef} className="presentable">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className={cn('font-semibold text-text-secondary flex items-center gap-2', compact ? 'text-sm' : 'text-xl neon-brand')}>
          <CalendarCheck className={cn(compact ? 'w-4 h-4' : 'w-5 h-5')} style={{ color: 'var(--brand)' }} />
          {compact ? "Schedule · who's where" : 'Schedule'}
        </h3>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={copy}>
            {copied ? '✓ Copied' : '📋 Copy for chat'}
          </Button>
          <Button size="sm" onClick={present}>
            {fs ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            {fs ? 'Exit' : 'Present'}
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className={cn('w-full', fs ? 'text-sm' : 'text-[11px]')}>
          <thead>
            <tr className="text-left text-[10px] text-text-muted uppercase tracking-wider border-b border-border-subtle">
              <th className="pb-1.5 pr-2">Rep</th>
              {days.map(d => (
                <th key={d} className="pb-1.5 px-1 text-center">
                  {new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                  <span className="block text-[9px] normal-case font-normal">{d.slice(5)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {people.map(p => (
              <tr key={p.id}>
                <td className={cn('pr-2 font-medium whitespace-nowrap', cell)}>{p.name}</td>
                {days.map(d => {
                  const val = schedule[d]?.[p.name] ?? '';
                  return (
                    <td key={d} className="py-1 px-0.5 text-center">
                      <select
                        value={val}
                        onChange={e => setShift(d, p.name, e.target.value)}
                        className={cn(
                          'w-full bg-bg-tertiary border rounded px-1 py-0.5 focus:outline-none cursor-pointer',
                          fs ? 'text-xs' : 'text-[9px]',
                          val === 'OFF' ? 'border-border-subtle text-text-muted' : val ? 'border-accent-cyan/30 text-accent-cyan' : 'border-border-subtle text-text-muted'
                        )}
                        aria-label={`${p.name} on ${d}`}
                      >
                        <option value="">—</option>
                        {storeOptions.map(s => <option key={s} value={s}>{s}</option>)}
                        {(p.stores ?? []).filter(s => !storeOptions.includes(s)).map(s => <option key={s} value={s}>{s}</option>)}
                        <option value="OFF">OFF</option>
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-text-muted">
        Set it in the morning meeting — the Daily Tracker locks each rep&apos;s sales to their scheduled store, and Copy exports it for Discord/iMessage.
      </p>
    </div>
  );
}
