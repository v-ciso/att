import { withAuth } from 'next-auth/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { authSecret } from '@/lib/auth-secret';
import { canWrite, can, type Role } from '@/lib/permissions';
import { SESSION_VERSION } from '@/lib/session-version';

// Auth gate for pages AND the data API.
//
// Pages redirect to /login when signed out. API routes must NOT — redirecting
// a fetch() hands the caller the HTML login page with a 200, which client code
// will happily try to parse as JSON. They get a 401 instead.
//
// Write access is decided by lib/permissions.ts, not by a Set inlined here. This
// file used to hardcode ['OWNER','MANAGER'] while the sidebar showed every link
// to every role, so the edge and the UI disagreed by construction. VIEWER is
// read-only by contract and is blocked on every mutating call: hiding buttons is
// a hint, not a permission, and a read-only seat that can still POST is not
// read-only.
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const PRIVATE_NO_STORE = 'no-store, private';

function apiResponse(body: object, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': PRIVATE_NO_STORE },
  });
}

/**
 * Authenticated writes are same-origin only. Browsers attach Origin to fetches
 * and form submissions; comparing it with the proxy-aware host blocks another
 * site from using a signed-in employee's cookies to mutate company data.
 */
function hasTrustedOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const expectedHost = forwardedHost || req.headers.get('host');
  try {
    return !!expectedHost && new URL(origin).host === expectedHost;
  } catch {
    return false;
  }
}

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const { pathname } = req.nextUrl;
    const isApi = pathname.startsWith('/api/');

    // Shape the token into the actor the matrix expects. isSuperAdmin is stamped
    // into the JWT at sign-in (lib/auth.ts), so the edge can read it without a
    // database round-trip.
    const actor = {
      role: token?.role as Role | undefined,
      isSuperAdmin: token?.isSuperAdmin as boolean | undefined,
    };

    if (isApi && !token) {
      return apiResponse({ error: 'Not signed in' }, 401);
    }

    // Retire pre-versioning sessions. Old JWTs were minted with a 30-day exp,
    // so a phone signed in months ago still sailed through — with a stale UI
    // to match. Pages get the redirect from `authorized` below; API calls from
    // such a session get an explicit 401 here instead of an HTML login page.
    if (isApi && token && token.sv !== SESSION_VERSION) {
      return apiResponse({ error: 'Session expired — please sign in again.' }, 401);
    }

    // Was `role !== 'OWNER'`, which locked super-admins out of Settings even
    // though they own the platform. `can()` grants them the capability.
    if (pathname.startsWith('/settings') && !can(actor, 'settings.view')) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    if (pathname.startsWith('/admin') && !can(actor, 'admin.console')) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    if (isApi && MUTATING.has(req.method)) {
      if (!hasTrustedOrigin(req)) {
        return apiResponse({ error: 'Cross-origin write refused.' }, 403);
      }
      if (!canWrite(actor)) {
        return apiResponse({ error: 'Your account has read-only access.' }, 403);
      }
    }

    const response = NextResponse.next();
    if (isApi) response.headers.set('Cache-Control', PRIVATE_NO_STORE);
    return response;
  },
  {
    pages: { signIn: '/login' },
    // withAuth otherwise reads process.env.NEXTAUTH_SECRET itself. With that
    // var unset it threw a Configuration error and redirected every gated
    // request to /api/auth/error, making the dashboard unreachable even though
    // NextAuth's own route handler was working off its dev fallback. Passing
    // the shared resolver keeps the two in lockstep.
    secret: authSecret(),
    callbacks: {
      // API routes report their own 401 above, so they must not be redirected
      // here. Pages need BOTH a token and the current session version —
      // pre-versioning tokens (30-day exp) bounce to /login for a fresh
      // sign-in, which also pulls fresh HTML onto long-idle devices.
      authorized: ({ token, req }) =>
        req.nextUrl.pathname.startsWith('/api/')
          ? true
          : !!token && token.sv === SESSION_VERSION,
    },
  }
);

export const config = {
  // /api/auth/* is excluded so sign-in and the NextAuth callbacks stay
  // reachable to anonymous visitors; every other API route is gated. The
  // /admin page and /api/admin routes additionally check super-admin server-side.
  matcher: ['/dashboard/:path*', '/settings/:path*', '/admin/:path*', '/api/((?!auth/|webhooks/).*)'],
};
