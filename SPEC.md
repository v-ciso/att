# FieldOS — AT&T Retail Sales Management Platform
## Complete Product Specification

---

### 1. Executive Summary

**Product Name:** FieldOS  
**Tagline:** "Command Your Field. Own Your Numbers."  
**Target Market:** AT&T Retail Market Owners (Tier 5) → expand to B2B owners, other carriers  
**Pricing Model:** B2B SaaS — $297/mo per market owner (white-label: +$197/mo)  
**Distribution:** Direct sales via soramimarketing.com/the-toolkit.html  
**Deployment:** Vercel (primary) / Replit (fallback)  
**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Prisma + PostgreSQL, NextAuth.js, Stripe, Three.js + Chart.js, html2pdf.js

---

### 2. Business Model & User Hierarchy

#### 2.1 Campaign Structure (AT&T Retail)
```
Market Owner (Tier 5) ← YOU ARE HERE
    │
    ├── ASM / AD (Assistant Director)
    │       │
    │       └── Team Leads (multiple)
    │               │
    │               └── Sales Reps / Interns
    │
    └── Direct Reports (Leads without ASM)
```

#### 2.2 Role Definitions & Permissions

| Role | Tier | Commission Override | Can Manage | Dashboard Access |
|------|------|---------------------|------------|------------------|
| Market Owner | 5 | Full P&L, all overrides | Everyone | Full + Admin |
| ASM / AD | 4 | % of Leads + Reps | Leads, Reps | Full |
| Team Lead | 3 | $5/line above Rep | Reps | Team View |
| Sales Rep / Intern | 1-2 | Base commission | Self | Personal View |

#### 2.3 Promotion Timeline
- **Intern → Rep:** 2-4 weeks (hitting minimums)
- **Rep → Lead:** 3-6 months (consistent production, teaching)
- **Lead → ASM:** 6-12 months (team revenue, leadership)
- **ASM → Market Owner:** 12-24 months (P&L ownership, multi-location)

---

### 3. Core Product Modules

#### 3.1 Dashboard (Command Center)
**Purpose:** Morning meeting centerpiece — real-time pulse of the business

**Key Metrics (Real-time):**
- Daily Production (lines, premium mix, revenue)
- Weekly Production (rolling 7-day)
- MTD vs Goal (lines, premium, fiber, revenue)
- Attendance % (today + weekly trend)
- Top 3 Performers (auto-ranked)
- Commission Trend (7-day sparkline)
- Product Mix (doughnut: Premium/Extra/Value/Fiber/Accessories)

**Visual Requirements:**
- 3D orbital background (Three.js) — subtle, performant
- Glassmorphism cards with animated gradient borders
- Neon accent colors per metric (Blue=Production, Purple=Weekly, Green=Revenue, Yellow=Premium, Cyan=Fiber)
- Slide-in stagger animations (60fps)
- Mobile-first: 2-col grid → 4-col desktop

#### 3.2 Leaderboard (Competitive Intelligence)
**Purpose:** Gamified performance tracking with full edit capability

**Features:**
- Editable table (contenteditable + programmatic sync)
- Rows: Rank, Name, Store, Lines, Premium, Fiber, Commission
- Team rows (aggregated) visually distinct
- Inline editing → auto-save (debounced 500ms)
- Reset to defaults button
- Export to PDF/CSV
- Drag-to-reorder (future)

**Data Model:**
```typescript
interface LeaderboardEntry {
  id: string;
  rank: number;
  name: string;
  store: 'Costco' | 'Target' | "BJ's" | 'Custom';
  lines: number;
  premium: number;
  fiber: number;
  commission: number;
  role: 'rep' | 'lead' | 'team' | 'asm';
  teamId?: string;
  userId?: string; // links to User if claimed
}
```

#### 3.3 Meeting Mode (Presentation Engine)
**Purpose:** Full-screen, TV-ready morning standup presentation

