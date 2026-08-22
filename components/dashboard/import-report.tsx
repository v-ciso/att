'use client';

import { useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { AlertTriangle, ArrowRight, CheckCircle2, FileText, History, Link2, Loader2, RotateCcw, ShieldCheck, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, formatCurrency } from '@/lib/utils';

interface Profile { id: string; employeeCode: string; displayName: string; legalName?: string | null; externalIds: Array<{ externalRepId: string }> }
interface Summary { externalRepId: string; reportName: string; generated: number; ecBonusReceived: number; ecBonusMissing: number; detailCount: number; profile: Profile | null }
interface Preview { fileName: string; hash: string; reportType: 'DD_BY_REP' | 'DD_DETAIL'; processedWeek: string; ddWeek: string; warnings: string[]; rows: Array<Record<string, unknown>>; summaries: Summary[]; totals: { officeGenerated: number; ecBonusReceived: number; ecBonusMissing: number; rows: number; reps: number; unmapped: number } }
interface Batch { id: string; sourceFileName: string; ddWeek: string; reportType: string; status: string; isAuthoritative: boolean; officeGenerated: number; rowCount: number; createdAt: string }
interface ReportData { batches: Batch[]; profiles: Profile[]; operatingStartDate: string | null }
const fetcher = (url: string) => fetch(url).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); return body; });
const stepLabels = ['Upload & parse', 'Resolve people', 'Confirm week'];

