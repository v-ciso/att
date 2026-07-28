'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { CalendarCheck, ChevronLeft, ChevronRight, Save, Undo2, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAnnounce } from '@/components/a11y/announcer';
import {
  AttendanceBook,
  AttendanceStatus,
  ATTENDANCE_LABEL,
  loadAttendance,
  saveAttendance,
  markStatus,
  markOf,
  scheduledStore,
  todayStr,
} from '@/lib/sales';
import type { Person } from './roster';

/**
 * The one attendance editing surface. Both the Daily Tracker strip and the Team
 * → Attendance grid render this, so the two can't drift apart the way they did
 * when each owned its own copy of the marking logic.
 *
 * Editing contract (same in both places):
 *  - marks go into a local draft, not straight to storage
 *  - an explicit Save (or Ctrl/Cmd+S) commits, with an aria-live confirmation
 *  - the viewed day is independent of any other date on the page, so you can
 *    correct last Tuesday without disturbing the row you're logging today
 *  - auto-save on unmount is a *fallback* so no click is ever lost; Save is the
 *    reassurance, not the only path
 */

const ORDER: AttendanceStatus[] = ['P', 'L', 'A', 'E'];

const CHIP: Record<AttendanceStatus, string> = {
  P: 'bg-accent-green/20 text-accent-green border-accent-green/50',
  L: 'bg-accent-yellow/20 text-accent-yellow border-accent-yellow/50',
  A: 'bg-accent-red/20 text-accent-red border-accent-red/50',
  E: 'bg-accent-blue/20 text-accent-blue border-accent-blue/50',
};

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  const a = new Date(from + 'T12:00:00').getTime();
  const b = new Date(to + 'T12:00:00').getTime();
  return Math.round((b - a) / 86_400_000);
}

export interface AttendanceEditorProps {
  people: Person[];
  /** Who gets stamped into `markedBy`. */
  markedBy?: string;
  /** Initial day. Defaults to today. */
  initialDate?: string;
  /** Rendered inside an existing card (Daily Tracker) vs standalone. */
  variant?: 'embedded' | 'standalone';
}

