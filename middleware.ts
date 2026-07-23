import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

// Auth gate. Everything under /dashboard and /settings requires a session;
// /settings additionally requires OWNER (white-label + domain config is an
// admin surface, not something a REP should reach by typing the URL).
//
// The data API routes do their own getServerSession check AND scope every
// query by the session's marketOwnerId — that tenant scoping is what keeps
// one company's rows invisible to another.
export default withAuth(
  function middleware(req) {
    const role = req.nextauth.token?.role;
    if (req.nextUrl.pathname.startsWith('/settings') && role !== 'OWNER') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    return NextResponse.next();
  },
  {
    pages: { signIn: '/login' },
    callbacks: { authorized: ({ token }) => !!token },
  }
);

export const config = {
  matcher: ['/dashboard/:path*', '/settings/:path*'],
};
