'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Menu,
  X,
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

export function MobileHeader({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 glass border-b border-border-subtle px-4 py-3 flex items-center justify-between lg:hidden">
      <div className="logo-placeholder">
        <img
          src="https://placehold.co/120x40/1a1a2e/ffffff?text=FIELDOS"
          alt="FieldOS Logo"
          className="logo-img h-8 w-auto"
        />
      </div>
      <button onClick={onMenuClick} className="p-2 rounded-lg hover:bg-white/5 transition-colors" aria-label="Open menu">
        <Menu className="w-6 h-6" />
      </button>
    </header>
  );
}

export function MobileMenu({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();

  return (
    <div
      id="mobileMenu"
      className={cn(
        'mobile-menu fixed inset-0 z-50 glass lg:hidden',
        isOpen && 'open'
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Mobile navigation"
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-8">
          <div className="logo-placeholder">
            <img
              src="https://placehold.co/120x40/1a1a2e/ffffff?text=FIELDOS"
              alt="FieldOS Logo"
              className="logo-img h-8 w-auto"
            />
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 transition-colors" aria-label="Close menu">
            <X className="w-6 h-6" />
          </button>
        </div>
        <nav className="space-y-2" role="navigation" aria-label="Mobile navigation">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200',
                  isActive
                    ? 'bg-accent-blue/10 text-white nav-active'
                    : 'text-text-secondary hover:text-white hover:bg-white/5'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <item.icon className={cn('w-5 h-5', isActive && 'text-accent-blue')} aria-hidden="true" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}