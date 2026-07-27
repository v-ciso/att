'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { CalendarCheck, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { loadAttendance, AttendanceStatus, AttendanceBook, todayStr } from '@/lib/sales';
import { Person } from './roster';

// The attendance RECORD. Marking someone late in the Daily Tracker was writing
// to storage but there was nowhere to read it back — so "who was late last
// week" had no answer. This is that answer, per rep and per period.

type Span = 'week' | 'month' | 'year';

const SPAN_DAYS: Record<Span, number> = { week: 7, month: 30, year: 365 };
const SPAN_LABEL: Record<Span, string> = { week: 'This week', month: 'Last 30 days', year: 'Last 12 months' };

const MARK = {
  P: { label: 'Present', cls: 'bg-accent-green/20 text-accent-green border-accent-green/40' },
  L: { label: 'Late', cls: 'bg-accent-yellow/20 text-accent-yellow border-accent-yellow/40' },
  A: { label: 'Absent', cls: 'bg-accent-red/20 text-accent-red border-accent-red/40' },
} as const;

export interface RepAttendance {
  person: string;
  present: number;
  late: number;
  absent: number;
  marked: number;
  /** Present = 1, Late = 0.5, Absent = 0 — the same weighting the roster uses. */
  score: number;
  lastLate: string | null;
  lastAbsent: string | null;
}

// Shift a YYYY-MM-DD string by N days.
function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function summarise(
  people: Person[], span: Span, book: Record<string, Record<string, AttendanceStatus>>, endDate: string,
): RepAttendance[] {
  const cutoff = shiftDate(endDate, -(SPAN_DAYS[span] - 1));
  return people.map(p => {
    let present = 0, late = 0, absent = 0;
    let lastLate: string | null = null;
    let lastAbsent: string | null = null;

    for (const [date, marks] of Object.entries(book)) {
      if (date < cutoff || date > endDate) continue;
      const status = marks[p.name];
      if (!status) continue;
      if (status === 'P') present++;
      else if (status === 'L') { late++; if (!lastLate || date > lastLate) lastLate = date; }
      else if (status === 'A') { absent++; if (!lastAbsent || date > lastAbsent) lastAbsent = date; }
    }

    const marked = present + late + absent;
    return {
      person: p.name,
      present, late, absent, marked,
      score: marked === 0 ? 0 : Math.round(((present + late * 0.5) / marked) * 1000) / 10,
      lastLate, lastAbsent,
    };
  });
}

