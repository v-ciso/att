'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Mail, CalendarDays, Store, Users, BadgeCheck } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/layout';
import { getInitials, cn } from '@/lib/utils';
import { loadPeople, ROSTER_ROLE_LABELS, type Person } from '@/components/dashboard/roster';
import { PersonSnapshot, PersonDocuments } from '@/components/dashboard/person-profile';
import { useActor } from '@/lib/use-actor';

// ---------------------------------------------------------------------------
// /people/[code] — the full employee file. The drawer stays the quick look;
// this page is the durable record: identity, dates, status, contact, live
// production (same PersonSnapshot the drawer renders), and the documents
// filed against this person (offer letters, write-ups, awards, approvals).
// Keyed by employeeCode — stable and never reused — so the URL survives
// renames and can be safely referenced from paperwork.
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-accent-green/15 text-accent-green border-accent-green/30',
  retired: 'bg-accent-yellow/15 text-accent-yellow border-accent-yellow/30',
  archived: 'bg-accent-red/15 text-accent-red border-accent-red/30',
};

function tenureLabel(hiredAt?: string): string | null {
  if (!hiredAt) return null;
  const start = new Date(hiredAt + 'T12:00:00');
  if (Number.isNaN(start.getTime())) return null;
  const days = Math.max(0, Math.floor((Date.now() - start.getTime()) / 86_400_000));
  if (days < 31) return `${days} day${days === 1 ? '' : 's'}`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return `${years} yr${years === 1 ? '' : 's'}${rem ? ` ${rem} mo` : ''}`;
}

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function PersonProfilePage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const actor = useActor();
  const code = decodeURIComponent(params.code ?? '');

  const { data, error, isLoading } = useSWR<{ profile: {
    displayName: string; employeeCode: string; status: string; startDate?: string | null; email?: string | null;
    teamName?: string | null; storeName?: string | null; externalIds: Array<{ externalRepId: string; reportName?: string | null }>;
    ddSummaries: Array<{ id: string; generated: number; ecBonusReceived: number; ecBonusMissing: number; batch: { ddWeek: string } }>;
  } }>(`/api/profiles/${encodeURIComponent(code)}`, async url => {
    const response = await fetch(url);
    if (!response.ok) throw new Error((await response.json()).error ?? 'Profile not found.');
    return response.json();
  });
  const localPerson = typeof window === 'undefined' ? null : loadPeople().find(p => p.employeeCode === code) ?? null;
  const person = useMemo<Person | null | undefined>(() => {
    if (data?.profile) return {
      id: data.profile.employeeCode, employeeCode: data.profile.employeeCode, name: data.profile.displayName,
      role: localPerson?.role ?? 'REP', stores: data.profile.storeName ? [data.profile.storeName] : localPerson?.stores ?? [],
      team: data.profile.teamName ?? localPerson?.team ?? '', weeklyProfit: localPerson?.weeklyProfit ?? [],
      attendance: localPerson?.attendance ?? 100, email: data.profile.email ?? undefined,
      hiredAt: data.profile.startDate?.slice(0, 10), status: data.profile.status as Person['status'],
    };
    if (isLoading) return undefined;
    return localPerson;
  }, [data, isLoading, localPerson]);

  return (
    <DashboardLayout>
      <div className="slide-in mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="w-11 h-11 inline-flex items-center justify-center rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </button>
        <div>
          <h1 className="text-2xl lg:text-4xl font-bold neon-brand">Employee File</h1>
          <p className="text-text-secondary text-sm mt-0.5">The durable record — identity, dates, production, and paperwork in one place</p>
        </div>
      </div>

      {person === undefined ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : person === null ? (
        <div className="glass border border-border-subtle rounded-2xl p-8 text-center">
          <p className="text-sm text-text-secondary mb-1">No employee with code &quot;{code}&quot; on this roster.</p>
          <p className="text-xs text-text-muted mb-4">
            If they were archived, restore them from the Recycle Bin first — their file comes back with them.
          </p>
          <Link href="/dashboard" className="text-accent-blue text-sm hover:underline">Back to dashboard</Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Identity header */}
          <section aria-label={`${person.name} identity`} className="glass border border-border-subtle rounded-2xl p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center font-bold text-lg">
                  {getInitials(person.name)}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold">{person.name}</h2>
                    <span className={cn('text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border', STATUS_BADGE[person.status ?? 'active'])}>
                      {person.status ?? 'active'}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {ROSTER_ROLE_LABELS[person.role]}
                    {person.employeeCode && <span className="text-text-muted"> · {person.employeeCode}</span>}
                  </p>
                </div>
              </div>
            </div>

            <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
              <div className="p-3 rounded-xl bg-white/5">
                <dt className="text-[9px] text-text-muted uppercase tracking-wider flex items-center gap-1"><CalendarDays className="w-3 h-3" aria-hidden="true" /> Hired</dt>
                <dd className="text-sm font-semibold mt-0.5">{fmtDate(person.hiredAt)}</dd>
                {tenureLabel(person.hiredAt) && <dd className="text-[10px] text-text-muted">{tenureLabel(person.hiredAt)} of tenure</dd>}
              </div>
              <div className="p-3 rounded-xl bg-white/5">
                <dt className="text-[9px] text-text-muted uppercase tracking-wider flex items-center gap-1"><Mail className="w-3 h-3" aria-hidden="true" /> Email</dt>
                <dd className="text-sm font-semibold mt-0.5 break-all">
                  {person.email ? <a href={`mailto:${person.email}`} className="text-accent-blue hover:underline">{person.email}</a> : <span className="text-text-muted font-normal">none on file</span>}
                </dd>
              </div>
              <div className="p-3 rounded-xl bg-white/5">
                <dt className="text-[9px] text-text-muted uppercase tracking-wider flex items-center gap-1"><Store className="w-3 h-3" aria-hidden="true" /> Stores</dt>
                <dd className="text-sm font-semibold mt-0.5">{(person.stores ?? []).join(', ') || '—'}</dd>
              </div>
              <div className="p-3 rounded-xl bg-white/5">
                <dt className="text-[9px] text-text-muted uppercase tracking-wider flex items-center gap-1"><Users className="w-3 h-3" aria-hidden="true" /> Team</dt>
                <dd className="text-sm font-semibold mt-0.5">{person.team || <span className="text-text-muted font-normal">unassigned</span>}</dd>
              </div>
            </dl>

            {person.status === 'retired' && (
              <p className="text-xs text-accent-yellow bg-accent-yellow/5 border border-accent-yellow/20 rounded-lg px-3 py-2 mt-3">
                Retired {fmtDate(person.retiredAt)}{person.retiredReason ? ` — ${person.retiredReason}` : ''}. Their history and documents stay on file; rehire them from the Roster tab (Show retired).
              </p>
            )}
            {(person.rehiredAt ?? []).length > 0 && (
              <p className="text-[11px] text-text-muted mt-2 flex items-center gap-1">
                <BadgeCheck className="w-3.5 h-3.5" aria-hidden="true" />
                Rehired: {(person.rehiredAt ?? []).map(d => fmtDate(d)).join(', ')}
              </p>
            )}
          </section>

          {data?.profile && (
            <section aria-label={`${person.name} direct deposit history`} className="glass border border-border-subtle rounded-2xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Authoritative DD history</h2>
                  <p className="mt-1 text-xs text-text-secondary">Office-generated totals and EC outcomes. These are not rep commissions.</p>
                </div>
                {data.profile.externalIds.map(identity => (
                  <span key={identity.externalRepId} className="rounded-full border border-border-subtle bg-bg-tertiary px-3 py-1 font-mono text-xs text-text-secondary">
                    Carrier ID {identity.externalRepId}
                  </span>
                ))}
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead><tr className="border-b border-border-subtle text-left text-[10px] uppercase tracking-wider text-text-muted"><th className="pb-2">DD week</th><th className="pb-2 text-right">Generated</th><th className="pb-2 text-right">EC received</th><th className="pb-2 text-right">EC exception</th></tr></thead>
                  <tbody className="divide-y divide-border-subtle">{data.profile.ddSummaries.map(summary => <tr key={summary.id}><td className="py-3">{new Date(summary.batch.ddWeek).toLocaleDateString()}</td><td className="py-3 text-right font-mono font-semibold">{summary.generated.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</td><td className="py-3 text-right font-mono text-accent-green">{summary.ecBonusReceived.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</td><td className="py-3 text-right font-mono text-accent-yellow">{summary.ecBonusMissing ? summary.ecBonusMissing.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '—'}</td></tr>)}</tbody>
                </table>
                {!data.profile.ddSummaries.length && <p className="py-4 text-sm text-text-muted">No confirmed DD weeks for this profile yet.</p>}
              </div>
            </section>
          )}

          {/* Operational tracker activity remains separate from the authoritative DD record. */}
          <section aria-label={`${person.name} production`} className="glass border border-border-subtle rounded-2xl p-5">
            <PersonSnapshot name={person.name} period="weekly" />
          </section>

          {/* Paper trail */}
          <PersonDocuments person={person} actor={actor} />
        </div>
      )}
    </DashboardLayout>
  );
}
