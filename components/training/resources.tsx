import { ArrowUpRight, Download, FileText } from 'lucide-react';
import Link from 'next/link';

const documents = [
  { title: 'Field Guide', label: 'The sales playbook', pages: 11, path: '/training/field-guide.pdf', description: 'Your selling day, the five-step conversation, the four Ps, closing, and on-floor standards.', edition: 'SM-2026 edition' },
  { title: 'Costco Promotions', label: 'The offer reference', pages: 8, path: '/training/costco-promotions.pdf', description: 'Trade-in grids, no-trade pricing, member perks, Next Up Anytime, and the bill conversation.', edition: 'Updated September 29, 2026' },
];

export function TrainingResources() {
  return (
    <section id="resources" className="flex scroll-mt-6 flex-col gap-7" aria-labelledby="resources-heading">
      <div className="flex flex-col gap-2"><span className="text-sm font-semibold uppercase tracking-[0.14em] training-accent">Your first day, made simpler</span><h2 id="resources-heading" className="text-3xl font-bold">Keep the essentials close.</h2><p className="training-muted">Read the guides, learn the basics, then put your knowledge to work.</p></div>
      <div className="grid gap-5 md:grid-cols-2">
        {documents.map(document => <article key={document.path} className="training-panel flex flex-col gap-5 p-6">
          <div className="flex items-start gap-4"><span className="training-accent rounded-lg border border-[var(--training-border)] p-3"><FileText size={24} aria-hidden="true" /></span><div className="flex flex-col gap-1"><p className="training-muted text-sm">{document.label}</p><h3 className="text-xl font-bold">{document.title}</h3></div></div>
          <p className="training-muted text-sm leading-relaxed">{document.description}</p><p className="training-muted text-sm">PDF · {document.pages} pages · {document.edition}</p>
          <div className="flex flex-wrap gap-3"><a href={document.path} target="_blank" rel="noopener noreferrer" className="training-button training-button-secondary" aria-label={`Read ${document.title} PDF (opens in a new tab)`}>Read guide <ArrowUpRight size={16} aria-hidden="true" /></a><a href={document.path} download className="training-button training-button-secondary" aria-label={`Download ${document.title} PDF`}><Download size={16} aria-hidden="true" /> Download</a></div>
        </article>)}
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-4"><h3 className="text-xl font-bold">Before your first shift</h3><ol className="flex list-decimal flex-col gap-3 pl-5 text-sm leading-relaxed training-muted"><li>Read the Field Guide. Practice your opener out loud and learn the four Ps: Phone, Plan, Price, Promotion.</li><li>Review the promotion sheet and confirm today&apos;s offers in the quoting tool with your manager.</li><li>Brush up on compliance, then take a 12-question practice round.</li><li>Ask your manager for your Orientation Handout, reporting location, shift, pay policies, and daily targets. Those details aren&apos;t supplied on this page.</li></ol></div>
        <aside className="flex flex-col gap-4 rounded-xl border border-[var(--training-brand)] p-6"><h3 className="text-xl font-bold">One no and go. Always.</h3><p className="text-sm leading-relaxed training-muted">The practice material&apos;s compliance rule is stricter than the Field Guide&apos;s repeated-close advice. If a member says no, waves you off, or ignores you, thank them and let them go. Never chase, pressure, or ask again. Ask your manager to clarify any conflicting guidance.</p><Link href="/training/practice?drill=pitch&mode=study" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold training-accent">Review compliance <ArrowUpRight size={16} aria-hidden="true" /></Link></aside>
      </div>
    </section>
  );
}
