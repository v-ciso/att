import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, compact = false): string {
  if (compact) {
    if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
    return `$${amount.toFixed(0)}`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num: number, compact = false): string {
  if (compact) {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toString();
  }
  return new Intl.NumberFormat('en-US').format(num);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
}

export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let lastRun = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastRun >= ms) {
      fn(...args);
      lastRun = now;
    }
  };
}

export const ROLE_HIERARCHY = ['INTERN', 'REP', 'LEAD', 'ASM', 'OWNER'] as const;
export type Role = typeof ROLE_HIERARCHY[number];

export function getRoleLevel(role: Role): number {
  return ROLE_HIERARCHY.indexOf(role);
}

export function canManage(managerRole: Role, targetRole: Role): boolean {
  return getRoleLevel(managerRole) > getRoleLevel(targetRole);
}

export const STORE_LABELS: Record<string, string> = {
  COSTCO: 'Costco',
  TARGET: 'Target',
  BJS: "BJ's",
  CUSTOM: 'Custom',
};

export const ROLE_LABELS: Record<Role, string> = {
  INTERN: 'Intern',
  REP: 'Sales Rep',
  LEAD: 'Team Lead',
  ASM: 'ASM / AD',
  OWNER: 'Market Owner',
};

export const ROLE_COLORS: Record<Role, string> = {
  INTERN: '#6B7280',
  REP: '#3B82F6',
  LEAD: '#A855F7',
  ASM: '#F59E0B',
  OWNER: '#10B981',
};

export const ATTENDANCE_LABELS: Record<string, string> = {
  PRESENT: 'Present',
  LATE: 'Late',
  ABSENT: 'Absent',
  EXCUSED: 'Excused',
  ROADTRIP: 'Roadtrip',
};

export const ATTENDANCE_COLORS: Record<string, string> = {
  PRESENT: '#10B981',
  LATE: '#F59E0B',
  ABSENT: '#EF4444',
  EXCUSED: '#6B7280',
  ROADTRIP: '#06B6D4',
};