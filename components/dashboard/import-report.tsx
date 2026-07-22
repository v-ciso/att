'use client';

import { useMemo, useState } from 'react';
import { cn, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Upload, AlertTriangle, CheckCircle } from 'lucide-react';
import { SaleEntry, Period } from '@/lib/sales';
import { computePay } from '@/lib/pay';
import { loadPeople, Person } from './roster';
import { CommissionState } from './editable-sections';

// Weekly direct-deposit reconciler. Upload the carrier's Excel/CSV report (or
// paste the cells), and it matches each employee by name and compares the
// reported payout against what the tool computed — flagging any mismatch so a
// wrong number can't slip through.

interface Parsed { name: string; amount: number }

function parseRows(rows: (string | number)[][]): Parsed[] {
  if (!rows.length) return [];
  // Find the header row and the name/amount columns heuristically
  let headerIdx = 0;
  let nameCol = -1;
  let amtCol = -1;
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const cells = rows[i].map(c => String(c ?? '').toLowerCase());
    const n = cells.findIndex(c => /name|employee|rep|agent/.test(c));
    const a = cells.findIndex(c => /amount|payout|pay|total|commission|deposit|earn/.test(c));
    if (n >= 0 && a >= 0) { headerIdx = i; nameCol = n; amtCol = a; break; }
  }
  if (nameCol < 0) { nameCol = 0; amtCol = 1; } // fall back to first two columns
  const out: Parsed[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const name = String(rows[i][nameCol] ?? '').trim();
    const raw = String(rows[i][amtCol] ?? '').replace(/[^0-9.\-]/g, '');
    const amount = parseFloat(raw);
    if (name && Number.isFinite(amount)) out.push({ name, amount });
  }
  return out;
}

function matchPerson(reportedName: string, people: Person[]): Person | undefined {
  const n = reportedName.trim().toLowerCase();
  // exact, then "last, first", then loose contains
  return (
    people.find(p => p.name.toLowerCase() === n) ||
    people.find(p => { const [l, f] = n.split(',').map(s => s.trim()); return f && l && p.name.toLowerCase() === `${f} ${l}`; }) ||
    people.find(p => n.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(n))
  );
}

