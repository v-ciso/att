import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';
import { CareerPath, FieldEssentials, OnboardingTimeline } from '@/components/training/roadmap-sections';

export const metadata: Metadata = {
  title: { absolute: 'New Hire Roadmap | Sorami Training' },
  description: 'Your first 90 days at Sorami and the four-step career path: Sales Rep, Leader, Assistant Director/Manager, and Owner. Includes field tools and practice resources.',
};

export default function RoadmapPage() {
  return (
    <main id="training-main" className="mx-auto flex max-w-6xl flex-col gap-12 px-5 py-10 sm:px-8 sm:py-14">
      <header className="flex flex-col items-start gap-5">
        <Link href="/training" className="training-muted inline-flex min-h-11 items-center gap-2 text-sm hover:underline"><ArrowLeft size={16} aria-hidden="true" />Back to training</Link>
        <p className="training-accent text-sm font-semibold uppercase tracking-[0.16em]">New hire roadmap</p>
        <h1 className="max-w-3xl text-balance text-4xl font-extrabold leading-[1.12] tracking-tight sm:text-5xl">Your road from day one to <span className="training-accent">running a market.</span></h1>
        <p className="training-muted max-w-2xl text-pretty leading-relaxed">Everything about the program in one place: how it works, what to master each week, how to get promoted, and the tools you&apos;ll use every shift.</p>
        <div className="flex flex-wrap gap-3"><a href="#career-path" className="training-button">See the four steps<ArrowRight size={18} aria-hidden="true" /></a><a href="#first-90-days" className="training-button training-button-secondary">Your first 90 days</a><a href="#quick-links" className="training-button training-button-secondary">Quick links</a></div>
      </header>
      <aside className="training-panel flex flex-col gap-3 border-2 !border-[var(--training-brand)] p-6" aria-labelledby="rule-heading">
        <p className="training-accent flex items-center gap-2 text-sm font-semibold uppercase tracking-wider"><ShieldCheck size={20} aria-hidden="true" />Rule one · Every shift</p>
        <h2 id="rule-heading" className="text-2xl font-bold">Check the promotion before you pitch it.</h2>
        <p className="training-muted leading-relaxed">Our sheets and drills can fall behind AT&amp;T. Before your first conversation each day, confirm current offers, pricing, and eligibility on <a href="https://attknowledgeplus.com" target="_blank" rel="noopener noreferrer" className="training-accent font-semibold underline">AT&amp;T Knowledge Plus<span className="sr-only"> (opens in a new tab)</span></a> using your SARA Plus credentials. If it doesn&apos;t match what you practiced, follow the current official terms and tell your manager.</p>
      </aside>
      <CareerPath />
      <OnboardingTimeline />
      <FieldEssentials />
    </main>
  );
}
