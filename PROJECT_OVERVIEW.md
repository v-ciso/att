# Sales Engine — Project Overview & Handoff

Single source of truth for how this app works, its architecture, and its current
state. Written so a fresh engineer (or another AI tool / new chat) can pick it up
with zero prior context. Current at commit `acf4993` (branch `master`).

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

- **Next.js 14** (App Router) + React 18 + TypeScript, at the **repo root**.
- **Tailwind** for styling; obsidian-black base with a per-preset brand accent
  (obsidian-gold default; command-blue, emerald).
- **Prisma** ORM → **Supabase Postgres** (project `izcxirupnvliiymwcedz`,
  ca-central-1). Prisma reads `POSTGRES_PRISMA_URL` / `POSTGRES_URL_NON_POOLING`
  (injected by the Vercel↔Supabase integration).
- **NextAuth** (JWT strategy, Credentials provider) for sessions, with a
  **dual password backend** (Supabase Auth or bcrypt — see §4).
- **three.js** (3D product-mix pie), **chart.js** (trend line), **xlsx** +
  **pdfjs** (import), print-based PDF export.
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
- **`middleware.ts`** gates `/dashboard`, `/settings`, `/admin`, and `/api/*`
  (except `/api/auth/*`). API routes return **401 JSON** (not an HTML redirect)
  when unauthenticated; mutating methods from a VIEWER get 403.
- Super-admin list: `lib/super-admins.ts` (client-safe) — founder hardcoded, plus
  `SUPER_ADMIN_EMAILS` (server env, comma-separated).
- **RLS**: on for all 10 relational tables with **zero policies = default-deny**,
  so the public anon key reads nothing (verified via `npm run admin:audit`). Do
  not weaken this. (App-level scoping in `/api/tenant-data` is the live control.)

---

## 5. Dashboard tabs (what a customer sees)

All under `app/(dashboard)/dashboard/page.tsx`, tab state in `?tab=`:
- **Dashboard** — KPI tiles (each opens its own drilldown), revenue trend
  (chart.js, 7D/8W/12M), 3D product-mix pie (three.js, rim light follows brand),
  top performers, weekly goals, attendance snapshot.
- **Daily Tracker** — log a sale; mark attendance (Present/Late/Absent, Late-out
  GPS chargeback, Morning-Meeting checkbox); shows each rep's scheduled shift.
- **Roster** — people (single source of truth), inline + **modal edit**
  (name/role/stores/team/hourly/attendance), promotion ladder, Stores manager,
  drag-drop Team Builder. Delete confirms.
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
- **Competition** — live standings from sales; **"End & save"** archives final
  standings (viewable under "Past"); plain delete warns.
- **P&L** — Daily/Weekly/Monthly/Yearly (cadence conversion via `toView`);
  revenue/expenses/roadtrips; **roadtrip "Mark received"** button; live sales
  commission + chargebacks folded in.
- **Commission** — the payout engine (tiers, per-store multipliers, plan payouts,
  role rules, late-penalty). `normalizeCommission` guards against partial data.
- **Import** — reconcile uploaded .xlsx/.csv/.pdf vs computed pay (flags diffs).
- **Settings** — customers see **only** the password-change tab; the vendor also
  sees Branding + Domain.
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
- **Data recovery/undo** beyond competition archive (e.g., restore a removed
  store/user) — deletes confirm but there's no soft-delete recycle bin yet.
- **Offline conflict merge** for simultaneous multi-editor companies.
- **Editable per-store shift hours UI** (`lib/shifts.ts` hours are hardcoded).
- **2FA** enrolment UI (Supabase MFA is available once on Supabase Auth).
- `components/charts/charts-3d.tsx` is **dead code** (only `chart-3d.tsx` is used).
- Stripe code is env-gated and intentionally NOT wired (owner decision).

---

## 10. Gotchas

- Non-ASCII in `prisma/schema.prisma` → Prisma CLI dies with a bare "Error:".
- Never `npm run build` while `next dev` runs (both write `.next/`).
- Browser-pane screenshots time out (heavy blur/orbs) — verify via page text /
  JS eval and a fresh load.
- After any auth/session-shape change, **sign out and back in** to mint a new JWT.
- Demo defaults must never seed a live account — always route sample data through
  `seedForWorkspace` / `useLocalState`'s `liveDefault`.

---

## 11. To continue in a new chat (seed prompt)

> I'm working on **Sales Engine**, a Next.js 14 + Prisma + Supabase white-label
> AT&T retail sales dashboard (repo at root, branch `master`, deploys to
> `att.soramimarketing.com` via Vercel). Read **PROJECT_OVERVIEW.md** first — it
> has the full architecture. Key points: derived-data engine (owner logs sales in
> the Daily Tracker, everything else derives); per-tenant Postgres sync via the
> `TenantData` table + `lib/tenant-sync.ts` with localStorage as a device cache;
> NextAuth dual-path login (Supabase Auth or bcrypt) with server-computed
> `isSuperAdmin`; vendor Admin Console at `/admin`. Run `npm test` before/after
> changes. Then help me with: <your task>.
