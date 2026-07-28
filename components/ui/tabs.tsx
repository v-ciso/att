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

    /**
     * Arrow-key navigation. An element with role="tablist" is REQUIRED to
     * support arrow keys — without it a keyboard user has to Tab through every
     * tab to reach the last one, and the roving-tabindex contract below breaks.
     * Implemented on the container so individual tabs stay dumb.
     */
    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
      if (!keys.includes(e.key)) return;

      const tabs = Array.from(
        e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])')
      );
      if (!tabs.length) return;

      const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
      let next = current;

      if (e.key === 'ArrowRight') next = current < 0 ? 0 : (current + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') next = current <= 0 ? tabs.length - 1 : current - 1;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = tabs.length - 1;

      e.preventDefault();
      // Focus + activate: this is an automatic-activation tablist, which matches
      // how the panels are already rendered (cheap, no async loading).
      tabs[next].focus();
      tabs[next].click();
    };

    return (
      <div
        ref={ref}
        role="tablist"
        onKeyDown={onKeyDown}
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

    // text-text-secondary instead of text-gray-400: gray-400 (#9ca3af) on the
    // translucent panel background lands under the 4.5:1 contrast floor, so
    // inactive tab labels were failing WCAG AA.
    const variants = {
      line: isActive
        ? 'bg-transparent text-white border-b-2 border-accent-blue'
        : 'text-text-secondary hover:text-white',
      // The active pill uses the themeable brand pair rather than a fixed blue.
      // bg-accent-blue was a hardcoded #3B82F6, so it both failed AA behind white
      // 14px text (3.68:1) and ignored the active theme — reading as a stray blue
      // chip in the gold preset. --brand/--brand-ink track the theme and every
      // preset clears AA (gold 10.68:1, emerald 7.45:1, default blue 5.17:1).
      pill: isActive
        ? 'bg-[var(--brand)] text-[var(--brand-ink)] shadow-sm'
        : 'text-text-secondary hover:text-white hover:bg-white/5',
      underline: isActive
        ? 'text-white border-b-2 border-accent-blue'
        : 'text-text-secondary hover:text-white',
    };

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isActive}
        aria-controls={`panel-${value}`}
        id={`tab-${value}`}
        // Roving tabindex: only the selected tab is a Tab stop. Arrow keys move
        // between tabs (handled by TabList), which is the expected pattern.
        tabIndex={isActive ? 0 : -1}
        className={twMerge(clsx(
          'tab-btn px-4 py-2 min-h-11 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]',
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

/**
 * TabBar — a CONTROLLED tablist for the many places that already keep their own
 * `activeTab` state and were rendering bare <button className="tab-btn"> tabs.
 *
 * Those hand-rolled tabs announced as plain buttons ("button" instead of
 * "tab, 1 of 3, selected"), had no arrow-key support and no panel association,
 * so screen-reader and keyboard users could not tell a tab strip from a row of
 * unrelated buttons. This gives them the correct semantics without forcing a
 * refactor onto the uncontrolled <Tabs> component.
 *
 * Pair each bar with `tabPanelProps(value, activeValue)` on the panel it shows.
 */
export interface TabBarItem {
  value: string;
  label: React.ReactNode;
  /** Announced instead of `label` when the visible label is an icon or terse. */
  ariaLabel?: string;
  disabled?: boolean;
}

export function TabBar({
  items,
  value,
  onChange,
  label,
  variant = 'pill',
  className,
  idPrefix,
}: {
  items: TabBarItem[];
  value: string;
  onChange: (value: string) => void;
  /** Accessible name for the tab strip, e.g. "Settings sections". */
  label: string;
  variant?: 'line' | 'pill' | 'underline';
  className?: string;
  /** Set when two tab strips on one page share tab values, to keep ids unique. */
  idPrefix?: string;
}) {
  const prefix = idPrefix ? `${idPrefix}-` : '';

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    const tabs = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])')
    );
    if (!tabs.length) return;
    const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
    let next = current;
    if (e.key === 'ArrowRight') next = current < 0 ? 0 : (current + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = current <= 0 ? tabs.length - 1 : current - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    e.preventDefault();
    tabs[next].focus();
    tabs[next].click();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={twMerge(clsx(
        'flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-hide',
        variant === 'pill' && 'bg-white/5 rounded-xl p-1',
        className
      ))}
    >
      {items.map(item => {
        const isActive = item.value === value;
        const styles = {
          line: isActive
            ? 'bg-transparent text-white border-b-2 border-accent-blue'
            : 'text-text-secondary hover:text-white',
          // Themeable brand pair — see the contrast note on Tab above.
          pill: isActive
            ? 'bg-[var(--brand)] text-[var(--brand-ink)] shadow-sm'
            : 'text-text-secondary hover:text-white hover:bg-white/5',
          underline: isActive
            ? 'text-white border-b-2 border-accent-blue'
            : 'text-text-secondary hover:text-white',
        }[variant];

        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={`${prefix}tab-${item.value}`}
            aria-selected={isActive}
            // Consumers that mount only the active panel (the dashboard does)
            // would otherwise leave every inactive tab pointing aria-controls at
            // an element that isn't in the DOM — a dangling reference screen
            // readers can't follow. Emit it only where the target really exists.
            aria-controls={isActive ? `${prefix}panel-${item.value}` : undefined}
            aria-label={item.ariaLabel}
            tabIndex={isActive ? 0 : -1}
            disabled={item.disabled}
            onClick={() => !item.disabled && onChange(item.value)}
            className={twMerge(clsx(
              'px-4 py-2 min-h-11 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]',
              styles,
              item.disabled && 'opacity-50 cursor-not-allowed'
            ))}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Spread onto the element a TabBar controls, so the panel is correctly
 * associated with its tab and hidden from assistive tech when inactive.
 */
export function tabPanelProps(value: string, activeValue: string, idPrefix?: string) {
  const prefix = idPrefix ? `${idPrefix}-` : '';
  return {
    role: 'tabpanel' as const,
    id: `${prefix}panel-${value}`,
    'aria-labelledby': `${prefix}tab-${value}`,
    tabIndex: 0,
    hidden: value !== activeValue,
  };
}

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
