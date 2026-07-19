'use client';

import { forwardRef, HTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'blue' | 'purple' | 'cyan' | 'green' | 'yellow' | 'orange' | 'red' | 'gray';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', dot, children, ...props }, ref) => {
    const variants = {
      default: 'bg-white/10 text-text-secondary border border-border-subtle',
      blue: 'bg-blue-500/20 text-blue-400 border border-blue-500/20',
      purple: 'bg-purple-500/20 text-purple-400 border border-purple-500/20',
      cyan: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/20',
      green: 'bg-green-500/20 text-green-400 border border-green-500/20',
      yellow: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/20',
      orange: 'bg-orange-500/20 text-orange-400 border border-orange-500/20',
      red: 'bg-red-500/20 text-red-400 border border-red-500/20',
      gray: 'bg-gray-500/20 text-gray-400 border border-gray-500/20',
    };

    const sizes = {
      sm: 'px-2 py-0.5 text-[9px]',
      md: 'px-2.5 py-1 text-[10px]',
      lg: 'px-3 py-1.5 text-[11px]',
    };

    const dotColors = {
      default: 'bg-white/30',
      blue: 'bg-blue-400',
      purple: 'bg-purple-400',
      cyan: 'bg-cyan-400',
      green: 'bg-green-400',
      yellow: 'bg-yellow-400',
      orange: 'bg-orange-400',
      red: 'bg-red-400',
      gray: 'bg-gray-400',
    };

    return (
      <span
        ref={ref}
        className={twMerge(clsx(
          'inline-flex items-center font-medium uppercase tracking-wider rounded-full',
          variants[variant],
          sizes[size],
          className
        ))}
        {...props}
      >
        {dot && <span className={twMerge(clsx('w-1.5 h-1.5 rounded-full mr-1.5', dotColors[variant]))} />}
        {children}
      </span>
    );
  }
);
Badge.displayName = 'Badge';