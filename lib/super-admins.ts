// Client-safe: no server imports, so both the sidebar (client) and lib/admin.ts
// (server) can use it. The env list is only read on the server; the browser
// only knows the founder, which is enough to decide whether to show the link —
// the /admin page and API re-check server-side regardless.
const FOUNDER = 'sameer@khatriinc.com';

export function isSuperAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const e = email.toLowerCase();
  if (e === FOUNDER) return true;
  // Server only: SUPER_ADMIN_EMAILS is not NEXT_PUBLIC, so this is empty in the
  // browser and populated in Node.
  const extra = (process.env.SUPER_ADMIN_EMAILS ?? '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return extra.includes(e);
}
