'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CalendarCheck, ChevronLeft, ChevronRight, Maximize2, Minimize2, AlertTriangle, Store as StoreIcon, X } from 'lucide-react';
import { useLocalState } from './editable-sections';
import { todayStr } from '@/lib/sales';
import { Person } from './roster';
import { SHIFT_CODES, ShiftCode, shiftTime, encodeShift, parseShift, storeCoverage, Coverage } from '@/lib/shifts';

// Store-first, one-day-at-a-time schedule. The old rep x 30-day grid forced a
// horizontal scroll; this pages by DATE (arrows + a picker) and stacks one card
// per store, so it fits any screen including a phone. Each card shows coverage
// and warns when a store is not properly staffed.
//
// Data shapes are unchanged so the Daily Tracker's store-lock and the sync
// layer keep working:
//   se-schedule-v1     { date: { person: "store|CODE" | "OFF" } }
//   se-store-closed-v1 { date: string[] }   // stores marked closed that day

type ScheduleMap = Record<string, Record<string, string>>;
type ClosedMap = Record<string, string[]>;

const STATUS_STYLE: Record<Coverage['status'], string> = {
  ok: 'bg-accent-green/15 text-accent-green border-accent-green/30',
  thin: 'bg-accent-yellow/15 text-accent-yellow border-accent-yellow/30',
  gap: 'bg-accent-orange/15 text-accent-orange border-accent-orange/30',
  unstaffed: 'bg-accent-red/15 text-accent-red border-accent-red/30',
  closed: 'bg-white/5 text-text-muted border-border-subtle',
};

function fmtDay(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export function ScheduleBoard({ people, storeOptions, compact = false }: {
  people: Person[]; storeOptions: string[]; compact?: boolean;
}) {
  const { state: schedule, setState: setSchedule } = useLocalState<ScheduleMap>('se-schedule-v1', {});
  const { state: closed, setState: setClosed } = useLocalState<ClosedMap>('se-store-closed-v1', {});
  const [date, setDate] = useState(() => todayStr());

  const dayPlan = schedule[date] ?? {};
  const closedToday = closed[date] ?? [];

  const setShift = (person: string, value: string) =>
    setSchedule(prev => {
      const day = { ...(prev[date] ?? {}) };
      if (!value) delete day[person]; else day[person] = value;
      return { ...prev, [date]: day };
    });

  const toggleClosed = (store: string) =>
    setClosed(prev => {
      const list = new Set(prev[date] ?? []);
      if (list.has(store)) list.delete(store); else list.add(store);
      return { ...prev, [date]: Array.from(list) };
    });

  // person -> {store, code} for this date (Map for O(1) lookups per the guide)
  const placed = useMemo(() => {
    const m = new Map<string, { store: string; code: ShiftCode }>();
    for (const [person, value] of Object.entries(dayPlan)) {
      const { store, code } = parseShift(value);
      if (store && code) m.set(person, { store, code });
    }
    return m;
  }, [dayPlan]);

  const unscheduled = people.filter(p => !placed.has(p.name));

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
    const lines: string[] = [`Schedule - ${fmtDay(date)}`];
    for (const store of storeOptions) {
      if (closedToday.includes(store)) { lines.push(`\n${store}: CLOSED`); continue; }
      const here = Array.from(placed.entries()).filter(([, v]) => v.store === store);
      if (!here.length) continue;
      lines.push(`\n${store}`);
      // AM first, then SWING, PM, FULL - one consistent order.
      for (const code of SHIFT_CODES) {
        const names = here.filter(([, v]) => v.code === code).map(([n]) => n);
        if (names.length) lines.push(`  ${code} ${shiftTime(store, date, code)}: ${names.join(', ')}`);
      }
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true); setTimeout(() => setCopied(false), 2500);
    } catch { /* clipboard blocked */ }
  };

  const step = (days: number) => setDate(d => {
    const nd = new Date(d + 'T12:00:00'); nd.setDate(nd.getDate() + days);
    return nd.toISOString().slice(0, 10);
  });

  const warnings = storeOptions
    .map(store => ({ store, cov: coverageFor(store, placed, closedToday) }))
    .filter(x => x.cov.status === 'gap' || x.cov.status === 'unstaffed' || x.cov.status === 'thin');

  return (
    <div ref={panelRef} className="presentable">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className={cn('font-semibold text-text-secondary flex items-center gap-2', compact ? 'text-sm' : 'text-xl neon-brand')}>
          <CalendarCheck className={cn(compact ? 'w-4 h-4' : 'w-5 h-5')} style={{ color: 'var(--brand)' }} />
          {compact ? "Schedule" : 'Schedule'}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {/* Date pager: arrows + a picker to jump to any specific day. */}
          <div className="flex items-center gap-1 rounded-lg bg-white/5 border border-border-subtle p-0.5">
            <button
              type="button"
              onClick={() => step(-1)}
              className="w-9 h-9 inline-flex items-center justify-center rounded hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
              aria-label="Previous day"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <input
              type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)}
              className="bg-transparent text-sm px-1 min-h-9 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] rounded"
              aria-label="Pick a schedule date"
            />
            <button
              type="button"
              onClick={() => step(1)}
              className="w-9 h-9 inline-flex items-center justify-center rounded hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
              aria-label="Next day"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setDate(todayStr())}
            className="tab-btn inactive min-h-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          >
            Today
          </button>
          <Button variant="secondary" size="sm" onClick={copy}>{copied ? 'Copied' : 'Copy'}</Button>
          {!compact && (
            <Button size="sm" onClick={present}>
              {fs ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              {fs ? 'Exit' : 'Present'}
            </Button>
          )}
        </div>
      </div>

      <p className="text-sm text-text-secondary mb-3">{fmtDay(date)}</p>

      {warnings.length > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-accent-orange/10 border border-accent-orange/25 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-accent-orange flex-none mt-0.5" />
          <p className="text-xs text-text-secondary">
            <span className="font-semibold text-accent-orange">Staffing gaps: </span>
            {warnings.map(w => `${w.store} (${w.cov.label.toLowerCase()})`).join(' · ')}. Fix them below, or mark a store closed.
          </p>
        </div>
      )}

      {storeOptions.length === 0 ? (
        <p className="text-xs text-text-muted p-3 rounded-xl bg-white/5">No stores yet - add them in the Commission tab or the setup guide.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {storeOptions.map(store => (
            <StoreCard
              key={store}
              store={store} date={date} people={people} placed={placed}
              closed={closedToday.includes(store)}
              onToggleClosed={() => toggleClosed(store)}
              onAssign={(person, code) => setShift(person, code ? encodeShift(store, code) : '')}
            />
          ))}
        </div>
      )}

      {unscheduled.length > 0 && (
        <div className="mt-4 p-3 rounded-xl bg-white/[0.03] border border-border-subtle">
          <p className="text-[11px] uppercase tracking-wider text-text-muted mb-2">Not scheduled ({unscheduled.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {unscheduled.map(p => <span key={p.id} className="px-2 py-1 rounded-lg bg-white/5 text-xs">{p.name}</span>)}
          </div>
        </div>
      )}

      <p className="mt-3 text-[11px] text-text-muted">
        Assign each rep to a shift per store. The Daily Tracker locks a rep&apos;s sale to their scheduled store, and Copy exports it for chat.
      </p>
    </div>
  );
}

