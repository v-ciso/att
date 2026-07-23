'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Sparkles, ClipboardList, ChevronDown, ChevronUp, Maximize2, Minimize2, CalendarCheck } from 'lucide-react';
import {
  SaleEntry, loadSales, saveSales, loadCommission, entryRevenue, todayStr, generateDemoSales,
  AttendanceBook, AttendanceStatus, loadAttendance, saveAttendance, attendanceForDate,
  LateOutBook, loadLateOuts, saveLateOuts, isPhonePlan, scheduledStore,
} from '@/lib/sales';
import { loadPeople } from './roster';

interface DailyTrackerProps {
  onDataChange: () => void; // tells the dashboard to recompute derived stats
}

const selectClass =
  'bg-bg-tertiary border border-border-subtle rounded-lg px-2.5 py-2 text-xs text-white ' +
  'focus:outline-none focus:border-accent-blue/50 focus:ring-1 focus:ring-accent-blue/30';

export function DailyTracker({ onDataChange }: DailyTrackerProps) {
  const [sales, setSales] = useState<SaleEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const commission = useMemo(loadCommission, [sales]); // reread after changes
  const people = useMemo(loadPeople, [sales]);
  const plans = useMemo(
    () => [...commission.phonePlans.map(p => p.name), ...commission.internet.map(p => p.name)],
    [commission]
  );

  // Entry form — defaults to YESTERDAY: production is logged the morning after
  const [date, setDate] = useState(todayStr(-1));
  const [person, setPerson] = useState('');
  const [plan, setPlan] = useState('');
  const [qty, setQty] = useState(1);
  const [nextUps, setNextUps] = useState(0);
  const [insurance, setInsurance] = useState(0);
  const [entryStore, setEntryStore] = useState('');
  const [viewStore, setViewStore] = useState(''); // '' = all stores
  const [expanded, setExpanded] = useState<string | null>(null);

  // Attendance + late clock-outs for the selected date
  const [attendance, setAttendance] = useState<AttendanceBook>({});
  const [lateOuts, setLateOuts] = useState<LateOutBook>({});

  // Presentation mode for the tracker itself
  const panelRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);
  const togglePresent = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else panelRef.current?.requestFullscreen?.().catch(() => {});
  };

  useEffect(() => {
    setSales(loadSales());
    setAttendance(loadAttendance());
    setLateOuts(loadLateOuts());
    setLoaded(true);
  }, []);

  // Toggle a GPS late clock-out for a rep on this date. The store defaults to
  // where they sold that day (else their first store); the chargeback itself
  // is computed live in the aggregation at the Commission tab's $/line rate.
  const toggleLateOut = (name: string) => {
    setLateOuts(prev => {
      const day = [...(prev[date] ?? [])];
      const idx = day.findIndex(lo => lo.person === name);
      if (idx >= 0) {
        day.splice(idx, 1);
      } else {
        const p = people.find(pp => pp.name === name);
        const soldStore = sales.find(e => e.date === date && e.person === name)?.store;
        day.push({ person: name, store: soldStore ?? p?.stores?.[0] ?? 'Costco 1018' });
      }
      const next = { ...prev, [date]: day };
      saveLateOuts(next);
      onDataChange();
      return next;
    });
  };

  const setLateOutStore = (name: string, store: string) => {
    setLateOuts(prev => {
      const day = (prev[date] ?? []).map(lo => (lo.person === name ? { ...lo, store } : lo));
      const next = { ...prev, [date]: day };
      saveLateOuts(next);
      onDataChange();
      return next;
    });
  };

  // Preview of the charge: penalty × the marked store's PHONE LINES this date
  // (internet does not count), split between that store's late reps. No lines
  // that day → no charge.
  const latePreview = (name: string): { store: string; amount: number; lines: number; splitWith: number } | null => {
    const day = lateOuts[date] ?? [];
    const mine = day.find(lo => lo.person === name);
    if (!mine) return null;
    const sameStore = day.filter(lo => lo.store.toLowerCase() === mine.store.toLowerCase());
    const lines = sales
      .filter(e => e.date === date && e.store.toLowerCase() === mine.store.toLowerCase() && isPhonePlan(commission, e.plan))
      .reduce((a, e) => a + e.qty, 0);
    return {
      store: mine.store,
      lines,
      splitWith: sameStore.length,
      amount: (lines * (commission.latePenaltyPerLine ?? 15)) / Math.max(1, sameStore.length),
    };
  };

  const markAttendance = (name: string, status: AttendanceStatus | null) => {
    setAttendance(prev => {
      const day = { ...(prev[date] ?? {}) };
      if (status === null) delete day[name];
      else day[name] = status;
      const next = { ...prev, [date]: day };
      saveAttendance(next);
      onDataChange();
      return next;
    });
  };

  const attSummary = attendanceForDate(attendance, date);

  useEffect(() => {
    if (loaded) {
      saveSales(sales);
      onDataChange();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, loaded]);

  const selectedPerson = people.find(p => p.name === person) ?? people[0];
  const personStores = selectedPerson?.stores?.length ? selectedPerson.stores : ['Costco'];
  const allStores = Array.from(new Set(people.flatMap(p => p.stores ?? [])));
  // If this rep is scheduled somewhere that day, the sale is locked to that
  // store — no logging Sarah at Target when she was scheduled at Costco.
  const scheduledAt = scheduledStore(selectedPerson?.name ?? '', date);
  const effectiveStores = scheduledAt ? [scheduledAt] : personStores;

  const addEntry = () => {
    const who = person || people[0]?.name;
    const what = plan || plans[0];
    if (!who || !what || qty < 1) return;
    const store = scheduledAt || (effectiveStores.includes(entryStore) ? entryStore : effectiveStores[0]);
    setSales(prev => [
      {
        id: `s-${Date.now()}`,
        date,
        person: who,
        store,
        plan: what,
        qty,
        nextUps: Math.min(nextUps, qty),
        insurance: Math.min(insurance, qty),
      },
      ...prev,
    ]);
    setQty(1); setNextUps(0); setInsurance(0);
  };

  const removeEntry = (id: string) => setSales(prev => prev.filter(e => e.id !== id));

  const generateDemo = () => setSales(generateDemoSales(people, commission));
  const clearAll = () => {
    setSales([]);
    setAttendance({});
    setLateOuts({});
    saveAttendance({});
    saveLateOuts({});
    onDataChange();
  };

  const dayEntries = sales.filter(e =>
    e.date === date && (!viewStore || e.store.toLowerCase() === viewStore.toLowerCase())
  );
  const dayTotal = dayEntries.reduce((a, e) => a + entryRevenue(e, commission).total, 0);
  const visiblePeople = viewStore
    ? people.filter(p => (p.stores ?? []).some(s => s.toLowerCase() === viewStore.toLowerCase()))
    : people;

  return (
    <div ref={panelRef} className="presentable">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-xl font-bold neon-brand flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-accent-blue" /> Daily Tracker
          <span className="text-xs text-text-muted font-normal">yesterday&apos;s production, logged this morning</span>
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={togglePresent}>
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            {isFullscreen ? 'Exit' : 'Present'}
          </Button>
          <Button variant="secondary" size="sm" onClick={generateDemo}>
            <Sparkles className="w-3.5 h-3.5" /> Generate Demo Data
          </Button>
          <Button variant="ghost" size="sm" onClick={clearAll}>↻ Clear All</Button>
        </div>
      </div>

      {/* Entry form — the morning workflow: pick rep, pick plan, pick counts */}
      <div className="p-4 rounded-xl glass border border-accent-blue/20 mb-4">
        <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2.5">
          Log a sale — revenue, leaderboard &amp; dashboard update automatically at your current payouts
        </p>
        <div className="flex flex-wrap items-end gap-2.5">
          <label className="flex flex-col gap-1 text-[10px] text-text-muted uppercase tracking-wider">
            Date
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={selectClass} />
          </label>
          <label className="flex flex-col gap-1 text-[10px] text-text-muted uppercase tracking-wider">
            Rep
            <select value={person || selectedPerson?.name || ''} onChange={e => { setPerson(e.target.value); setEntryStore(''); }} className={selectClass}>
              {people.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] text-text-muted uppercase tracking-wider">
            Store {scheduledAt && <span className="text-accent-cyan normal-case">📅 scheduled</span>}
            <select
              value={scheduledAt || (effectiveStores.includes(entryStore) ? entryStore : effectiveStores[0])}
              onChange={e => setEntryStore(e.target.value)}
              disabled={!!scheduledAt}
              className={cn(selectClass, scheduledAt && 'opacity-70 cursor-not-allowed')}
              title={scheduledAt ? `Locked — scheduled at ${scheduledAt} on ${date}` : undefined}
            >
              {effectiveStores.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] text-text-muted uppercase tracking-wider">
            Plan
            <select value={plan || plans[0] || ''} onChange={e => setPlan(e.target.value)} className={selectClass}>
              <optgroup label="Phone Lines">
                {commission.phonePlans.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
              </optgroup>
              <optgroup label="Internet">
                {commission.internet.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
              </optgroup>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] text-text-muted uppercase tracking-wider">
            Qty
            <input type="number" min={1} max={99} value={qty} onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))} className={cn(selectClass, 'w-16')} />
          </label>
          <label className="flex flex-col gap-1 text-[10px] text-text-muted uppercase tracking-wider">
            Next Ups
            <input type="number" min={0} max={99} value={nextUps} onChange={e => setNextUps(Math.max(0, parseInt(e.target.value) || 0))} className={cn(selectClass, 'w-16')} />
          </label>
          <label className="flex flex-col gap-1 text-[10px] text-text-muted uppercase tracking-wider">
            Insurance
            <input type="number" min={0} max={99} value={insurance} onChange={e => setInsurance(Math.max(0, parseInt(e.target.value) || 0))} className={cn(selectClass, 'w-16')} />
          </label>
          <Button size="sm" onClick={addEntry}><Plus className="w-3.5 h-3.5" /> Add Sale</Button>
        </div>
      </div>

      {/* Attendance for the selected date */}
      <div className="p-4 rounded-xl glass border border-accent-green/20 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <p className="text-[10px] text-text-muted uppercase tracking-wider flex items-center gap-1.5">
            <CalendarCheck className="w-3.5 h-3.5 text-accent-green" /> Attendance · {date}
          </p>
          <p className="text-[10px] text-text-secondary">
            <span className="text-accent-green font-semibold">{attSummary.present} present</span> ·{' '}
            <span className="text-accent-yellow font-semibold">{attSummary.late} late</span> ·{' '}
            <span className="text-accent-red font-semibold">{attSummary.absent} absent</span> ·{' '}
            {people.length - attSummary.marked} unmarked
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
          {visiblePeople.map(p => {
            const status = attendance[date]?.[p.name] ?? null;
            const chip = (s: AttendanceStatus, label: string, active: string) => (
              <button
                key={s}
                onClick={() => markAttendance(p.name, status === s ? null : s)}
                className={cn(
                  'px-2 py-1.5 sm:px-1.5 sm:py-0.5 rounded text-[11px] sm:text-[9px] font-semibold border transition-all',
                  status === s ? active : 'border-border-subtle text-text-muted hover:text-white hover:bg-white/5'
                )}
              >
                {label}
              </button>
            );
            const late = latePreview(p.name);
            return (
              <div key={p.id} className="px-2.5 py-1.5 rounded-lg bg-white/[0.03]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs truncate">{p.name}</span>
                  <span className="flex gap-1">
                    {chip('P', 'Present', 'bg-accent-green/20 text-accent-green border-accent-green/40')}
                    {chip('L', 'Late', 'bg-accent-yellow/20 text-accent-yellow border-accent-yellow/40')}
                    {chip('A', 'Absent', 'bg-accent-red/20 text-accent-red border-accent-red/40')}
                    <button
                      onClick={() => toggleLateOut(p.name)}
                      className={cn(
                        'px-2 py-1.5 sm:px-1.5 sm:py-0.5 rounded text-[11px] sm:text-[9px] font-semibold border transition-all',
                        late ? 'bg-accent-orange/20 text-accent-orange border-accent-orange/40' : 'border-border-subtle text-text-muted hover:text-white hover:bg-white/5'
                      )}
                      title="GPS late clock-out — charges the store's whole day at the Commission tab's $/line rate, split between late reps"
                    >
                      ⏰ Late out
                    </button>
                  </span>
                </div>
                {late && (
                  <div className="flex items-center justify-between gap-2 mt-1 pl-1">
                    <select
                      value={late.store}
                      onChange={e => setLateOutStore(p.name, e.target.value)}
                      className="bg-bg-tertiary border border-border-subtle rounded px-1.5 py-0.5 text-[10px] text-text-secondary focus:outline-none"
                      aria-label={`Store where ${p.name} clocked out late`}
                    >
                      {(p.stores ?? []).map(s => <option key={s} value={s}>{s}</option>)}
                      {!(p.stores ?? []).includes(late.store) && <option value={late.store}>{late.store}</option>}
                    </select>
                    <span className="text-[10px] text-accent-orange font-semibold">
                      {late.lines === 0
                        ? `no lines at ${late.store} on ${date} — no chargeback`
                        : <>chargeback −{formatCurrency(late.amount)} <span className="text-text-muted font-normal">({late.lines} line{late.lines === 1 ? '' : 's'} × ${commission.latePenaltyPerLine ?? 15}{late.splitWith > 1 ? ` ÷ ${late.splitWith}` : ''})</span></>}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Day summary + entries with revenue breakdown */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <p className="text-xs text-text-secondary">
          {dayEntries.length} entr{dayEntries.length === 1 ? 'y' : 'ies'} on{' '}
          <span className="text-white font-medium">{date}</span>
          {viewStore && <span className="text-accent-blue"> · {viewStore}</span>}
        </p>
        <div className="flex items-center gap-2">
          <select
            value={viewStore}
            onChange={e => setViewStore(e.target.value)}
            className={cn(selectClass, 'py-1')}
            aria-label="Filter entries by store"
          >
            <option value="">All stores</option>
            {allStores.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <p className="text-xs whitespace-nowrap">
            Office generated: <span className="text-accent-green font-bold">{formatCurrency(dayTotal)}</span>
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        {dayEntries.length === 0 && (
          <p className="text-xs text-text-muted p-4 rounded-xl bg-white/5 text-center">
            No sales logged for this date yet — add one above, or Generate Demo Data to fill the whole tool with sample numbers.
          </p>
        )}
        {dayEntries.map(entry => {
          const { total, repTotal, parts } = entryRevenue(entry, commission);
          const isOpen = expanded === entry.id;
          return (
            <div key={entry.id} className="group rounded-xl glass border border-border-subtle overflow-hidden">
              <div className="flex items-center gap-3 px-3 py-2 text-xs">
                <span className="font-semibold min-w-[110px]">{entry.person}</span>
                <span className="text-text-secondary">{entry.store}</span>
                <span className="px-2 py-0.5 rounded-full bg-accent-blue/10 text-accent-blue border border-accent-blue/20 text-[10px]">
                  {entry.qty} × {entry.plan}
                </span>
                {entry.nextUps > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-accent-red/10 text-accent-red border border-accent-red/20 text-[10px]">
                    {entry.nextUps} Next Up
                  </span>
                )}
                {entry.insurance > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-accent-purple/10 text-accent-purple border border-accent-purple/20 text-[10px]">
                    {entry.insurance} Ins.
                  </span>
                )}
                <span className="ml-auto text-accent-green font-bold">{formatCurrency(total)}</span>
                <button
                  onClick={() => setExpanded(isOpen ? null : entry.id)}
                  className="p-1 rounded text-text-muted hover:text-white transition-colors"
                  aria-label="Show revenue breakdown"
                >
                  {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => removeEntry(entry.id)}
                  className="p-1 rounded text-text-muted opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:text-accent-red transition-all"
                  aria-label="Remove entry"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {isOpen && (
                <div className="px-4 pb-2.5 pt-1 border-t border-border-subtle bg-white/[0.02]">
                  <p className="text-[9px] text-text-muted uppercase tracking-wider mb-1">Where this money comes from</p>
                  {parts.map((part, i) => (
                    <div key={i} className="flex justify-between text-[11px] py-0.5">
                      <span className="text-text-secondary">{part.label}</span>
                      <span className="text-accent-green">{formatCurrency(part.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-[11px] py-0.5 border-t border-border-subtle mt-1 pt-1">
                    <span className="text-text-secondary">Rep&apos;s commission (your rates)</span>
                    <span className="text-accent-blue font-semibold">{formatCurrency(repTotal)}</span>
                  </div>
                  <p className="text-[9px] text-text-muted mt-1">
                    Office totals priced at Tier {commission.tier} with {entry.store}&apos;s multiplier — the rep cut is the flat amount you set per plan in the Commission tab.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
