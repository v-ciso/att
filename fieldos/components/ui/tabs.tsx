'use client';

import { forwardRef, HTMLAttributes, createContext, useContext, useState } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface TabsProps {
  defaultValue: string;
  onChange?: (value: string) => void;
  children: React.ReactNode;
  variant?: 'line' | 'pill' | 'underline';
  className?: string;
}

interface TabListProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

interface TabProps extends HTMLAttributes<HTMLButtonElement> {
  value: string;
  disabled?: boolean;
}

interface TabPanelProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
}

const TabsContext = createContext<{ value: string; onChange: (value: string) => void; variant: string } | null>(null);

function useTabs() {
  const context = useContext(TabsContext);
  if (!context) throw new Error('Tabs components must be used within Tabs');
  return context;
}

export const Tabs = forwardRef<HTMLDivElement, TabsProps>(
  ({ className, defaultValue, onChange, children, variant = 'pill', ...props }, ref) => {
    const [value, setValue] = useState(defaultValue);

    const handleChange = (newValue: string) => {
      setValue(newValue);
      onChange?.(newValue);
    };

    return (
      <TabsContext.Provider value={{ value, onChange: handleChange, variant }}>
        <div ref={ref} className={twMerge(clsx('space-y-4', className))} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    );
  }
);
Tabs.displayName = 'Tabs';

export const TabList = forwardRef<HTMLDivElement, TabListProps>(
  ({ className, children, ...props }, ref) => {
    const { variant } = useTabs();
    return (
      <div
        ref={ref}
        role="tablist"
        className={twMerge(clsx(
          'flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-hide',
          variant === 'pill' && 'bg-white/5 rounded-xl p-1',
          className
        ))}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TabList.displayName = 'TabList';

export const Tab = forwardRef<HTMLButtonElement, TabProps>(
  ({ className, value, disabled, children, ...props }, ref) => {
    const { value: currentValue, onChange, variant } = useTabs();
    const isActive = currentValue === value;

    const variants = {
      line: isActive
        ? 'bg-transparent text-white border-b-2 border-accent-blue'
        : 'text-gray-400 hover:text-white',
      pill: isActive
        ? 'bg-accent-blue text-white shadow-sm'
        : 'text-gray-400 hover:text-white hover:bg-white/5',
      underline: isActive
        ? 'text-white border-b-2 border-accent-blue'
        : 'text-gray-400 hover:text-white',
    };

    return (
      <button
        ref={ref}
        role="tab"
        aria-selected={isActive}
        aria-controls={`panel-${value}`}
        id={`tab-${value}`}
        className={twMerge(clsx(
          'tab-btn px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap',
          variants[variant as keyof typeof variants],
          disabled && 'opacity-50 cursor-not-allowed',
          className
        ))}
        onClick={() => !disabled && onChange(value)}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Tab.displayName = 'Tab';

export const TabPanel = forwardRef<HTMLDivElement, TabPanelProps>(
  ({ className, value, children, ...props }, ref) => {
    const { value: currentValue } = useTabs();
    const isActive = currentValue === value;

    return (
      <div
        ref={ref}
        role="tabpanel"
        id={`panel-${value}`}
        aria-labelledby={`tab-${value}`}
        hidden={!isActive}
        className={twMerge(clsx(
          'animate-fade-in',
          className
        ))}
        {...props}
      >
        {isActive && children}
      </div>
    );
  }
);
TabPanel.displayName = 'TabPanel';