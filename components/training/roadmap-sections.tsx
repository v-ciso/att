import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { careerSteps, dailyHabits, fieldLinks, onboardingSteps } from '@/lib/training/roadmap';

export function CareerPath() {
  return (
    <section id="career-path" aria-labelledby="career-heading" className="flex scroll-mt-6 flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="training-accent text-sm font-semibold uppercase tracking-widest">Four steps to market owner</p>
        <h2 id="career-heading" className="text-balance text-3xl font-bold">We only promote from within.</h2>
        <p className="training-muted max-w-3xl leading-relaxed">Every manager here started where you are now. Each promotion comes with a certificate and new responsibilities. Your results and how you develop others decide when you move up.</p>
      </div>
      <ol aria-label="Career progression" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {careerSteps.map((step, index) => (
          <li key={step.title} className="training-panel flex flex-col gap-4 p-6">
            <span className="training-accent text-sm font-bold">STEP {index + 1} OF 4</span>
            <h3 className="text-pretty text-xl font-bold">{step.title}</h3>
            <p className="training-muted text-sm leading-relaxed">{step.description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function OnboardingTimeline() {
  return (
    <section id="first-90-days" aria-labelledby="onboarding-heading" className="flex scroll-mt-6 flex-col gap-6">
      <div className="flex flex-col gap-3"><p className="training-accent text-sm font-semibold uppercase tracking-widest">Your onboarding plan</p><h2 id="onboarding-heading" className="text-3xl font-bold">Your first 90 days.</h2><p className="training-muted">Build the habits now. Carry them into every role.</p></div>
      <ol className="flex flex-col gap-4">
        {onboardingSteps.map(step => (
          <li key={step.period} className="training-panel grid gap-4 p-6 md:grid-cols-[160px_1fr]">
            <p className="training-accent text-sm font-semibold uppercase tracking-wider">{step.period}</p>
            <div className="flex flex-col items-start gap-3"><h3 className="text-xl font-bold">{step.title}</h3><p className="training-muted leading-relaxed">{step.description}</p><Link href={step.href} className="training-accent inline-flex min-h-11 items-center gap-2 text-sm font-semibold hover:underline">{step.link}<ArrowRight size={16} aria-hidden="true" /></Link></div>
          </li>
        ))}
      </ol>
      <p className="training-muted text-sm">Practice scores are not saved or submitted. Share your progress with your Leader; the onboarding timeline is not a guarantee of promotion.</p>
    </section>
  );
}

export function FieldEssentials() {
  return (
    <>
      <section aria-labelledby="habits-heading" className="flex flex-col gap-6">
        <h2 id="habits-heading" className="text-3xl font-bold">The habits that move you forward.</h2>
        <div className="grid gap-4 sm:grid-cols-2">{dailyHabits.map(habit => <article key={habit.title} className="training-panel flex flex-col gap-3 p-6"><h3 className="text-xl font-bold">{habit.title}</h3><p className="training-muted leading-relaxed">{habit.description}</p></article>)}</div>
      </section>
      <section aria-labelledby="offer-heading" className="flex flex-col gap-6">
        <div className="flex flex-col gap-3"><p className="training-accent text-sm font-semibold uppercase tracking-widest">Know the member benefits</p><h2 id="offer-heading" className="text-balance text-3xl font-bold">Believe in what you&apos;re selling.</h2><p className="training-muted">These are training references, not live offers. Confirm every benefit and eligibility requirement on Knowledge Plus.</p></div>
        <div className="grid gap-5 md:grid-cols-2">
          <article className="training-panel flex flex-col gap-4 p-6"><h3 className="text-xl font-bold">At Costco</h3><ul className="flex list-disc flex-col gap-3 pl-5 training-muted"><li><strong className="text-[var(--training-text)]">Costco Digital Shop Card:</strong> available with eligible devices; the guide notes that it never expires.</li><li><strong className="text-[var(--training-text)]">Next Up Anytime:</strong> the supplied guide lists a waived $35 upgrade fee, a $100 shop card, and $50 in bill credits. Verify current terms.</li><li><strong className="text-[var(--training-text)]">Dedicated VIP line:</strong> <a href="tel:+18339504601" className="training-accent underline">(833) 950-4601</a>.</li><li><strong className="text-[var(--training-text)]">Help in person:</strong> help members set up their phones and navigate the switch.</li></ul></article>
          <article className="training-panel flex flex-col gap-4 p-6"><h3 className="text-xl font-bold">With AT&amp;T</h3><ul className="flex list-disc flex-col gap-3 pl-5 training-muted"><li><strong className="text-[var(--training-text)]">Trade-in credits:</strong> check current iPhone, Pixel, and Galaxy offers, including eligibility for older or damaged phones.</li><li><strong className="text-[var(--training-text)]">Upgrade early:</strong> the guide describes Next Up Anytime upgrades after one payment, subject to current program requirements.</li><li><strong className="text-[var(--training-text)]">Help paying to switch:</strong> check Carrier Switcher reward-card eligibility toward an old-carrier balance.</li><li><strong className="text-[var(--training-text)]">Appreciation discounts:</strong> for qualifying first responders, military, teachers, and other eligible groups.</li></ul></article>
        </div>
        <p className="training-muted text-sm">Network and coverage claims change. Use current claims on Knowledge Plus and check coverage at the member&apos;s home address.</p>
      </section>
      <section id="quick-links" aria-labelledby="links-heading" className="flex scroll-mt-6 flex-col gap-6">
        <div className="flex flex-col gap-3"><h2 id="links-heading" className="text-3xl font-bold">Your shift toolkit.</h2><p className="training-muted">Bookmark these. This roadmap is public; some external tools require staff credentials.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">{fieldLinks.map(link => <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className="training-panel flex flex-col gap-3 p-6 hover:border-[var(--training-brand)]"><span className="flex items-start justify-between gap-3 font-bold">{link.title}<ArrowUpRight className="shrink-0 training-accent" size={18} aria-hidden="true" /></span><span className="training-muted text-sm leading-relaxed">{link.description}</span><span className="sr-only">Opens in a new tab</span></a>)}<Link href="/training#drills" className="training-panel flex flex-col gap-3 p-6 hover:border-[var(--training-brand)]"><span className="flex items-center justify-between font-bold">Practice drills<ArrowRight size={18} className="training-accent" aria-hidden="true" /></span><span className="training-muted text-sm">Promo and Pitch &amp; Compliance. 12 questions per round, with instant explanations.</span></Link></div>
      </section>
    </>
  );
}
