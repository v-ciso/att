'use client';

import { ArrowRight } from 'lucide-react';
import type { Study } from '@/lib/training/engine';

export function StudyGuide({ guide, topic, onTopic, onResume, resumeLabel }: {
  guide: Study; topic: string; onTopic: (topic: string) => void; onResume: () => void; resumeLabel: string;
}) {
  return <div className="flex flex-col gap-6">
    <div className="flex flex-wrap gap-2" role="group" aria-label="Brush-up topics">
      {Object.keys(guide).map(name => <button key={name} onClick={() => onTopic(name)} aria-pressed={topic === name} className={`training-button ${topic === name ? '' : 'training-button-secondary'}`}>{name}</button>)}
    </div>
    <section className="flex flex-col gap-3" aria-label={`${topic} study notes`}>
      {(guide[topic] || []).map(fact => <article key={fact.h} className="training-panel flex flex-col gap-2 p-5"><h2 className="text-base font-bold">{fact.h}</h2><p className="text-sm leading-relaxed training-muted">{fact.b}</p></article>)}
    </section>
    <button onClick={onResume} className="training-button self-start">{resumeLabel}<ArrowRight size={18} aria-hidden="true" /></button>
  </div>;
}
