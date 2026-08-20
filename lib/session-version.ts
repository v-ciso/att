/**
 * Session version stamp — shared by lib/auth.ts (stamps it into every new JWT)
 * and proxy.ts (rejects tokens that don't carry the current value).
 *
 * Why this exists: NextAuth JWTs carry their own `exp` computed from `maxAge`
 * AT MINT TIME. Sessions issued before the 2-hour ceiling was introduced were
 * minted with the 30-day default, so a phone that signed in months ago was
 * still walking straight into the dashboard — with a stale UI to match, since
 * it never re-fetched a fresh page through the login flow.
 *
 * Bump this number whenever every existing session must be forced through
 * /login again (auth-shape changes, permission-matrix migrations, or a stale
 * fleet like the one above). Old tokens fail the proxy check and get a clean
 * redirect — no error, just a fresh sign-in.
 *
 * Edge-safe: a bare constant with zero imports, usable from middleware.
 */
export const SESSION_VERSION = 2;
