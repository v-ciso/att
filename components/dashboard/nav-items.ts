import {
  LayoutDashboard,
  Trophy,
  Presentation,
  Receipt,
  DollarSign,
  Settings,
  Users,
  ClipboardList,
  Award,
  CalendarCheck,
  FileSpreadsheet,
} from 'lucide-react';

export interface NavItem {
  name: string;
  href: string;
  tab?: string;
  icon: React.ComponentType<{ className?: string }>;
}

// All feature areas live as tabs inside /dashboard; Settings is its own page.
export const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', tab: 'dashboard', icon: LayoutDashboard },
  { name: 'Daily Tracker', href: '/dashboard?tab=tracker', tab: 'tracker', icon: ClipboardList },
  { name: 'Roster', href: '/dashboard?tab=roster', tab: 'roster', icon: Users },
  { name: 'Leaderboard', href: '/dashboard?tab=leaderboard', tab: 'leaderboard', icon: Trophy },
  { name: 'Meeting Mode', href: '/dashboard?tab=meeting', tab: 'meeting', icon: Presentation },
  { name: 'Schedule', href: '/dashboard?tab=schedule', tab: 'schedule', icon: CalendarCheck },
  { name: 'Competition', href: '/dashboard?tab=competition', tab: 'competition', icon: Award },
  { name: 'P&L', href: '/dashboard?tab=pnl', tab: 'pnl', icon: Receipt },
  { name: 'Commission', href: '/dashboard?tab=commission', tab: 'commission', icon: DollarSign },
  { name: 'Import Report', href: '/dashboard?tab=import', tab: 'import', icon: FileSpreadsheet },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function isNavItemActive(item: NavItem, pathname: string, currentTab: string | null): boolean {
  if (!item.tab) return pathname === item.href || pathname.startsWith(item.href + '/');
  if (pathname !== '/dashboard') return false;
  return (currentTab ?? 'dashboard') === item.tab;
}
