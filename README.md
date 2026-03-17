# Wolo

Decentralized marketplace for X (Twitter) content creation services, powered by Solana escrow and on-chain reputation.

## What It Does

Wolo connects brands and individuals who need X content with creators who produce it. All payments flow through native SOL escrow on Solana — no intermediary holds the funds.

- **Offers** — creators list their services (posts, threads) with pricing and deadlines
- **Requests** — buyers post what they need; creators apply and the buyer picks one
- **Escrow** — funds lock on-chain, release on delivery or after dispute resolution
- **Payroll** — recurring contracts with weekly/monthly periods and auto-release deadlines
- **Reputation** — on-chain wallet tracking ratings, badges, and completed orders
- **AI Search** — Groq-powered chatbot to find services or get marketplace context
- **Chat** — real-time messaging between buyer and seller per order

## Tech Stack

| Layer | Tools |
|-------|-------|
| Frontend | Next.js 14 (App Router), React, TypeScript, shadcn/ui, Tailwind, Framer Motion |
| Backend | Next.js API routes, Supabase (PostgreSQL) |
| Blockchain | Solana (Anchor 0.32.1) — `woland_escrow` + `woland_reputation` programs |
| Wallet | Solana Wallet Adapter (Phantom, Solflare) |
| AI | Groq API |
| Verification | twitterapi.io (X handle oracle) |
| Email | Resend |


## Project Structure

```
src/
  app/(app)/          — Pages: dashboard, marketplace, orders, services, profile, admin
  app/api/            — API routes: escrow, orders, services, ratings, auth, chat, cron
  components/         — UI: ServiceCard, ChatPanel, MilestonePanel, PayrollTimeline, RatingModal
  hooks/              — React Query hooks for all data fetching
  lib/                — Solana helpers, AI agent, utilities
  server/             — Storage layer, auth, notifications
  shared/             — Schema definitions, route contracts
programs/
  woland_escrow/      — Anchor program: deposit, release, milestones, disputes
  woland_reputation/  — Anchor program: reputation wallets, badges, ratings
```

## License

Proprietary. All rights reserved.
