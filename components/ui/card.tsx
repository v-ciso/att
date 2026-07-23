'use client';

import { forwardRef, HTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'glass' | 'elevated' | 'bordered' | 'neon-blue' | 'neon-purple' | 'neon-cyan';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'glass', padding = 'md', hover = false, children, ...props }, ref) => {
    const variants = {
      // The `.glass` class expands to exactly these utilities AND picks up the
      // per-preset border tint in globals.css. Inlining the utilities meant
      // every Card kept a neutral white edge while its .glass children went
      // gold — the mismatch you see inside Meeting Mode.
      glass: 'glass',
      elevated: 'bg-bg-tertiary shadow-glass border border-border-subtle',
      bordered: 'bg-bg-secondary border border-border-strong',
      'neon-blue': 'bg-bg-card backdrop-blur-glass border border-blue-500/30 shadow-neon-blue',
      'neon-purple': 'bg-bg-card backdrop-blur-glass border border-purple-500/30 shadow-neon-purple',
      'neon-cyan': 'bg-bg-card backdrop-blur-glass border border-cyan-500/30 shadow-neon-cyan',
    };

    const paddings = {
      none: '',
      sm: 'p-3',
      md: 'p-5',
      lg: 'p-6',
    };

    return (
      <div
        ref={ref}
        className={twMerge(clsx(
          'rounded-2xl transition-all duration-300',
          variants[variant],
          paddings[padding],
          hover && 'hover:border-border-strong hover:shadow-glass',
          className
        ))}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = 'Card';

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={twMerge(clsx('mb-4', className))} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={twMerge(clsx('text-fluid-lg font-semibold text-text-primary', className))} {...props} />
  )
);
CardTitle.displayName = 'CardTitle';

export const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={twMerge(clsx('text-fluid-sm text-text-secondary mt-1', className))} {...props} />
  )
);
CardDescription.displayName = 'CardDescription';

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={twMerge(clsx('', className))} {...props} />
  )
);
CardContent.displayName = 'CardContent';

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={twMerge(clsx('mt-4 pt-4 border-t border-border-subtle flex items-center gap-2', className))} {...props} />
  )
);
CardFooter.displayName = 'CardFooter';