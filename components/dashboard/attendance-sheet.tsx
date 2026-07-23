'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { CalendarCheck, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { loadAttendance, AttendanceStatus, todayStr } from '@/lib/sales';
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

export function summarise(people: Person[], span: Span, book: Record<string, Record<string, AttendanceStatus>>): RepAttendance[] {
  const cutoff = todayStr(-(SPAN_DAYS[span] - 1));
  return people.map(p => {
    let present = 0, late = 0, absent = 0;
    let lastLate: string | null = null;
    let lastAbsent: string | null = null;

    for (const [date, marks] of Object.entries(book)) {
      if (date < cutoff || date > todayStr()) continue;
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
  const book = useMemo(loadAttendance, []);

  const rows = useMemo(() => summarise(people, span, book), [people, span, book]);
  const days = useMemo(
    () => Array.from({ length: Math.min(SPAN_DAYS[span], 30) }, (_, i) => todayStr(-i)).reverse(),
    [span]
  );

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
          <div className="flex gap-1.5">
            {(['week', 'month', 'year'] as Span[]).map(s => (
              <button key={s} onClick={() => setSpan(s)} className={cn('tab-btn', span === s ? 'active' : 'inactive')}>
                {s === 'week' ? 'Weekly' : s === 'month' ? 'Monthly' : 'Yearly'}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" onClick={exportCsv}>
            <Download className="w-3.5 h-3.5" /> CSV
          </Button>
        </div>
      </div>

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
              <thead>
                <tr className="text-left text-[10px] text-text-muted uppercase tracking-wider border-b border-border-subtle">
                  <th className="pb-2">Rep</th>
                  <th className="pb-2 text-right">Present</th>
                  <th className="pb-2 text-right">Late</th>
                  <th className="pb-2 text-right">Absent</th>
                  <th className="pb-2 text-right">Score</th>
                  <th className="pb-2 text-right">Last late</th>
                  <th className="pb-2 text-right">Last absent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {rows.sort((a, b) => b.score - a.score).map(r => (
                  <tr key={r.person} className="hover:bg-white/5 transition-colors">
                    <td className="py-2 font-medium whitespace-nowrap">{r.person}</td>
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
              <thead>
                <tr className="text-left text-[9px] text-text-muted uppercase border-b border-border-subtle">
                  <th className="pb-1.5 pr-2">Rep</th>
                  {days.map(d => (
                    <th key={d} className="pb-1.5 px-0.5 text-center font-normal">{d.slice(5)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {people.map(p => (
                  <tr key={p.id}>
                    <td className="pr-2 py-1 font-medium whitespace-nowrap">{p.name}</td>
                    {days.map(d => {
                      const status = book[d]?.[p.name];
                      return (
                        <td key={d} className="py-1 px-0.5 text-center">
                          <span
                            className={cn(
                              'inline-block w-5 h-5 leading-5 rounded border text-[9px] font-bold',
                              status ? MARK[status].cls : 'border-border-subtle text-text-muted/40'
                            )}
                            title={status ? `${p.name}: ${MARK[status].label} on ${d}` : `${p.name}: not marked on ${d}`}
                          >
                            {status ?? '·'}
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
