'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpRight, Menu, X } from 'lucide-react';

const links = [
  { href: '/training', label: 'Training home' },
  { href: '/training/roadmap', label: 'New-hire roadmap' },
  { href: '/training#resources', label: 'Field resources' },
];

export function TrainingHeader() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  return <header className="border-b border-[var(--training-border)]" onKeyDown={event => {
    if (event.key === 'Escape' && open) { setOpen(false); toggle.current?.focus(); }
  }}>
    <div className="mx-auto max-w-6xl px-5 sm:px-8">
      <div className="flex min-h-20 items-center justify-between gap-3">
        <Link href="/training" className="flex min-w-0 items-center gap-3" aria-label="Sorami training home" onClick={() => setOpen(false)}>
          <Image src="/training/sorami-favicon.svg" width={44} height={44} alt="" className="shrink-0 rounded-xl" />
          <span className="flex min-w-0 flex-col"><span className="text-base font-extrabold tracking-[0.16em]">SORAMI</span><span className="training-muted text-sm">Training room</span></span>
        </Link>
        <button ref={toggle} type="button" aria-expanded={open} aria-controls="training-mobile-navigation" className="flex min-h-12 items-center gap-2 rounded-xl border border-[var(--training-border)] px-3 text-sm font-semibold md:hidden" onClick={() => setOpen(!open)}>{open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}{open ? 'Close' : 'Menu'}</button>
        <nav aria-label="Training navigation" className="hidden items-center gap-6 md:flex">
          {links.slice(1).map(link => <Link key={link.href} href={link.href} aria-current={pathname === link.href ? 'page' : undefined} className="inline-flex min-h-12 items-center text-sm training-muted hover:underline">{link.label}</Link>)}
          <Link href="/login" className="inline-flex min-h-12 items-center gap-1 text-sm training-muted hover:underline">Staff login <ArrowUpRight size={16} aria-hidden="true" /></Link>
        </nav>
      </div>
      <nav id="training-mobile-navigation" aria-label="Mobile training navigation" hidden={!open} className="border-t border-[var(--training-border)] py-3 md:hidden">
        {links.map(link => <Link key={link.href} href={link.href} aria-current={pathname === link.href ? 'page' : undefined} onClick={() => setOpen(false)} className="flex min-h-12 items-center rounded-lg px-3 text-base hover:bg-[var(--training-surface)] aria-[current=page]:text-[var(--training-brand)]">{link.label}</Link>)}
        <Link href="/login" onClick={() => setOpen(false)} className="flex min-h-12 items-center gap-2 rounded-lg px-3 text-base training-muted">Staff login <ArrowUpRight size={16} aria-hidden="true" /></Link>
      </nav>
    </div>
  </header>;
}
