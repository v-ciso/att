'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { cn, getInitials, ROLE_LABELS } from '@/lib/utils';
import { useTheme } from '@/components/white-label/theme-provider';
import { navigation, isNavItemActive } from './nav-items';
import { isSuperAdminEmail } from '@/lib/super-admins';
import { ShieldCheck } from 'lucide-react';
import { WorkspaceSwitcher } from './workspace-switcher';

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab');
  const { data: session } = useSession();
  const { theme } = useTheme();

  // Falls back to the demo identity when no one is signed in (preview mode).
  const userName = session?.user?.name ?? 'Demo Owner';
  const userRole = session?.user?.role
    ? (ROLE_LABELS[session.user.role as keyof typeof ROLE_LABELS] ?? session.user.role)
    : 'Market Owner';

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 glass border-r border-border-subtle hidden lg:flex flex-col z-30">
      {/* Header and footer are fixed; only the nav list scrolls. Without the
          min-h-0 below, a 12-item nav pushes the footer (Demo/Live switch, user
          chip, Sign out) off the bottom of a short viewport — which is how the
          Sign out button became unreachable at 652px tall. */}
      <div className="flex-none px-6 pt-6 pb-4 flex items-center gap-2">
        {theme.logoUrl ? (
          <img src={theme.logoUrl} alt={`${theme.companyName} logo`} className="h-10 w-auto" />
        ) : (
          <span className="text-xl font-bold neon-brand">{theme.companyName}</span>
        )}
        <span className="text-xs text-text-muted">v2.0</span>
      </div>
      <nav
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 space-y-1"
        aria-label="Main navigation"
      >
        {navigation.map((item) => {
          const isActive = isNavItemActive(item, pathname, currentTab);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-xl border transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]',
                isActive
                  ? 'bg-[var(--brand-soft)] border-[var(--brand-soft)] text-white'
                  : 'border-transparent text-text-secondary hover:text-white hover:bg-white/5'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Wrapper carries the colour: nav icons only accept className,
                  and lucide glyphs inherit currentColor. */}
              <span
                className="inline-flex flex-shrink-0"
                style={isActive ? { color: 'var(--brand)' } : undefined}
                aria-hidden="true"
              >
                <item.icon className="w-5 h-5" />
              </span>
              <span className="text-sm">{item.name}</span>
            </Link>
          );
        })}
      </nav>
      {/* flex-none: this block must never be squeezed or scrolled away. */}
      <div className="flex-none px-6 pt-4 pb-6 border-t border-border-subtle space-y-3">
        {(session?.user?.isSuperAdmin ?? isSuperAdminEmail(session?.user?.email)) && (
          <Link
            href="/admin"
            className="flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-xl text-sm text-text-secondary hover:text-white hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
          >
            <ShieldCheck className="w-4 h-4 flex-none" style={{ color: 'var(--brand)' }} aria-hidden="true" />
            Admin Console
          </Link>
        )}
        <WorkspaceSwitcher />
        <div className="flex items-center gap-3 px-3 py-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-none"
            style={{
              background: 'linear-gradient(135deg, var(--brand-2), var(--brand-3))',
              color: 'var(--brand-ink)',
            }}
            aria-hidden="true"
          >
            {getInitials(userName)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{userName}</p>
            <p className="text-xs text-text-muted truncate">{userRole}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