// Coverage for one store, from the shared pure helper.
function coverageFor(store: string, placed: Map<string, { store: string; code: ShiftCode }>, closedToday: string[]): Coverage {
  const codes = Array.from(placed.values()).filter(v => v.store === store).map(v => v.code);
  return storeCoverage(codes, closedToday.includes(store));
}

function StoreCard({ store, date, people, placed, closed, onToggleClosed, onAssign }: {
  store: string; date: string; people: Person[];
  placed: Map<string, { store: string; code: ShiftCode }>;
  closed: boolean;
  onToggleClosed: () => void;
  onAssign: (person: string, code: ShiftCode | null) => void;
}) {
  const cov = coverageFor(store, placed, closed ? [store] : []);
  // Only reps who can work this store (their stores list, or anyone if unset).
  const eligible = people.filter(p => !p.stores?.length || p.stores.includes(store));

  return (
    <div className={cn('p-4 rounded-xl glass border', closed ? 'border-border-subtle opacity-70' : 'border-border-subtle')}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h4 className="font-semibold flex items-center gap-2">
          <StoreIcon className="w-4 h-4" style={{ color: 'var(--brand)' }} /> {store}
        </h4>
        <div className="flex items-center gap-2">
          <span className={cn('text-[10px] px-2 py-0.5 rounded-full border', STATUS_STYLE[cov.status])}>{cov.label}</span>
          <button
            onClick={onToggleClosed}
            className={cn('text-[10px] px-2 py-0.5 rounded-lg border transition-colors',
              closed ? 'border-accent-red/40 text-accent-red' : 'border-border-subtle text-text-muted hover:text-white')}
          >
            {closed ? 'Closed' : 'Mark closed'}
          </button>
        </div>
      </div>

      {closed ? (
        <p className="text-xs text-text-muted">Store marked closed for this day - no coverage expected.</p>
      ) : (
        <div className="space-y-2">
          {SHIFT_CODES.map(code => {
            const assigned = eligible.filter(p => placed.get(p.name)?.store === store && placed.get(p.name)?.code === code);
            return (
              <div key={code} className="flex flex-wrap items-center gap-1.5">
                <span className="w-24 flex-none text-[11px] text-text-muted">
                  <span className="font-semibold text-text-secondary">{code}</span> {shiftTime(store, date, code)}
                </span>
                {assigned.map(p => (
                  <button
                    key={p.id}
                    onClick={() => onAssign(p.name, null)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-[rgba(var(--brand-rgb),0.15)] text-[color:var(--brand)] border border-[rgba(var(--brand-rgb),0.3)]"
                    title="Click to unassign"
                  >
                    {p.name} <X className="w-3 h-3" />
                  </button>
                ))}
                <select
                  value=""
                  onChange={e => { if (e.target.value) onAssign(e.target.value, code); }}
                  className="text-xs bg-bg-tertiary border border-border-subtle rounded-lg px-2 py-1 text-text-secondary focus:outline-none cursor-pointer"
                  aria-label={`Add someone to ${store} ${code}`}
                >
                  <option value="">+ add</option>
                  {eligible
                    .filter(p => {
                      const cur = placed.get(p.name);
                      return !cur || cur.store !== store || cur.code !== code;
                    })
                    .map(p => {
                      const cur = placed.get(p.name);
                      const elsewhere = cur ? ` (${cur.store === store ? cur.code : cur.store})` : '';
                      return <option key={p.id} value={p.name}>{p.name}{elsewhere}</option>;
                    })}
                </select>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
