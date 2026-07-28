import {
  LayoutDashboard,
  ClipboardCheck,
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
  Trash2,
} from 'lucide-react';

import type { Capability } from '@/lib/permissions';

export interface NavItem {
  name: string;
  href: string;
  tab?: string;
  icon: React.ComponentType<{ className?: string }>;
  /**
   * Capability required to see this entry. Declared here rather than derived
   * from `tab` because Settings is a standalone page with no tab value, and
   * giving it one would break isNavItemActive's `pathname === '/dashboard'`
   * check. Entries without a capability are visible to every signed-in seat.
   */
  capability?: Capability;
}

// All feature areas live as tabs inside /dashboard; Settings is its own page.
export const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', tab: 'dashboard', icon: LayoutDashboard },
  { name: 'Daily Tracker', href: '/dashboard?tab=tracker', tab: 'tracker', icon: ClipboardList },
  { name: 'Roster', href: '/dashboard?tab=roster', tab: 'roster', icon: Users },
  { name: 'Leaderboard', href: '/dashboard?tab=leaderboard', tab: 'leaderboard', icon: Trophy },
  { name: 'Meeting Mode', href: '/dashboard?tab=meeting', tab: 'meeting', icon: Presentation },
  { name: 'Schedule', href: '/dashboard?tab=schedule', tab: 'schedule', icon: CalendarCheck },
  { name: 'Attendance', href: '/dashboard?tab=attendance', tab: 'attendance', icon: ClipboardCheck },
  { name: 'Competition', href: '/dashboard?tab=competition', tab: 'competition', icon: Award },
  { name: 'P&L', href: '/dashboard?tab=pnl', tab: 'pnl', icon: Receipt, capability: 'pnl.view' },
  { name: 'Commission', href: '/dashboard?tab=commission', tab: 'commission', icon: DollarSign, capability: 'commission.view' },
  { name: 'Import Report', href: '/dashboard?tab=import', tab: 'import', icon: FileSpreadsheet, capability: 'import.use' },
  { name: 'Recycle Bin', href: '/dashboard?tab=recycle', tab: 'recycle', icon: Trash2, capability: 'company.recycleBin' },
  { name: 'Settings', href: '/settings', icon: Settings, capability: 'settings.view' },
];

export function isNavItemActive(item: NavItem, pathname: string, currentTab: string | null): boolean {
  if (!item.tab) return pathname === item.href || pathname.startsWith(item.href + '/');
  if (pathname !== '/dashboard') return false;
  return (currentTab ?? 'dashboard') === item.tab;
}