export function ImportReport({ sales, commission }: { sales: SaleEntry[]; commission: CommissionState }) {
  const [rows, setRows] = useState<Parsed[]>([]);
  const [period, setPeriod] = useState<Period>('weekly');
  const [paste, setPaste] = useState('');
  const [fileName, setFileName] = useState('');
  const people = useMemo(loadPeople, [rows]);

  const [error, setError] = useState('');

  const onFile = async (file: File) => {
    setFileName(file.name);
    setError('');
    try {
      const buf = await file.arrayBuffer();
      if (/\.pdf$/i.test(file.name)) {
        // Extract text lines from the PDF, then run the same row heuristic.
        // ponytail: works on text-based table PDFs; scanned/image PDFs won't parse.
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs')).default;
        const doc = await pdfjs.getDocument({ data: buf }).promise;
        const grid: string[][] = [];
        for (let p = 1; p <= doc.numPages; p++) {
          const page = await doc.getPage(p);
          const content = await page.getTextContent();
          // group text items into lines by their y position
          const byLine = new Map<number, { x: number; s: string }[]>();
          content.items.forEach((it) => {
            const item = it as { str: string; transform: number[] };
            if (!item.str.trim()) return;
            const y = Math.round(item.transform[5]);
            byLine.set(y, [...(byLine.get(y) ?? []), { x: item.transform[4], s: item.str }]);
          });
          Array.from(byLine.entries())
            .sort((a, b) => b[0] - a[0])
            .forEach(([, cells]) => grid.push(cells.sort((a, b) => a.x - b.x).map(c => c.s)));
        }
        const parsed = parseRows(grid);
        if (!parsed.length) setError('No name/amount rows found in this PDF — try the Excel/CSV export instead, or paste the cells.');
        setRows(parsed);
        return;
      }
      const XLSX = await import('xlsx');
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, blankrows: false });
      setRows(parseRows(data));
    } catch (e) {
      setError(`Couldn't read that file: ${(e as Error).message}. Try Excel/CSV or paste the cells.`);
    }
  };

  const parsePaste = () => {
    const grid = paste.trim().split('\n').map(line => line.split(/\t|,/).map(c => c.trim()));
    setRows(parseRows(grid));
    setFileName('pasted data');
  };

  // Reconcile each parsed row against the tool's computed pay
  const reconciled = rows.map(r => {
    const person = matchPerson(r.name, people);
    const computed = person ? computePay(person, { sales, commission, people, period }).total : null;
    const diff = computed == null ? null : r.amount - computed;
    return { ...r, matched: person?.name ?? null, computed, diff };
  });
  const flagged = reconciled.filter(r => r.matched === null || (r.diff != null && Math.abs(r.diff) > 1));

  const selectClass = 'bg-bg-tertiary border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-xl font-bold neon-brand flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5" style={{ color: 'var(--brand)' }} /> Direct Deposit Reconciler
        </h2>
        <select value={period} onChange={e => setPeriod(e.target.value as Period)} className={selectClass} aria-label="Compare against period">
          <option value="weekly">Compare vs Weekly</option>
          <option value="monthly">Compare vs Monthly</option>
          <option value="daily">Compare vs Daily</option>
          <option value="all">Compare vs All Time</option>
        </select>
      </div>

      <p className="text-xs text-text-secondary mb-3">
        Upload the carrier&apos;s weekly report (Excel or CSV) or paste the cells. It matches each employee by name and flags any payout that doesn&apos;t match what the tool computed.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <label className="cursor-pointer p-4 rounded-xl glass border border-dashed border-border-strong flex flex-col items-center justify-center gap-2 hover:bg-white/5 transition-all">
          <Upload className="w-5 h-5 text-accent-blue" />
          <span className="text-xs font-medium">Upload .xlsx / .csv / .pdf</span>
          {fileName && <span className="text-[10px] text-text-muted">{fileName}</span>}
          <input type="file" accept=".xlsx,.xls,.csv,.pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
        </label>
        <div className="p-3 rounded-xl glass border border-border-subtle">
          <textarea
            value={paste}
            onChange={e => setPaste(e.target.value)}
            placeholder={'Or paste cells (tab or comma separated):\nName\tPayout\nBenjamin Tinoco\t1240'}
            className="w-full h-20 bg-bg-tertiary border border-border-subtle rounded-lg p-2 text-[11px] text-white focus:outline-none resize-none"
          />
          <Button size="sm" className="mt-2" onClick={parsePaste} disabled={!paste.trim()}>Parse pasted data</Button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-accent-red/10 border border-accent-red/30 text-accent-red text-xs mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="flex items-center gap-3 mb-2 text-xs">
            <span className="text-text-secondary">{reconciled.length} rows</span>
            {flagged.length === 0 ? (
              <span className="text-accent-green flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> All match</span>
            ) : (
              <span className="text-accent-red flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> {flagged.length} to review</span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] text-text-muted uppercase tracking-wider border-b border-border-subtle">
                  <th className="pb-2">Report Name</th><th className="pb-2">Matched</th>
                  <th className="pb-2 text-right">Reported</th><th className="pb-2 text-right">Tool Computed</th>
                  <th className="pb-2 text-right">Difference</th><th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {reconciled.map((r, i) => {
                  const ok = r.matched && r.diff != null && Math.abs(r.diff) <= 1;
                  return (
                    <tr key={i} className={cn('hover:bg-white/5 transition-colors', !ok && 'bg-accent-red/[0.04]')}>
                      <td className="py-2">{r.name}</td>
                      <td className="py-2">{r.matched ?? <span className="text-accent-red">no match</span>}</td>
                      <td className="py-2 text-right">{formatCurrency(r.amount)}</td>
                      <td className="py-2 text-right text-text-secondary">{r.computed == null ? '—' : formatCurrency(r.computed)}</td>
                      <td className={cn('py-2 text-right font-semibold', r.diff == null ? 'text-text-muted' : Math.abs(r.diff) <= 1 ? 'text-accent-green' : 'text-accent-red')}>
                        {r.diff == null ? '—' : `${r.diff >= 0 ? '+' : ''}${formatCurrency(r.diff)}`}
                      </td>
                      <td className="py-2">{ok ? <span className="text-accent-green">✓ match</span> : <span className="text-accent-red">review</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[10px] text-text-muted">
            &quot;Tool computed&quot; is base commission + lead bump + ASM override for the selected period. A difference over $1 is flagged — check for a miskeyed line, a chargeback, or a plan the report priced differently.
          </p>
        </>
      )}
    </div>
  );
}
