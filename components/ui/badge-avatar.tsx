'use client';

import { forwardRef, HTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'blue' | 'purple' | 'cyan' | 'green' | 'yellow' | 'red' | 'gray';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', dot, children, ...props }, ref) => {
    const variants = {
      default: 'bg-white/10 text-text-secondary border border-white/10',
      success: 'bg-green-500/20 text-green-400 border border-green-500/20',
      warning: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/20',
      danger: 'bg-red-500/20 text-red-400 border border-red-500/20',
      info: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/20',
      blue: 'bg-blue-500/20 text-blue-400 border border-blue-500/20',
      purple: 'bg-purple-500/20 text-purple-400 border border-purple-500/20',
      cyan: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/20',
      green: 'bg-green-500/20 text-green-400 border border-green-500/20',
      yellow: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/20',
      red: 'bg-red-500/20 text-red-400 border border-red-500/20',
      gray: 'bg-gray-500/20 text-gray-400 border border-gray-500/20',
    };

    const sizes = {
      sm: 'px-2 py-0.5 text-[10px]',
      md: 'px-2.5 py-1 text-[11px]',
      lg: 'px-3 py-1 text-[12px]',
    };

    return (
      <span
        ref={ref}
        className={twMerge(clsx(
          'inline-flex items-center gap-1.5 rounded-full font-medium uppercase tracking-wider border',
          variants[variant],
          sizes[size],
          className
        ))}
        {...props}
      >
        {dot && <span className={`w-1.5 h-1.5 rounded-full ${variants[variant].split(' ')[0].replace('bg-', 'bg-')}`} />}
        {children}
      </span>
    );
  }
);
Badge.displayName = 'Badge';

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  status?: 'online' | 'offline' | 'busy' | 'away';
  shape?: 'circle' | 'square';
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, name, size = 'md', status, shape = 'circle', ...props }, ref) => {
    const sizes = {
      xs: 'w-6 h-6 text-[10px]',
      sm: 'w-8 h-8 text-[11px]',
      md: 'w-10 h-10 text-sm',
      lg: 'w-12 h-12 text-base',
      xl: 'w-16 h-16 text-lg',
      '2xl': 'w-24 h-24 text-xl',
    };

    const statusSizes = {
      xs: 'w-1.5 h-1.5',
      sm: 'w-2 h-2',
      md: 'w-2.5 h-2.5',
      lg: 'w-3 h-3',
      xl: 'w-4 h-4',
      '2xl': 'w-5 h-5',
    };

    const statusColors = {
      online: 'bg-green-400',
      offline: 'bg-gray-500',
      busy: 'bg-red-400',
      away: 'bg-yellow-400',
    };

    const getInitials = (name: string) => {
      return name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    };

    const bgColors = [
      'bg-blue-500', 'bg-purple-500', 'bg-cyan-500', 'bg-green-500',
      'bg-yellow-500', 'bg-orange-500', 'bg-red-500', 'bg-pink-500',
    ];

    const colorIndex = name ? name.charCodeAt(0) % bgColors.length : 0;

    return (
      <div
        ref={ref}
        className={twMerge(clsx(
          'relative inline-flex shrink-0 overflow-hidden',
          sizes[size],
          shape === 'circle' ? 'rounded-full' : 'rounded-xl',
          className
        ))}
        {...props}
      >
        {src ? (
          <img
            src={src}
            alt={alt || name || 'Avatar'}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={twMerge(clsx('w-full h-full flex items-center justify-center font-medium text-white', bgColors[colorIndex]))}>
            {name ? getInitials(name) : '?'}
          </div>
        )}
        {status && (
          <span
            className={twMerge(clsx(
              'absolute bottom-0 right-0 border-2 border-bg-primary rounded-full',
              statusColors[status],
              statusSizes[size]
            ))}
          />
        )}
      </div>
    );
  }
);
Avatar.displayName = 'Avatar';

export const AvatarGroup = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { max?: number }>(
  ({ className, max = 5, children, ...props }, ref) => {
    const kids = Array.isArray(children) ? children : [children];
    const visible = kids.slice(0, max);
    const remaining = kids.length - max;

    return (
      <div ref={ref} className={twMerge(clsx('flex -space-x-2', className))} {...props}>
        {visible.map((child, index) => (
          <div key={index} className="relative z-[calc(100-_index)]">
            {child}
          </div>
        ))}
        {remaining > 0 && (
          <div className={twMerge(clsx('flex items-center justify-center bg-white/5 border-2 border-bg-primary w-10 h-10 text-sm', 'rounded-full'))}>
            +{remaining}
          </div>
        )}
      </div>
    );
  }
);
AvatarGroup.displayName = 'AvatarGroup';