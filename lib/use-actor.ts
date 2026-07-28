'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import type { Actor, Role } from '@/lib/permissions';

/**
 * The unauthenticated fallback. Kept deliberately permissive because the server
 * re-checks every capability anyway — this only decides which chrome is drawn.
 */
const FALLBACK_ACTOR: Actor = { role: 'OWNER' as Role, isSuperAdmin: false };

/**
 * Resolves the current seat into an `Actor`, hydration-safe.
 *
 * Why the `mounted` gate exists: on the server `useSession()` has no session, so
 * permission-driven chrome (the tab strip, the sidebar links) renders with
 * FALLBACK_ACTOR. But SessionProvider can hand the browser a cached session
 * *synchronously*, so the very first client render already knew the real role and
 * drew fewer tabs than the server had — React then reported
 * "Expected server HTML to contain a matching <div>" and threw away the
 * mismatched subtree. Deferring the real actor by one commit makes the first
 * client render byte-identical to the server's, then swaps in the true
 * permissions immediately after mount.
 *
 * Both the tab strip and the sidebar consume this, so they cannot disagree about
 * what a seat may see.
 */
export function useActor(): Actor {
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return useMemo(() => {
    if (!mounted || !session?.user) return FALLBACK_ACTOR;
    return {
      role: session.user.role as Role | undefined,
      isSuperAdmin: session.user.isSuperAdmin,
    };
  }, [mounted, session?.user]);
}
