import { NextResponse } from 'next/server';

// PREVIEW MODE: auth gating is disabled so the Vercel preview works with zero
// env vars and no database. The original RBAC middleware (next-auth withAuth,
// role checks for /settings, protected /api routes) is preserved in git
// history — restore it when real auth + a database are plugged back in.
export default function middleware() {
  return NextResponse.next();
}

export const config = {
  // Never matches a real route — middleware is fully disabled in preview mode.
  matcher: ['/preview-mode-disabled'],
};
