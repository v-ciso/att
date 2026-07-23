# Sales Engine — operator runbook

Everything you need to run, secure, sell, and ship the tool. Written for the
owner, not for a contributor.

---

# PART 1 — Selling it

## The model in one paragraph

You (KGV Inc) sell a seat to a market owner. You create their account from your
machine; there is no public sign-up. They get their own tenant, their own login,
and their own branding. Their reps do **not** get logins — reps are data records
inside the owner's dashboard, not user accounts. One paying seat = one market
owner. Billing is through KGV Inc, which is stated on the login screen under
every customer's branding.

## Onboarding a new customer — the whole sequence

**1. Create their account** (from the project folder):

```bash
npm run admin:create -- --email owner@theircompany.com --company "Their Company"
```

Prints a password **once**. Copy it before closing the terminal.

**2. Send them three things:** the URL (`https://att.soramimarketing.com`), their
email, and that password. Tell them to change it immediately.

**3. They change the password** — Settings → Account. After that you no longer
know their password, which is the point.

**4. They brand it** — Settings → Branding: company name, logo (also becomes the
browser favicon), and colour preset. Once they lock the logo it is permanent.

**5. Verify from your side:**

```bash
npx tsx scripts/check-admin.ts
```

Every row should be a customer you recognise, and OWNER should only appear for
real account holders.

## Demoing to a prospect

Use **your own login** and flip the sidebar switch to **Demo**. Demo is a
completely separate data bucket — nothing you type while pitching can touch your
real numbers, and "Reset demo data" wipes only the demo side.

Do **not** create a shared demo account. A login several prospects know is a
permanent weak password sitting on your production database.

## Pricing conversations — what is actually true today

Be accurate about this, because it is the difference between a happy customer
and a refund:

- Their data lives **in their browser**, not on your server. It does not sync
  between their laptop and their phone, and clearing site data clears the book.
- You cannot see their numbers, so you cannot support them on their own data.
- One person, one browser, one device is the honest supported configuration
  right now.

Until the server-side migration lands, sell it as a **single-operator command
center**, not a multi-device team platform.

---

# PART 2 — Running it

## Run it locally

```bash
npm run dev
```

Open http://localhost:3000 — you land on `/login`. There is no way past it;
`/dashboard` and `/settings` redirect to the login page without a session.

## Accounts

Roles: `OWNER`, `ASM`, `LEAD`, `REP`, `INTERN`. **Role is the security boundary** —
only `OWNER` can switch to Live data or open Settings (white-label + domain).

```bash
npm run admin:create -- --email you@company.com --company "Your Company"
```

Prints a generated password **once**. Set `ADMIN_PASSWORD` first if you want to
choose it. Re-running with the same email resets that account's password.

```bash
npx tsx scripts/check-admin.ts                              # list accounts + roles
npx tsx scripts/set-role.ts --email x@y.com --role REP      # change a role
```

Never leave a shared or demo login at `OWNER`.

## Demo vs Live data

The sidebar has a **Data source** switch. This is a real boundary, not a filter:
each mode reads and writes its own `localStorage` bucket, namespaced by a shim
installed before React mounts (`lib/workspace.ts`, wired in `app/layout.tsx`).

- **Demo** — `demo:*`. Shared sandbox for pitching. "Reset demo data" wipes only
  this bucket. Anyone below OWNER is pinned here.
- **Live** — `live:<tenantId>:*`. The real book. OWNER only. Two tenants on the
  same browser never see each other's numbers.

Switching reloads the page on purpose — otherwise React state from the previous
workspace would linger and a demo figure could surface in a live view.

## White-labeling a new customer

1. `npm run admin:create -- --email them@theirco.com --company "Their Co"`
2. They sign in and open **Settings → Branding**: company name, logo (doubles as
   favicon), and colour preset. Once the logo is locked it is permanent.
3. Their branding is stored per workspace, so it never bleeds into your tenant.

New tenants start on **Obsidian & Gold**; `Command Blue` and `Emerald` are the
other presets. Semantic colours never change: green = profit, red = loss,
blue = phone, cyan = internet.

## Self-serve signup

Closed by default. `/api/auth/register` returns 403 while `SIGNUP_INVITE_CODE`
is unset — it provisions a whole tenant with an OWNER account, so it must not be
open. To hand out a signup link, set the env var, then rotate it after onboarding.

## Before you deploy

Set on Vercel (Production):

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Postgres. Required — production refuses to boot without it. |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32`. Must be ≥32 chars and not start with `demo-`, or production throws on boot. |
| `NEXTAUTH_URL` | Your real subdomain, e.g. `https://app.yourdomain.com`. |
| `SIGNUP_INVITE_CODE` | Leave **unset** unless you want open signup. |

Then:

```bash
npm run build
npx tsx scripts/check-admin.ts
```

Confirm the only `OWNER` rows are people you trust.

## Tests

```bash
npm run test:roadtrips
```

Covers the P&L money path: a roadtrip is a **one-time** charge, and its
reimbursement is recognised ~14 days later — never netted against the cost in
the same period. See `lib/roadtrips.ts`.

## Known limits

- **App data lives in the browser, not the database.** Sales, roster, schedule,
  commission and P&L are `localStorage`. Clearing site data clears the book, and
  numbers do not follow you to another device. The Postgres schema and API
  routes exist and are tenant-scoped, but the dashboard does not read from them
  yet. Moving the engine server-side is the next real milestone.
- Because of the above, Postgres row-level security is not what protects your
  data today — the login gate and the per-workspace storage namespace are.
- `lib/shifts.ts` still hardcodes store hours; there is no editable UI yet.
