'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, ReactNode } from 'react';

type Announce = (message: string, priority?: 'polite' | 'assertive') => void;

const AnnouncerContext = createContext<Announce>(() => {});

/**
 * Screen-reader announcements for actions that only change the page visually.
 *
 * Adding a sale, removing a rep, or importing a report all mutate a table in
 * place. A sighted user sees the row appear or vanish; a screen-reader user gets
 * nothing, because focus never moves and no text near the cursor changes.
 *
 * Both regions are mounted permanently and start empty. A live region has to
 * already exist in the accessibility tree before its text changes — inserting a
 * populated region and its message in the same commit is not reliably announced,
 * which is the most common way this pattern silently fails.
 */
export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [polite, setPolite] = useState('');
  const [assertive, setAssertive] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const announce = useCallback<Announce>((message, priority = 'polite') => {
    const set = priority === 'assertive' ? setAssertive : setPolite;
    // Clearing first guarantees a text change even when the same message is sent
    // twice in a row (e.g. removing two rows), which would otherwise be silent.
    set('');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => set(message), 60);
  }, []);

  return (
    <AnnouncerContext.Provider value={announce}>
      {children}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {polite}
      </div>
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {assertive}
      </div>
    </AnnouncerContext.Provider>
  );
}

/** Returns a stable `announce(message, priority?)` for live-region updates. */
export function useAnnounce(): Announce {
  return useContext(AnnouncerContext);
}

/** Convenience helper so callers can build counts without repeating the ternary. */
export function useAnnouncers() {
  const announce = useAnnounce();
  return useMemo(
    () => ({
      announce,
      announceCount: (count: number, singular: string, verb: string) =>
        announce(`${count} ${count === 1 ? singular : `${singular}s`} ${verb}`),
    }),
    [announce]
  );
}
