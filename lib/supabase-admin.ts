import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// SERVER ONLY. The service-role key bypasses every row-level rule, so it must
// never reach the browser. Nothing here is imported by a client component, and
// the key is read from a non-NEXT_PUBLIC env var so Next.js can't inline it.

let cached: SupabaseClient | null = null;

function url(): string {
  const u = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!u) throw new Error('SUPABASE_URL is not set');
  return u;
}

/** Admin client (service role). Manages users in Supabase Auth. */
export function supabaseAdmin(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  cached ??= createClient(url(), key, { auth: { autoRefreshToken: false, persistSession: false } });
  return cached;
}

/** True when Supabase Auth is wired up. Lets callers fall back gracefully. */
export function supabaseAuthReady(): boolean {
  return Boolean(
    (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Verify an email + password against Supabase Auth using the PUBLIC anon key
 * (the same path a browser sign-in takes). Returns the auth user id on success.
 * Used by the credentials provider for accounts that have an authId.
 */
export async function verifySupabasePassword(email: string, password: string): Promise<string | null> {
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!anon) return null;
  const client = createClient(url(), anon, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) return null;
  return data.user.id;
}

/**
 * Create (or reuse) a Supabase Auth user. `email_confirm: true` skips the
 * confirmation email — the vendor is vouching for the account. Idempotent:
 * if the email already exists in Auth, its id is returned instead of erroring.
 */
export async function createAuthUser(email: string, password: string): Promise<{ id: string; reused: boolean }> {
  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (!error && data.user) return { id: data.user.id, reused: false };

  // Already registered → find and return the existing id.
  if (error && /already been registered|already exists/i.test(error.message)) {
    const existing = await findAuthUserByEmail(email);
    if (existing) return { id: existing, reused: true };
  }
  throw new Error(error?.message ?? 'Could not create Supabase auth user');
}

export async function setAuthPassword(authId: string, password: string): Promise<void> {
  const { error } = await supabaseAdmin().auth.admin.updateUserById(authId, { password });
  if (error) throw new Error(error.message);
}

export async function deleteAuthUser(authId: string): Promise<void> {
  // Best-effort: a missing auth user must not block deleting the app row.
  try { await supabaseAdmin().auth.admin.deleteUser(authId); } catch { /* already gone */ }
}

async function findAuthUserByEmail(email: string): Promise<string | null> {
  // The admin API has no direct get-by-email, so page through the list. Fine at
  // vendor scale (tens of users); revisit if this ever holds thousands.
  const admin = supabaseAdmin();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data.users.length) break;
    const hit = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if (data.users.length < 200) break;
  }
  return null;
}
