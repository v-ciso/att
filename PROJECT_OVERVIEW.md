# Sales Engine — Project Overview & Handoff

Single source of truth for how this app works, its architecture, and its current
state. Written so a fresh engineer (or another AI tool / new chat) can pick it up
with zero prior context. Current on `v0/sales-engine-9e518872` as of 2026-08-07.

---

## 1. What it is

**Sales Engine** is a white-label sales-management command center for **AT&T
retail market owners**. The vendor is **KGV Inc**, selling it through
`soramimarketing.com`; the production app runs at **`att.soramimarketing.com`**.

The pitch: it replaces the weekly reporting grunt-work that a handful of reps and
admins do by hand — leaderboards, commissions, P&L, scheduling, attendance, and
goals in one dashboard. Priced **per week** (base $494/wk = 1 login; larger
plans add logins).

**Two roles of user:**
- **Vendor (super-admin)** — KGV Inc staff (`sameer@khatriinc.com` by default).
  Creates/suspends customer companies, manages their users and stores, sets up
  branding. Reaches the **Admin Console** at `/admin`.
- **Customer** — a market owner and (optionally) their managers. They run their
  own company's dashboard. One `OWNER` per company; additional logins default to
  `MANAGER` (edit) or `VIEWER` (read-only).

---

## 2. Tech stack

- **Next.js 16.3** (App Router/Turbopack) + React 19.2 + TypeScript, at the **repo root**.
- **Tailwind 3** for styling; obsidian-black base with a per-preset brand accent
  (obsidian-gold default; command-blue, emerald).
- **Prisma 5** ORM → **Supabase Postgres** (project `izcxirupnvliiymwcedz`,
  ca-central-1). Prisma reads `POSTGRES_PRISMA_URL` / `POSTGRES_URL_NON_POOLING`
  (injected by the Vercel↔Supabase integration).
- **NextAuth 4** (JWT strategy, Credentials provider) for sessions, with a
  **dual password backend** (Supabase Auth or bcrypt — see §4).
- **three.js** (3D product-mix pie), **chart.js** (trend line), **read-excel-file** +
  **pdfjs** (bounded XLSX/CSV/PDF import), and print-based PDF export. The old
  unmaintained `xlsx` and `html2pdf.js` dependencies were removed.
- Deployed on **Vercel** (auto-deploys from `master`).

---

## 3. The core architecture: derived data + per-tenant sync

### 3a. Derived-data engine (the heart)
The owner only ever enters **what was sold** — per rep, per day, in the **Daily
Tracker** (`SaleEntry`: date, person, store, plan, qty, nextUps, insurance).
**Everything else is derived** from those entries priced through the editable
**Commission Engine**: dashboard KPIs, leaderboard, 3D product mix, revenue
trend, meeting stats, and the P&L's sales-commission line. `lib/sales.ts`
`aggregateSales()` is the aggregator; it defensively skips malformed rows.

### 3b. Data storage & sync (per-tenant, cross-device)
Operational data is kept as ~17 JSON blobs under `se-*` **localStorage** keys.
On top of that:
- **`lib/workspace.ts`** installs a blocking `<script>` (in `app/layout.tsx`)
  that monkey-patches `Storage.prototype` to **namespace every `se-*` key** by
  workspace: `demo:` or `live:<marketOwnerId>:`. One seam gives demo/live
  separation AND per-tenant separation for free.
- **`TenantData`** table (Postgres): one row per `(marketOwnerId, key)`,
  cascade-deleted with the company. This is each company's **container**.
- **`/api/tenant-data`** GET/PUT scope by the **session's** `marketOwnerId`
  (never the request body) — that is the **isolation guarantee**; a signed-in
  user can only touch their own company's rows. VIEWER blocked on PUT. Only a
  whitelist of `se-*` keys is accepted.
- **`lib/tenant-sync.ts`** + `<TenantSync/>` (mounted in the dashboard layout):
  in **live** mode it hydrates the local cache from Postgres on mount (so a fresh
  device shows the real book), then **debounce-pushes** every edit back. First
  run seeds the server from local. **Demo mode never touches the server.**
- Isolation is **proven** (two-company test: cross-tenant leak = 0).

**Known limitation:** last-write-wins per key, no offline conflict merge — fine
for one-or-few concurrent editors per company.

### 3c. Reactivity
Any `se-*` write dispatches a `window` `se:data` event; the dashboard listens
(debounced ~120ms) and recomputes. `useLocalState` (in `editable-sections.tsx`)
is the shared hook — it takes `(key, demoDefault, liveDefault?)` so **demo
seeds sample data but live starts empty**, and it never persists a default until
the key is genuinely "owned" (loaded or edited), so opening a tab can't seed
demo furniture into a live account.

---

## 4. Auth & multi-tenancy

- **Login** (`lib/auth.ts`): dual path per user.
  - `authId` set → verified against **Supabase Auth** (`signInWithPassword`).
    These accounts appear in the Supabase **Authentication** tab and can be given
    OAuth/MFA/reset from the Supabase console. Created via the admin console.
  - else `passwordHash` → **bcrypt** (legacy/CLI accounts, e.g. the founder).
  - A disabled user OR a user under a disabled company is refused.
