'use client';

import { ArrowRight, BookOpen, Check, X } from 'lucide-react';
import type { RoundQuestion } from '@/lib/training/engine';

export function QuestionCard({ question, picked, last, onPick, onNext, onStudy }: {
  question: RoundQuestion; picked?: string; last: boolean;
  onPick: (answer: string) => void; onNext: () => void; onStudy: () => void;
}) {
  const answered = picked !== undefined;
  const correct = picked === question.a;
  return <div className="flex flex-col gap-6">
    <div className="flex flex-col gap-3" role="group" aria-labelledby="practice-heading">
      {question.options.map((option, index) => {
        const result = answered ? option === question.a ? 'correct' : option === picked ? 'incorrect' : 'other' : undefined;
        return <button key={option} className="training-answer" data-result={result} disabled={answered} onClick={() => onPick(option)}>
          <span className="training-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--training-border)] text-sm" aria-hidden="true">{String.fromCharCode(65 + index)}</span>
          <span className="flex-1">{option}</span>
          {result === 'correct' && <><Check size={20} className="training-accent shrink-0" aria-hidden="true" /><span className="sr-only">Correct answer</span></>}
          {result === 'incorrect' && <><X size={20} className="shrink-0" aria-hidden="true" /><span className="sr-only">Your answer, incorrect</span></>}
        </button>;
      })}
    </div>
    {answered && <div className="flex flex-col gap-5">
      <div role="status" className="training-panel flex flex-col gap-2 p-5"><p className="font-bold training-accent">{correct ? 'Correct. Nicely done.' : 'Not quite. Here’s the answer.'}</p>{!correct && <p className="font-semibold">{question.a}</p>}<p className="text-sm leading-relaxed training-muted">{question.why}</p></div>
      <div className="flex flex-wrap items-center justify-between gap-3"><button onClick={onStudy} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold training-accent"><BookOpen size={18} aria-hidden="true" /> Brush up on {question.topic}</button><button onClick={onNext} className="training-button">{last ? 'See my score' : 'Next question'}<ArrowRight size={18} aria-hidden="true" /></button></div>
    </div>}
  </div>;
}
