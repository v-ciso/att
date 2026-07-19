# FieldOS Design System — "Command Center Dark"

This is the brand contract for FieldOS. Any agent or tool (Claude Code, Open Design, Bolt, etc.)
producing UI, slides, PDFs, or marketing assets for this project MUST follow it.
The living reference implementation is `engine4.html` (open in a browser) and
`fieldos/tailwind.config.js` (code-level source of truth).

## Identity

- Product: **FieldOS** — the operating system for AT&T Retail Market Owners
- Personality: mission control / command center. Dark, precise, glowing, confident.
- White-label aware: `--wl-primary` / `--wl-secondary` CSS variables may override accents per customer.

## Color

### Base surfaces
| Token | Value | Use |
|---|---|---|
| bg-primary | `#000000` | Page background (pure black, never gray) |
| bg-secondary | `#0A0A0F` | Deep navy panels |
| bg-tertiary | `#111318` | Inputs, progress tracks |
| bg-card | `rgba(255,255,255,0.03)` | Glass cards |
| border-subtle | `rgba(255,255,255,0.08)` | Default borders |
| border-strong | `rgba(255,255,255,0.15)` | Hover borders |
| text-primary | `#FFFFFF` | Headlines, values |
| text-secondary | `#9CA3AF` | Body copy |
| text-muted | `#6B7280` | Labels, captions |

### Semantic accents — every color MEANS something; never decorative
| Color | Hex | Meaning |
|---|---|---|
| Blue | `#3B82F6` | Primary actions, Phone plans, Daily stats |
| Purple | `#A855F7` | Premium tier, Team leads, Weekly stats |
| Cyan | `#06B6D4` | Fiber, Info |
| Green | `#10B981` | Profit, Success, Revenue, Attendance |
| Yellow | `#F59E0B` | Goals, Warnings, Premium Mix |
| Orange | `#F97316` | Roadtrips, 3rd place |
| Red | `#EF4444` | Loss, Danger, Expenses |

Gradients (135deg, light→base→dark of the same hue): `grad-blue`, `grad-purple`,
`grad-cyan`, `grad-green`, `grad-yellow`. Card gradient: `rgba(17,24,39,0.9) → rgba(0,0,0,0.95)`.

## Signature effects

- **Glass morphism cards**: bg 3% white, `backdrop-filter: blur(20px)`, 8% white border,
  shadow `0 8px 32px rgba(0,0,0,0.3)`. Radius: `rounded-2xl` cards, `rounded-xl` buttons/inputs.
- **Neon text** for KPI numbers: gradient `background-clip: text` + `drop-shadow(0 0 20px <accent 50%>)`.
  Classes: `.neon-text-blue|purple|cyan|green|yellow`.
- **Ambient orbs**: 3 fixed blurred circles behind every page — blue top-right, purple bottom-left,
  cyan mid-right. `blur(100px)`, opacity 0.15, `pointer-events: none`.
- **Neon shadows** on emphasis: `0 0 20px <accent 30%>, 0 0 40px <accent 10%>`.

## Typography

- Sans: **Inter** (300–900), Mono: **JetBrains Mono** (data, IDs, code)
- Fluid scale via `clamp()` — see `fontSize.fluid-*` in tailwind config
- KPI values: bold 700–800, neon gradient. Labels: 10px uppercase, tracking-wider, text-muted.

## Motion

- Micro-interactions 150ms ease; standard transitions 300ms `cubic-bezier(0.4, 0, 0.2, 1)`
- Entrances: `slideIn` 600ms (translateY 30px → 0 + fade); stagger children 50ms (`.stagger-1..6`)
- KPI cards breathe: `pulse-glow` 2s infinite
- ALWAYS respect `prefers-reduced-motion` (already globally handled in `globals.css`)

## Components (see `fieldos/components/ui/`)

- Card variants: `glass` (default) / `elevated` / `bordered` / `neon-{color}`
- Buttons: `btn-primary` (blue gradient), `btn-secondary` (glass), `btn-ghost`, `btn-danger`
- Badges: `badge-{blue|purple|cyan|green|yellow|red|gray}` — 10px uppercase pills
- Tabs: `tab-btn` + `.active` (blue 20% bg) / `.inactive` (5% white bg)
- Charts: dark tooltips `rgba(17,24,39,0.95)`, grid lines 5% white, ticks `#666` 9px

## Rules for generated assets (slides, PDFs, mockups)

1. Black background, white text — never invert to light theme.
2. Use the semantic accent meanings above (e.g., revenue numbers are green, never red).
3. One accent dominates per slide/section; don't rainbow.
4. Numbers are the heroes: big, bold, neon. Supporting text stays muted and small.
5. Charts follow the same palette in the same order: blue, purple, cyan, green, yellow, red.