- **`isSuperAdmin` is computed server-side** in the NextAuth `jwt` callback
  (where `SUPER_ADMIN_EMAILS` is readable) and stamped on the session, so the
  client never has to re-derive it from an email. `companyName` (the tenant name)
  is also carried on the session → drives the **"Welcome, {Company}"** greeting.
  **Changing this requires a fresh sign-in** to mint a new token.
- **`proxy.ts`** gates `/dashboard`, `/settings`, `/admin`, and `/api/*`
  (except auth/webhooks). API routes return **401 JSON** (not an HTML redirect)
  when unauthenticated; mutating methods require a same-origin `Origin` header and
  a write-capable role. VIEWER is read-only.
- Sessions are JWTs with a **two-hour maximum lifetime** and 15-minute refresh
  cadence. Sign-out purges all live tenant caches from that browser.
- Login is throttled per normalized email and IP through `LoginAttempt`; failed,
  successful, and locked-out attempts are appended to `AuditLog`.
- Super-admin list: `lib/super-admins.ts` (client-safe) — founder hardcoded, plus
  `SUPER_ADMIN_EMAILS` (server env, comma-separated).
- **RLS** remains default-deny for direct public access. Server reads are also
  tenant-scoped from the session; do not weaken either layer.

---

## 5. Dashboard tabs (what a customer sees)

All under `app/(dashboard)/dashboard/page.tsx`, tab state in `?tab=`:
- **Dashboard** — KPI tiles (each opens its own drilldown), revenue trend
  (chart.js, 7D/8W/12M), 3D product-mix pie (three.js, rim light follows brand),
  top performers, weekly goals, attendance snapshot.
- **Daily Tracker** — log a sale; mark attendance (Present/Late/Absent, Late-out
  GPS chargeback, Morning-Meeting checkbox); shows each rep's scheduled shift.
- **Roster** — people are the identity source of truth. Each receives a stable
  employee code; lifecycle is active → retired/archived → rehire without losing
  history. The profile drawer derives lifetime production, attendance, tenure,
  stores, timeline, and document completion from existing source data.
- **Leaderboard** — ranked reps, PDF/print.
- **Meeting Mode** — fullscreen present surface; leadership earnings table,
  teams, competition, schedule, and a **Promo/attachments** panel (links persist;
  a PDF is an object-URL for that meeting only).
- **Schedule** — store-first, one-day-at-a-time; date pager (arrows + picker +
  Today); per-store AM/SWING/PM/FULL assignment; **coverage warnings**
  (unstaffed / no-morning / no-evening / thin) and a "Mark closed" toggle.
- **Attendance** — Weekly/Monthly/Yearly + **date navigation** (arrows, picker,
  Today); per-rep present/late/absent, weighted score, last-late/last-absent,
  day-by-day grid, CSV export. Fed by Daily-Tracker marks.
- **Competition** — relational `Competition`/`CompetitionStanding` lifecycle.
  Live standings derive from sales; **End & save** freezes numeric standings so
  back-dated entries cannot rewrite history. Ended competitions can be archived.
- **Library** — private Supabase Storage documents under tenant-prefixed paths;
  audience by role/person, effective dates, version chains, acknowledgement
  tracking, same-origin byte streaming, and Meeting Mode preview.
- **Recycle Bin** — `DataArchive` recovery portal for archived tenant entities.
  Owners restore their own company data; only super-admin can permanently purge,
  with company confirmation, reason, and audit row.
- **P&L** — Daily/Weekly/Monthly/Yearly (cadence conversion via `toView`);
  revenue/expenses/roadtrips; **roadtrip "Mark received"** button; live sales
  commission + chargebacks folded in.
- **Commission** — the payout engine (tiers, per-store multipliers, plan payouts,
  role rules, late-penalty). `normalizeCommission` guards against partial data.
- **Import** — reconcile uploaded .xlsx/.csv/.pdf vs computed pay (flags diffs).
  Tabular imports are capped at 10 MB, 10,000 rows, and 200 columns.
- **Settings** — customers see password change and their tenant audit trail;
  the vendor also sees Branding, Domain, and platform-wide audit activity.
- **Export PDF** — a checkbox dialog picks sections (KPIs/Leaderboard/P&L/
  Payout/Roster), pre-selecting the current tab.

---

## 6. The money model (owner's rules; all editable)

Office payout per line at Tier 5 (what AT&T deposits): **Value $124 / Extra $134
/ Premium $144**; **+$15** for Next Up (a Value line reads $139), **+$10**
Insurance. Fiber: 300=$250, 500=$300, 1GIG=$360, 2GIG=$360, 5GIG=$400.

Pay split out of that office payout:
- **Rep** = flat **$40/line** base.
- **Lead** = rep base **+$5 = $45/line**, on their own lines only.
- **ASM** = paid like a Lead on their own lines (**$45**) **plus 3% of their whole
  team's** production.
