import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen, MessageSquare, ShieldCheck, Smartphone } from 'lucide-react';
import { TrainingResources } from '@/components/training/resources';
import { drills } from '@/lib/training/engine';

export const metadata: Metadata = { title: { absolute: 'Rep Training | Sorami Marketing' } };

export default function TrainingPage() {
  return (
    <main id="training-main" className="mx-auto flex max-w-6xl flex-col gap-12 px-5 py-10 sm:px-8 sm:py-14">
      <section className="grid items-end gap-8 md:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col items-start gap-5">
          <span className="training-accent text-sm font-semibold tracking-[0.16em] uppercase">The Sorami training room</span>
          <h1 className="max-w-2xl text-balance text-4xl font-extrabold leading-[1.12] tracking-tight sm:text-5xl">Practice until<br />it&apos;s <span className="training-accent">second nature.</span></h1>
          <p className="max-w-xl text-pretty text-base leading-relaxed training-muted">Know the offer. Find the right words. Walk onto the floor ready. Your practice drills and field resources, all in one place.</p>
          <div className="flex flex-wrap items-center gap-3"><a href="#drills" className="training-button">Find your drill <ArrowRight size={18} aria-hidden="true" /></a><a href="#resources" className="training-button training-button-secondary">New here? Start here</a></div>
        </div>
        <aside className="training-panel flex flex-col gap-4 p-6">
          <span className="training-accent"><ShieldCheck size={26} aria-hidden="true" /></span>
          <h2 className="text-xl font-bold">Confidence starts with accuracy.</h2>
          <p className="training-muted text-sm leading-relaxed">Learn from the September 29, 2026 materials. Offers change—verify prices, eligibility, and terms in the current AT&T quoting tool before every customer conversation.</p>
          <span className="text-sm font-semibold">Never guess. Confirm first.</span>
        </aside>
      </section>
      <section id="drills" className="flex scroll-mt-6 flex-col gap-5" aria-labelledby="drills-heading">
        <div className="flex flex-wrap items-end justify-between gap-3"><h2 id="drills-heading" className="text-2xl font-bold">A little practice. A stronger pitch.</h2><p className="text-sm training-muted">12 questions per round · Instant explanations</p></div>
        <div className="grid gap-5 md:grid-cols-2">
          {(['promo', 'pitch'] as const).map(key => {
            const drill = drills[key];
            const Icon = key === 'promo' ? Smartphone : MessageSquare;
            return <article key={key} className="training-panel flex flex-col gap-5 p-6 sm:p-7">
              <div className="flex items-center justify-between"><Icon className="training-accent" size={26} aria-hidden="true" /><span className="text-sm training-muted">{drill.bank.length} questions · {Object.keys(drill.study).length} topics</span></div>
              <div className="flex flex-col gap-3"><h3 className="text-2xl font-bold">{drill.title}</h3><p className="text-sm leading-relaxed training-muted">{drill.description}</p></div>
              <div className="mt-auto grid grid-cols-1 gap-3 min-[360px]:grid-cols-2"><Link href={`/training/practice?drill=${key}`} className="training-button">Start round <ArrowRight className="hidden shrink-0 sm:block" size={16} aria-hidden="true" /></Link><Link href={`/training/practice?drill=${key}&mode=study`} className="training-button training-button-secondary"><BookOpen size={16} aria-hidden="true" /> Brush up</Link></div>
            </article>;
          })}
        </div>
        <p className="text-sm training-muted">Fresh questions before repeats. Scores last for your current visit only—nothing is submitted or tracked.</p>
      </section>
      <TrainingResources />
    </main>
  );
}
