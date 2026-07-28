'use client';

import { useEffect, useMemo, useState } from 'react';
import { Trophy, MapPin, CalendarDays, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ATTENDANCE_LABEL, loadAttendance, loadSales, type AttendanceStatus } from '@/lib/sales';
import { fetchCompetitionWins } from '@/lib/competitions-client';
import {
  attendanceHistory,
  tenureTimeline,
  tenureDays,
  storesWorked,
  salesSpan,
  type TimelineKind,
} from '@/lib/rep-history';
import type { Person } from './roster';

const STATUS_COLOR: Record<AttendanceStatus, string> = {
  P: 'text-accent-green',
  L: 'text-accent-yellow',
  A: 'text-accent-red',
  E: 'text-accent-blue',
};

const TIMELINE_COPY: Record<TimelineKind, { label: string; dot: string }> = {
  hired: { label: 'Hired', dot: 'bg-accent-green' },
  rehired: { label: 'Rehired', dot: 'bg-accent-blue' },
  retired: { label: 'Retired', dot: 'bg-text-muted' },
};

function fmtDate(iso: string) {
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/**
 * A rep's lifetime record: tenure, reliability, stores worked, comps won.
 *
 * Everything is derived on render from the sales/attendance/roster data that
 * already exists (see lib/rep-history.ts) so it can never disagree with the
 * Daily Tracker. The only network read is the trophy count, which lives in the
 * frozen competition standings rather than on the roster row.
 */
export function RepLifetime({ person }: { person: Person }) {
  const [wins, setWins] = useState<number | null>(null);

  // Matches the existing fetch-in-effect pattern used by the competition tab;
  // failures resolve to {} so the panel still renders without a trophy count.
  useEffect(() => {
    let alive = true;
    fetchCompetitionWins()
      .then(map => {
        if (!alive) return;
        const byId = person.id ? map[person.id] : undefined;
        const byName = Object.values(map).find(
          w => w.personName.trim().toLowerCase() === person.name.trim().toLowerCase()
        );
        setWins((byId ?? byName)?.wins ?? 0);
      })
      .catch(() => alive && setWins(0));
    return () => {
      alive = false;
    };
  }, [person.id, person.name]);

  const { att, timeline, days, stores, span } = useMemo(() => {
    const sales = loadSales();
    return {
      att: attendanceHistory(loadAttendance(), person.name),
      timeline: tenureTimeline(person),
      days: tenureDays(person),
      stores: storesWorked(sales, person),
      span: salesSpan(sales, person.name),
    };
  }, [person]);

  return (
    <section className="mt-4 pt-4 border-t border-border-subtle" aria-label={`${person.name} lifetime record`}>
      <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Lifetime Record</p>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="p-2 rounded-xl bg-white/5 text-center">
          <p className="text-[9px] text-text-muted uppercase tracking-wider">Tenure</p>
          <p className="text-sm font-bold text-accent-blue">
            {days === null ? '--' : days >= 365 ? `${(days / 365).toFixed(1)} yr` : `${days} d`}
          </p>
        </div>
        <div className="p-2 rounded-xl bg-white/5 text-center">
          <p className="text-[9px] text-text-muted uppercase tracking-wider">Reliability</p>
          <p className={cn('text-sm font-bold', att.tracked === 0 ? 'text-text-muted' : att.pct >= 90 ? 'text-accent-green' : 'text-accent-yellow')}>
            {att.tracked === 0 ? '--' : `${att.pct}%`}
          </p>
        </div>
        <div className="p-2 rounded-xl bg-white/5 text-center">
          <p className="text-[9px] text-text-muted uppercase tracking-wider">Comps Won</p>
          <p className="text-sm font-bold text-accent-yellow inline-flex items-center gap-1">
            {wins === null ? '--' : wins}
            {!!wins && <Trophy className="w-3 h-3" aria-hidden="true" />}
          </p>
        </div>
      </div>

      {days === null && (
        <p className="text-[10px] text-text-muted mb-3">
          No hire date on file — add one via Edit on the Roster tab to track tenure.
        </p>
      )}

      {/* Tenure timeline */}
      {timeline.length > 0 && (
        <div className="mb-3">
          <p className="text-[9px] text-text-muted uppercase tracking-wider mb-1.5 inline-flex items-center gap-1">
            <CalendarDays className="w-3 h-3" aria-hidden="true" /> Timeline
          </p>
          <ul className="space-y-1">
            {timeline.map((e, i) => (
              <li key={`${e.kind}-${e.date}-${i}`} className="flex items-center gap-2 text-[11px]">
                <span className={cn('w-1.5 h-1.5 rounded-full flex-none', TIMELINE_COPY[e.kind].dot)} aria-hidden="true" />
                <span className="text-text-secondary">{TIMELINE_COPY[e.kind].label}</span>
                <span className="text-text-muted">{fmtDate(e.date)}</span>
                {e.note && <span className="text-text-muted truncate">· {e.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Attendance breakdown */}
      <div className="mb-3">
        <p className="text-[9px] text-text-muted uppercase tracking-wider mb-1.5">
          Attendance {att.tracked > 0 && <span className="normal-case tracking-normal">({att.tracked} {att.tracked === 1 ? 'day' : 'days'} marked)</span>}
        </p>
        {att.tracked === 0 ? (
          <p className="text-[11px] text-text-muted">No days marked yet — mark attendance in the Daily Tracker.</p>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-1.5">
              {(['P', 'L', 'A', 'E'] as AttendanceStatus[]).map(s => (
                <div key={s} className="p-1.5 rounded-lg bg-white/5 text-center">
                  <p className="text-[8px] text-text-muted uppercase tracking-wider">{ATTENDANCE_LABEL[s]}</p>
                  <p className={cn('text-xs font-bold', STATUS_COLOR[s])}>{att.counts[s]}</p>
                </div>
              ))}
            </div>
            {att.presentStreak > 1 && (
              <p className="text-[10px] text-accent-green mt-1.5">{att.presentStreak} day present streak</p>
            )}
            {att.corrections.length > 0 && (
              <p className="text-[10px] text-text-muted mt-1.5 inline-flex items-center gap-1">
                <History className="w-3 h-3" aria-hidden="true" />
                {att.corrections.length} mark{att.corrections.length === 1 ? '' : 's'} corrected after the fact
              </p>
            )}
          </>
        )}
      </div>

      {/* Stores worked */}
      <div>
        <p className="text-[9px] text-text-muted uppercase tracking-wider mb-1.5 inline-flex items-center gap-1">
          <MapPin className="w-3 h-3" aria-hidden="true" /> Stores Worked
        </p>
        {stores.length === 0 ? (
          <p className="text-[11px] text-text-muted">No store assigned or sold in yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {stores.map(s => (
              <span key={s} className="px-2 py-0.5 rounded-full bg-white/5 text-[10px] text-text-secondary">{s}</span>
            ))}
          </div>
        )}
        {span && (
          <p className="text-[10px] text-text-muted mt-1.5">
            Sales recorded {fmtDate(span.first)} - {fmtDate(span.last)}
          </p>
        )}
      </div>
    </section>
  );
}
