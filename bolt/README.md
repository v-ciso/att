# Bolt workspace

This folder is the sandbox for Bolt (bolt.new) experiments.

## Rules for Bolt (and any other AI tool working here)

1. **Work only inside this `bolt/` folder.** Do not modify anything outside it —
   `app/`, `components/`, `lib/`, `prisma/`, config files, and docs at the repo
   root belong to the main Sales Engine app and are managed separately.
2. Prototypes built here are throwaway/reference material. Anything worth
   keeping gets reviewed and re-implemented properly in the main app.
3. Follow the design system in `../DESIGN.md` (Command Center Dark: pure black
   base, semantic neon accents, glass morphism). The visual reference is
   `../engine4.html`.
4. Never commit secrets, API keys, or customer data here.

## Context for prototypes

Sales Engine is a sales-management dashboard for AT&T retail market owners:
leaderboards, team management, commission/payout engine (tiers 1–5, stores,
phone/internet/add-on plans), P&L with roadtrip reimbursement, meeting
presentation mode, goals and attendance. Anything prototyped here should fit
that product.
