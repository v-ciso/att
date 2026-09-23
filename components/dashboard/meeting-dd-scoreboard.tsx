'use client';

import useSWR from 'swr';
import { useState } from 'react';
import { CopyPost } from './production-share';
import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, BadgeDollarSign, Building2, Users } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { readWorkspace } from '@/lib/workspace';

interface Summary { id: string; generated: number; ecBonusReceived: number; ecBonusMissing: number; externalRepId: string; reportName: string; teamSnapshot?: string | null; repProfile?: { employeeCode: string; displayName: string; teamName?: string | null; title?: string | null } | null }
interface Batch { id: string; ddWeek: string; reportType: string; officeGenerated: number; ecBonusReceived: number; ecBonusMissing: number; rowCount: number; isAuthoritative: boolean; summaries: Summary[] }
interface ProductionRow { id: string; externalRepId: string; reportName: string; tier?: string | null; retail?: string | null; store?: string | null; orderType?: string | null; noEcBonusReason?: string | null; rowData?: Record<string, string> | null }
interface DDResponse { weeks?: string[]; batches: Batch[]; productionBatch?: { id: string; ddWeek: string; detailRows: ProductionRow[] } | null }
const fetcher = (url: string) => fetch(url).then(async response => { if (!response.ok) throw new Error('DD reports could not be loaded.'); return response.json(); });

