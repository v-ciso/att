import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

// Auth gate for pages AND the data API.
//
// Pages redirect to /login when signed out. API routes must NOT — redirecting
// a fetch() hands the caller the HTML login page with a 200, which client code
// will happily try to parse as JSON. They get a 401 instead.
//
// Roles that may change data. VIEWER is read-only by contract, so it is blocked
// at the edge on every mutating call: hiding buttons in the UI is a hint, not a
// permission, and a read-only seat that can still POST is not read-only.
const CAN_WRITE = new Set(['OWNER', 'MANAGER']);
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const role = token?.role as string | undefined;
    const { pathname } = req.nextUrl;
    const isApi = pathname.startsWith('/api/');

    if (isApi && !token) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }

    if (pathname.startsWith('/settings') && role !== 'OWNER') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    if (isApi && MUTATING.has(req.method) && !CAN_WRITE.has(role ?? '')) {
      return NextResponse.json({ error: 'Your account has read-only access.' }, { status: 403 });
    }

    return NextResponse.next();
  },
  {
    pages: { signIn: '/login' },
    callbacks: {
      // API routes report their own 401 above, so they must not be redirected
      // here. Pages still get the normal sign-in redirect.
      authorized: ({ token, req }) =>
        req.nextUrl.pathname.startsWith('/api/') ? true : !!token,
    },
  }
);

export const config = {
  // /api/auth/* is excluded so sign-in and the NextAuth callbacks stay
  // reachable to anonymous visitors; every other API route is gated.
  matcher: ['/dashboard/:path*', '/settings/:path*', '/api/((?!auth/).*)'],
};
