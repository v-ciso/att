# FieldOS - AT&T Retail Market Owner SaaS Platform
## Complete Product Specification & Implementation Status

---

## 1. PROJECT OVERVIEW

**FieldOS** is a production-ready, white-label SaaS platform built for **AT&T Retail Market Owners** to manage their entire field sales operation. Each Market Owner purchases their own isolated instance — no shared data between customers.

**Target Users:** Market Owners, ASMs (Area Sales Managers), Team Leads, Sales Reps, Interns
**Business Model:** B2B SaaS — $297/mo Standard, $494/mo White-Label
**Deployment:** Vercel + Neon PostgreSQL + Stripe Billing

---

## 2. CORE OBJECTIVES

### Primary Goal
Deliver a **visually stunning, feature-complete dashboard** that Market Owners can log into and immediately run their business — tracking daily production, commissions, P&L, attendance, goals, team performance, and morning meetings.

### Secondary Goals
- **White-label ready**: Every customer gets custom branding (logo, colors, domain, feature flags)
- **Stripe-ready billing**: Subscription management built-in, activatable via env vars
- **Vercel deployable**: Zero-config production deployment
- **Demo-able**: Pre-seeded demo data for instant evaluation
- **Extensible**: Clean architecture for future features

---

## 3. ROLE HIERARCHY & PERMISSIONS

| Role | Level | Can Manage | Dashboard Access |
|------|-------|------------|------------------|
| OWNER | 5 | All users, teams, settings, billing, white-label | Full |
| ASM | 4 | Leads, Reps, Interns; team goals, attendance | Full |
| LEAD | 3 | Reps, Interns; team goals, attendance | Team-scoped |
| REP | 2 | Self only | Personal stats only |
| INTERN | 1 | Self only | Personal stats only |

**Middleware enforces RBAC** on all API routes and pages.

---

## 4. VISUAL DESIGN SPECIFICATION

### 4.1 Color System (CSS Variables)
All colors defined in `tailwind.config.js` and injected via white-label theme provider:

```css
/* Base Dark Theme (AT&T-inspired) */
--bg-primary: #000000          /* Pure black background */
--bg-secondary: #0A0A0F        /* Deep navy */
--bg-tertiary: #111318         /* Card backgrounds */
--bg-card: rgba(255,255,255,0.03)  /* Glass cards */

/* Borders */
--border-subtle: rgba(255,255,255,0.08)
--border-strong: rgba(255,255,255,0.15)

/* Text */
--text-primary: #FFFFFF
--text-secondary: #9CA3AF
--text-muted: #6B7280

/* Accent Colors (White-label customizable) */
--accent-blue: #3B82F6         /* Primary actions, links */
--accent-purple: #A855F7       /* Secondary, premium */
--accent-cyan: #06B6D4         /* Info, fiber */
--accent-green: #10B981        /* Success, profit */
--accent-yellow: #F59E0B       /* Warning, goals */
--accent-orange: #F97316       /* Roadtrips */
--accent-red: #EF4444          /* Danger, loss */
```

### 4.2 Visual Effects & Atmosphere

**Ambient Orbs** — Three fixed, blurred gradient orbs behind content:
- Blue (top-right), Purple (bottom-left), Cyan (mid-right)
- `filter: blur(100px) opacity(0.15)` — creates depth without distraction

**Glass Morphism Cards** — `backdrop-blur: 20px`, semi-transparent bg, subtle border
- Variants: `glass` (default), `elevated` (darker bg + shadow), `bordered`, `neon-{color}` (glowing border)

**Neon Text Gradients** — `background-clip: text` with drop-shadow glow
- `.neon-text-blue`, `.neon-text-purple`, `.neon-text-cyan`, `.neon-text-green`

**Micro-animations** — Framer Motion not required; pure CSS:
- `slideIn` (staggered entry), `pulse-glow` (stat cards), `fadeIn`, `scaleIn`
- Respects `prefers-reduced-motion`

**3D Charts (Three.js)** — Not flat Chart.js fallbacks
- **PieChart3D**: Extruded slices, hover = pull out + scale 1.05x, click = detail drawer
- **BarChart3D**: Extruded bars, subtle breathing animation, hover = highlight
- **FunnelChart3D**: Tapered stages for pipeline visualization
- All: responsive, high-DPI, clean disposal on unmount

