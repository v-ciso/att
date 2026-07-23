# Sales Engine — Web/Higgsfield working context
(Pair this with fieldos-project-state.md, which has the engineering detail.)

## Product & goal
Sales Engine = white-label sales command center for AT&T retail (EDM) + B2B market
owners (ICDs). Sold via soramimarketing.com. Owner: Sameer. Repo: github.com/v-ciso/att
(branch master, Next.js 14, deployed on Vercel). Goal now: demo-ready + marketing assets
+ eventually multi-tenant with real logins.

## Tool boundaries — use the right one
- **Claude Code (desktop, on the owner's machine)** = the ONLY thing that edits the repo,
  runs builds, pushes to GitHub, deploys to Vercel, verifies in-browser. All app changes go here.
- **Claude web (claude.ai)** = planning, writing code snippets to hand to Claude Code,
  design direction, and running MCP tools (Higgsfield). Connect the GitHub repo via web
  "Connectors → GitHub" so web can READ v-ciso/att for context. Web cannot commit.
- **Higgsfield MCP (paid, connected)** = generate MARKETING/DEMO MEDIA only — promo videos,
  hero animations, ad creative, social clips, product-tour visuals. NOT app UI/code.
- **Ruflo** = Claude Code plugin; its project memory is local to the desktop. Don't run
  `npx ruflo init` in the repo. Its swarm/autopilot are NOT worth it (cost more, no self-perfect).

## Brand spec (feed this to Higgsfield so assets match the app)
- Look: "Command Center Dark" — PURE BLACK (#000) obsidian base, glass-morphism panels,
  neon accents. Premium, mission-control, confident.
- Active theme: OBSIDIAN & GOLD — black + shiny gold (#E7C24A -> #F7E08A -> #B8860B).
  Green = profit, red = loss, blue = phone, cyan = internet (these are fixed/semantic).
- Type: Sora (display/headings, tight tracking) + Inter (body) + JetBrains Mono (numbers).
- Motion: subtle, glossy, drifting ambient glow; nothing that reads "AI-generated template."
- Product visuals to generate: dashboard hero shot, 3D pie/leaderboard beauty shots,
  "morning meeting" presentation mode, before/after (Excel chaos -> clean dashboard),
  a 15-30s promo, and soramimarketing.com toolkit-page creative.

## What's built (so web can pitch/plan accurately)
Derived-data engine: owner logs daily sales -> revenue, leaderboard, 3D pie, P&L, pay all
auto-compute. Tabs: Dashboard, Daily Tracker, Roster (+ Stores mgr + drag-drop teams +
promotion roadmap), Leaderboard, Meeting Mode (fullscreen present + commitments + schedule),
Schedule (shift hours per store), Competition (multiple, per-store), P&L (W/M/Y cadence),
Commission (tier/store/plan payouts, office vs rep cut), Import (reconcile .xlsx/.csv/.pdf
direct-deposit vs computed pay), Settings (theme presets, logo upload+lock). Store-level
GPS late clock-out chargebacks. Campaign selector (Retail EDM / B2B).

## Status (updated 2026-07-22)
Auth is LIVE — see RUNBOOK.md. `/` redirects to `/login`; `/dashboard` and `/settings`
are gated; `/settings` is OWNER-only; self-serve signup is closed unless
`SIGNUP_INVITE_CODE` is set. Demo vs Live data is a real storage boundary
(`lib/workspace.ts`), OWNER-only for Live. DB is **Neon**, not Supabase.

## Open items / next
1. Phase 2: move the engine server-side. The dashboard is still localStorage-only, so
   the Prisma schema + tenant-scoped API routes are unused and Postgres RLS protects
   nothing yet. The login gate + per-workspace namespace are today's real controls.
2. Editable per-store shift hours UI (`lib/shifts.ts` is hardcoded).
3. Marketing site assets (Higgsfield).
4. `DESIGN.md` still documents the old blue-primary system — reconcile with gold.

## Rule of thumb
Design/marketing/media/planning -> web + Higgsfield. Actual app changes + deploy -> Claude Code.
Never expect web to "run until perfect" - it plans; the desktop executes and verifies.
