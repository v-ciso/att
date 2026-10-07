import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { DrillChooser } from '@/components/training/drill-chooser';
import { TrainingResources } from '@/components/training/resources';
import { drills } from '@/lib/training/engine';

export const metadata: Metadata = { title: { absolute: 'Rep Training | Sorami Marketing' } };

export default function TrainingPage() {
  return (
    <main id="training-main" tabIndex={-1} className="mx-auto flex max-w-6xl flex-col gap-9 px-5 py-7 sm:gap-12 sm:px-8 sm:py-12">
      <section className="flex flex-col items-start gap-4 border-b border-[var(--training-border)] pb-7 sm:pb-10">
        <span className="training-accent text-sm font-semibold tracking-widest uppercase">A little practice. A stronger pitch.</span>
        <h1 className="max-w-2xl text-balance text-4xl font-extrabold leading-[1.12] tracking-tight sm:text-5xl">Walk onto the floor<br /><span className="training-accent">feeling ready.</span></h1>
        <p className="max-w-xl text-pretty text-base leading-relaxed training-muted">Know the offer. Find the right words. Build your confidence, one round at a time.</p>
        <div className="flex w-full flex-col gap-3 min-[400px]:flex-row sm:w-auto"><a href="#drills" className="training-button">Find your practice <ArrowRight size={18} aria-hidden="true" /></a><Link href="/training/roadmap" className="training-button training-button-secondary">New here? Start here</Link></div>
        <p className="flex items-start gap-2 text-sm training-muted"><ShieldCheck className="shrink-0 training-accent" size={18} aria-hidden="true" />Training only. Always verify live offers before quoting.</p>
      </section>
      <DrillChooser items={(['promo', 'pitch'] as const).map(key => ({ key, title: drills[key].title, description: drills[key].description, count: drills[key].bank.length, topics: Object.keys(drills[key].study) }))} />
      <details className="training-panel training-disclosure px-5 py-2">
        <summary className="cursor-pointer text-base font-semibold">About these training materials</summary>
        <p className="pb-4 text-sm leading-relaxed training-muted">Based on the September 29, 2026 materials. Offers change—verify prices, eligibility, and terms in the current AT&T quoting tool before every customer conversation. Never guess. Confirm first.</p>
      </details>
      <section aria-labelledby="roadmap-heading" className="training-panel flex flex-col items-start gap-5 p-6 sm:p-8">
        <p className="training-accent text-sm font-semibold uppercase tracking-widest">Your next chapter</p>
        <h2 id="roadmap-heading" className="text-balance text-3xl font-bold">From your first shift to your own market.</h2>
        <p className="training-muted max-w-2xl leading-relaxed">Get your first-90-days plan, daily field tools, and the four-step career path: Sales Rep → Leader → Assistant Director/Manager → Owner.</p>
        <Link href="/training/roadmap" className="training-button">Explore the new-hire roadmap <ArrowRight size={18} aria-hidden="true" /></Link>
      </section>
      <TrainingResources />
    </main>
  );
}