**Requirements:**
- **Auto-fullscreen** on load (requestFullscreen API)
- **AirPlay/Chromecast ready** — viewport adapts to external display
- **Keyboard shortcuts:** Space=Next, ←/→=Navigate, Esc=Exit
- **Daily Trackers** (editable, large type):
  - Today's Lines (big number)
  - Top Rep (name)
  - Attendance % (big number)
  - Goal Progress % (big number)
- **Teams Overview** (4-up grid):
  - Team name, % vs goal, Lines/Premium/Fiber, progress bar
  - All editable inline
- **Auto-hide cursor** after 3s inactivity
- **High contrast mode** toggle for projector visibility

#### 3.4 P&L / Expenses (Financial Command)
**Purpose:** Monthly profit tracking with roadtrip reimbursement logic

**Revenue Categories:**
- Commission (auto-calculated from leaderboard)
- Bonuses (manual entry)
- Spiff income (manual)

**Expense Categories:**
- Payroll (base + commission payout)
- Rent (per location)
- Travel (gas, hotels, meals)
- Roadtrips (special: 60% AT&T reimbursed)
- Marketing/Swag
- Software/Tools
- Other

**Roadtrip Logic:**
```
Roadtrip Cost: $X,XXX
AT&T Reimbursement: 60% ($X,XXX × 0.60)
Net Cost to Office: 40% ($X,XXX × 0.40)
```
- Track per trip: date, location, attendees, purpose, cost, reimbursement status
- Monthly rollup: Total Roadtrips, Total Reimbursed, Net Cost

**Visual:** Side-by-side Revenue vs Expenses cards → Net Profit hero card with margin %

#### 3.5 Commission Engine (The Money Machine)
**Purpose:** Single source of truth for all payout calculations — fully editable

##### 3.5.1 Plan Types & Base Payouts (Tier 5 — Current)

**EDITABLE**)
```typescript
const PHONE_PLANS = {
  'Premium 2.0': 35,
  'Premium 2.0 + Next Up': 40,
  'Extra 2.0': 30,
  'Value 2.0': 20,
  'Upgrades': 15,
  'Next Up Anytime (addon)': 10, // +$10 on any plan
};

const FIBER_PLANS = {
  'Internet Air': 25,
  'Fiber 300': 25,
  'Fiber 500': 35,
  'Fiber 1GIG': 50,
  'Fiber 2GIG': 75,
  'Fiber 5GIG': 100,
};
```

##### 3.5.2 Store Multipliers (EDITABLE)
```typescript
const STORE_MULTIPLIERS = {
  'Costco': 1.0,   // baseline
  'Target': 1.0,   // same tier
  "BJ's": 1.0,     // same tier
  'Custom': 1.0,
};
```

##### 3.5.3 Role Overrides (EDITABLE — $5 steps typical)
```typescript
const ROLE_OVERRIDES = {
  'Sales Rep / Intern': 0,      // base
  'Team Lead': 5,               // +$5/line
  'ASM / AD': 0.10,             // 10% of team's gross commission
  'Market Owner': 0.15,         // 15% of office gross (after ASM)
};
```
**Override Types:** Flat $/line OR % of subordinate gross

##### 3.5.4 Commission Calculation Flow
```
1. Rep sells line → Base payout (plan + store multiplier)
2. Rep gets: Base + Role Override (if Lead+)
3. Lead gets: $5/line on Rep's lines (if Lead)
4. ASM gets: 10% of (Lead override + Rep base) for their tree
5. Owner gets: 15% of office gross (after ASM cut)
```

**UI:** Tabbed editor (Phone / Fiber / Overrides / Stores) with live preview calculator

#### 3.6 Goals & Attendance (Daily Discipline)

**Goals (Weekly, editable per role):**
- Total Lines (office: 1000, per rep: 25)
- Premium Lines (office: 350, per rep: 9)
- Fiber Lines (office: 150, per rep: 4)
- Revenue Target (auto from commission engine)
- Attendance Target (95%)

