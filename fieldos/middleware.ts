import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Allow public paths
    if (path === '/login' || path === '/register' || path.startsWith('/api/auth') || path.startsWith('/api/webhooks')) {
      return NextResponse.next();
    }

    // Protect dashboard routes
    if (path.startsWith('/dashboard')) {
      if (!token) {
        const url = new URL('/login', req.url);
        url.searchParams.set('callbackUrl', path);
        return NextResponse.redirect(url);
      }

      // Role-based access for settings
      if (path.startsWith('/dashboard/settings') && token.role !== 'OWNER') {
        return NextResponse.redirect(new URL('/dashboard', req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;
        // Allow public paths
        if (path === '/login' || path === '/register' || path.startsWith('/api/auth') || path.startsWith('/api/webhooks')) {
          return true;
        }
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/leaderboard/:path*',
    '/api/teams/:path*',
    '/api/commission/:path*',
    '/api/expenses/:path*',
    '/api/roadtrips/:path*',
    '/api/goals/:path*',
    '/api/attendance/:path*',
    '/api/whitelabel/:path*',
    '/api/stripe/:path*',
  ],
};