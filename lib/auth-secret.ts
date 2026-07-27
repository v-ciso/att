// The single source of truth for the session-signing secret.
//
// This lives apart from lib/auth.ts on purpose: middleware runs on the edge and
// cannot import lib/auth.ts (which pulls in Prisma). Before this split, the
// middleware fell back to reading process.env.NEXTAUTH_SECRET on its own, so
// with the var unset it threw a Configuration error and bounced every request
// for /dashboard, /settings, and /admin to /api/auth/error — the whole app was
// unreachable, while lib/auth.ts happily used its dev fallback. Both sides now
// resolve the secret identically, so a token signed by one always verifies in
// the other.

/** Same fallback on both sides, so signing and verification cannot diverge. */
const DEV_FALLBACK_SECRET = 'dev-only-secret-not-used-in-production-builds';

/**
 * Resolve the secret that signs and verifies session JWTs.
 *
 * A known or shared value means anyone can mint an OWNER session, so production
 * refuses to boot without a real one rather than falling back to something
 * guessable. Development and preview get a deterministic fallback so the app is
 * usable without any setup.
 */
export function authSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (secret && secret.length >= 32 && !secret.startsWith('demo-')) return secret;

  // Only a real request may fail. `next build` imports route modules to collect
  // page data, and runtime secrets are not present in that phase — throwing
  // there failed the build itself rather than the request, which would block
  // deploys even when the secret is configured correctly on the server.
  const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';

  if (process.env.NODE_ENV === 'production' && !isBuildPhase) {
    throw new Error(
      'NEXTAUTH_SECRET is missing or insecure. Generate one with: openssl rand -base64 32'
    );
  }

  return DEV_FALLBACK_SECRET;
}