export function ImportReport() {
  const { data, mutate } = useSWR<ReportData>('/api/dd-reports', fetcher);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [mappingId, setMappingId] = useState<string | null>(null);
  const unmapped = useMemo(() => preview?.summaries.filter(row => !row.profile) ?? [], [preview]);
  const step = !preview ? 0 : unmapped.length ? 1 : 2;

  async function parse(file?: File) {
    if (!file && !pasted.trim()) return;
    setBusy(true); setError('');
    const form = new FormData();
    if (file) form.set('file', file); else form.set('pasted', pasted);
    try {
      const response = await fetch('/api/dd-reports', { method: 'POST', body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setPreview(body.preview);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not read this report.'); }
    finally { setBusy(false); }
  }

  async function mapPerson(summary: Summary, profileId?: string) {
    setMappingId(summary.externalRepId); setError('');
    try {
      const response = await fetch('/api/dd-reports/profiles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ externalRepId: summary.externalRepId, reportName: summary.reportName, profileId, displayName: summary.reportName }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setPreview(current => current ? { ...current, summaries: current.summaries.map(row => row.externalRepId === summary.externalRepId ? { ...row, profile: body.profile } : row), totals: { ...current.totals, unmapped: current.totals.unmapped - 1 } } : current);
      await mutate();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not map this rep.'); }
    finally { setMappingId(null); }
  }

  async function confirm() {
    if (!preview || unmapped.length) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/dd-reports/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...preview, confirmation: true }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setPreview(null); setPasted(''); setConfirming(false); await mutate();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not confirm this report.'); }
    finally { setBusy(false); }
  }

  async function rollback(batchId: string) {
    if (!window.confirm('Restore this batch as the authoritative record for its week? The current batch remains in history.')) return;
    const response = await fetch('/api/dd-reports/rollback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ batchId, confirmation: true }) });
    if (!response.ok) { const body = await response.json(); setError(body.error); return; }
    await mutate();
  }

  return (
    <section className="flex flex-col gap-6" aria-labelledby="dd-reports-title">
      <header className="flex flex-col gap-4 rounded-2xl border border-border-subtle bg-bg-secondary p-5 md:flex-row md:items-end md:justify-between">
        <div className="flex max-w-2xl flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-yellow">Authoritative weekly record</span>
          <h2 id="dd-reports-title" className="font-sans text-2xl font-bold text-balance">Direct Deposit reports</h2>
          <p className="text-sm leading-6 text-text-secondary">Import carrier DD exports, map every carrier ID to a durable rep profile, then review and explicitly replace that week. These amounts are payable to the office—not rep compensation.</p>
        </div>
        {data?.operatingStartDate && <div className="rounded-xl border border-border-subtle bg-bg-tertiary px-4 py-3 text-right"><p className="text-[10px] uppercase tracking-wider text-text-muted">Company records begin</p><p className="font-mono text-sm font-semibold">{new Date(data.operatingStartDate).toLocaleDateString()}</p></div>}
      </header>

      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label="Import progress">
        {stepLabels.map((label, index) => <li key={label} className={cn('flex min-h-12 items-center gap-3 rounded-xl border px-4 text-sm', index === step ? 'border-accent-yellow bg-accent-yellow/10 text-foreground' : index < step ? 'border-accent-green/30 bg-accent-green/5 text-accent-green' : 'border-border-subtle text-text-muted')}><span className="font-mono text-xs">0{index + 1}</span>{label}{index < step && <CheckCircle2 className="ml-auto h-4 w-4" />}</li>)}
      </ol>

      {error && <div role="alert" className="flex items-start gap-3 rounded-xl border border-accent-red/30 bg-accent-red/10 p-4 text-sm text-accent-red"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

      {!preview && <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <button type="button" onClick={() => fileRef.current?.click()} className="flex min-h-56 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border-strong bg-bg-secondary p-8 text-center transition-colors hover:border-accent-yellow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-yellow">
          {busy ? <Loader2 className="h-8 w-8 animate-spin text-accent-yellow" /> : <Upload className="h-8 w-8 text-accent-yellow" />}
          <span className="text-lg font-semibold">Upload DD BY REP or DD DETAIL</span><span className="max-w-md text-sm leading-6 text-text-secondary">Text-based PDF, CSV, or TSV. Maximum 12 MB and 10,000 rows. Carrier company IDs are required.</span>
          <input ref={fileRef} type="file" accept=".pdf,.csv,.tsv,.txt" className="sr-only" onChange={event => { const file = event.target.files?.[0]; if (file) void parse(file); }} />
        </button>
        <div className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-bg-secondary p-5"><div><h3 className="font-semibold">Paste tabular report</h3><p className="mt-1 text-xs leading-5 text-text-secondary">Secondary path, with the same ID mapping and confirmation rules.</p></div><textarea value={pasted} onChange={event => setPasted(event.target.value)} placeholder={'Rep Name\tCompany ID\tTotal Sums\tEC Bonus to ICD'} className="min-h-32 flex-1 resize-none rounded-xl border border-border-subtle bg-bg-tertiary p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent-yellow" /><Button onClick={() => void parse()} disabled={!pasted.trim() || busy}>Parse pasted rows</Button></div>
      </div>}

      {preview && <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[['Office generated', formatCurrency(preview.totals.officeGenerated)], ['EC received', formatCurrency(preview.totals.ecBonusReceived)], ['Missing / withheld EC', formatCurrency(preview.totals.ecBonusMissing)], ['Mapped reps', `${preview.totals.reps - unmapped.length}/${preview.totals.reps}`], ['Detail rows', String(preview.totals.rows)]].map(([label, value]) => <div key={label} className="rounded-xl border border-border-subtle bg-bg-secondary p-4"><p className="text-[10px] uppercase tracking-wider text-text-muted">{label}</p><p className="mt-2 font-mono text-xl font-bold text-foreground">{value}</p></div>)}
        </div>
        <div className="overflow-hidden rounded-2xl border border-border-subtle bg-bg-secondary"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle p-4"><div><h3 className="font-semibold">{preview.fileName}</h3><p className="mt-1 text-xs text-text-secondary">{preview.reportType.replaceAll('_', ' ')} · DD week {new Date(preview.ddWeek).toLocaleDateString()}</p></div><Button variant="ghost" onClick={() => { setPreview(null); setError(''); }}>Start over</Button></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b border-border-subtle text-left text-[10px] uppercase tracking-wider text-text-muted"><th className="p-3">Carrier identity</th><th className="p-3">Live profile</th><th className="p-3 text-right">Generated</th><th className="p-3 text-right">EC received</th><th className="p-3 text-right">EC exception</th></tr></thead><tbody className="divide-y divide-border-subtle">{preview.summaries.map(summary => <tr key={summary.externalRepId}><td className="p-3"><p className="font-medium">{summary.reportName}</p><p className="font-mono text-xs text-text-muted">ID {summary.externalRepId}</p></td><td className="p-3">{summary.profile ? <span className="inline-flex items-center gap-2 text-accent-green"><Link2 className="h-4 w-4" />{summary.profile.displayName}</span> : <div className="flex items-center gap-2"><select defaultValue="" aria-label={`Map ${summary.reportName}`} className="min-h-10 rounded-lg border border-border-subtle bg-bg-tertiary px-2 text-xs" onChange={event => { if (event.target.value) void mapPerson(summary, event.target.value); }}><option value="">Choose existing profile</option>{data?.profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.displayName} · {profile.employeeCode}</option>)}</select><Button size="sm" variant="outline" disabled={mappingId === summary.externalRepId} onClick={() => void mapPerson(summary)}>{mappingId === summary.externalRepId ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create profile'}</Button></div>}</td><td className="p-3 text-right font-mono font-semibold">{formatCurrency(summary.generated)}</td><td className="p-3 text-right font-mono text-accent-green">{formatCurrency(summary.ecBonusReceived)}</td><td className="p-3 text-right font-mono text-accent-yellow">{summary.ecBonusMissing ? formatCurrency(summary.ecBonusMissing) : '—'}</td></tr>)}</tbody></table></div></div>
        <div className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-bg-secondary p-4 md:flex-row md:items-center md:justify-between"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-accent-yellow" /><div><p className="font-semibold">{unmapped.length ? `${unmapped.length} carrier ${unmapped.length === 1 ? 'ID needs' : 'IDs need'} a profile` : 'Ready for owner review'}</p><p className="mt-1 text-xs leading-5 text-text-secondary">Confirming replaces the authoritative record for this DD week. The old batch remains available for rollback.</p></div></div><Button disabled={Boolean(unmapped.length) || busy} onClick={() => setConfirming(true)}>Review replacement <ArrowRight className="ml-2 h-4 w-4" /></Button></div>
      </div>}

      {confirming && preview && <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="confirm-dd-title"><div className="w-full max-w-lg rounded-2xl border border-border-strong bg-bg-secondary p-6 shadow-2xl"><span className="text-xs font-semibold uppercase tracking-wider text-accent-yellow">Final confirmation</span><h3 id="confirm-dd-title" className="mt-2 text-xl font-bold text-balance">Replace week of {new Date(preview.ddWeek).toLocaleDateString()}?</h3><p className="mt-3 text-sm leading-6 text-text-secondary">This makes {formatCurrency(preview.totals.officeGenerated)} across {preview.totals.reps} reps and {preview.totals.rows} rows the live sales record for the week. Previous data is retained in audit history.</p><div className="mt-6 flex justify-end gap-3"><Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button><Button onClick={() => void confirm()} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm replacement</Button></div></div></div>}

      <div className="rounded-2xl border border-border-subtle bg-bg-secondary"><div className="flex items-center gap-2 border-b border-border-subtle p-4"><History className="h-4 w-4 text-accent-yellow" /><h3 className="font-semibold">Import history</h3></div>{data?.batches.length ? <div className="divide-y divide-border-subtle">{data.batches.map(batch => <div key={batch.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-3"><FileText className="h-5 w-5 text-text-muted" /><div><p className="text-sm font-medium">{batch.sourceFileName}</p><p className="mt-1 text-xs text-text-muted">{new Date(batch.ddWeek).toLocaleDateString()} · {batch.rowCount} rows · {formatCurrency(batch.officeGenerated)}</p></div></div><div className="flex items-center gap-2"><span className={cn('rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider', batch.isAuthoritative ? 'bg-accent-green/10 text-accent-green' : 'bg-bg-tertiary text-text-muted')}>{batch.isAuthoritative ? 'Live' : batch.status}</span>{!batch.isAuthoritative && <Button size="sm" variant="ghost" onClick={() => void rollback(batch.id)}><RotateCcw className="mr-2 h-3.5 w-3.5" />Restore</Button>}</div></div>)}</div> : <p className="p-5 text-sm text-text-muted">No DD report history yet.</p>}</div>
    </section>
  );
}