**Attendance Tracking:**
- Daily check-in (mobile-friendly, one-tap)
- Statuses: Present, Late, Absent, Excused, Roadtrip
- Weekly rollup % (Present / Total Expected)
- Streak tracking (consecutive days present)
- Export for payroll

#### 3.7 Team Management (Org Builder)

**Features:**
- Create teams (name, color, lead)
- Assign members (drag-drop or multi-select)
- Team-level goals (cascaded from office)
- Team commission pool view
- Transfer members between teams
- Archive/restore teams
- Team avatar/logo upload

**Data Model:**
```typescript
interface Team {
  id: string;
  name: string;
  color: string; // hex for UI theming
  leadId: string; // User ID
  memberIds: string[];
  goals: WeeklyGoals;
  createdAt: Date;
  archivedAt?: Date;
}
```

#### 3.8 White-Label System (Revenue Multiplier)

**Customizable per Client:**
- Logo (SVG/PNG, auto-dark/light)
- Primary/Secondary color palette (generates CSS variables)
- Company name (replaces "FieldOS" in UI)
- Custom domain (CNAME → Vercel)
- Branded PDF exports (watermark, footer)
- Login page branding
- Email templates (invites, reports)
- Feature flags (hide P&L, hide Commission Engine, etc.)

**Implementation:** Theme context + CSS variables + build-time config

---

### 4. Technical Architecture

#### 4.1 Project Structure
```
fieldos/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Login, register, password reset
│   ├── (dashboard)/       # Protected dashboard routes
│   │   ├── dashboard/     # Main dashboard
│   │   ├── leaderboard/   # Leaderboard
│   │   ├── meeting/       # Meeting mode
│   │   ├── pnl/           # P&L
│   │   ├── commission/    # Commission engine
│   │   ├── goals/         # Goals & attendance
│   │   ├── teams/         # Team management
│   │   └── settings/      # White-label, billing, users
│   ├── api/               # API routes
│   │   ├── auth/          # NextAuth
│   │   ├── webhooks/      # Stripe webhooks
│   │   ├── leaderboard/   # CRUD
│   │   ├── teams/         # CRUD
│   │   ├── commission/    # Calculation engine
│   │   └── export/        # PDF generation
│   └── globals.css
├── components/
│   ├── ui/                # Base components (Button, Card, Input, Table, Modal)
│   ├── charts/            # Chart wrappers (Three.js, Chart.js)
│   ├── dashboard/         # Dashboard-specific
│   ├── leaderboard/       # Leaderboard-specific
│   ├── meeting/           # Meeting mode
│   ├── pnl/               # P&L components
│   ├── commission/        # Commission editor
│   ├── teams/             # Team management
│   └── white-label/       # Theme provider, branded components
├── lib/
│   ├── auth.ts            # NextAuth config
│   ├── db.ts              # Prisma client
│   ├── stripe.ts          # Stripe client
│   ├── commission.ts      # Calculation engine (pure functions)
│   ├── theme.ts           # White-label theme generator
│   ├── pdf.ts             # PDF generation
│   └── utils.ts           # Helpers
├── hooks/                 # Custom React hooks
├── types/                 # TypeScript definitions
├── prisma/
│   └── schema.prisma      # Database schema
├── public/                # Static assets
└── middleware.ts          # Auth protection, theme injection
```

#### 4.2 Database Schema (Prisma + PostgreSQL)