export function MeetingDDScoreboard({ onOpenProfile }: { onOpenProfile?: (name: string) => void }) {
  const workspace = readWorkspace();
  const [selectedWeek, setSelectedWeek] = useState('');
  const { data, error, isLoading } = useSWR<DDResponse>(workspace.mode === 'live' ? [`/api/dd-reports${selectedWeek ? `?week=${selectedWeek}` : ''}`, workspace.scope] : null, ([url]) => fetcher(url), { refreshInterval: 15_000 });
  if (workspace.mode === 'demo') return null;
  if (error) return <p role="alert" className="mb-4 text-sm text-accent-red">DD reports could not be loaded. No sample totals are substituted.</p>;
  if (isLoading) return <p role="status" className="mb-4 text-sm text-text-secondary">Loading confirmed DD totals…</p>;
  const batch = data?.batches.filter(item => item.isAuthoritative && item.reportType === 'DD_BY_REP' && (!selectedWeek || item.ddWeek.slice(0, 10) === selectedWeek)).sort((a, b) => b.ddWeek.localeCompare(a.ddWeek))[0];
  if (!batch && selectedWeek) return <div className="mb-4 flex flex-col gap-2"><p className="text-sm text-text-secondary">No confirmed report for {selectedWeek}.</p><button className="min-h-11 self-start text-sm text-accent-yellow" onClick={() => setSelectedWeek('')}>Return to latest confirmed week</button></div>;
  if (!batch) return <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-dashed border-border-strong bg-bg-tertiary p-5 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold">No confirmed DD week yet</p><p className="mt-1 text-sm text-text-secondary">Import and confirm a DD report to make office and rep totals authoritative.</p></div><Link href="/dashboard?tab=import" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-accent-yellow px-4 text-sm font-semibold text-bg-primary">Open DD Reports</Link></div>;
  const sorted = [...batch.summaries].sort((a, b) => b.generated - a.generated);
  const exceptions = sorted.filter(row => row.ecBonusMissing > 0);
  const teamTotals = [...sorted.filter(row => row.repProfile?.title !== 'OWNER').reduce((map, row) => { const team = row.repProfile?.teamName || row.teamSnapshot || 'Unassigned'; map.set(team, (map.get(team) ?? 0) + row.generated); return map; }, new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  const productionRows = data?.productionBatch?.ddWeek === batch.ddWeek ? data.productionBatch.detailRows : [];
  const productionMix = [...productionRows.reduce((map, row) => {
    const label = row.orderType || row.tier || row.rowData?.description || 'Other production';
    map.set(label, (map.get(label) ?? 0) + 1);
    return map;
  }, new Map<string, number>())].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const nextUpCount = productionRows.filter(row => /next up/i.test([row.orderType, row.tier, row.rowData?.description].filter(Boolean).join(' '))).length;
  return <div className="mb-6 flex flex-col gap-4">
    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between"><div><span className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-yellow">Confirmed DD · separate from tracker activity</span><h2 className="mt-1 text-2xl font-bold text-balance">Office production scoreboard</h2></div><label className="flex flex-col gap-1 text-sm text-text-secondary">DD week ending<select value={selectedWeek || batch.ddWeek.slice(0, 10)} onChange={event => setSelectedWeek(event.target.value)} className="min-h-11 rounded-lg border border-border-subtle bg-bg-tertiary px-3 text-text-primary">{(data?.weeks ?? [batch.ddWeek]).map(week => <option key={week} value={week.slice(0, 10)}>{week.slice(0, 10)}</option>)}</select></label></div>
    <CopyPost label="Copy weekly DD" text={[`CONFIRMED WEEKLY DD · ending ${batch.ddWeek.slice(0, 10)}`, `Office generated: ${formatCurrency(batch.officeGenerated)}`, ...sorted.map(row => `${row.repProfile?.displayName ?? row.reportName}${row.repProfile?.title === 'OWNER' ? ' (owner · outside teams)' : ''}: ${formatCurrency(row.generated)}`), `EC received: ${formatCurrency(batch.ecBonusReceived)}`, `Missing / withheld EC: ${formatCurrency(batch.ecBonusMissing)}`, 'Amounts payable to the office, not rep compensation.'].join('\n')} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
      ['Office generated', formatCurrency(batch.officeGenerated), Building2], ['EC received', formatCurrency(batch.ecBonusReceived), BadgeDollarSign], ['Missing / withheld EC', formatCurrency(batch.ecBonusMissing), AlertTriangle], ['Active report reps', String(sorted.length), Users],
    ].map(([label, value, Icon]) => { const Glyph = Icon as typeof Building2; return <div key={String(label)} className="rounded-2xl border border-border-subtle bg-bg-secondary p-4"><div className="flex items-center justify-between"><p className="text-[10px] uppercase tracking-wider text-text-muted">{String(label)}</p><Glyph className="h-4 w-4 text-accent-yellow" /></div><p className="mt-3 font-mono text-2xl font-bold">{String(value)}</p></div>; })}</div>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_0.8fr]">
      <div className="overflow-hidden rounded-2xl border border-border-subtle bg-bg-secondary"><div className="flex items-center justify-between border-b border-border-subtle p-4"><h3 className="font-semibold">Rep lanes</h3><span className="text-xs text-text-muted">Generated for office</span></div><div className="divide-y divide-border-subtle">{sorted.slice(0, 12).map((row, index) => <button key={row.id} onClick={() => onOpenProfile?.(row.repProfile?.displayName ?? row.reportName)} className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-bg-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-yellow"><span className="w-7 font-mono text-xs text-text-muted">{String(index + 1).padStart(2, '0')}</span><div className="min-w-0 flex-1"><p className="truncate font-medium">{row.repProfile?.displayName ?? row.reportName}</p><p className="truncate text-xs text-text-muted">{row.repProfile?.title === 'OWNER' ? 'Owner · outside teams' : row.repProfile?.teamName || 'Unassigned'} · ID {row.externalRepId}</p></div><span className="font-mono font-bold">{formatCurrency(row.generated)}</span><ArrowUpRight className="h-4 w-4 text-text-muted" /></button>)}</div></div>
      <div className="flex flex-col gap-4"><div className="rounded-2xl border border-border-subtle bg-bg-secondary p-4"><h3 className="font-semibold">Team lanes</h3><div className="mt-3 flex flex-col gap-3">{teamTotals.map(([team, total], index) => <div key={team} className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{team}</p><div className="mt-1 h-1.5 w-32 max-w-full overflow-hidden rounded-full bg-bg-tertiary"><div className="h-full rounded-full bg-accent-yellow motion-safe:transition-all" style={{ width: `${Math.max(4, (total / (teamTotals[0]?.[1] || 1)) * 100)}%` }} /></div></div><span className="font-mono text-sm font-semibold">{formatCurrency(total)}</span></div>)}</div></div><div className="rounded-2xl border border-accent-yellow/30 bg-accent-yellow/5 p-4"><div className="flex items-center justify-between"><h3 className="font-semibold">Needs attention</h3><span className="rounded-full bg-accent-yellow/15 px-2 py-1 font-mono text-xs text-accent-yellow">{exceptions.length}</span></div><div className="mt-3 flex flex-col gap-2">{exceptions.length ? exceptions.map(row => <div key={row.id} className="rounded-lg bg-bg-secondary p-3"><p className="text-sm font-medium">{row.repProfile?.displayName ?? row.reportName}</p><p className="mt-1 text-xs text-accent-yellow">{formatCurrency(row.ecBonusMissing)} EC exception</p></div>) : <p className="text-sm text-text-secondary">No evidence-based EC exceptions in this batch.</p>}</div></div></div>
    </div>
    <div className="rounded-2xl border border-border-subtle bg-bg-secondary p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div><h3 className="font-semibold">Production detail</h3><p className="mt-1 text-xs text-text-muted">Confirmed DD DETAIL activity, separate from office payable totals.</p></div>
        <div className="flex gap-2"><span className="rounded-full bg-bg-tertiary px-3 py-1 font-mono text-xs">{productionRows.length} rows</span><span className="rounded-full bg-accent-yellow/15 px-3 py-1 font-mono text-xs text-accent-yellow">{nextUpCount} Next Up</span></div>
      </div>
      {productionMix.length ? <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">{productionMix.map(([label, count]) => <div key={label} className="rounded-xl bg-bg-tertiary p-3"><p className="truncate text-xs text-text-muted" title={label}>{label}</p><p className="mt-2 font-mono text-xl font-bold">{count}</p></div>)}</div> : <p className="mt-4 text-sm text-text-secondary">Confirm a DD DETAIL report to show order types, tiers, stores, and Next Up production here.</p>}
    </div>
  </div>;
}