export function AttendanceEditor({
  people,
  markedBy = 'unknown',
  initialDate,
  variant = 'standalone',
}: AttendanceEditorProps) {
  const announce = useAnnounce();
  const today = todayStr();

  const [date, setDate] = useState(() => initialDate ?? todayStr());
  const [book, setBook] = useState<AttendanceBook>({});
  /** person -> status|null. Only holds cells touched since the last save. */
  const [draft, setDraft] = useState<Record<string, AttendanceStatus | null>>({});
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Storage is read after mount, never during render: reading in render makes the
  // server and client disagree and freezes the first snapshot forever.
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

  const dirtyCount = Object.keys(draft).length;
  const isDirty = dirtyCount > 0;

  /** Effective status for a rep on the viewed day: draft wins over stored. */
  const statusFor = useCallback(
    (name: string): AttendanceStatus | undefined => {
      if (name in draft) return draft[name] ?? undefined;
      return markStatus(book[date]?.[name]);
    },
    [draft, book, date]
  );

  const unmarked = people.filter(p => !statusFor(p.name)).length;

  // Committing merges the draft into the stored book, stamping an audit trail and
  // keeping the previous value in `editedFrom` so corrections stay traceable.
  const commit = useCallback(
    (d: Record<string, AttendanceStatus | null>, forDate: string, silent = false) => {
      const entries = Object.entries(d);
      if (entries.length === 0) return;

      const next: AttendanceBook = { ...loadAttendance() };
      const day = { ...(next[forDate] ?? {}) };
      const stamp = new Date().toISOString();

      for (const [name, status] of entries) {
        if (status === null) {
          delete day[name];
          continue;
        }
        const before = markStatus(day[name]);
        day[name] = {
          status,
          markedBy,
          markedAt: stamp,
          // Only record a correction when the value actually changed.
          ...(before && before !== status ? { editedFrom: before } : {}),
        };
      }

      if (Object.keys(day).length === 0) delete next[forDate];
      else next[forDate] = day;

      saveAttendance(next);
      setBook(next);
      setDraft({});

      if (!silent) {
        const when = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        setSavedAt(when);
        announce(
          `Saved. ${entries.length} ${entries.length === 1 ? 'rep' : 'reps'} marked for ${forDate} at ${when}.`,
          'polite'
        );
      }
    },
    [markedBy, announce]
  );

  // Auto-save fallback. Uses refs so the cleanup always sees the latest draft
  // instead of the values captured when the effect first ran — otherwise
  // navigating away mid-edit would silently drop the marks it was meant to save.
  const draftRef = useRef(draft);
  const dateRef = useRef(date);
  const commitRef = useRef(commit);
  useEffect(() => {
    draftRef.current = draft;
    dateRef.current = date;
    commitRef.current = commit;
  }, [draft, date, commit]);

  useEffect(
    () => () => {
      if (Object.keys(draftRef.current).length > 0) {
        commitRef.current(draftRef.current, dateRef.current, true);
      }
    },
    []
  );

  // Warn before a full page unload with unsaved marks. This cannot cover in-app
  // navigation, which is why the unmount fallback above also exists.
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  // Ctrl/Cmd+S saves instead of opening the browser's save dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (Object.keys(draftRef.current).length > 0) {
          commitRef.current(draftRef.current, dateRef.current);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const setMark = (name: string, status: AttendanceStatus) => {
    setSavedAt(null);
    setDraft(prev => {
      const current = statusFor(name);
      const nextStatus = current === status ? null : status;
      const stored = markStatus(book[date]?.[name]);
      const next = { ...prev };
      // Returning a cell to its stored value means it is no longer a change.
      if (nextStatus === stored) delete next[name];
      else next[name] = nextStatus;
      return next;
    });
  };

  const markAllPresent = () => {
    setSavedAt(null);
    setDraft(prev => {
      const next = { ...prev };
      for (const p of people) {
        if (statusFor(p.name)) continue; // don't overwrite an existing decision
        next[p.name] = 'P';
      }
      return next;
    });
    announce(`${unmarked} unmarked ${unmarked === 1 ? 'rep' : 'reps'} set to Present. Not saved yet.`, 'polite');
  };

  const copyFromScheduled = () => {
    setSavedAt(null);
    let n = 0;
    setDraft(prev => {
      const next = { ...prev };
      for (const p of people) {
        if (statusFor(p.name)) continue;
        if (scheduledStore(p.name, date)) {
          next[p.name] = 'P';
          n++;
        }
      }
      return next;
    });
    announce(
      n === 0
        ? `No scheduled shifts found for ${date}.`
        : `${n} scheduled ${n === 1 ? 'rep' : 'reps'} set to Present. Not saved yet.`,
      'polite'
    );
  };

  const discard = () => {
    setDraft({});
    setSavedAt(null);
    announce('Unsaved attendance changes discarded.', 'polite');
  };

  const offset = useMemo(() => daysBetween(date, today), [date, today]);
  const isToday = offset === 0;

  return (
    <section
      aria-labelledby="attendance-editor-heading"
      className={variant === 'standalone' ? 'p-4 rounded-xl glass border border-border-subtle' : ''}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3
          id="attendance-editor-heading"
          className="text-sm font-semibold flex items-center gap-2 text-text-secondary"
        >
          <CalendarCheck className="w-4 h-4 text-accent-green" aria-hidden="true" />
          Attendance
        </h3>

        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1 rounded-lg bg-white/5 border border-border-subtle p-0.5">
            <button
              type="button"
              onClick={() => setDate(d => shiftDate(d, -1))}
              className="p-2 min-w-11 min-h-11 rounded hover:bg-white/10 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
              aria-label="Previous day"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <input
              type="date"
              value={date}
              max={today}
              onChange={e => e.target.value && setDate(e.target.value)}
              className="bg-transparent text-sm px-1 min-h-11 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
              aria-label="Attendance date"
            />
            <button
              type="button"
              onClick={() => setDate(d => shiftDate(d, 1))}
              disabled={date >= today}
              className="p-2 min-w-11 min-h-11 rounded hover:bg-white/10 disabled:opacity-30 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
              aria-label="Next day"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setDate(today)} disabled={isToday}>
            Today
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setDate(shiftDate(today, -1))}
            disabled={offset === 1}
          >
            Yesterday
          </Button>
        </div>
      </div>

      {/* Back-dating must never be accidental, so the viewed day is stated
          outright whenever it isn't today. */}
      {!isToday && (
        <p className="text-xs mb-3 px-2.5 py-1.5 rounded-lg bg-accent-yellow/15 border border-accent-yellow/40 text-accent-yellow inline-flex items-center gap-1.5">
          <span aria-hidden="true">•</span>
          Editing {date} — {offset} {offset === 1 ? 'day' : 'days'} back
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Button variant="secondary" size="sm" onClick={markAllPresent} disabled={unmarked === 0}>
          <UserCheck className="w-3.5 h-3.5" aria-hidden="true" /> Mark all present
        </Button>
        <Button variant="secondary" size="sm" onClick={copyFromScheduled} disabled={unmarked === 0}>
          Copy from scheduled
        </Button>
        <span className="text-xs text-text-secondary">
          {unmarked === 0 ? 'All reps marked' : `${unmarked} unmarked`}
        </span>
      </div>

      <ul className="flex flex-col gap-1.5 mb-3">
        {people.map(p => {
          const status = statusFor(p.name);
          const changed = p.name in draft;
          const audit = markOf(book[date]?.[p.name]);
          return (
            <li
              key={p.id}
              className={cn(
                'flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg',
                changed ? 'bg-[var(--brand)]/10 ring-1 ring-[var(--brand)]/40' : 'bg-white/5'
              )}
            >
              <span className="text-xs font-medium flex items-center gap-1.5">
                {p.name}
                {changed && <span className="text-[10px] text-[var(--brand)]">unsaved</span>}
                {!changed && audit?.editedFrom && (
                  <span className="text-[10px] text-text-muted">
                    changed from {ATTENDANCE_LABEL[audit.editedFrom]}
                    {audit.markedBy ? ` by ${audit.markedBy}` : ''}
                  </span>
                )}
              </span>
              {/* Toggle buttons rather than radios: clicking the active choice
                  clears the mark, which radio semantics can't express. */}
              <span role="group" aria-label={`Attendance for ${p.name} on ${date}`} className="flex gap-1">
                {ORDER.map(s => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={status === s}
                    onClick={() => setMark(p.name, s)}
                    className={cn(
                      'min-w-11 min-h-11 px-2 rounded-lg border text-[11px] font-bold transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]',
                      status === s ? CHIP[s] : 'border-border-subtle text-text-muted hover:bg-white/10'
                    )}
                  >
                    <span aria-hidden="true">{s}</span>
                    <span className="sr-only">{ATTENDANCE_LABEL[s]}</span>
                  </button>
                ))}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => commit(draft, date)} disabled={!isDirty}>
          <Save className="w-3.5 h-3.5" aria-hidden="true" /> Save
        </Button>
        <Button variant="secondary" size="sm" onClick={discard} disabled={!isDirty}>
          <Undo2 className="w-3.5 h-3.5" aria-hidden="true" /> Discard
        </Button>
        <span className="text-xs text-text-secondary">
          {isDirty
            ? `${dirtyCount} unsaved ${dirtyCount === 1 ? 'change' : 'changes'}`
            : savedAt
              ? `Saved at ${savedAt}`
              : 'No changes'}
        </span>
      </div>
    </section>
  );
}