export function AttendanceSheet({ people }: { people: Person[] }) {
  const [span, setSpan] = useState<Span>('week');
  const [end, setEnd] = useState(() => todayStr()); // window ends on this date
    // Attendance lives in localStorage. Reading it during render breaks
  // hydration (server renders {}, client renders real data) and caches the
  // snapshot forever, so marks made in the Daily Tracker never showed up here.
  // Load after mount and re-read on the same `se:data` / `storage` signals the
  // rest of the dashboard uses.
  const [book, setBook] = useState<AttendanceBook>({});
  useEffect(() => {
    const sync = () => setBook(loadAttendance());
    sync();
    window.addEventListener('se:data', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('se:data', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const rows = useMemo(() => summarise(people, span, book, end), [people, span, book, end]);
  const days = useMemo(
    () => Array.from({ length: Math.min(SPAN_DAYS[span], 30) }, (_, i) => shiftDate(end, -i)).reverse(),
    [span, end]
  );
  const shiftWindow = (dir: number) => setEnd(e => shiftDate(e, dir * SPAN_DAYS[span]));

  const totals = rows.reduce(
    (a, r) => ({ present: a.present + r.present, late: a.late + r.late, absent: a.absent + r.absent }),
    { present: 0, late: 0, absent: 0 }
  );
  const totalMarked = totals.present + totals.late + totals.absent;

  const exportCsv = () => {
    const header = ['Rep', 'Present', 'Late', 'Absent', 'Days marked', 'Score %', 'Last late', 'Last absent'];
    const body = rows.map(r => [r.person, r.present, r.late, r.absent, r.marked, r.score, r.lastLate ?? '', r.lastAbsent ?? '']);
    const csv = [header, ...body].map(line => line.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${span}-${todayStr()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-xl font-bold neon-brand flex items-center gap-2">
          <CalendarCheck className="w-5 h-5" style={{ color: 'var(--brand)' }} /> Attendance
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {/* A filter, not a tab strip: radiogroup so the active span is
              announced ("Weekly, selected, 1 of 3") instead of three buttons
              with no indication of which one is applied. */}
          <div className="flex gap-1.5" role="radiogroup" aria-label="Attendance period">
            {(['week', 'month', 'year'] as Span[]).map(s => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={span === s}
                onClick={() => setSpan(s)}
                className={cn(
                  'tab-btn min-h-11',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]',
                  span === s ? 'active' : 'inactive'
                )}
              >
                {s === 'week' ? 'Weekly' : s === 'month' ? 'Monthly' : 'Yearly'}
              </button>
            ))}
          </div>
          {/* Move the window: back/forward one period, or jump to a specific end date. */}
          <div className="flex items-center gap-1 rounded-lg bg-white/5 border border-border-subtle p-0.5">
            <button
              type="button"
              onClick={() => shiftWindow(-1)}
              className="p-2 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 sm:p-1.5 rounded hover:bg-white/10 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
              aria-label="Previous period"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <input
              type="date"
              value={end}
              max={todayStr()}
              onChange={e => e.target.value && setEnd(e.target.value)}
              className="bg-transparent text-sm px-1 min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] rounded"
              aria-label="Period end date"
            />
            <button
              type="button"
              onClick={() => shiftWindow(1)}
              disabled={end >= todayStr()}
              className="p-2 min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 sm:p-1.5 rounded hover:bg-white/10 disabled:opacity-30 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
              aria-label="Next period"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
          {/* A plain action that only borrows the chip styling — stays a button. */}
          <button
            type="button"
            onClick={() => setEnd(todayStr())}
            className="tab-btn inactive min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          >
            Today
          </button>
          <Button variant="secondary" size="sm" onClick={exportCsv}>
            <Download className="w-3.5 h-3.5" /> CSV
          </Button>
        </div>
      </div>
      <p className="text-xs text-text-secondary -mt-2 mb-3">
        {span === 'week' ? '7 days' : span === 'month' ? '30 days' : '12 months'} ending {end}
      </p>

      {totalMarked === 0 ? (
        <p className="text-xs text-text-muted p-3 rounded-xl bg-white/5">
          Nothing marked in this period. Mark Present / Late / Absent in the Daily Tracker and it lands here.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: SPAN_LABEL[span], value: `${Math.round(((totals.present + totals.late * 0.5) / totalMarked) * 100)}%`, cls: 'text-accent-green' },
              { label: 'Present', value: String(totals.present), cls: 'text-accent-green' },
              { label: 'Late', value: String(totals.late), cls: 'text-accent-yellow' },
              { label: 'Absent', value: String(totals.absent), cls: 'text-accent-red' },
            ].map(s => (
              <div key={s.label} className="p-4 rounded-xl glass border border-border-subtle">
                <p className="text-[11px] text-text-muted uppercase tracking-wider">{s.label}</p>
                <p className={cn('text-2xl font-bold mt-1', s.cls)}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-xs">
              <caption className="sr-only">
                Attendance summary per rep for the {SPAN_LABEL[span].toLowerCase()} ending {end}
              </caption>
              <thead>
                <tr className="text-left text-[11px] text-text-muted uppercase tracking-wider border-b border-border-subtle">
                  <th scope="col" className="pb-2">Rep</th>
                  <th scope="col" className="pb-2 text-right">Present</th>
                  <th scope="col" className="pb-2 text-right">Late</th>
                  <th scope="col" className="pb-2 text-right">Absent</th>
                  <th scope="col" className="pb-2 text-right">Score</th>
                  <th scope="col" className="pb-2 text-right">Last late</th>
                  <th scope="col" className="pb-2 text-right">Last absent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {/* Copy before sorting: `rows` comes from useMemo, and sorting in
                    place mutates the cached array on every render. */}
                {[...rows].sort((a, b) => b.score - a.score).map(r => (
                  <tr key={r.person} className="hover:bg-white/5 transition-colors">
                    <th scope="row" className="py-2 font-medium whitespace-nowrap text-left">{r.person}</th>
                    <td className="py-2 text-right text-accent-green">{r.present}</td>
                    <td className="py-2 text-right text-accent-yellow">{r.late || '—'}</td>
                    <td className="py-2 text-right text-accent-red">{r.absent || '—'}</td>
                    <td className={cn('py-2 text-right font-bold', r.score >= 90 ? 'text-accent-green' : r.score >= 75 ? 'text-accent-yellow' : 'text-accent-red')}>
                      {r.marked ? `${r.score}%` : '—'}
                    </td>
                    <td className="py-2 text-right text-text-muted">{r.lastLate ?? '—'}</td>
                    <td className="py-2 text-right text-text-muted">{r.lastAbsent ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Day-by-day grid: the "who was late yesterday" view. */}
          <h3 className="text-sm font-semibold text-text-secondary mt-6 mb-3">Day by day</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]" style={{ minWidth: `${140 + days.length * 34}px` }}>
              <caption className="sr-only">
                Day-by-day attendance mark per rep for the {days.length} periods ending {end}
              </caption>
              <thead>
                <tr className="text-left text-[10px] text-text-muted uppercase border-b border-border-subtle">
                  <th scope="col" className="pb-1.5 pr-2">Rep</th>
                  {days.map(d => (
                    <th key={d} scope="col" className="pb-1.5 px-0.5 text-center font-normal">
                      <span aria-hidden="true">{d.slice(5)}</span>
                      <span className="sr-only">{d}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {people.map(p => (
                  <tr key={p.id}>
                    <th scope="row" className="pr-2 py-1 font-medium whitespace-nowrap text-left">{p.name}</th>
                    {days.map(d => {
                      const status = book[d]?.[p.name];
                      return (
                        <td key={d} className="py-1 px-0.5 text-center">
                          {/* The letter + colour alone are not accessible: colour
                              can't be the only cue and `title` is not reliably
                              exposed to screen readers or touch. The visible
                              glyph is decorative; the sr-only text carries the
                              real meaning. */}
                          <span
                            className={cn(
                              'inline-block w-5 h-5 leading-5 rounded border text-[9px] font-bold',
                              status ? MARK[status].cls : 'border-border-subtle text-text-muted/40'
                            )}
                          >
                            <span aria-hidden="true">{status ?? '·'}</span>
                            <span className="sr-only">
                              {status ? `${MARK[status].label} on ${d}` : `Not marked on ${d}`}
                            </span>
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
