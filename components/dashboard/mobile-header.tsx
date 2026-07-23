'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/white-label/theme-provider';
import { Menu, X } from 'lucide-react';
import { navigation, isNavItemActive } from './nav-items';

function Logo() {
  const { theme } = useTheme();
  if (theme.logoUrl) {
    return <img src={theme.logoUrl} alt={`${theme.companyName} logo`} className="h-8 w-auto" />;
  }
  return <span className="text-lg font-bold neon-brand">{theme.companyName}</span>;
}

export function MobileHeader({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 glass border-b border-border-subtle px-4 py-3 flex items-center justify-between lg:hidden">
      <Logo />
      <button onClick={onMenuClick} className="p-2 rounded-lg hover:bg-white/5 transition-colors" aria-label="Open menu">
        <Menu className="w-6 h-6" />
      </button>
    </header>
  );
}

export function MobileMenu({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab');

  return (
    <div
      id="mobileMenu"
      className={cn(
        'mobile-menu fixed inset-0 z-50 glass lg:hidden',
        isOpen ? 'block' : 'hidden'
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Mobile navigation"
    >
      <div className="p-6 bg-bg-secondary/95 backdrop-blur-glass min-h-screen">
        <div className="flex items-center justify-between mb-8">
          <Logo />
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 transition-colors" aria-label="Close menu">
            <X className="w-6 h-6" />
          </button>
        </div>
        <nav className="space-y-2" role="navigation" aria-label="Mobile navigation">
          {navigation.map((item) => {
            const isActive = isNavItemActive(item, pathname, currentTab);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-3 rounded-xl border transition-all duration-200',
                  isActive
                    ? 'bg-[var(--brand-soft)] border-[var(--brand-soft)] text-white'
                    : 'border-transparent text-text-secondary hover:text-white hover:bg-white/5'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <span
                  className="inline-flex flex-shrink-0"
                  style={isActive ? { color: 'var(--brand)' } : undefined}
                  aria-hidden="true"
                >
                  <item.icon className="w-5 h-5" />
                </span>
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
