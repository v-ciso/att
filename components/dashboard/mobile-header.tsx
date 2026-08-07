'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { cn, getInitials, ROLE_LABELS } from '@/lib/utils';
import { useTheme } from '@/components/white-label/theme-provider';
import { Menu, ShieldCheck, X } from 'lucide-react';
import { navigation, isNavItemActive } from './nav-items';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import { can } from '@/lib/permissions';
import { isSuperAdminEmail } from '@/lib/super-admins';
import { useActor } from '@/lib/use-actor';
import { WorkspaceSwitcher } from './workspace-switcher';

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
  // Unmount rather than hide: a `display:none` element still carried
  // role="dialog"/aria-modal, which told screen readers a modal was open on
  // every page load, and the focus trap must only run while it is visible.
  if (!isOpen) return null;
  return <MobileMenuPanel onClose={onClose} />;
}

function MobileMenuPanel({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab');
  const panelRef = useModalA11y<HTMLDivElement>(onClose);
  const { data: session } = useSession();

  // Same capability filtering as the desktop sidebar — the two menus must
  // never disagree about which tabs a seat can see.
  const actor = useActor();
  const visibleNavigation = useMemo(
    () => navigation.filter((item) => !item.capability || can(actor, item.capability)),
    [actor]
  );

  const showAdmin = can(
    {
      role: actor.role,
      isSuperAdmin: session?.user?.isSuperAdmin ?? isSuperAdminEmail(session?.user?.email),
    },
    'admin.console'
  );

  const userName = session?.user?.name ?? 'Demo Owner';
  const userRole = session?.user?.role
    ? (ROLE_LABELS[session.user.role as keyof typeof ROLE_LABELS] ?? session.user.role)
    : 'Market Owner';

  return (
    <div
      id="mobileMenu"
      ref={panelRef}
      tabIndex={-1}
      className={cn(
        // Eleven nav items overflow a short viewport, and a fixed-position box
        // does not extend the document scroll region — so the last few links
        // were unreachable on an SE or in landscape.
        'mobile-menu fixed inset-0 z-50 glass lg:hidden overflow-y-auto overscroll-contain focus:outline-none'
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Mobile navigation"
    >
      <div className="p-6 bg-bg-secondary/95 backdrop-blur-glass min-h-full">
        <div className="flex items-center justify-between mb-8">
          <Logo />
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 transition-colors" aria-label="Close menu">
            <X className="w-6 h-6" />
          </button>
        </div>
        <nav className="space-y-2" aria-label="Main">
          {visibleNavigation.map((item) => {
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

        {/* Same footer as the desktop sidebar: Admin Console link, the
            Demo/Live workspace switcher, the signed-in user, and Sign out.
            This block is the whole reason phones/tablets could not switch
            workspaces or sign out — the sidebar is display:none below lg. */}
        <div className="mt-8 pt-6 border-t border-border-subtle space-y-3">
          {showAdmin && (
            <Link
              href="/admin"
              onClick={onClose}
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
      </div>
    </div>
  );
}
