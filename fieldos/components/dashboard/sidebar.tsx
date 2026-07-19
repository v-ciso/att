'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { cn, getInitials, ROLE_LABELS } from '@/lib/utils';
import { useTheme } from '@/components/white-label/theme-provider';
import { navigation, isNavItemActive } from './nav-items';

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab');
  const { data: session } = useSession();
  const { theme } = useTheme();

  const userName = session?.user?.name ?? 'Guest';
  const userRole = session?.user?.role
    ? (ROLE_LABELS[session.user.role as keyof typeof ROLE_LABELS] ?? session.user.role)
    : '';

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 glass border-r border-border-subtle p-6 hidden lg:flex flex-col z-30">
      <div className="mb-8 flex items-center gap-2">
        {theme.logoUrl ? (
          <img src={theme.logoUrl} alt={`${theme.companyName} logo`} className="h-10 w-auto" />
        ) : (
          <span className="text-xl font-bold neon-text-blue">{theme.companyName}</span>
        )}
        <span className="text-xs text-gray-500">v2.0</span>
      </div>
      <nav className="flex-1 space-y-1" role="navigation" aria-label="Main navigation">
        {navigation.map((item) => {
          const isActive = isNavItemActive(item, pathname, currentTab);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
                isActive
                  ? 'bg-accent-blue/10 text-white nav-active'
                  : 'text-text-secondary hover:text-white hover:bg-white/5'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <item.icon className={cn('w-5 h-5 flex-shrink-0', isActive && 'text-accent-blue')} aria-hidden="true" />
              <span className="text-sm">{item.name}</span>
            </Link>
          );
        })}
      </nav>
      <div className="pt-4 border-t border-border-subtle">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center text-sm font-bold">
            {getInitials(userName)}
          </div>
          <div>
            <p className="text-sm font-medium">{userName}</p>
            <p className="text-xs text-text-muted">{userRole}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
