'use client';

import { forwardRef, HTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { X } from 'lucide-react';

interface ModalProps extends HTMLAttributes<HTMLDivElement> {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  children: React.ReactNode;
}

export const Modal = forwardRef<HTMLDivElement, ModalProps>(
  ({ className, isOpen, onClose, title, description, size = 'md', children, ...props }, ref) => {
    if (!isOpen) return null;

    const sizes = {
      sm: 'max-w-md',
      md: 'max-w-lg',
      lg: 'max-w-2xl',
      xl: 'max-w-4xl',
      full: 'max-w-[90vw]',
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby={title ? 'modal-title' : undefined} aria-describedby={description ? 'modal-description' : undefined}>
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          ref={ref}
          className={twMerge(clsx(
            'relative w-full glass rounded-2xl shadow-2xl animate-scale-in',
            sizes[size],
            className
          ))}
          {...props}
        >
          {(title || description) && (
            <div className="flex items-start justify-between p-5 border-b border-border-subtle">
              <div>
                {title && (
                  <h2 id="modal-title" className="text-lg font-semibold text-white">
                    {title}
                  </h2>
                )}
                {description && (
                  <p id="modal-description" className="mt-1 text-sm text-gray-400">
                    {description}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
          <div className="p-5">{children}</div>
        </div>
      </div>
    );
  }
);
Modal.displayName = 'Modal';

interface DrawerProps extends Omit<ModalProps, 'size'> {
  side?: 'left' | 'right';
}

export const Drawer = forwardRef<HTMLDivElement, DrawerProps>(
  ({ className, isOpen, onClose, title, description, side = 'right', children, ...props }, ref) => {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-labelledby={title ? 'drawer-title' : undefined} aria-describedby={description ? 'drawer-description' : undefined}>
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          ref={ref}
          className={twMerge(clsx(
            'relative glass flex flex-col h-full w-full max-w-xl shadow-2xl animate-slide-in',
            side === 'right' ? 'ml-auto rounded-l-2xl' : 'mr-auto rounded-r-2xl',
            className
          ))}
          {...props}
        >
          {(title || description) && (
            <div className="flex items-start justify-between p-5 border-b border-border-subtle flex-shrink-0">
              <div>
                {title && (
                  <h2 id="drawer-title" className="text-lg font-semibold text-white">
                    {title}
                  </h2>
                )}
                {description && (
                  <p id="drawer-description" className="mt-1 text-sm text-gray-400">
                    {description}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-5">{children}</div>
        </div>
      </div>
    );
  }
);
Drawer.displayName = 'Drawer';