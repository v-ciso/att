'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, MessageSquare, Smartphone } from 'lucide-react';
import type { DrillKey } from '@/lib/training/engine';

type DrillPreview = { key: DrillKey; title: string; description: string; count: number; topics: string[] };

export function DrillChooser({ items }: { items: DrillPreview[] }) {
  const [mode, setMode] = useState<'practice' | 'study'>('practice');
  return <section id="drills" className="flex scroll-mt-6 flex-col gap-5" aria-labelledby="drills-heading">
    <div className="flex flex-col gap-2"><p className="training-accent text-sm font-semibold uppercase tracking-widest">Your next rep starts here</p><h2 id="drills-heading" className="text-balance text-2xl font-bold sm:text-3xl">What do you want to sharpen?</h2></div>
    <div className="training-mode-switch" role="group" aria-label="Learning mode">
      <button type="button" aria-pressed={mode === 'practice'} onClick={() => setMode('practice')}>Practice a round</button>
      <button type="button" aria-pressed={mode === 'study'} onClick={() => setMode('study')}>Brush up first</button>
    </div>
    <p aria-live="polite" className="text-sm training-muted">{mode === 'practice' ? '12 questions. Instant explanations. A fresh round every time.' : 'No quiz, no pressure. Review each topic at your own pace.'}</p>
    <div className="grid gap-4 md:grid-cols-2">
      {items.map(drill => {
        const Icon = drill.key === 'promo' ? Smartphone : MessageSquare;
        return <article key={drill.key} className="training-panel flex flex-col gap-5 p-5 sm:p-7">
          <div className="flex items-center gap-3"><span className="training-accent flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--training-border)]"><Icon size={22} aria-hidden="true" /></span><p className="text-sm training-muted">{drill.count} questions · {drill.topics.length} topics</p></div>
          <div className="flex flex-col gap-2"><h3 className="text-xl font-bold sm:text-2xl">{drill.title}</h3><p className="text-base leading-relaxed training-muted">{drill.description}</p></div>
          <details className="training-disclosure text-sm"><summary className="min-h-11 cursor-pointer font-semibold">Explore the topics</summary><ul className="flex list-disc flex-col gap-2 pb-3 pl-5 training-muted">{drill.topics.map(topic => <li key={topic}>{topic}</li>)}</ul></details>
          <Link href={`/training/practice?drill=${drill.key}${mode === 'study' ? '&mode=study' : ''}`} className="training-button w-full" aria-label={`${mode === 'practice' ? 'Practice' : 'Brush up on'} ${drill.title}`}>{mode === 'practice' ? <>Start practice <ArrowRight size={18} aria-hidden="true" /></> : <><BookOpen size={18} aria-hidden="true" /> Open brush-up guide</>}</Link>
        </article>;
      })}
    </div>
    <p className="text-sm training-muted">Scores stay in this visit only. Nothing is submitted or tracked.</p>
  </section>;
}
