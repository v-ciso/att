'use client';

import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';

interface LeaderboardRowProps {
  entry: {
    rank: number;
    name: string;
    store: string;
    lines: number;
    premium: number;
    fiber: number;
    commission: number;
    role: string;
  };
  index: number;
}

export function LeaderboardRow({ entry }: LeaderboardRowProps) {
  const rankColors = ['text-yellow-400', 'text-gray-400', 'text-orange-400', 'text-gray-500', 'text-gray-500'];

  return (
    <tr className="hover:bg-white/2 transition-colors">
      <td className="py-2">
        <span className={cn('font-bold', rankColors[entry.rank - 1] || 'text-gray-500')}>#{entry.rank}</span>
      </td>
      <td className="py-2 font-medium" contentEditable suppressContentEditableWarning>
        {entry.name}
      </td>
      <td className="py-2 text-text-secondary" contentEditable suppressContentEditableWarning>
        {entry.store}
      </td>
      <td className="py-2 font-semibold" contentEditable suppressContentEditableWarning>
        {entry.lines}
      </td>
      <td className="py-2 text-accent-purple" contentEditable suppressContentEditableWarning>
        {entry.premium}
      </td>
      <td className="py-2 text-accent-cyan" contentEditable suppressContentEditableWarning>
        {entry.fiber}
      </td>
      <td className="py-2 text-accent-green font-bold" contentEditable suppressContentEditableWarning>
        {formatCurrency(entry.commission)}
      </td>
    </tr>
  );
}

interface MeetingTrackerProps {
  label: string;
  value: string;
  color: string;
  size: string;
}

export function MeetingTracker({ label, value, color, size }: MeetingTrackerProps) {
  const colorClasses = {
    blue: 'text-accent-blue',
    purple: 'text-accent-purple',
    green: 'text-accent-green',
    yellow: 'text-accent-yellow',
  };

  const sizeClasses = {
    lg: 'text-lg',
    '2xl': 'text-2xl font-bold',
  };

  return (
    <div className="glass rounded-xl p-3 text-center">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className={cn('font-bold', colorClasses[color as keyof typeof colorClasses], sizeClasses[size as keyof typeof sizeClasses])} contentEditable suppressContentEditableWarning>
        {value}
      </p>
    </div>
  );
}

interface MeetingTeamProps {
  name: string;
  change: string;
  lines: number;
  premium: number;
  fiber: number;
  progress: number;
  color: string;
}

export function MeetingTeam({ name, change, lines, premium, fiber, progress, color }: MeetingTeamProps) {
  const borderColors = {
    blue: 'border-accent-blue/10',
    purple: 'border-accent-purple/10',
    cyan: 'border-accent-cyan/10',
    yellow: 'border-accent-yellow/10',
  };

  const progressColors = {
    blue: 'bg-accent-blue',
    purple: 'bg-accent-purple',
    cyan: 'bg-accent-cyan',
    yellow: 'bg-accent-yellow',
  };

  return (
    <div className={cn('glass rounded-xl p-4 border', borderColors[color as keyof typeof borderColors])}>
      <div className="flex justify-between items-center mb-2">
        <span className="font-medium" contentEditable suppressContentEditableWarning>{name}</span>
        <span className="text-xs text-accent-green" contentEditable suppressContentEditableWarning>{change}</span>
      </div>
      <div className="flex justify-between text-xs text-text-secondary">
        <span contentEditable suppressContentEditableWarning>Lines: {lines}</span>
        <span contentEditable suppressContentEditableWarning>Premium: {premium}</span>
        <span contentEditable suppressContentEditableWarning>Fiber: {fiber}</span>
      </div>
      <div className="w-full h-1 mt-2 rounded-full bg-gray-700">
        <div
          className={cn('h-full rounded-full', progressColors[color as keyof typeof progressColors])}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

interface PNLCardProps {
  title: string;
  items: { category: string; amount: number }[];
  total: number;
  color: string;
  icon: React.ComponentType<any>;
}

export function PNLCard({ title, items, total, color, icon: Icon }: PNLCardProps) {
  const colorClasses = {
    green: 'text-accent-green',
    red: 'text-accent-red',
  };

  return (
    <div>
      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
        <Icon className="w-4 h-4" />
        <span className={cn(colorClasses[color as keyof typeof colorClasses])}>{title}</span>
      </h3>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.category} className="flex justify-between p-2 rounded-lg glass text-sm">
            <span>{item.category}</span>
            <span className={cn(colorClasses[color as keyof typeof colorClasses])}>
              {formatCurrency(item.amount)}
            </span>
          </div>
        ))}
        <div className="flex justify-between p-2 rounded-lg glass border-t border-border-subtle pt-2 text-sm">
          <span className="font-bold">Total</span>
          <span className={cn('font-bold', colorClasses[color as keyof typeof colorClasses])}>
            {formatCurrency(total)}
          </span>
        </div>
      </div>
    </div>
  );
}

interface CommissionCategoryProps {
  title: string;
  plans: Array<{ name: string; payout?: number; override?: string; role?: string }>;
  icon: React.ComponentType<any>;
  color: string;
}

export function CommissionCategory({ title, plans, icon: Icon, color }: CommissionCategoryProps) {
  const borderColors = {
    blue: 'border-accent-blue/20',
    purple: 'border-accent-purple/20',
    yellow: 'border-accent-yellow/20',
  };

  const iconColors = {
    blue: 'text-accent-blue',
    purple: 'text-accent-purple',
    yellow: 'text-accent-yellow',
  };

  return (
    <div className={cn('p-3 rounded-xl glass border', borderColors[color as keyof typeof borderColors])}>
      <h4 className={cn('font-semibold text-sm mb-2 flex items-center gap-2', iconColors[color as keyof typeof iconColors])}>
        <Icon className="w-4 h-4" /> {title}
      </h4>
      <div className="space-y-1 text-xs">
        {plans.map((plan) => (
          <div key={plan.name} className="flex justify-between">
            <span>{plan.name}</span>
            <span className="text-accent-green">
              {plan.payout !== undefined ? formatCurrency(plan.payout) : plan.override}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const overrides = [
  { name: 'Leader', payout: 5, unit: '/line' },
  { name: 'Asst. Mgr', payout: 3, unit: '/line' },
  { name: 'Tier (100+)', payout: 2, unit: '/line' },
  { name: 'Owner', payout: 15, unit: '%' },
];