# Sales Engine — operator runbook

Everything you need to run, secure, and ship the tool. Written for the owner,
not for a contributor.

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
