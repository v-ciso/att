'use client';

import { useId, useState } from 'react';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatProductionPost } from '@/lib/production-post';
import type { SaleEntry } from '@/lib/sales';

export function CopyPost({ text, label }: { text: string; label: string }) {
  const [feedback, setFeedback] = useState<{ text: string; message: string } | null>(null);
  const message = feedback?.text === text ? feedback.message : '';
  const [showPreview, setShowPreview] = useState(false);
  const id = useId();
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setFeedback({ text, message: 'Copied. Ready to paste into your chat.' });
    } catch {
      setShowPreview(true);
      setFeedback({ text, message: 'Clipboard access is blocked. Select and copy the post below.' });
    }
  }
  return <div className="flex min-w-0 flex-col gap-2">
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="secondary" className="min-h-11" onClick={copy}><Copy className="size-4" />{label}</Button>
      <Button size="sm" variant="ghost" className="min-h-11" aria-expanded={showPreview} aria-controls={id} onClick={() => setShowPreview(!showPreview)}>{showPreview ? 'Hide post' : 'Preview post'}</Button>
    </div>
    <p role="status" aria-live="polite" className="text-sm text-text-secondary">{message}</p>
    {showPreview && <textarea id={id} aria-label={`${label} preview`} readOnly rows={12} value={text} onFocus={event => event.currentTarget.select()} className="w-full min-w-0 rounded-xl border border-border-subtle bg-bg-tertiary p-3 font-mono text-sm text-text-primary" />}
  </div>;
}

export function ProductionShare({ sales, date, stores }: { sales: SaleEntry[]; date: string; stores?: string[] }) {
  const [period, setPeriod] = useState<'daily' | 'weekly'>('daily');
  const text = date ? formatProductionPost(sales, { date, period, stores }) : '';
  return <section aria-label="Share production" className="mb-4 flex flex-col gap-3 rounded-xl border border-border-subtle bg-bg-secondary p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-sm font-semibold">Post production to your chat</h3><p className="text-sm text-text-secondary">Selected date: {date || 'choose a date'} · weekly posts use Monday–Sunday. Store filters apply.</p></div>
      <label className="flex items-center gap-2 text-sm">Post period<select value={period} onChange={event => setPeriod(event.target.value as 'daily' | 'weekly')} className="min-h-11 rounded-lg border border-border-subtle bg-bg-tertiary px-3 text-text-primary"><option value="daily">Daily</option><option value="weekly">Weekly</option></select></label>
    </div>
    {text && <CopyPost text={text} label={`Copy ${period} production`} />}
  </section>;
}
