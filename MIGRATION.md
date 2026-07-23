# Migration guides

Two things you asked how to do. Both are written so you can hand them to any
developer, including me in a later session.

---

# 1. Moving auth to Supabase

## Read this before you start

**Do this AFTER the app reads from Postgres, not before.** Today every number
lives in browser `localStorage`. Supabase Auth's main advantage is that RLS can
key off `auth.uid()` — but RLS protects database rows, and you have almost none.
Migrating now buys you nothing except 2FA, which is ~100 lines on your current
setup anyway.

The one thing that *is* urgent regardless: today a customer's data lives on one
laptop. That is the real blocker.

## What actually changes

| | Now | After |
|---|---|---|
| Password check | `bcrypt.compare` in `lib/auth.ts` | Supabase GoTrue |
| Where users live | `public.User` | `auth.users` + a `public.User` profile row |
| Session | NextAuth JWT cookie | Supabase session (JWT with `auth.uid()`) |
| Tenant isolation | `marketOwnerId` filter in each API route | RLS policy in the database |
| 2FA | build it | built in |
| Password reset | build it | built in |

## Steps

**1. Install and configure**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are already in
your env from the Vercel integration.

**2. Link `public.User` to `auth.users`**

Add to `prisma/schema.prisma` on the `User` model, then `npx prisma db push`:

```prisma
  authId String? @unique  // maps to auth.users.id
```

**3. Migrate existing accounts.** Their bcrypt hashes cannot be imported into
GoTrue. For each existing user, create a Supabase auth user with a fresh
temporary password and email it (`lib/email.ts` already does this), then set
`authId`. With one customer this is a five-minute job; do it before you have
twenty.

**4. Swap the sign-in call.** Replace the NextAuth `signIn('credentials', …)` in
`app/(auth)/login/page.tsx` with `supabase.auth.signInWithPassword(…)`, and
replace `getServerSession(authOptions)` in every API route with the Supabase
server client's `getUser()`.

**5. Turn on RLS policies.** Right now RLS is ON with **zero policies**, which
is default-deny — safe, but it also means nothing can read through PostgREST.
Once auth is Supabase, add per-table policies like:

```sql
create policy "own tenant read" on public."LeaderboardEntry"
for select using (
  "marketOwnerId" = (
    select "marketOwnerId" from public."User" where "authId" = auth.uid()
  )
);
```

Repeat per table, per operation. Verify with `npm run admin:audit` — it lists
RLS state and policies per table.

**6. Enable MFA** in Supabase → Authentication → Multi-Factor, then add the
enrolment UI. This is the 2FA you asked about.

**7. Delete** `lib/auth.ts`, the NextAuth route, and the `next-auth` dependency.

## Rollback

Keep `passwordHash` in the `User` table until the migration is proven. It is the
only way back if GoTrue misbehaves mid-cutover.

---

# 2. Onboarding email with Resend

`lib/email.ts` is written and wired. It **no-ops safely** when unconfigured —
provisioning never fails because email is misconfigured, which would otherwise
create an account and lose the credentials.

## What you need to do

**1. Create a Resend account** at resend.com.

**2. Verify the sending domain `kgvinc.com`.** Resend gives you DNS records —
add them at your registrar:

| Type | Purpose |
|---|---|
| MX + TXT (SPF) | proves Resend may send as you |
| TXT (DKIM) | signs the mail |
| TXT (DMARC) | tells inboxes what to do with failures |

Without this, mail from `sales@kgvinc.com` lands in spam or is rejected. Verification
usually takes under an hour.

**3. Create an API key** (Resend → API Keys), sending permission only.

**4. Add to `.env` locally and to Vercel (All Environments):**

```
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=Sales Engine <sales@kgvinc.com>
```

**5. Send a real one.** Add `--email-them` to any provisioning command:

```bash
npm run admin:create -- --email owner@theirco.com --company "Their Co" --email-them
```

It prints `Emailed  welcome sent to …` or the exact reason it didn't.

## What's already written

| Function | Sent when | Contains |
|---|---|---|
| `sendWelcome` | new customer provisioned | URL, email, temp password, campaign, seats |
| `sendSeatInvite` | extra user added | URL, email, temp password, access level |
| `sendAccessRequest` | someone asks for access | their company + email, and the exact command to provision them |

All three carry the "Powered by KGV Inc · Billing and support through KGV Inc"
footer, and the two credential emails go to exactly one recipient — never BCC.

## One deliberate choice

`--email-them` is **opt-in**. These emails carry a working password; sending
them automatically on every command means one typo mails someone else's
credentials to the wrong address.
