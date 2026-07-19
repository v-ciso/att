# FieldOS — Complete Handoff for Claude Code

## Update — 2026-07-19 session (Claude Code)

The P0 login bug is **fixed and verified in-browser**. The real root cause was NOT the duplicate tailwind config alone: `app/layout.tsx` never imported `./globals.css`, so no Tailwind styles were ever served (which also masked broken classes inside globals.css that only failed once the import existed).

Fixes applied and verified (login → dashboard → tabs → settings all render; production build passes with 0 errors):
- `app/layout.tsx`: converted to a server component, added `import './globals.css'`, proper `metadata`/`viewport` exports, added JetBrains Mono font
- `app/globals.css`: fixed invalid `@apply -webkit-tap-highlight-transparent`, added `.neon-text-yellow`
- `tailwind.config.js`: added `border.DEFAULT`, `grad-border`, `grad-yellow`
- `lib/theme.tsx`: `applyTheme()` now creates the `#whitelabel-theme` style element if missing (white-label CSS vars actually inject now)
- `components/charts/chart-wrapper.tsx`: registered missing `BarElement`, `BarController`, `DoughnutController` (doughnut/bar charts crashed the dashboard error boundary)
- Sidebar/mobile nav: previously linked to 9 nonexistent routes (all 404). Now driven by `components/dashboard/nav-items.ts` pointing at real destinations (`/dashboard?tab=...` + `/settings`); dashboard reads `?tab=` for deep-linking; sidebar shows the real session user + white-label logo/company name instead of hardcoded values
- `app/(dashboard)/dashboard/page.tsx`: fixed `stagger-{i + 1}` literal, `icon={PieChart3D}` (a Three.js component used as a 16px icon), net-profit class bug (`cn()` was being passed a currency string), removed unused top-level `html2pdf` import
- Login page: magic-link button now shows an honest "coming soon" message (no Email provider is configured) instead of failing silently
- Stripe: intentionally left env-gated OFF per owner's decision — do not wire it up yet

## Current State Overview

The project is an AT&T Retail Market Owner SaaS platform (FieldOS) built with Next.js 14 App Router, TypeScript, Prisma + Neon PostgreSQL, and Tailwind. It was generated from `engine4.html` (the visual prototype/design reference) into a full Next.js application.

### Git Status
- Repo root: `C:\Users\ITKLocal\Downloads\GROK\ATT- Sales Engine`
- Remote: `https://github.com/v-ciso/att.git` (configured but no push done yet)
- Initial commit: `e6c0be7` — "Initial commit: FieldOS SaaS platform for AT&T Retail Market Owners" (68 files)
- Many unstaged changes exist (see below)
- Branch: `master`

### Database
- **Neon PostgreSQL** — connected and working
- Connection string: `DATABASE_URL` in `fieldos/.env` (pooled, pgbouncer mode)
- Tables synced via `prisma db push` — all models created
- Demo data seeded: `demo@fieldos.app` / `demo123456`
- Seeded data includes: market owner, owner user, lead, 20 reps, 6 teams, commission rules, leaderboard entries, goals, expenses
- `.env` also has `NEXTAUTH_SECRET="demo-secret-do-not-use-in-production"` and `NEXTAUTH_URL="http://localhost:3000"`

---

## Staged/Uncommitted Changes (What We Did This Session)

These changes are NOT committed — they exist in the working tree only:

### Files Modified
| File | Change |
|------|--------|
| `fieldos/lib/auth.ts` | Added `getServerSession` import; exported `auth()` function returning `getServerSession(authOptions)` |
| `fieldos/components/white-label/theme-provider.tsx` | Added `mounted` state guard — returns ThemeContext.Provider immediately (before mount) with `isLoading: true` to prevent hydration mismatch / blank render |
| `fieldos/components/charts/chart-3d.tsx` | Added `data?.length` guard in PieChart3D and BarChart3D useEffect to prevent Three.js crash on empty data |
| `fieldos/components/charts/chart-wrapper.tsx` | Registered `LineController` in Chart.js (was missing, caused console warnings/errors) |
| `fieldos/app/(auth)/demo/page.tsx` | Reformatted/improved demo page — stats, leaderboard, commission, P&L tabs with hardcoded demo data |