```prisma
// Core models
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String
  name          String
  role          Role      @default(REP)
  employeeId    String?   @unique
  avatarUrl     String?
  teamId        String?
  team          Team?     @relation(fields: [teamId], references: [id])
  marketOwnerId String?   // for multi-tenant white-label
  marketOwner   MarketOwner? @relation(fields: [marketOwnerId], references: [id])
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  // Relations
  attendances   Attendance[]
  goals         Goal[]
  commissions   Commission[]
}

model MarketOwner {
  id            String    @id @default(cuid())
  name          String
  slug          String    @unique // for subdomain/white-label
  stripeCustomerId String?
  stripeSubscriptionId String?
  subscriptionTier SubscriptionTier @default(STANDARD)
  theme         Json      // White-label config
  users         User[]
  teams         Team[]
  leaderboardEntries LeaderboardEntry[]
  expenses      Expense[]
  roadtrips     Roadtrip[]
  commissionRules CommissionRule[]
  goals         Goal[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Team {
  id            String    @id @default(cuid())
  name          String
  color         String    @default("#3B82F6")
  leadId        String
  lead          User      @relation("TeamLead", fields: [leadId], references: [id])
  members       User[]    @relation("TeamMembers")
  marketOwnerId String
  marketOwner   MarketOwner @relation(fields: [marketOwnerId], references: [id])
  goals         Json      // WeeklyGoals
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model LeaderboardEntry {
  id            String    @id @default(cuid())
  marketOwnerId String
  marketOwner   MarketOwner @relation(fields: [marketOwnerId], references: [id])
  userId        String?
  user          User?     @relation(fields: [userId], references: [id])
  rank          Int
  name          String
  store         StoreType
  lines         Int
  premium       Int
  fiber         Int
  commission    Float
  role          Role
  teamId        String?
  team          Team?     @relation(fields: [teamId], references: [id])
  date          DateTime  @default(now())
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Expense {
  id            String        @id @default(cuid())
  marketOwnerId String
  marketOwner   MarketOwner   @relation(fields: [marketOwnerId], references: [id])
  category      ExpenseCategory
  amount        Float
  description   String
  date          DateTime
  isRecurring   Boolean       @default(false)
  createdAt     DateTime      @default(now())
}

model Roadtrip {
  id            String        @id @default(cuid())
  marketOwnerId String
  marketOwner   MarketOwner   @relation(fields: [marketOwnerId], references: [id])
  name          String
  location      String
  startDate     DateTime
  endDate       DateTime
  totalCost     Float
  reimbursed    Float         // 60% typically
  status        RoadtripStatus @default(PENDING)
  attendees     String[]      // User IDs
  createdAt     DateTime      @default(now())
}

model CommissionRule {
  id            String        @id @default(cuid())
  marketOwnerId String
  marketOwner   MarketOwner   @relation(fields: [marketOwnerId], references: [id])
  category      CommissionCategory // PHONE, FIBER, OVERRIDE, STORE
  planName      String
  baseAmount    Float
  multiplier    Float         @default(1.0)
  overrideType  OverrideType? // FLAT, PERCENT
  overrideValue Float?
  appliesToRole Role?
  isActive      Boolean       @default(true)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
}

model Goal {
  id            String        @id @default(cuid())
  marketOwnerId String
  marketOwner   MarketOwner   @relation(fields: [marketOwnerId], references: [id])
  userId        String?
  user          User?         @relation(fields: [userId], references: [id])
  teamId        String?
  team          Team?         @relation(fields: [teamId], references: [id])
  period        GoalPeriod    // WEEKLY, MONTHLY
  linesTarget   Int
  premiumTarget Int
  fiberTarget   Int
  revenueTarget Float
  attendanceTarget Float     // percentage
  weekStart     DateTime
  createdAt     DateTime      @default(now())
}

model Attendance {
  id            String            @id @default(cuid())
  userId        String
  user          User              @relation(fields: [userId], references: [id])
  date          DateTime
  status        AttendanceStatus  // PRESENT, LATE, ABSENT, EXCUSED, ROADTRIP
  checkInTime   DateTime?
  checkOutTime  DateTime?
  createdAt     DateTime          @default(now())
}

// Enums
enum Role { OWNER, ASM, LEAD, REP, INTERN }
enum StoreType { COSTCO, TARGET, BJS, CUSTOM }
enum ExpenseCategory { PAYROLL, RENT, TRAVEL, ROADTRIP, MARKETING, SOFTWARE, OTHER }
enum RoadtripStatus { PENDING, APPROVED, REIMBURSED, DENIED }
enum CommissionCategory { PHONE, FIBER, OVERRIDE, STORE }
enum OverrideType { FLAT, PERCENT }
enum GoalPeriod { WEEKLY, MONTHLY }
enum AttendanceStatus { PRESENT, LATE, ABSENT, EXCUSED, ROADTRIP }
enum SubscriptionTier { STANDARD, WHITE_LABEL }
```

