'use client';

import { forwardRef, HTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  fallback?: string;
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, size = 'md', fallback, ...props }, ref) => {
    const sizes = {
      xs: 'w-6 h-6 text-[10px]',
      sm: 'w-8 h-8 text-[11px]',
      md: 'w-10 h-10 text-[12px]',
      lg: 'w-12 h-12 text-[14px]',
      xl: 'w-16 h-16 text-[18px]',
      '2xl': 'w-20 h-20 text-[22px]',
    };

    return (
      <div
        ref={ref}
        className={twMerge(clsx('relative inline-flex shrink-0 overflow-hidden rounded-full bg-white/10', sizes[size], className))}
        {...props}
      >
        {src ? (
          <img
            src={src}
            alt={alt || 'Avatar'}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-500 font-bold text-white select-none">
            {fallback || '?'}
          </div>
        )}
      </div>
    );
  }
);
Avatar.displayName = 'Avatar';

export const AvatarGroup = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { max?: number }>(
  ({ className, max = 5, children, ...props }, ref) => {
    const childrenArray = Array.isArray(children) ? children : [children];
    const visible = childrenArray.slice(0, max);
    const remaining = childrenArray.length - max;

    return (
      <div ref={ref} className={twMerge(clsx('flex -space-x-2', className))} {...props}>
        {visible.map((child, index) => (
          <div key={index} className="relative z-[auto]">
            {child}
          </div>
        ))}
        {remaining > 0 && (
          <div className={twMerge(clsx('relative z-0 flex items-center justify-center bg-white/5 border-2 border-bg-primary rounded-full'))}>
            <span className="text-[10px] font-medium text-text-secondary">+{remaining}</span>
          </div>
        )}
      </div>
    );
  }
);
AvatarGroup.displayName = 'AvatarGroup';