- **Owner** = the **remainder** (auto-computed by `computeOfficeTake`, never a
  fixed %).

Logic in `lib/pay.ts`; locked by `npm run test:pay`. Roadtrip reimbursement is a
one-time charge reimbursed ~14 days later (`lib/roadtrips.ts`, `test:roadtrips`).
Staffing coverage in `lib/shifts.ts` (`test:shifts`). B2B campaign = straight
50% split, no base, areas not stores.

---

## 7. Admin console (`/admin`, super-admin only)

`components/admin/admin-console.tsx` + `lib/provision.ts` + `/api/admin/*`:
- **New company**: name, owner email, temp password (optional), campaign
  (retail/b2b), **seats (any number, base 1)**, theme, **logo upload**. Creates
  the tenant + OWNER in **Supabase Auth**, seeds empty operational data + the
  branding (name/logo/colors) so their dashboard shows THEIR company on first
  login.
- **Per company**: add/remove **Stores** (handoff setup), add users (default
  **MANAGER**; seat cap auto-raises), **Reset pw** on any user (owners included),
  edit seats inline, **Suspend/Reinstate** the whole company.
- Users created here carry the **"Supabase"** badge; CLI/bcrypt accounts don't.
- **Audit** activity is available to super-admin across companies; company owners
  see only their own tenant slice.

CLI equivalents (in `scripts/`, run with `npm run …`): `admin:create`,
`admin:adduser`, `admin:removeuser`, `admin:audit`, plus `set-role`,
`delete-tenant`, `check-admin`. Onboarding email via `lib/email.ts` (Resend,
`sales@kgvinc.com`, opt-in `--email-them`; needs `RESEND_API_KEY` + verified
domain).

---

## 8. Environment / deploy

Vercel env (Production/All):
- `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` — from the
  Supabase integration.
- `NEXTAUTH_SECRET` (≥32 chars, not `demo-*`; prod refuses to boot otherwise),
  `NEXTAUTH_URL` = `https://att.soramimarketing.com`. **These two are NOT
  supplied by the integration and `vercel env pull` strips them — keep them set.**
- Optional: `SUPER_ADMIN_EMAILS`, `RESEND_API_KEY`, `EMAIL_FROM`,
  `SIGNUP_INVITE_CODE` (leave unset → public signup 403s).

Run locally: `npm run dev`. Tests: `npm test`. Build: `npm run build`.
Schema push: `npx prisma db push` (keep `schema.prisma` **ASCII-only**; stop the
dev server before `prisma generate` on Windows or it locks the engine DLL).

Docs: `RUNBOOK.md` (operate/sell), `MIGRATION.md` (Supabase-Auth cutover +
Resend DNS), `SALES_ENGINE.md`/`SPEC.md`/`DESIGN.md` (older design intent —
note some predate the gold theme and current auth).

---

## 9. Deferred / not done (honest backlog)

- **Full Supabase-Auth migration** for existing bcrypt accounts (dual path works
  now; MIGRATION.md has the plan).
- **Offline conflict merge** for simultaneous multi-editor companies.
- **Editable per-store shift hours UI** (`lib/shifts.ts` hours are hardcoded).
- **2FA is intentionally deferred**. The schema fields exist but default false;
  there is no enrolment/challenge UI and middleware does not enforce MFA.
- Recovery currently covers app-level archived entities. Admin removal of a
  Supabase Auth user/store still follows its existing confirmed workflow.
- `components/charts/charts-3d.tsx` is **dead code** (only `chart-3d.tsx` is used).
- Stripe code is env-gated and intentionally NOT wired (owner decision).

---

## 10. Gotchas

- Non-ASCII in `prisma/schema.prisma` → Prisma CLI dies with a bare "Error:".
- After `npm ci --ignore-scripts`, run `npx prisma generate` before typecheck/build;
  otherwise TypeScript reports missing Prisma exports and cascades into implicit-any errors.
- Browser verification of the 3D dashboard should launch with WebGL support.
- After any auth/session-shape change, **sign out and back in** to mint a new JWT.
- Demo defaults must never seed a live account — always route sample data through
  `seedForWorkspace` / `useLocalState`'s `liveDefault`.

---

## 11. To continue in a new chat (seed prompt)

> I'm working on **Sales Engine**, a Next.js 16 + Prisma + Supabase white-label
> AT&T retail sales dashboard (repo root, deploys to `att.soramimarketing.com`
> via Vercel). Read **PROJECT_OVERVIEW.md** first. Key points: derived-data engine;
> per-tenant Postgres sync with localStorage as a device cache; NextAuth dual-path
> login; stable employee identities and derived lifetime profiles; relational
> competitions; private document library; recycle bin; audit trail and login
> throttling. Vendor Admin Console is `/admin`. Run `npm test`, `npx prisma
> generate`, `npx tsc --noEmit`, and `npm run build` before/after changes. Then
> help me with: <your task>.