#### 4.3 Security Requirements

**Authentication:**
- NextAuth.js with credentials + email magic links
- bcryptjs (12 rounds) for password hashing
- JWT sessions (httpOnly, Secure, SameSite=Strict)
- Rate limiting: 5 attempts/15min per IP

**Authorization:**
- Role-based access control (RBAC) on every API route
- Market owner isolation (multi-tenant row-level security)
- API route middleware validates ownership

**Input Validation:**
- Zod schemas on ALL API inputs
- ContentEditable sanitization (DOMPurify on client + server)
- SQL injection prevention (Prisma parameterized queries)
- XSS prevention (CSP headers, no dangerouslySetInnerHTML)

**Headers (next.config.js):**
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.stripe.com;
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

**Stripe Security:**
- Webhook signature verification
- Idempotency keys on all charges
- Never log full card details
- PCI SAQ-A compliance (Stripe Elements)

#### 4.4 Performance Targets
- **LCP < 2.5s** (dashboard)
- **TTI < 3.5s**
- **CLS < 0.1**
- **Bundle size < 200KB gzipped** (initial)
- **60fps animations** (meeting mode, charts)
- **Offline-first** (Service Worker for meeting mode)

---

### 5. UI/UX Design System

#### 5.1 Color Palette (Dark Mode Default)
```css
:root {
  /* Base */
  --bg-primary: #000000;
  --bg-secondary: #0A0A0F;
  --bg-tertiary: #111318;
  --bg-card: rgba(255,255,255,0.03);
  --border-subtle: rgba(255,255,255,0.08);
  --border-strong: rgba(255,255,255,0.15);

  /* Text */
  --text-primary: #FFFFFF;
  --text-secondary: #9CA3AF;
  --text-muted: #6B7280;
  --text-inverse: #000000;

  /* Accents (Neon) */
  --accent-blue: #3B82F6;
  --accent-blue-glow: rgba(59,130,246,0.4);
  --accent-purple: #A855F7;
  --accent-purple-glow: rgba(168,85,247,0.4);
  --accent-cyan: #06B6D4;
  --accent-cyan-glow: rgba(6,182,212,0.4);
  --accent-green: #10B981;
  --accent-yellow: #F59E0B;
  --accent-orange: #F97316;
  --accent-red: #EF4444;

  /* Gradients */
  --grad-blue: linear-gradient(135deg, #60A5FA, #3B82F6, #2563EB);
  --grad-purple: linear-gradient(135deg, #C084FC, #A855F7, #7C3AED);
  --grad-cyan: linear-gradient(135deg, #67E8F9, #06B6D4, #0891B2);
  --grad-green: linear-gradient(135deg, #6EE7B7, #10B981, #059669);
  --grad-card: linear-gradient(135deg, rgba(17,24,39,0.9), rgba(0,0,0,0.95));

  /* Glass */
  --glass-bg: rgba(255,255,255,0.03);
  --glass-border: rgba(255,255,255,0.08);
  --glass-hover: rgba(255,255,255,0.06);
}
```

**White-Label Override:** All accents become CSS variables generated from client's primary/secondary hex.

#### 5.2 Typography
- **Font:** Inter (300-900) — self-hosted for performance
- **Scale:** clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem) base
- **Headings:** 700 weight, tight tracking
- **Numbers:** Tabular numerals (font-variant-numeric: tabular-nums)

