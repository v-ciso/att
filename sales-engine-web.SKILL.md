---
name: sales-engine-web
description: >
  Web-side working context for Sales Engine (AT&T sales command center, sold via
  soramimarketing.com, repo v-ciso/att). Load whenever the task is PLANNING, DESIGN
  DIRECTION, or MARKETING/DEMO MEDIA for this product on claude.ai — hero/landing
  concepts, brand-accurate visuals, Higgsfield promo assets, roadmap/next-steps.
  Do NOT use for editing the repo, running builds, or deploying — that is Claude
  Code on the owner's desktop only.
metadata:
  node_type: skill
  type: project
  owner: Sameer (sameer@khatriinc.com)
  repo: github.com/v-ciso/att (branch master, Next.js 14, Vercel)
---

# Sales Engine — web / design / Higgsfield context

**What it is.** White-label sales command center for AT&T retail (EDM) + B2B market
owners (ICDs). Derived-data engine: the owner logs daily `SaleEntry` rows once, and
revenue, leaderboard, 3D product-mix pie, P&L, payroll, and chargebacks all
auto-compute. Tabs: Dashboard, Daily Tracker, Roster (+ stores + drag-drop teams +
promotion roadmap), Leaderboard, Meeting Mode, Schedule, Competition, P&L,
Commission, Import (reconcile .xlsx/.csv/.pdf vs computed pay), Settings.

## Tool boundaries — the one rule that matters
- **Claude Code (desktop)** = the ONLY thing that edits `v-ciso/att`, builds, pushes,
  deploys to Vercel, and verifies in-browser. Every app/code change goes there.
- **Claude web (here)** = planning, design direction, code snippets to hand off, and
  running Higgsfield. Reads the repo via the GitHub connector; **cannot commit**.
- **Higgsfield MCP** = MARKETING/DEMO MEDIA only (promo video, hero/ambient art, ad
  creative, social clips, product-tour visuals). Never app UI or code.
- Web plans; the desktop executes and verifies. Never expect web to "run until perfect."

## Brand spec — "Command Center Dark / Obsidian & Gold"
Source of truth: repo `DESIGN.md` + `tailwind.config.js` + `engine4.html`.
- **Base:** pure black `#000000` (never gray). Panels `#0A0A0F` / `#111318`. Glass =
  `rgba(255,255,255,0.03)`, `backdrop-filter: blur(20px)`, border `rgba(255,255,255,0.08)`
  (hover `0.15`), shadow `0 8px 32px rgba(0,0,0,0.3)`.
- **Gold chrome (active theme accent, swappable):** `#B8860B → #E7C24A → #F7E08A`.
  Drives titles, logo, active tab, primary button, hero headline — CHROME ONLY.
- **Semantic colors — FIXED in every theme, never decorative:** blue `#3B82F6` = phone /
  primary, cyan `#06B6D4` = internet/fiber, green `#10B981` = profit/revenue, red
  `#EF4444` = loss/expense, purple `#A855F7` = premium/leads, yellow `#F59E0B` = goals,
  orange `#F97316` = roadtrips/3rd.
- **Type:** Sora (display/headings, tight tracking) · Inter (body) · JetBrains Mono
  (numbers/IDs). Numbers are the heroes: big, bold, neon.
- **Motion:** subtle, glossy, drifting ambient glow; `pulse-glow` on KPI cards; respect
  `prefers-reduced-motion`. Nothing that reads "AI-generated template."
- **Asset rules:** black bg + white text always; one accent dominates per section (don't
  rainbow); revenue is green never red; charts follow blue→purple→cyan→green→yellow→red.

## Higgsfield asset pipeline (what works for THIS brand)
- Generate **atmospheric / abstract** brand assets (obsidian+gold light ribbons, glass
  shards, ambient hero backgrounds, promo B-roll) that **composite behind real UI
  screenshots** — do NOT generate fake dashboards (reads as AI slop + breaks the
  "no template" rule; real UI comes from the app).
- **Recraft V4.1** (`recraft_v4_1`) is the go-to image model: it accepts an explicit
  hex `colors` palette + `background_color`, so lock `#000000` + the gold trio and keep
  gold-dominant. 16:9 + 2k for heroes. Preflight with `get_cost` when unsure.
- Always feed the brand spec above into every prompt; keep assets text-free so copy is
  added in-app / in-design.

## Open items / next
1. **SECURITY (gates everything):** rotate the Supabase creds pasted in chat before any
   real data — project `izcxirupnvliiymwcedz`: reset DB password, regenerate keys,
   resync the Vercel integration. Never write these to files.
2. Phase 2: real DB/auth (admin + demo logins only), multi-tenant white-label domains.
3. Editable per-store shift-hours UI (hours currently hardcoded in `lib/shifts.ts`).
4. Marketing site assets for soramimarketing.com (Higgsfield).

## Known repo/spec drift to flag for Claude Code
- `DESIGN.md` still documents a **blue-primary, multi-accent** system; the current
  direction is **gold chrome + fixed semantic colors** (per WEB_CONTEXT). Reconcile.
- `DESIGN.md`/`tailwind.config.js` list only Inter + JetBrains Mono; current direction
  adds **Sora** for display. Add Sora to the font stack + config.
