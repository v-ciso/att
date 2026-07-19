'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Store,
  DollarSign,
  CalendarCheck,
  Receipt,
  Trophy,
  Presentation,
  Target,
  TrendingUp,
  Building2,
  MapPin,
  Trophy as TrophyIcon,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Employees', href: '/dashboard/employees', icon: Users },
  { name: 'Stores', href: '/dashboard/stores', icon: Store },
  { name: 'Sales Entry', href: '/dashboard/sales', icon: DollarSign },
  { name: 'Attendance', href: '/dashboard/attendance', icon: CalendarCheck },
  { name: 'Expenses', href: '/dashboard/expenses', icon: Receipt },
  { name: 'Leaderboard', href: '/dashboard/leaderboard', icon: Trophy },
  { name: 'Meeting Mode', href: '/dashboard/meeting', icon: Presentation },
  { name: 'Goals', href: '/dashboard/goals', icon: Target },
  { name: 'Forecasts', href: '/dashboard/forecasts', icon: TrendingUp },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 glass border-r border-border-subtle p-6 hidden lg:flex flex-col z-30">
      <div className="logo-placeholder mb-8">
        <img
          src="https://placehold.co/140x50/1a1a2e/ffffff?text=FIELDOS"
          alt="Company Logo"
          className="logo-img h-10 w-auto"
        />
        <span className="text-xs text-gray-500 ml-1">v2.0</span>
      </div>
      <nav className="flex-1 space-y-1" role="navigation" aria-label="Main navigation">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
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
            A
          </div>
          <div>
            <p className="text-sm font-medium">Alex Thompson</p>
            <p className="text-xs text-text-muted">Market Owner</p>
          </div>
        </div>
      </div>
    </aside>
  );
}