#### 5.3 Component Library (Build First)
| Component | Variants | States |
|-----------|----------|--------|
| Button | primary, secondary, ghost, danger, accent-{blue,purple,cyan} | hover, active, disabled, loading |
| Card | glass, elevated, bordered, neon-{color} | hover, focus |
| Input | text, number, select, textarea | error, success, disabled |
| Table | striped, hover, editable, compact | sorting, loading |
| Modal | default, fullscreen, drawer | open, closing |
| Badge | neutral, success, warning, danger, accent-{color} | - |
| Avatar | sm, md, lg, xl, group | - |
| Tooltip | top, bottom, left, right | - |
| Dropdown | default, searchable, multi | - |
| Tabs | line, pill, underline | active, disabled |
| Progress | linear, circular, gradient | indeterminate |
| ChartWrapper | line, area, bar, doughnut, 3d-pie, 3d-bar | loading, error |

#### 5.4 Animation Principles
- **Duration:** 150ms (micro), 300ms (standard), 500ms (macro)
- **Easing:** cubic-bezier(0.4, 0, 0.2, 1) — Material standard
- **Stagger:** 50ms per item (lists, grids)
- **Reduced Motion:** Respect `prefers-reduced-motion`

#### 5.5 Mobile Breakpoints
```
xs: 320px   (iPhone SE)
sm: 375px   (iPhone 12/13/14)
md: 428px   (iPhone 14 Pro Max)
lg: 768px   (iPad)
xl: 1024px  (Desktop)
2xl: 1440px (Wide)
```

#### 5.6 Meeting Mode Specifics
- **Font sizes:** 2.5x desktop base (minimum 32px for numbers)
- **Touch targets:** 56×56px minimum
- **Safe area insets** for notched devices
- **Landscape lock** option for presentation

---

### 6. Stripe Integration (Billing)

#### 6.1 Products & Prices
```typescript
const STRIPE_PRODUCTS = {
  standard: {
    name: 'FieldOS Standard',
    priceId: 'price_standard_monthly',
    amount: 29700, // $297.00
    interval: 'month',
    features: ['Full dashboard', 'Leaderboard', 'Meeting mode', 'P&L', 'Commission engine', 'Goals/Attendance', 'Teams', 'PDF export', 'Up to 50 users'],
  },
  whiteLabel: {
    name: 'FieldOS White-Label',
    priceId: 'price_whitelabel_monthly',
    amount: 49400, // $494.00 ($297 + $197)
    interval: 'month',
    features: ['Everything in Standard', 'Custom branding', 'Custom domain', 'Branded PDFs', 'White-label login', 'Priority support', 'Unlimited users'],
  },
};
```

#### 6.2 Billing Flow
1. Market owner signs up → Creates Stripe Customer
2. Selects tier → Creates Subscription (trial: 14 days)
3. Webhook: `customer.subscription.created` → Update MarketOwner.subscriptionTier
4. Webhook: `invoice.payment_failed` → Email + grace period (7 days)
5. Webhook: `customer.subscription.deleted` → Downgrade to read-only

#### 6.3 Portal
- Stripe Billing Portal for self-serve (update card, cancel, invoices)
- Embedded in Settings → Billing

---

### 7. API Specification (Key Endpoints)

#### 7.1 Authentication
```
POST   /api/auth/register           # Register market owner + first user
POST   /api/auth/login              # Credentials login
POST   /api/auth/magic-link         # Request magic link
GET    /api/auth/callback           # Magic link verify
POST   /api/auth/logout             # Sign out
GET    /api/auth/session            # Get session
```

#### 7.2 Dashboard
```
GET    /api/dashboard/stats         # Real-time stats for cards
GET    /api/dashboard/charts        # Chart data (commission trend, product mix)
GET    /api/dashboard/top-performers # Top 3 for dashboard
```

#### 7.3 Leaderboard
```
GET    /api/leaderboard             # List entries (paginated, filterable)
POST   /api/leaderboard             # Create entry
PATCH  /api/leaderboard/[id]        # Update entry (inline edit)
DELETE /api/leaderboard/[id]        # Delete entry
POST   /api/leaderboard/reset       # Reset to defaults
POST   /api/leaderboard/bulk        # Bulk update (CSV import)
```