### 4.3 Typography
- **Font**: Inter (300-900) — loaded via Google Fonts preconnect
- **Fluid type scale** using `clamp()`: `fluid-xs` through `fluid-4xl`
- **Monospace**: JetBrains Mono for numbers/codes

### 4.4 Spacing & Layout
- 8px base unit
- Dashboard: `p-4 lg:p-8`, sidebar `w-64` fixed left
- Mobile: collapsible sidebar + bottom nav
- Max content width: `max-w-7xl` centered

---

## 5. FEATURE SPECIFICATIONS

### 5.1 Authentication (`/login`, `/register`)
- **Credentials**: Email/password + bcrypt (NextAuth CredentialsProvider)
- **Magic Links**: Email provider (configure SendGrid/Resend later)
- **Session**: JWT strategy, 30-day expiry, `marketOwnerId` in token
- **Middleware**: Protects `/dashboard/*`, `/api/*` (except auth/webhooks)
- **Demo credentials**: `demo@fieldos.app` / `demo123456`

### 5.2 Dashboard (`/dashboard`) — Main Command Center

**Top Section:**
- Page title + "AT&T campaign · white-label ready" subtitle
- Campaign badge row: Live indicator, AT&T Retailer, 8 Stores
- **Export PDF** button (html2pdf.js) → generates branded report

**Stats Row (4 cards, staggered entry):**
- Daily Prod: `127` (+12.5%) — blue
- Weekly Prod: `843` (+8.2%) — purple
- Revenue: `$142K` (+15.3%) — green
- Premium Mix: `68.4%` (+2.1%) — yellow

**Charts Row (2-col):**
1. **Commission Trend** — LineChart (Chart.js) — 7-day sparkline
2. **Product Mix** — DoughnutChart (Chart.js) — 6 segments

**Tabs (horizontal, scrollable):**
| Tab | Content |
|-----|---------|
| **Dashboard** | Stats + charts + leaderboard + top performers + attendance + goals |
| **Employees** | Team management, roles, stores, inline editing |
| **Stores** | Store list, multipliers, performance |
| **Sales Entry** | Daily line entry form (phone + fiber plans) |
| **Attendance** | Calendar grid, bulk actions |
| **Expenses** | P&L expense entry + roadtrip 60% reimbursement logic |
| **Leaderboard** | Full rankings, editable cells, PDF/CSV export |
| **Meeting Mode** | Full-screen presentation (see 5.3) |
| **Goals** | Weekly/monthly targets per role/store |
| **Forecasts** | Trend projection, capacity planning |

**Leaderboard Table (inline editable):**
- Columns: Rank, Name, Store, Lines, Premium, Fiber, Commission, Role
- Click any cell → inline edit → auto-save via `/api/leaderboard`
- Row colors by role (Owner=green, ASM=yellow, Lead=purple, Rep=blue, Intern=gray)

**Top Performers** — Podium (1st/2nd/3rd) with medals

**Attendance Ring** — DoughnutChart: Present/Late/Absent percentages

**Goals Progress** — Horizontal bars with % complete

### 5.3 Meeting Mode (`/dashboard/meeting`) — Full-Screen Presentation

**Trigger**: Button in header or `/dashboard/meeting` route
**Behavior**: `requestFullscreen()`, hides sidebar/header, ESC to exit

**Layout (4-quadrant grid):**
1. **Daily Trackers** (4 large stat cards): Today's Lines, Top Rep, Attendance %, Goal Progress
2. **Team Overview** (4 team cards): Name, % change, Lines, Premium, Fiber, Progress ring
3. **Leaderboard** (compact): Top 10, keyboard navigable (←/→ arrows)
4. **P&L Snapshot** — Revenue vs Expenses vs Net Profit, margin %

**Keyboard Shortcuts:**
- `Space` / `→` = Next section
- `←` = Previous section
- `F` = Toggle fullscreen
- `Esc` = Exit meeting mode

### 5.4 Commission Engine (`/dashboard/commission`) — Fully Editable

**Three Sections (each in own Card):**

1. **Phone Plans** — Array of `{ name, payout }`
   - Premium 2.0, Premium 2.0 + Next Up, Extra 2.0, Value 2.0, Upgrades
   - Inline edit payout → PATCH `/api/commission`

2. **Fiber Plans** — Array of `{ name, payout }`
   - Fiber 300, 500, 1GIG, 2GIG, 5GIG

