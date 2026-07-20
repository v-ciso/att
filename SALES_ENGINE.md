# Sales Engine — Compact Product Doc

**What it is:** A command-center dashboard for AT&T retail (EDM) and B2B market owners (ICDs).
One place for morning meetings, leaderboards, commission/payout math, P&L, roster, and the
leadership roadmap — white-label ready, sold as a service.

**Live:** deployed on Vercel from `v-ciso/att` (`master`, app at repo root). Zero env vars
required in preview mode. Design system: `DESIGN.md` · visual prototype: `engine4.html`.

---

## Pages & features

| Where | What it does |
|---|---|
| `/` | Redirects to the dashboard (no login gate in preview mode) |
| **Dashboard tab** | KPI tiles (animated count-up), commission trend line, **3D product-mix pie** — click a slice or legend chip → drill-down drawer (units, mix %, payout/unit *live from the Commission engine*, est. revenue, 7-day trend). Top performers, attendance ring, weekly goals |
| **Roster tab** | The **single source of truth for people**: add/remove employees, click role badge to change role, assign store + team, weekly profit + attendance per person, and the **Leadership Roadmap** — editable rules (default: $5,000 profit/wk × 2 wks + ≥90% attendance). When someone qualifies, a green **Promote** button appears; ladder is Intern → Sales Rep → Lead → ASM/AD |
| **Leaderboard tab** | Editable rep table (click any cell), add/remove reps, auto-ranked. **Team column auto-joins from the Roster** by name. **Store filter chips** — view All, one store, or several. Hover a row: 👤 opens the rep's **profile drawer** (stats, role/store/team, roadmap ladder, weekly profit vs. target, attendance) |
| **Meeting Mode tab** | **Auto-fullscreens on entry** (Present button / F key / Esc as controls) for TV·AirPlay. Editable daily trackers. **Teams**: Add Team **auto-populates unassigned people from the Roster** (picks an available Lead and ASM too); appoint Lead/ASM by clicking names; member chips add/remove |
| **P&L tab** | Add/remove/edit revenue, expenses, roadtrips. Roadtrip reimbursement (editable %, default 60%) auto-flows to revenue. Live net profit + margin |
| **Commission tab** | The payout engine: **Tiers 1–5** (Tier 5 highest, editable $-per-tier drop, default $5), **stores** add/remove with per-store multipliers, three editable payout groups — Phone (Premium/Extra/Value 2.0, Upgrades), Internet (Internet Air, Fiber 300→5GIG), Add-Ons (Next Up Anytime $10, Insurance) — plus the role structure (Lead +$5/line, ASM % override, Owner) |
| **Export PDF** (header) | Branded report: company header, KPI tiles, leaderboard table, full P&L, payout structure at current tier/store, **and the roster + roadmap table** — all pulled from live data, dated filename |
| `/settings` | White-label: company name, colors, logo, feature toggles (drives the whole UI + PDF header) |
| `/demo` | Public marketing page with pricing |

**Every edit saves automatically** (browser localStorage in preview mode) and every section has a Reset.

## Data model (joined by design)

```
Person { name, role: INTERN|REP|LEAD|ASM, store, team, weeklyProfit[], attendance% }
Team { name, lead, asm, members[], lines, premium, fiber, progress }
LeaderboardEntry { name, store, lines, premium, fiber, commission }   ← team joined from Person by name
CommissionState { tier 1-5, tierDelta, stores[{name, multiplier}], phonePlans[], internet[], addOns[], roles[] }
PnlState { revenue[], expenses[], roadtrips[], reimburseRate% }
PromotionRules { profitPerWeek, weeks, minAttendance }
```

localStorage keys: `se-people-v1`, `se-teams-v2`, `se-leaderboard-v1`, `se-commission-v1`,
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
