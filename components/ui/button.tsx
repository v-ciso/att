'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'accent-blue' | 'accent-purple' | 'accent-cyan' | 'accent-green';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, fullWidth, disabled, children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-primary disabled:opacity-50 disabled:cursor-not-allowed';
    
    const variants = {
      primary: 'btn-primary-brand focus:ring-white/20',
      secondary: 'bg-white/5 hover:bg-white/10 text-white border border-border-subtle focus:ring-white/20',
      ghost: 'hover:bg-white/5 text-text-secondary focus:ring-white/10',
      // Solid accents are one to two steps darker than the raw accent-* tokens.
      // Measured against white text, the originals all failed WCAG AA for normal
      // text: blue 3.68:1, purple 3.96:1, red 3.76:1, cyan 2.43:1, green 2.54:1.
      // These shades keep the same hue while clearing 4.5:1 (red 4.83, blue 5.17,
      // cyan 5.36, purple 5.38, emerald 5.48).
      danger: 'bg-red-600 hover:bg-red-700 text-white shadow-glow-red focus:ring-red-500',
      outline: 'border-2 border-accent-blue text-accent-blue hover:bg-blue-500/10 focus:ring-blue-500',
      'accent-blue': 'bg-blue-600 hover:bg-blue-700 text-white shadow-glow-blue focus:ring-blue-500',
      'accent-purple': 'bg-purple-600 hover:bg-purple-700 text-white shadow-glow-purple focus:ring-purple-500',
      'accent-cyan': 'bg-cyan-700 hover:bg-cyan-800 text-white shadow-glow-cyan focus:ring-cyan-500',
      'accent-green': 'bg-emerald-700 hover:bg-emerald-800 text-white focus:ring-green-500',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-fluid-sm gap-1.5',
      md: 'px-4 py-2 text-fluid-base gap-2',
      lg: 'px-6 py-3 text-fluid-lg gap-2',
      xl: 'px-8 py-4 text-fluid-xl gap-2.5',
    };

    return (
      <button
        ref={ref}
        className={twMerge(clsx(baseStyles, variants[variant], sizes[size], fullWidth && 'w-full', className))}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