#### 7.4 Teams
```
GET    /api/teams                   # List teams
POST   /api/teams                   # Create team
PATCH  /api/teams/[id]              # Update team
DELETE /api/teams/[id]              # Archive team
POST   /api/teams/[id]/members      # Add members
DELETE /api/teams/[id]/members/[userId] # Remove member
PATCH  /api/teams/[id]/lead         # Change lead
```

#### 7.5 Commission Engine
```
GET    /api/commission/rules        # Get all rules
POST   /api/commission/rules        # Create rule
PATCH  /api/commission/rules/[id]   # Update rule
DELETE /api/commission/rules/[id]   # Delete rule
POST   /api/commission/calculate    # Calculate commissions (preview)
GET    /api/commission/payouts      # Generated payouts per user
```

#### 7.6 P&L / Expenses
```
GET    /api/expenses                # List expenses (filter by month, category)
POST   /api/expenses                # Create expense
PATCH  /api/expenses/[id]           # Update expense
DELETE /api/expenses/[id]           # Delete expense
GET    /api/roadtrips               # List roadtrips
POST   /api/roadtrips               # Create roadtrip
PATCH  /api/roadtrips/[id]          # Update roadtrip
GET    /api/pnl/[month]             # P&L summary for month
```

#### 7.7 Goals & Attendance
```
GET    /api/goals                   # List goals (office, team, user)
POST   /api/goals                   # Create/update goal
GET    /api/attendance              # List attendance (filter by date, user, team)
POST   /api/attendance              # Check in/out
GET    /api/attendance/summary      # Weekly/monthly rollup
```

#### 7.8 White-Label
```
GET    /api/whitelabel/config       # Get theme config
PATCH  /api/whitelabel/config       # Update theme config
POST   /api/whitelabel/logo         # Upload logo
POST   /api/whitelabel/domain       # Verify custom domain
```

#### 7.9 Export
```
POST   /api/export/pdf              # Generate PDF (dashboard, leaderboard, P&L)
POST   /api/export/csv              # Generate CSV (leaderboard, attendance, commissions)
```

---

### 8. Charts & Visualizations (3D Priority)

#### 8.1 Chart.js (2D — Reliable, Fast)
- Commission Trend: Gradient area chart (7/30/90 day)
- Product Mix: Doughnut with center label
- Attendance: Horizontal bar (team comparison)
- Goals: Progress rings (circular)

#### 8.2 Three.js (3D — "Wow" Factor)
- **3D Pie Chart:** Product mix with depth, rotation on hover, slice explosion
- **3D Bar Chart:** Commission by rep/team — bars rise on load
- **3D Funnel:** Sales pipeline (Leads → Qualified → Closed)
- **Orbital Background:** Subtle floating particles (dashboard only)

**Performance:** Lazy-load Three.js only on tabs that need it. Fallback to Chart.js if WebGL unavailable.

#### 8.3 Chart Configuration Standards
```typescript
const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 750, easing: 'easeOutQuart' },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(17,24,39,0.95)',
      titleColor: '#fff',
      bodyColor: '#9CA3AF',
      borderColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      padding: 12,
      cornerRadius: 8,
    },
  },
  scales: {
    x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#6B7280', font: { size: 10 } } },
    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#6B7280', font: { size: 10 } } },
  },
};
```

---

### 9. Mobile & Presentation Features

#### 9.1 PWA Configuration
- `manifest.json`: name, short_name, icons (192, 512), start_url, display: standalone
- Service Worker: Cache shell + meeting mode assets for offline presentation
- "Add to Home Screen" prompt