3. **Store Multipliers** — Per-store coefficient (Costco=1.2, Target=1.0, BJ's=1.1, Custom)

4. **Role Overrides** — Flat $/line bonus per role (Leader=$5, ASM=$3, Tier=$2)

**Validation**: Zod schemas, minimum $0, max $500
**Persistence**: `CommissionRule` model (type: PHONE/FIBER/STORE/ROLE)

### 5.5 P&L / Expenses (`/dashboard/expenses`)

**Revenue Section:** Commission, Bonuses (editable)
**Expense Categories:** Payroll, Rent, Travel, Marketing, Software, Other
**Roadtrip Reimbursement:** 
- Separate `Roadtrip` model (destination, miles, date, attendees)
- Auto-calculates: `miles × $0.67 × 60%` = reimbursement
- Appears as separate line item in P&L

**Calculations (real-time):**
- Total Revenue = Σ revenue items
- Total Expenses = Σ expenses + roadtrip reimbursements
- Net Profit = Revenue - Expenses
- Margin % = (Net Profit / Revenue) × 100

**Export**: PDF includes branded header, date range, all line items

### 5.6 Goals & Attendance

**Goals (`/dashboard/goals`):**
- Per-role weekly targets (lines, premium, fiber, upgrades)
- Per-store monthly targets
- Progress bars with color coding (red<50%, yellow<80%, green≥80%)
- Bulk edit via modal

**Attendance (`/dashboard/attendance`):**
- Calendar month view
- Status per day: Present / Late / Absent / Excused / Roadtrip
- Bulk select → apply status
- Summary stats: % present, streak, total days

### 5.7 Team Management (`/dashboard/employees`)

**Create Team Modal:**
- Name, color picker, assign Lead (dropdown of LEAD/ASM/OWNER users)
- Add members (multi-select from available users)

**Employee Table:**
- Columns: Name, Role, Store, Team, Email, Status, Actions
- Inline role change (dropdown) → updates permissions instantly
- Invite new user → sends magic link
- Archive (soft delete) / Restore

### 5.8 White-Label Settings (`/settings`) — OWNER Only

**Tabs:**
1. **Branding**: Company name, logo upload (URL), primary/secondary/accent color pickers
2. **Domain**: Custom domain input (CNAME instructions shown), SSL status
3. **Features**: Toggle flags — Hide P&L, Hide Commission Engine, Hide Team Mgmt, Hide Goals/Attendance
4. **Billing**: Stripe portal link (when connected)

**Persistence**: `MarketOwner.theme` (JSON) + `customDomain` field
**Application**: CSS variables injected via `ThemeProvider` on mount

### 5.9 Stripe Billing (Pluggable)

**Plans:**
- `STANDARD` — $297/mo (price_id from env)
- `WHITE_LABEL` — $494/mo

**Flows:**
1. **Checkout** (`/api/stripe/checkout`): Creates session → redirects to Stripe
2. **Portal** (`/api/stripe/portal`): Manage subscription, update payment method
3. **Webhook** (`/api/webhooks/stripe`): Handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Updates `MarketOwner.subscriptionTier`, `stripeCustomerId`, `stripeSubscriptionId`

**Env vars required** (add when ready):
```
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_STANDARD_PRICE_ID=
NEXT_PUBLIC_STRIPE_WHITE_LABEL_PRICE_ID=
```

---

## 6. DATA MODEL (Prisma Schema)

```prisma
// Core
User { id, email, passwordHash, name, role, store, teamId, marketOwnerId, employeeId, avatarUrl, isActive, lastLoginAt }
MarketOwner { id, name, slug, stripeCustomerId, stripeSubscriptionId, subscriptionTier, theme(Json), customDomain, createdAt }
Team { id, name, color, leadId, marketOwnerId, members[], goals(Json) }

// Sales & Commission
LeaderboardEntry { id, userId, marketOwnerId, date, lines, premium, fiber, upgrades, commission, store, role }
CommissionRule { id, marketOwnerId, type(PHONE/FIBER/STORE/ROLE), name, value, config(Json) }
Commission { id, userId, marketOwnerId, periodStart, periodEnd, amount, breakdown(Json), status }

// Finance
Expense { id, marketOwnerId, category, amount, description, date, receiptUrl }
Roadtrip { id, marketOwnerId, destination, miles, reimbursementRate(0.60), date, attendees[], amount }

// Goals & Attendance
Goal { id, userId, marketOwnerId, type(WEEKLY/MONTHLY), metric, target, current, periodStart, periodEnd }
Attendance { id, userId, marketOwnerId, date, status(PRESENT/LATE/ABSENT/EXCUSED/ROADTRIP), notes }
```

**Multi-tenancy**: Every model has `marketOwnerId` — enforced by middleware + API checks.

---

## 7. API ROUTES (All Zod-validated, RBAC-protected)

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/auth/[...nextauth]` | GET/POST | Public | NextAuth handler |
| `/api/auth/register` | POST | Public | Create market owner + owner user |
| `/api/leaderboard` | GET/PATCH | User | CRUD entries, inline edit |
| `/api/commission` | GET/PATCH | User | Commission rules |
| `/api/expenses` | GET/POST/PATCH/DELETE | User | P&L expenses |
| `/api/roadtrips` | GET/POST/PATCH/DELETE | User | Roadtrip reimbursements |
| `/api/goals` | GET/POST/PATCH/DELETE | User | Goals CRUD |
| `/api/attendance` | GET/POST/PATCH | User | Attendance grid |
| `/api/teams` | GET/POST/PATCH/DELETE | User | Team management |
| `/api/whitelabel` | GET/PATCH | OWNER | Theme + domain + features |
| `/api/stripe/checkout` | POST | User | Create checkout session |
| `/api/stripe/portal` | POST | User | Create billing portal session |
| `/api/webhooks/stripe` | POST | Stripe | Subscription lifecycle |

---

## 8. DEPLOYMENT CHECKLIST

### Vercel Project Settings
- **Framework**: Next.js (auto-detected)
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

### Environment Variables (Vercel Dashboard)
```
DATABASE_URL=postgresql://... (Neon pooled)
NEXTAUTH_SECRET= (openssl rand -base64 32)
NEXTAUTH_URL=https://your-domain.vercel.app
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app

# Stripe (add when ready)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_STANDARD_PRICE_ID=
NEXT_PUBLIC_STRIPE_WHITE_LABEL_PRICE_ID=

# Email (for magic links - add when ready)
EMAIL_SERVER_HOST=
EMAIL_SERVER_PORT=
EMAIL_SERVER_USER=
EMAIL_SERVER_PASSWORD=
EMAIL_FROM=
```

### Post-Deploy
1. Run `npx prisma db push` (or `migrate deploy`) against Neon
2. Run `npm run db:seed` for demo data
3. Configure Stripe webhook endpoint: `https://your-domain.vercel.app/api/webhooks/stripe`
4. Test login: `demo@fieldos.app` / `demo123456`

---

## 9. IMPLEMENTATION STATUS

### ✅ COMPLETED (Production-Ready)

| Area | Status | Notes |
|------|--------|-------|
| **Project Structure** | ✅ | Next.js 14 App Router, TypeScript, Tailwind, Prisma |
| **Database Schema** | ✅ | All models, relations, indexes, enums |
| **Authentication** | ✅ | Credentials + Magic Links, JWT, middleware RBAC |
| **Dashboard Layout** | ✅ | Sidebar, mobile header/menu, background orbs |
| **Stats Cards** | ✅ | 4 KPIs with neon text, pulse glow, stagger |
| **2D Charts** | ✅ | LineChart, DoughnutChart, BarChart, AreaChart (Chart.js) |
| **3D Charts** | ✅ | PieChart3D, BarChart3D, FunnelChart3D (Three.js) — hover pull-out, click-ready |
| **Leaderboard** | ✅ | Table + inline edit + PDF/CSV export |
| **Meeting Mode** | ✅ | Fullscreen, 4-quadrant, keyboard nav |
| **Commission Engine** | ✅ | 4 sections, inline edit, Zod validation |
| **P&L / Expenses** | ✅ | Revenue/expenses, roadtrip 60%, real-time calc |
| **Roadtrips** | ✅ | Separate model, auto-reimbursement |
| **Goals** | ✅ | Weekly/monthly, progress bars, bulk edit |
| **Attendance** | ✅ | Calendar grid, bulk status, summary |
| **Team Management** | ✅ | Create team, assign lead/members, inline role edit |
| **White-Label Settings** | ✅ | Branding, domain, feature flags, CSS var injection |
| **Stripe Integration** | ✅ | Checkout, Portal, Webhooks — env-gated |
| **Security** | ✅ | CSP headers, bcrypt, Zod, RBAC middleware, rate limiting ready |
| **Build** | ✅ | `npm run build` — zero TypeScript errors |

### 🔧 IN PROGRESS / NEEDS POLISH

| Item | Issue | Fix Planned |
|------|-------|-------------|
| **Login page visuals** | User reports "black and white, no fonts" | Debug Tailwind class application, ensure ThemeProvider mounts before render |
| **3D Chart Interactions** | Click handler for detail drawer not wired | Add `onClick` → open sheet with drill-down data |
| **Demo Data Realism** | Seed data is placeholder | Enhance `prisma/seed.ts` with realistic AT&T retail numbers |
| **Mobile Sidebar** | Works but could be smoother | Add Framer Motion for slide animation |
| **PDF Export Styling** | Basic html2pdf — needs branded template | Custom PDF layout with logo, colors, watermark |

### ⏳ DEFERRED (Post-Launch)
- Email provider integration (SendGrid/Resend)
- Stripe price IDs + webhook registration
- Custom domain SSL automation
- Advanced forecasting ML
- Multi-market owner super-admin
- Audit logs / activity feed
- Slack/Teams webhook notifications

---

## 10. DESIGN PHILOSOPHY & VISUAL DIRECTION

### Core Aesthetic: **"Command Center Dark"**
- **Not** a typical SaaS light theme — this is a *tool for operators* who stare at it 8hrs/day
- Pure black (`#000`) base reduces eye strain, makes data pop
- Neon accents (blue/purple/cyan/green) = **data categories**, not decoration
- Every color has semantic meaning: Blue=Primary/Phone, Purple=Premium/Team, Cyan=Fiber/Info, Green=Profit/Success, Yellow=Goals/Warning, Orange=Roadtrips, Red=Loss/Danger

### Glass Morphism = **Depth Without Weight**
- Cards float on blurred orbs → sense of Z-space
- Borders at 8% opacity = structure without heaviness
- Neon variants for "live" states (meeting mode, alerts)

### Three.js > Chart.js for **Premium Feel**
- 3D charts aren't "flashy" — they communicate **volume** and **proportion** better
- PieChart3D extrusion = commission weight per product
- BarChart3D height = daily production volume
- Hover pull-out = "drill down" affordance
- Click → detail drawer (next sprint)

### Animation = **Feedback, Not Decoration**
- Staggered entry = "system booting up"
- Pulse glow = "this metric is live"
- Hover scale = "this is interactive"
- Respects `prefers-reduced-motion`

### White-Label = **Invisible Until Configured**
- Default = FieldOS branding (AT&T-appropriate)
- Customer sees *their* logo, colors, domain
- Feature flags let them hide modules they don't sell
- PDF exports carry their brand

---

## 11. NEXT STEPS FOR YOU

1. **Fix login visuals** — Check browser DevTools: are Tailwind classes applying? Is `ThemeProvider` wrapping correctly? The CSS variables from `theme.tsx` must inject before first paint.

2. **Test demo flow** — Visit `/demo` → click "Launch Live Demo" → should show seeded dashboard

3. **Add Stripe keys** — When ready, add 4 env vars + run webhook registration

4. **Deploy to Vercel** — Connect GitHub → add env vars → deploy

5. **Custom domain** — Add CNAME → update `MarketOwner.customDomain` → SSL auto

---

## 12. FILES TO KNOW

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Complete data model |
| `lib/auth.ts` | NextAuth config, credentials + email |
| `middleware.ts` | RBAC route protection |
| `components/white-label/theme-provider.tsx` | CSS variable injection |
| `lib/theme.tsx` | Theme types, defaults, CSS var generation |
| `app/(dashboard)/dashboard/page.tsx` | Main dashboard composition |
| `components/charts/chart-3d.tsx` | Three.js charts (Pie/Bar/Funnel) |
| `components/charts/chart-wrapper.tsx` | Chart.js 2D wrappers |
| `components/dashboard/dashboard-components.tsx` | Reusable dashboard pieces |
| `app/api/*/route.ts` | All API endpoints |
| `tailwind.config.js` | Design tokens (colors, fonts, animations) |
| `app/globals.css` | Base styles, utilities, keyframes |
| `prisma/seed.ts` | Demo data (run `npm run db:seed`) |

---

*This document is the single source of truth for FieldOS. Any AI or developer can pick this up and understand the product, architecture, and remaining work.*