### Files Deleted
| File | Reason |
|------|--------|
| `fieldos/tailwind.config.ts` | **Critical: duplicate Tailwind config.** Deleting `.ts` version ensures only `tailwind.config.js` is used. The `.js` version has ALL design tokens (`shadow-glass`, `backdropBlur-glass`, etc.). The `.ts` version was missing these — this is the ROOT CAUSE of the "white page" login bug (Tailwind classes like `bg-bg-primary` weren't resolving). |

### New Untracked Files
| File | Purpose |
|------|---------|
| `fieldos/app/page.tsx` | Root route `/` — checks session via `auth()`, redirects to `/dashboard` if logged in, else `/login` |
| `FIELDOS_SPEC.md` | Full product spec (already present, not created by us) |
| `HANDOFF.md` | This file |

---

## PROJECT STRUCTURE

### Key Entry Points
- `fieldos/` — Next.js application (the main project)
- `engine4.html` — **Design reference / visual prototype** (standalone HTML with all UI, charts, colors, animations — the design source of truth)
- `SPEC.md` — Full product spec (892 lines, very detailed)
- `FIELDOS_SPEC.md` — Concise product spec (470 lines, implementation status)

### App Routes
```
/                          → app/page.tsx (new) — redirects to /dashboard or /login
/login                     → app/(auth)/login/page.tsx
/register                  → app/(auth)/register/page.tsx
/demo                      → app/(auth)/demo/page.tsx — marketing page + interactive demo dashboard
/dashboard                 → app/(dashboard)/dashboard/page.tsx
/dashboard/employees       → teams management
/dashboard/meeting         → fullscreen meeting mode
/dashboard/leaderboard     → editable leaderboard
/dashboard/commission      → commission editor
/dashboard/pnl             → P&L / expenses
/dashboard/goals           → goals & attendance
/settings                  → white-label config (OWNER only)
```

### API Routes
All at `app/api/` — uses Zod validation + RBAC middleware.

---

## CURRENT ISSUES (PRIORITIZED)

### 1. Login Page Renders White (HIGH PRIORITY)
**Symptom**: `http://localhost:3000/login` shows blank white page — no content renders.

**Root Cause (FIXED)**: 
- `tailwind.config.ts` was missing `shadow.glass`, `backdropBlur.glass`, and other design tokens that the login form's `Card` component depends on
- The `.ts` config was being picked up over `.js` — deleted the `.ts` version
- Also fixed `ThemeProvider` to not crash during SSR (added `mounted` state guard)

**Still Needs Verification**:
- User must restart dev server (`Ctrl+C` then `npm run dev`) for the tailwind config change to take effect
- Then visit `http://localhost:3000/login` — should show dark-themed login form
- If still broken: open browser DevTools → check that `:root` has CSS variables `--wl-primary`, etc.
- If still white: check for JS console errors (the `useTheme()` call on login page line 15 could throw if ThemeProvider context is missing)

**Test credentials**: `demo@fieldos.app` / `demo123456`

### 2. Build Verification Needed
- Run `npm run build` in `fieldos/` to confirm 0 TypeScript errors
- After the fixes, the build should still pass (no structural changes)

### 3. Demo Data Needs Realism
- `scripts/seed-demo.ts` has placeholder numbers — needs realistic AT&T retail data
- Realistic values: lines/rep, premium mix ratio, fiber attach rate, commission ranges

---

## DESIGN SYSTEM REFERENCE

The **primary design source of truth** is `engine4.html` at the project root. Open this file in a browser to see the complete visual reference for:

### Theme
- Pure black background (`#000`), deep navy secondary (`#0A0A0F`)
- Glass morphism cards: `background: rgba(255,255,255,0.03)`, `backdrop-filter: blur(20px)`, border `rgba(255,255,255,0.08)`
- 3 ambient orbs (blue top-right, purple bottom-left, cyan mid-right) — `blur(100px) opacity(0.15)`
- Neon gradient text: `.neon-blue`, `.neon-purple`, `.neon-cyan` — uses `background-clip: text` + `drop-shadow` glow

### Tailwind Config (`fieldos/tailwind.config.js`)
All design tokens are defined here:
```js
colors: { bg: { primary/secondary/tertiary/card }, border: { subtle/strong }, text: { primary/secondary/muted/inverse }, accent: { blue/purple/cyan/green/yellow/orange/red + glow variants } }
backgroundImage: { grad-blue/purple/cyan/green/card }
boxShadow: { neon-blue/purple/cyan, glass }
backdropBlur: { glass: '20px' }
animation: { pulse-glow/slide-in/fade-in/scale-in }
fontFamily: { sans: 'Inter', mono: 'JetBrains Mono' }
fontSize: { fluid-xs through fluid-4xl — all clamp() }
```

### Color Semantics (EVERY color means something)
| Color | Meaning |
|-------|---------|
| Blue (#3B82F6) | Primary actions, Phone plans, Daily stats |
| Purple (#A855F7) | Premium, Team leads, Weekly stats |
| Cyan (#06B6D4) | Fiber, Info, Secondary accent |
| Green (#10B981) | Profit, Success, Attendance, Revenue |
| Yellow (#F59E0B) | Goals, Warning, Premium Mix |
| Orange (#F97316) | Roadtrips, Third place |
| Red (#EF4444) | Loss, Danger, Expenses |

### Card Variants (from `components/ui/card.tsx`)
- `glass` (default): translucent, blurred
- `elevated`: darker bg + shadow
- `bordered`: visible border
- `neon-{color}`: glowing border with accent color

### Animation Principles
- Micro-interactions: 150ms ease
- Standard: 300ms cubic-bezier(0.4, 0, 0.2, 1)
- Stagger: 50ms per child
- Respects `prefers-reduced-motion`

---

## REMAINING WORK (For Claude Code)

### P0 — Fix Login + Verify
1. Restart `npm run dev` after tailwind config fix
2. Verify login page renders (dark bg, form, orbs)
3. Test login with demo credentials
4. If still broken: check JS console for `useTheme()` context error or missing CSS variables
5. Test `/demo` page renders correctly
6. Test root `/` redirect works

### P1 — Polish & Realism
1. Enhance `scripts/seed-demo.ts` with realistic AT&T retail numbers
2. Wire 3D chart click handlers (PieChart3D/BarChart3D) → detail drawer
3. Mobile sidebar animation (add Framer Motion for smooth slide)
4. PDF export branding (custom template with logo, colors, watermark, page numbers)

### P2 — Deployment
1. Remove `NEXTAUTH_SECRET="demo-secret"` → use real secret (`openssl rand -base64 32`)
2. Push to GitHub (`git push origin master`)
3. Connect to Vercel, add env vars, deploy
4. Add Stripe env vars + register webhook in Stripe dashboard
5. Test checkout → portal → webhook → subscription tier update

### P3 — Deferred (Post-Launch)
- Email provider (SendGrid/Resend) for magic links
- Stripe price IDs + webhook registration
- Custom domain SSL automation
- Advanced forecasting (ML)
- Multi-market super-admin
- Audit logs / activity feed
- Slack/Teams webhook notifications
- PWA support (manifest.json, service worker)

---

## KEY FILES FOR CLAUDE CODE

| File | Why |
|------|-----|
| `engine4.html` | **Visual design reference** — open in browser to see exact look & feel |
| `FIELDOS_SPEC.md` | Concise product spec (start here) |
| `SPEC.md` | Full 892-line spec (complete detail) |
| `fieldos/tailwind.config.js` | Design tokens — source of truth for all colors/animations |
| `fieldos/app/(auth)/login/page.tsx` | Login page — uses `useTheme()` line 15 |
| `fieldos/components/white-label/theme-provider.tsx` | CSS variable injection (client-side) |
| `fieldos/lib/theme.tsx` | Theme types, defaults, `generateCSSVariables()` |
| `fieldos/lib/auth.ts` | NextAuth config — now exports `auth()` |
| `fieldos/middleware.ts` | RBAC route protection |
| `fieldos/prisma/schema.prisma` | Complete data model (12 models) |
| `fieldos/scripts/seed-demo.ts` | Demo seed data (improve realism) — run via `npm run db:seed` or `npx tsx scripts/seed-demo.ts` |
| `fieldos/app/(dashboard)/dashboard/page.tsx` | Main dashboard composition |
| `fieldos/components/charts/chart-3d.tsx` | Three.js charts (Pie/Bar/Funnel) |
| `fieldos/components/ui/card.tsx` | Card component with all glass variants |
| `fieldos/app/globals.css` | Base styles, utilities, keyframes |
| `fieldos/.env` | Connection strings and secrets |
| `fieldos/package.json` | All scripts and dependencies |

---

## IMPORTANT GOTCHAS

1. **Multi-tenancy**: EVERY query must filter by `marketOwnerId` — enforced by middleware + API checks
2. **Role hierarchy**: `OWNER(5) > ASM(4) > LEAD(3) > REP(2) > INTERN(1)` — see `lib/utils.ts` `getRoleLevel()`
3. **Theme injection**: Happens client-side in `ThemeProvider` useEffect — causes flash if not careful (now has `mounted` guard)
4. **Stripe webhooks**: Must use raw body (`request.text()`) for signature verification
5. **PDF export**: `html2pdf.js` captures DOM — needs `@media print` styles for clean output
6. **Three.js disposal**: Memory leak if `dispose()` not called — already implemented in `chart-3d.tsx`
7. **Two tailwind configs**: Only `.js` should exist — `.ts` was deleted (classes like `bg-bg-primary` won't work with the wrong config)
8. **Login page uses `useTheme()`** — must be wrapped in `ThemeProvider` (done in `app/providers.tsx`)
9. **`tailwind.config.ts` was deleted** — do NOT recreate it. Only `tailwind.config.js` should exist
10. **This is WINDOWS** — path separators are `\`, shell is PowerShell. If you need to run git commands with paths containing `()`, escape or use wildcards

---

## COMMANDS

```bash
# Development
cd fieldos && npm run dev

# Build
cd fieldos && npm run build

# Lint
cd fieldos && npm run lint

# Database (after schema changes)
cd fieldos && npx prisma db push

# Seed demo data
cd fieldos && npm run db:seed

# Prisma Studio
cd fieldos && npx prisma studio
```
