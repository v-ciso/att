'use client';

import Link from 'next/link';
import { X, ExternalLink } from 'lucide-react';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import { getInitials } from '@/lib/utils';
import { loadPeople, ROSTER_ROLE_LABELS } from './roster';
import { Period } from '@/lib/sales';
import { PersonSnapshot } from './person-profile';

// Quick-view profile. The full employee file (identity, status actions, and
// documents) lives at /people/[employeeCode]; this drawer is the fast in-place
// look during a meeting or while scanning a leaderboard. Both render the same
// PersonSnapshot, so the numbers can never disagree.
export function ProfileDrawer({ name, period, onClose }: { name: string; period: Period; onClose: () => void }) {
  const person = loadPeople().find(p => p.name.trim().toLowerCase() === name.trim().toLowerCase());

  // Focus enters the drawer on open, Tab stays inside it, Escape closes, and
  // focus returns to the trigger on close.
  const panelRef = useModalA11y<HTMLDivElement>(onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={`${name} profile`}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative w-full sm:max-w-lg glass border border-border-strong rounded-t-2xl sm:rounded-2xl p-6 animate-scale-in bg-bg-secondary/95 max-h-[90vh] overflow-y-auto focus:outline-none"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center font-bold">
              {getInitials(name)}
            </div>
            <div>
              <h3 className="text-lg font-bold">{name}</h3>
              <p className="text-xs text-text-secondary">
                {person
                  ? `${ROSTER_ROLE_LABELS[person.role]} · ${(person.stores ?? []).join(', ')}${person.team ? ` · ${person.team}` : ' · no team'}`
                  : 'Not in roster yet'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {person?.employeeCode && (
              <Link
                href={`/people/${encodeURIComponent(person.employeeCode)}`}
                className="min-h-11 px-3 inline-flex items-center gap-1.5 rounded-lg text-xs text-accent-blue hover:bg-white/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
              >
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /> Full profile
              </Link>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-11 h-11 inline-flex items-center justify-center flex-none rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
              aria-label={`Close ${name} profile`}
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <PersonSnapshot name={name} period={period} />
      </div>
    </div>
  );
}
