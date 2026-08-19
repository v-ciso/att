'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Upload } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { loadPeople, loadPromoRules, promotionStatus, effectiveAttendance, ROSTER_ROLE_LABELS, ROLE_LADDER, type Person } from './roster';
import { Period, PERIOD_LABELS, aggregateSales, loadSales, loadCommission } from '@/lib/sales';
import { computePay } from '@/lib/pay';
import { RepLifetime } from './rep-lifetime';
import { can, type Actor } from '@/lib/permissions';
import { fetchDocuments, uploadDocument, documentFileUrl, formatBytes, type DocumentDTO } from '@/lib/docs-client';

// ---------------------------------------------------------------------------
// PersonSnapshot — the production/pay/roadmap/lifetime block shared by the
// quick-view drawer and the full profile page. Extracted from the drawer so
// the two surfaces can never drift apart: one source renders both.
// ---------------------------------------------------------------------------

export function PersonSnapshot({ name, period }: { name: string; period: Period }) {
  const [span, setSpan] = useState<Period>(period);
  const person = loadPeople().find(p => p.name.trim().toLowerCase() === name.trim().toLowerCase());
  const rules = loadPromoRules();
  const status = person ? promotionStatus(person, rules) : null;
  const roleIndex = person ? ROLE_LADDER.indexOf(person.role) : -1;
  const profitMax = person ? Math.max(...person.weeklyProfit, rules.profitPerWeek) : 1;

  // Live stats for this person over the selected period, derived from sales entries
  const agg = aggregateSales(loadSales(), loadCommission(), { period: span });
  const stats = agg.perPerson.find(p => p.person.trim().toLowerCase() === name.trim().toLowerCase());

  return (
    <>
      {/* Period production, derived from the Daily Tracker */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <p className="text-[10px] text-text-muted uppercase tracking-wider">{PERIOD_LABELS[span]} Production</p>
        <div className="flex gap-1" role="radiogroup" aria-label="Production period">
          {(['daily', 'weekly', 'monthly', 'all'] as Period[]).map(p => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={span === p}
              onClick={() => setSpan(p)}
              className={cn(
                'tab-btn min-h-11',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]',
                span === p ? 'active' : 'inactive'
              )}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>
      {stats ? (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: 'Lines', value: String(stats.lines), color: 'text-accent-blue' },
            { label: 'Premium', value: String(stats.premium), color: 'text-accent-purple' },
            { label: 'Internet', value: String(stats.internet), color: 'text-accent-cyan' },
            { label: 'Next Up', value: String(stats.nextUps), color: 'text-accent-red' },
            { label: 'Generated', value: formatCurrency(stats.revenue), color: 'text-accent-green' },
            { label: stats.chargebacks > 0 ? 'Commission*' : 'Commission', value: formatCurrency(stats.commission), color: 'text-accent-blue' },
          ].map(s => (
            <div key={s.label} className="p-2 rounded-xl bg-white/5 text-center">
              <p className="text-[9px] text-text-muted uppercase tracking-wider">{s.label}</p>
              <p className={cn('text-sm font-bold', s.color)}>{s.value}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-text-muted p-3 rounded-xl bg-white/5 mb-4">
          No sales logged for this period — add them in the <span className="text-accent-blue">Daily Tracker</span>.
        </p>
      )}
      {person && (() => {
        // Full pay for the week: base + lead bump + ASM override, then the
        // greater of that vs the guaranteed hourly.
        const allPeople = loadPeople();
        const pay = computePay(person, { sales: loadSales(), commission: loadCommission(), people: allPeople, period: span === 'daily' ? 'weekly' : span });
        const hourly = person.hourlyWeekly ?? 0;
        const paid = Math.max(pay.total, hourly);
        const via = pay.total >= hourly ? 'earnings' : 'hourly floor';
        return (
          <div className="p-3 rounded-xl bg-accent-cyan/5 border border-accent-cyan/20 mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-text-secondary">💵 This week&apos;s pay</span>
              <span className="text-accent-cyan font-bold text-sm">{formatCurrency(paid)} <span className="text-[10px] text-text-muted font-normal">via {via}</span></span>
            </div>
            <div className="space-y-0.5 text-[11px]">
              <div className="flex justify-between"><span className="text-text-muted">Base commission (own sales)</span><span className="text-accent-blue">{formatCurrency(pay.base)}</span></div>
              {pay.bump > 0 && <div className="flex justify-between"><span className="text-text-muted">Lead per-line bump (own lines)</span><span className="text-accent-purple">+{formatCurrency(pay.bump)}</span></div>}
              {pay.override > 0 && <div className="flex justify-between"><span className="text-text-muted">ASM override (team production)</span><span className="text-accent-yellow">+{formatCurrency(pay.override)}</span></div>}
              {hourly > 0 && <div className="flex justify-between"><span className="text-text-muted">Guaranteed hourly floor</span><span className="text-text-secondary">{formatCurrency(hourly)}</span></div>}
            </div>
            {pay.notes.length > 0 && (
              <p className="text-[9px] text-text-muted mt-1.5">{pay.notes.join(' · ')} — rates editable in the Commission tab&apos;s Role Structure.</p>
            )}
          </div>
        );
      })()}

      {stats && stats.chargebacks > 0 && (
        <p className="text-[11px] text-accent-red p-2.5 rounded-lg bg-accent-red/5 border border-accent-red/20 mb-4">
          ⏰ Late clock-out chargebacks this period: <span className="font-bold">−{formatCurrency(stats.chargebacks)}</span>
          <span className="text-text-muted"> — already deducted from Generated and Commission above.</span>
        </p>
      )}

      {person && status ? (
        <>
          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Leadership Roadmap</p>
          <div className="flex items-center gap-1 mb-4">
            {ROLE_LADDER.map((role, i) => (
              <div key={role} className="flex-1 flex items-center gap-1">
                {/* Colour alone signalled which rung is current; aria-current
                    and an sr-only suffix state it non-visually too. */}
                <div
                  aria-current={i === roleIndex ? 'step' : undefined}
                  className={cn(
                    'flex-1 text-center py-1.5 rounded-lg text-[10px] font-semibold border transition-all',
                    i < roleIndex && 'bg-accent-green/10 text-accent-green border-accent-green/30',
                    i === roleIndex && 'bg-accent-blue/20 text-accent-blue border-accent-blue/40 shadow-neon-blue',
                    i > roleIndex && 'bg-white/5 text-text-muted border-border-subtle'
                  )}
                >
                  {ROSTER_ROLE_LABELS[role]}
                  {i < roleIndex && <span className="sr-only"> (completed)</span>}
                  {i === roleIndex && <span className="sr-only"> (current role)</span>}
                </div>
                {i < ROLE_LADDER.length - 1 && <span className="text-text-muted text-[10px]">→</span>}
              </div>
            ))}
          </div>

          <div className={cn('p-3 rounded-xl border mb-4', status.ready ? 'bg-accent-green/10 border-accent-green/30' : 'bg-white/5 border-border-subtle')}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold">{status.ready ? '🎉 ' : ''}{status.label}</span>
              <span className="text-[10px] text-text-muted">
                needs {formatCurrency(rules.profitPerWeek)}/wk × {rules.weeks} wks + {rules.minAttendance}% attendance
              </span>
            </div>
            <div
              className="w-full h-1.5 rounded-full bg-bg-tertiary"
              role="progressbar"
              aria-valuenow={Math.round(status.progress)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${name} progress toward promotion`}
            >
              <div className={cn('h-full rounded-full', status.ready ? 'bg-accent-green' : 'bg-gradient-to-r from-accent-blue to-accent-green')} style={{ width: `${status.progress}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-white/5">
              <p className="text-[9px] text-text-muted uppercase tracking-wider mb-2">Weekly Profit (roadmap)</p>
              <div className="flex items-end gap-3">
                {person.weeklyProfit.map((w, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    {/* fixed pixel heights — % collapses without a sized parent */}
                    <div
                      className={cn('w-full rounded-t', w >= rules.profitPerWeek ? 'bg-accent-green' : 'bg-accent-green/40')}
                      style={{ height: `${Math.max(8, Math.round((w / profitMax) * 56))}px` }}
                    />
                    <span className="text-[9px] text-text-secondary font-medium">{formatCurrency(w)}</span>
                    <span className="text-[8px] text-text-muted">wk {i + 1}</span>
                  </div>
                ))}
              </div>
              <p className="text-[8px] text-text-muted mt-1.5">target {formatCurrency(rules.profitPerWeek)}/wk · solid bar = week hit</p>
            </div>
            <div className="p-3 rounded-xl bg-white/5 flex flex-col items-center justify-center">
              <p className="text-[9px] text-text-muted uppercase tracking-wider mb-1">Attendance</p>
              {(() => {
                const att = effectiveAttendance(person);
                return (
                  <>
                    <p className={cn('text-2xl font-bold', att.pct >= rules.minAttendance ? 'text-accent-green' : 'text-accent-yellow')}>
                      {att.pct}%
                    </p>
                    <p className="text-[9px] text-text-muted">
                      target {rules.minAttendance}%{att.tracked ? ' · from tracker marks' : ''}
                    </p>
                  </>
                );
              })()}
            </div>
          </div>

          <RepLifetime person={person} />
        </>
      ) : (
        <p className="text-xs text-text-secondary p-3 rounded-xl bg-white/5">
          This rep isn&apos;t in the roster yet. Add them on the <span className="text-accent-blue font-medium">Roster</span> tab
          (same name) to track their store, team, promotions, and leadership roadmap here.
        </p>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// PersonDocuments — the paper trail on a person's file: offer letters,
// write-ups, awards, approvals. Server-side isolation already guarantees
// these can only ever be this company's docs (lib/docs.ts invariants); this
// component additionally narrows to docs addressed to THIS person via
// audiencePersonIds (keyed by employeeCode).
// ---------------------------------------------------------------------------

export function PersonDocuments({ person, actor }: { person: Person; actor: Actor | null | undefined }) {
  const manage = can(actor, 'docs.manage');
  const code = person.employeeCode ?? '';
  const [docs, setDocs] = useState<DocumentDTO[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadKind, setUploadKind] = useState('OTHER');

  const reload = useCallback(async () => {
    if (!code) {
      setDocs([]);
      return;
    }
    // personId scopes what a NON-manager may see; a manager gets the whole
    // shelf back, so narrow to docs explicitly addressed to this person.
    const items = await fetchDocuments({ personId: code });
    setDocs(items.filter(d => (d.audiencePersonIds ?? []).includes(code)));
  }, [code]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onUpload = async (file: File) => {
    if (!code) return;
    setBusy(true);
    setNotice(null);
    const { doc, error } = await uploadDocument({
      file,
      title: file.name.replace(/\.[^.]+$/, ''),
      kind: uploadKind,
      audiencePersonIds: [code],
    });
    setBusy(false);
    if (error || !doc) {
      setNotice(error ?? 'Upload failed.');
      return;
    }
    setNotice(`Filed "${doc.title}" on ${person.name}'s profile.`);
    await reload();
  };

  return (
    <section aria-label={`${person.name} documents`} className="glass border border-border-subtle rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted flex items-center gap-2">
          <FileText className="w-4 h-4" aria-hidden="true" /> Documents on file
          {docs && docs.length > 0 && <span className="normal-case tracking-normal">({docs.length})</span>}
        </h2>
        {manage && code && (
          <div className="flex items-center gap-2">
            <label htmlFor="person-doc-kind" className="sr-only">Document type</label>
            <select
              id="person-doc-kind"
              value={uploadKind}
              onChange={e => setUploadKind(e.target.value)}
              className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-text-primary"
            >
              <option value="OTHER">Other</option>
              <option value="TEMPLATE">From template</option>
              <option value="COMPLIANCE">Compliance</option>
              <option value="TRAINING">Training</option>
            </select>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.csv"
              className="sr-only"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) void onUpload(f);
                e.target.value = '';
              }}
              aria-label={`Upload a document for ${person.name}`}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="btn-primary text-xs px-3 py-1.5 inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" aria-hidden="true" /> {busy ? 'Uploading…' : 'Add to file'}
            </button>
          </div>
        )}
      </div>

      {notice && (
        <p role="status" className="text-xs text-text-muted bg-white/5 rounded-lg px-3 py-2 mb-2">{notice}</p>
      )}

      {!code ? (
        <p className="text-xs text-text-muted bg-white/5 rounded-xl p-4">
          This person has no employee code yet — open the Roster tab once so codes are assigned, then documents can be filed here.
        </p>
      ) : docs == null ? (
        <p className="text-xs text-text-muted">Loading documents…</p>
      ) : docs.length === 0 ? (
        <p className="text-xs text-text-muted bg-white/5 rounded-xl p-4">
          Nothing on file yet{manage ? ' — upload an offer letter, write-up, award, or approval, or generate one from a Library template.' : '.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {docs.map(doc => (
            <li key={doc.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2.5">
              <div className="min-w-0">
                <a
                  href={documentFileUrl(doc.id, { personId: code })}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-text-primary hover:underline truncate block"
                >
                  {doc.title}
                </a>
                <p className="text-[10px] text-text-muted">
                  {doc.kind} · {formatBytes(doc.sizeBytes)} · {new Date(doc.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  {doc.requiresAck && ` · ${doc.ackCount} ack${doc.ackCount === 1 ? '' : 's'}`}
                </p>
              </div>
              <a
                href={documentFileUrl(doc.id, { personId: code, download: true })}
                className="text-xs text-accent-blue hover:underline flex-none"
              >
                Download
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
