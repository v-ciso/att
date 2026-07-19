# FieldOS — AT&T Retail Sales Management Platform

A premium, white-labelable SaaS platform for AT&T Retail Market Owners to manage teams, track commissions, run morning meetings, and monitor P&L — all in one beautiful, mobile-ready dashboard.

## Features

### Core Modules
- **Dashboard** — Real-time stats, 3D charts (Three.js), commission trends, product mix
- **Leaderboard** — Editable team/rep rankings with inline editing
- **Meeting Mode** — Full-screen presentation mode with AirPlay/Chromecast support
- **P&L / Expenses** — Revenue tracking, roadtrip reimbursement (60% AT&T), net profit
- **Commission Engine** — Fully editable tiered payouts (Phone, Fiber, Overrides, Store multipliers)
- **Goals & Attendance** — Weekly targets, daily check-in, streak tracking
- **Team Management** — Create teams, assign leads, cascade goals

### White-Label System
- Custom logo, colors, company name
- Custom domain (CNAME → Vercel)
- Branded PDF exports
- Feature flags per client
- Branded login page

### Billing (Stripe)
- Standard: $297/mo
- White-Label: $494/mo
- Stripe Billing Portal for self-serve
- Webhook-driven subscription sync

### Tech Stack
- **Framework:** Next.js 14 (App Router) + TypeScript
- **Styling:** Tailwind CSS + CSS Variables for theming
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** NextAuth.js (credentials + magic links)
- **Charts:** Chart.js (2D) + Three.js (3D)
- **State:** Zustand + React Hook Form + Zod
- **Payments:** Stripe
- **Deploy:** Vercel (recommended) or Replit

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL database (local or Neon/Supabase)
- Stripe account (for billing)

### Installation

```bash
# Clone and install
cd fieldos
npm install

# Set up environment
cp .env.example .env
# Edit .env with your values

# Database
npx prisma generate
npx prisma db push

# Development
npm run dev
```

Visit `http://localhost:3000`

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Yes | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Yes | Your app URL |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes | Stripe publishable key |
| `STRIPE_PRICE_STANDARD` | Yes | Price ID for $297/mo plan |
| `STRIPE_PRICE_WHITELABEL` | Yes | Price ID for $494/mo plan |
| `NEXT_PUBLIC_APP_URL` | Yes | Public app URL |
| `RESEND_API_KEY` | No | For magic link emails |

### Stripe Setup

1. Create two prices in Stripe Dashboard:
   - **Standard** ($297/mo) → `price_standard_monthly`
   - **White-Label** ($494/mo) → `price_whitelabel_monthly`
   - Set `lookup_key` on each: `standard_monthly` / `whitelabel_monthly`

2. Configure webhook endpoint:
   - URL: `https://yourdomain.com/api/webhooks/stripe`
   - Events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `checkout.session.completed`

3. Enable Stripe Billing Portal in dashboard settings

## Project Structure

```
fieldos/
├── app/
│   ├── (auth)/login/          # Login page
│   ├── (dashboard)/           # Protected dashboard routes
│   │   ├── dashboard/         # Main dashboard
│   │   ├── leaderboard/       # Team leaderboard
│   │   ├── meeting/           # Meeting mode
│   │   ├── pnl/               # P&L
│   │   ├── commission/        # Commission engine
│   │   ├── goals/             # Goals & attendance
│   │   ├── teams/             # Team management
│   │   └── settings/          # White-label + billing
│   ├── api/                   # API routes
│   │   ├── auth/[...nextauth]/ # NextAuth
│   │   ├── leaderboard/       # CRUD
│   │   ├── teams/             # CRUD
│   │   ├── commission/        # Rules + calculation
│   │   ├── expenses/          # CRUD
│   │   ├── roadtrips/         # CRUD
│   │   ├── goals/             # CRUD
│   │   ├── attendance/        # Check-in
│   │   ├── whitelabel/        # Theme config
│   │   ├── stripe/            # Checkout + portal
│   │   └── webhooks/stripe/   # Stripe webhooks
│   ├── globals.css            # Global styles + design tokens
│   ├── layout.tsx             # Root layout
│   └── providers.tsx          # Session + Theme providers
├── components/
│   ├── ui/                    # Base components (Button, Card, Input, etc.)
│   ├── charts/                # Chart.js + Three.js wrappers
│   ├── dashboard/             # Dashboard-specific components
│   ├── white-label/           # ThemeProvider
│   └── ...
├── lib/
│   ├── auth.ts                # NextAuth config
│   ├── db.ts                  # Prisma client
│   ├── commission.ts          # Commission calculation engine
│   ├── theme.ts               # White-label CSS generator
│   ├── utils.ts               # Helpers
│   └── stripe.ts              # Stripe client
├── prisma/
│   └── schema.prisma          # Database schema
└── middleware.ts              # Auth protection
```

## Commission Engine

The commission engine (`lib/commission.ts`) handles:

- **Phone Plans:** Premium 2.0 ($35), Premium+NextUp ($40), Extra 2.0 ($30), Value 2.0 ($20), Upgrades ($15)
- **Fiber Plans:** Fiber 300 ($25), 500 ($35), 1GIG ($50), 2GIG ($75), 5GIG ($100)
- **Add-ons:** Next Up Anytime (+$10)
- **Store Multipliers:** Costco/Target/BJ's (1.0x), Custom
- **Role Overrides:**
  - Rep/Intern: Base
  - Lead: +$5/line on team
  - ASM: 10% of team gross
  - Owner: 15% of office gross (after ASM)

All rules are editable in the database via the Commission tab.

## White-Label Theming

The `ThemeProvider` generates CSS variables from the market owner's config:

```css
:root {
  --wl-primary: #3B82F6;
  --wl-primary-rgb: 59, 130, 246;
  --wl-primary-glow: rgba(59, 130, 246, 0.4);
  --wl-secondary: #A855F7;
  --wl-grad-primary: linear-gradient(135deg, var(--wl-primary), var(--wl-secondary));
}
```

Components use these variables via Tailwind's arbitrary values: `bg-[var(--wl-primary)]`.

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import in Vercel
3. Add environment variables
4. Configure custom domains for white-label clients

### Replit

1. Import from GitHub
2. Set environment variables in Secrets
3. Run `npm run dev`

## Security

- Row-level multi-tenancy via `marketOwnerId`
- Zod validation on all API inputs
- DOMPurify sanitization for contentEditable
- CSP headers in `next.config.js`
- bcrypt (12 rounds) for passwords
- httpOnly, Secure, SameSite=Strict cookies
- Rate limiting on auth endpoints

## License

Proprietary — FieldOS is a commercial product sold via soramimarketing.com/the-toolkit.html