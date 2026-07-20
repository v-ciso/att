# Sales Engine — Compact Product Doc

**What it is:** A command-center dashboard for AT&T retail (EDM) and B2B market owners (ICDs).
One place for morning meetings, leaderboards, commission/payout math, P&L, roster, and the
leadership roadmap — white-label ready, sold as a service.

**Live:** deployed on Vercel from `v-ciso/att` (`master`, app at repo root). Zero env vars
required in preview mode. Design system: `DESIGN.md` · visual prototype: `engine4.html`.

---

## Pages & features

**The core principle: you never type revenue.** You log *what was sold* in the Daily
Tracker (rep, plan, qty, next-ups, insurance) and every other number — revenue,
leaderboard, KPIs, product mix, meeting stats, P&L commission — derives automatically,
priced through the editable Commission Engine (tier × store multiplier), with the
breakdown of where each dollar came from always visible.

| Where | What it does |
|---|---|
| `/` | Redirects to the dashboard (no login gate in preview mode) |
| **Dashboard tab** | **Period selector (Daily/Weekly/Monthly/All) + multi-store dropdown** (one, several, or all stores) — every widget respects both. Derived KPI tiles (count-up animated); **clicking any KPI opens the "who did what" production drawer**. 7-day revenue trend, **3D product-mix pie** — click a slice → sold count, mix %, revenue, and the **Next Up attach breakdown** ("6 of 15 lines carried Next Up, +$60"). Top performers (click → profile), team-average attendance, weekly goals with derived progress. Empty state offers **Generate Demo Data** |
| **Daily Tracker tab** | The morning workflow: date + rep dropdown + plan dropdown (from your Commission lists) + qty/next-ups/insurance → Add Sale. Each entry shows its payout with an expandable **"where this money comes from"** breakdown. Generate Demo Data / Clear All |
| **Roster tab** | Single source of truth for people: add/remove, **click a name → full profile & stats**, pencil to rename, role badges, store + team, weekly profit + attendance. **Leadership Roadmap** — editable rules (default $5,000/wk × 2 wks + ≥90% attendance) → green **Promote** button when met. Below it, the **Team Builder: drag & drop people** between an Unassigned pool and team cards with an **org tree** (ASM → Lead → members) |
| **Leaderboard tab** | Derived, auto-ranked by payout for the selected period + stores. Team chips joined from roster. Click a name → profile drawer (period production, roadmap ladder, attendance) |
| **Meeting Mode tab** | **Auto-fullscreens on entry** (Present / F / Esc). Own period chips (Daily/Weekly/All). Trackers and **team cards compute live from members' sales**. Team membership managed in the Roster's Team Builder |
| **P&L tab** | Manual revenue/expense/roadtrip line items + **auto rows**: this month's sales commission (derived) and the roadtrip reimbursement (editable %, default 60%). Live net profit + margin |
| **Commission tab** | The pricing brain: Tiers 1–5 (editable $-per-tier drop), stores add/remove with multipliers, editable payout groups — Phone (Premium/Extra/Value 2.0, Upgrades), Internet (Internet Air, Fiber 300→5GIG), Add-Ons (Next Up Anytime, Insurance), role structure. **Change a number here and every derived stat recomputes** |
| **Export PDF** (header) | Crisp print-based export (vector text, not screenshots): branded header, derived KPI tiles, leaderboard, P&L, payout structure, roster + roadmap. Print dialog → Save as PDF |
| `/settings` | White-label: company name, colors, logo, feature toggles |
| `/demo` | Public marketing page with pricing |

**Every edit saves automatically** (browser localStorage in preview mode) and every section has a Reset that recomputes all derived views.

## Data model (joined by design)

```
SaleEntry { date, person, store, plan, qty, nextUps, insurance }      ← the ONLY thing you enter
Person { name, role: INTERN|REP|LEAD|ASM, store, team, weeklyProfit[], attendance% }
Team { name, color, lead, asm }                                        ← membership lives on Person.team
CommissionState { tier 1-5, tierDelta, stores[{name, multiplier}], phonePlans[], internet[], addOns[], roles[] }
PnlState { revenue[], expenses[], roadtrips[], reimburseRate% }        ← + auto commission from sales
PromotionRules { profitPerWeek, weeks, minAttendance }

Derivation (lib/sales.ts): revenue = Σ qty × payout(plan, tier, store-multiplier)
                                    + nextUps × payout(NextUp) + insurance × payout(Insurance)
aggregateSales(period, stores) → lines/premium/internet/nextUps/revenue, per-person, per-plan, per-day
```

localStorage keys: `se-sales-v1`, `se-people-v1`, `se-teams-v2`, `se-commission-v1`,
`se-pnl-v1`, `se-promo-rules-v1`, `se-theme-v1`.

## Payout economics (owner's model)

Office (ICD) receives ~100% of carrier payout (e.g. ~$124/starter line at Costco, Tier 5);
rep gets their cut (~$40), Lead earns +$5/line over rep, ASM/AD a % of team production,
remainder to the Market Owner. All of these numbers are editable in the Commission tab.
Payouts drop ~$5 per tier below Tier 5. Weekly carrier reports arrive as per-sale Excel
line items (rep + employee ID, plan, tier, store, week) — future import feature maps 1:1.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind (tokens in `tailwind.config.js`) ·
Chart.js (2D) + Three.js (3D) · html2pdf (branded template in
`components/dashboard/report-template.tsx`) · Prisma schema + API routes present but
dormant (preview mode) · NextAuth scaffolding preserved in git history.

## Phase 2 — turning on shared data (when owner gives go)

1. **Rotate the Supabase credentials first** (they were exposed in chat): Supabase →
   Settings → Database → reset password; regenerate API keys; Vercel → Integrations →
   Supabase → resync env vars. Never commit secrets; `.env` is gitignored.
2. Point Prisma at `POSTGRES_PRISMA_URL` (pooled) + `POSTGRES_URL_NON_POOLING` (direct),
   migrate schema, replace localStorage hooks with API-backed state.
3. Logins: market-owner/admin + demo only; reps/leads/ASMs are records, not accounts.
4. Then: weekly Excel import, daily/weekly/monthly/yearly period switcher backed by real
   sale records, per-store/per-person history "journey" views.

## Conventions for AI/dev handoff

- Bolt/bolt.new experiments live ONLY in `bolt/` (rules in its README).
- Follow `DESIGN.md` (black base, semantic neon accents, glass). Chart palettes must pass
  the dataviz six-checks (current pie order is validated colorblind-safe).
- Repo-local git identity: `sameer-4106 <sameer@khatriinc.com>`. Always build
  (`npm run build`) before pushing; never run build while the dev server is running.
