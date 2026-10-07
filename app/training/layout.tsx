import type { Metadata, Viewport } from 'next';
import { TrainingHeader } from '@/components/training/training-header';

export const metadata: Metadata = {
  title: { default: 'Rep Training | Sorami Marketing', template: '%s | Sorami Training' },
  description: 'Practice your sales knowledge, brush up on Costco promotions, and get started with Sorami Marketing’s field guides. No account required.',
  robots: { index: false, follow: false },
  icons: { icon: { url: '/training/sorami-favicon.svg', type: 'image/svg+xml' } },
};

export const viewport: Viewport = { themeColor: '#14140f', width: 'device-width', initialScale: 1, userScalable: true, viewportFit: 'cover' };

export default function TrainingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="training-theme font-sans">
      <a href="#training-main" className="training-skip-link">Skip to content</a>
      <TrainingHeader />
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
