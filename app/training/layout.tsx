import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { ArrowUpRight, BookOpen } from 'lucide-react';

export const metadata: Metadata = {
  title: { default: 'Rep Training | Sorami Marketing', template: '%s | Sorami Training' },
  description: 'Practice your sales knowledge, brush up on Costco promotions, and get started with Sorami Marketing’s field guides. No account required.',
  robots: { index: false, follow: false },
  icons: { icon: { url: '/training/sorami-favicon.svg', type: 'image/svg+xml' } },
};

export const viewport: Viewport = { themeColor: '#14140f', width: 'device-width', initialScale: 1 };

export default function TrainingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="training-theme font-sans">
      <a href="#training-main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 training-button">Skip to content</a>
      <header className="border-b border-[var(--training-border)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/training" className="flex items-center gap-3" aria-label="Sorami training home">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-[var(--training-brand)] training-accent"><BookOpen size={22} aria-hidden="true" /></span>
            <span className="flex flex-col"><span className="text-lg font-extrabold tracking-[0.16em]">SORAMI</span><span className="training-muted text-sm">Learning & development</span></span>
          </Link>
          <nav aria-label="Training navigation" className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 sm:gap-7">
            <Link href="/training/roadmap" className="flex min-h-11 items-center text-sm training-muted hover:underline">Roadmap</Link>
            <Link href="/training#resources" className="hidden text-sm training-muted hover:underline sm:inline-flex">Field resources</Link>
            <Link href="/login" className="flex min-h-11 items-center gap-1 text-sm training-muted hover:underline">Staff login <ArrowUpRight size={16} aria-hidden="true" /></Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t border-[var(--training-border)]">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-3 px-5 py-7 text-sm training-muted sm:flex-row sm:px-8">
          <p>Sorami Marketing · Rep training</p>
          <p>Public access. No account needed. Practice, not a live quote.</p>
        </div>
      </footer>
    </div>
  );
}
