'use client';

import { useEffect, useReducer, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, BookOpen, RotateCcw } from 'lucide-react';
import { drills, drawRound, initialState, practiceReducer, ROUND_SIZE, scoreRound, type DrillKey } from '@/lib/training/engine';
import { QuestionCard } from './question-card';
import { StudyGuide } from './study-guide';

export function PracticeRoom({ drill, study }: { drill: DrillKey; study: boolean }) {
  const [state, dispatch] = useReducer(practiceReducer, { drill, study }, value => initialState(value.drill, value.study));
  const headingRef = useRef<HTMLHeadingElement>(null);
  const source = drills[drill];
  const score = scoreRound(state);
  const question = state.round[state.index];
  const missed = state.round.filter((q, index) => state.picks[index] !== q.a);
  const title = state.screen === 'question' ? question.q : state.screen === 'study' ? state.topic : state.screen === 'done' ? 'Round complete.' : source.title;

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [state.screen, state.index]);

  function start() {
    const next = drawRound(source.bank, state.seen, state.round.map(q => q.id));
    dispatch({ type: 'start', ...next });
  }
  function openStudy(topic: string) { dispatch({ type: 'study', topic }); }

  return <main id="training-main" tabIndex={-1} data-practice-screen={state.screen} className="mx-auto flex min-h-[70dvh] max-w-3xl flex-col gap-7 px-5 py-8 sm:px-8 sm:py-10">
    <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/training" className="inline-flex min-h-11 items-center gap-2 text-sm training-muted" onClick={event => { if (state.screen === 'question' && !window.confirm('Leave this round? Your current round will be cleared.')) event.preventDefault(); }}><ArrowLeft size={16} aria-hidden="true" /> All training</Link><span className="text-sm training-muted">{state.screen === 'study' ? 'Brush-up guide' : 'Rep practice'} · No login required</span></div>
    {state.screen === 'question' && <div className="flex flex-col gap-3"><div className="flex items-center justify-between text-sm training-muted"><span>Question {state.index + 1} of {state.round.length}</span><span aria-live="polite">Score {score} / {state.round.length}</span></div><progress aria-label="Round progress" max={state.round.length} value={state.index + (state.picks[state.index] !== undefined ? 1 : 0)} /></div>}
    <div className="flex flex-col gap-3"><span className="text-sm font-semibold tracking-widest uppercase training-accent">{state.screen === 'question' ? question.topic : state.screen === 'ready' ? 'Build your floor confidence' : source.title}</span><h1 id="practice-heading" ref={headingRef} tabIndex={-1} className="text-pretty text-3xl font-bold leading-tight outline-none sm:text-4xl">{title}</h1></div>
    {state.screen === 'ready' && <div className="flex flex-col gap-6"><p className="leading-relaxed training-muted">{source.description}</p><div className="training-panel flex flex-col gap-4 p-6"><h2 className="text-lg font-bold">A quick round. A useful reset.</h2><ul className="flex list-disc flex-col gap-3 pl-5 text-sm training-muted"><li>{ROUND_SIZE} random questions from a bank of {source.bank.length}.</li><li>Choose an answer and learn why it is right.</li><li>Open a brush-up guide without losing your place.</li><li>Review your misses, then try fresh questions. Aim for 12 out of 12.</li></ul></div><div className="flex flex-wrap gap-3"><button onClick={start} className="training-button">Start round <ArrowRight size={18} aria-hidden="true" /></button><button onClick={() => openStudy(Object.keys(source.study)[0])} className="training-button training-button-secondary"><BookOpen size={18} aria-hidden="true" /> Brush up first</button></div></div>}
    {state.screen === 'question' && <QuestionCard question={question} picked={state.picks[state.index]} last={state.index === state.round.length - 1} onPick={answer => dispatch({ type: 'pick', answer })} onNext={() => dispatch({ type: 'next' })} onStudy={() => openStudy(question.topic)} />}
    {state.screen === 'study' && <StudyGuide guide={source.study} topic={state.topic} onTopic={topic => dispatch({ type: 'topic', topic })} resumeLabel={state.returnTo === 'question' ? 'Back to my question' : state.returnTo === 'done' ? 'Back to my score' : 'Start round'} onResume={() => state.returnTo === 'ready' ? start() : dispatch({ type: 'resume' })} />}
    {state.screen === 'done' && <div className="flex flex-col gap-7"><div className="training-panel flex flex-col gap-4 p-6 sm:p-8"><p className="text-6xl font-extrabold tracking-tight training-accent">{score}<span className="text-3xl training-muted"> / {state.round.length}</span></p><h2 className="text-xl font-semibold">{score === state.round.length ? 'Perfect recall. Keep it sharp.' : score >= 10 ? 'Almost there. Make the next round count.' : 'Every miss is something you can master.'}</h2><p className="text-sm training-muted">Best this visit: {state.best} / {ROUND_SIZE} · {state.rounds} {state.rounds === 1 ? 'round' : 'rounds'} completed</p></div>
      {missed.length > 0 && <section className="flex flex-col gap-4" aria-labelledby="missed-heading"><h2 id="missed-heading" className="text-xl font-bold">Review what you missed</h2>{missed.map(q => <article key={q.id} className="training-panel flex flex-col gap-3 p-5"><h3 className="text-base font-semibold">{q.q}</h3><p className="text-sm training-muted">Your answer: {state.picks[state.round.indexOf(q)]}</p><p className="text-sm font-semibold training-accent">Correct answer: {q.a}</p><p className="text-sm leading-relaxed training-muted">{q.why}</p><button className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold training-accent" onClick={() => openStudy(q.topic)}><BookOpen size={16} aria-hidden="true" /> Brush up on {q.topic}</button></article>)}</section>}
      <div className="flex flex-wrap gap-3"><button onClick={start} className="training-button"><RotateCcw size={18} aria-hidden="true" /> New round — fresh questions</button><button onClick={() => openStudy(Object.keys(source.study)[0])} className="training-button training-button-secondary">Brush up</button></div><p className="text-sm training-muted">{source.bank.length - state.seen.length} questions left before the bank cycles. Progress resets when you leave or refresh this page.</p>
    </div>}
    <aside className="mt-auto flex flex-col gap-2 border-t border-[var(--training-border)] pt-6 text-sm leading-relaxed training-muted"><p>Training source: September 29, 2026. Always confirm live prices, eligibility, and terms before quoting. A practice score is not certification.</p>{drill === 'pitch' && <p><strong className="training-accent">Compliance first:</strong> One no and go. No repeated pitches after a refusal, even where a script or Field Guide suggests otherwise.</p>}<Link href="/training#resources" className="inline-flex min-h-11 items-center gap-2 self-start training-accent">Open source documents <ArrowRight size={16} aria-hidden="true" /></Link></aside>
  </main>;
}