#### 9.2 Presentation Mode (Meeting Tab)
```typescript
// Auto-fullscreen on mount
useEffect(() => {
  const enter = async () => {
    try {
      await document.documentElement.requestFullscreen();
      screen.orientation?.lock('landscape');
    } catch (e) { /* user denied */ }
  };
  enter();
}, []);

// Viewport adaptation for external displays
const handleResize = () => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  document.documentElement.style.setProperty('--vh', `${vh * 0.01}px`);
  // Adjust font scale based on viewport area
  const scale = Math.min(vw / 1920, vh / 1080) * 1.5;
  document.documentElement.style.setProperty('--presentation-scale', scale);
};
window.addEventListener('resize', handleResize);
```

#### 9.3 AirPlay / Chromecast
- No special code needed — browser handles mirroring
- Ensure `viewport-fit=cover` and safe-area insets
- Test: iPhone → AirPlay → Apple TV (16:9)

---

### 10. Development Phases & Timeline

#### Phase 1: Foundation (Week 1-2)
- [ ] Next.js 14 + TypeScript + Tailwind + Prisma setup
- [ ] NextAuth.js (credentials + magic link)
- [ ] Database schema + migrations
- [ ] Base UI component library (Button, Card, Input, Table, Modal, Tabs)
- [ ] Theme system (CSS variables + context)
- [ ] Middleware (auth, tenant isolation)

#### Phase 2: Core Modules (Week 3-5)
- [ ] Dashboard (stats, Chart.js charts, top performers)
- [ ] Leaderboard (editable table, CRUD, reset, export)
- [ ] Meeting Mode (fullscreen, trackers, teams, keyboard nav)
- [ ] P&L / Expenses / Roadtrips
- [ ] Commission Engine (rule editor, calculator, payout preview)

#### Phase 3: Advanced Features (Week 6-7)
- [ ] Goals & Attendance (check-in, rollups, streaks)
- [ ] Team Management (create, assign, goals cascade)
- [ ] Three.js 3D charts (pie, bar, funnel)
- [ ] White-label system (theme generator, logo upload, custom domain)
- [ ] PDF/CSV exports (all modules)

#### Phase 4: Billing & Polish (Week 8)
- [ ] Stripe integration (subscriptions, portal, webhooks)
- [ ] Security hardening (CSP, rate limits, validation)
- [ ] Performance optimization (bundle analysis, lazy loading)
- [ ] Mobile testing (iOS Safari, Chrome Android)
- [ ] Presentation mode testing (AirPlay, Chromecast, HDMI)
- [ ] Documentation + README

#### Phase 5: Launch Prep (Week 9)
- [ ] Landing page integration (soramimarketing.com)
- [ ] Demo account + seed data
- [ ] Error tracking (Sentry)
- [ ] Analytics (PostHog/Plausible)
- [ ] Deploy to Vercel (production + preview)
- [ ] Load testing

---

### 11. Success Metrics (Post-Launch)

| Metric | Target |
|--------|--------|
| Trial → Paid Conversion | > 25% |
| Monthly Churn | < 5% |
| NPS | > 50 |
| Dashboard Load (p75) | < 2s |
| Meeting Mode FPS | 60fps |
| Support Tickets/Month | < 10 per 100 customers |

---

### 12. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Stripe rejection (high-risk) | Pre-approve via Stripe support; backup: Paddle/LemonSqueezy |
| White-label domain SSL | Vercel auto-SSL + wildcard cert |
| Three.js mobile performance | Fallback to Chart.js; quality settings |
| Data migration (Excel → App) | CSV import wizard + validation |
| Multi-tenant data leakage | Row-level security + integration tests |
| Commission calc errors | Property-based testing + audit log |

---

### 13. Immediate Next Steps

1. **Initialize repo** with spec-compliant structure
2. **Set up Neon/PostgreSQL** database
3. **Configure NextAuth** with magic links (email via Resend)
4. **Build component library** (Storybook optional)
5. **Implement Dashboard** as proof-of-concept

---

*This spec is the single source of truth. All code must trace back to a requirement here. If something is unclear, ask before building.*