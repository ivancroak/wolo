# WOLO -- Full Context for Continuation

You are picking up a Solana marketplace dApp called **Wolo** (formerly Woland). Read this entire file before touching anything. This is not a toy project -- there is real on-chain state on devnet, real Supabase data, and security-critical code. Do not guess. Read files before editing. Match existing patterns exactly.

---

## 1. CONCEPT

Wolo is a **decentralized marketplace for social influence services on X (Twitter)**. Think Fiverr but:
- Payments in native SOL via on-chain escrow (not custodial)
- Milestone-based delivery with on-chain tracking
- E2E encrypted messaging between buyer/seller (NaCl box)
- On-chain reputation system (badges, ratings)
- Dispute resolution via arbiter

**User flow (offers)**: Connect Solana wallet -> Browse marketplace -> Purchase service -> Funds locked in on-chain escrow -> Seller delivers -> Buyer approves -> Funds released -> Both parties rate each other.

**User flow (requests)**: Requester posts request -> Applicants submit proposals -> Requester reviews and accepts one -> Escrow created -> Requester funds on-chain -> Fulfiller delivers -> Requester approves -> Funds released.

**Service categories**: content only. Each can be an "offer" (seller lists) or "request" (buyer posts what they need).

**Pricing models**: fixed (one-time contract) or payroll (recurring weekly/monthly).

**Contract verification**: Automated keyword-based tweet verification. Each order has a required keyword (set by buyer at purchase for offers, auto-copied from service for requests) — disputes are resolved by checking if the seller posted N tweets containing the keyword. Service-level keywords on offers serve as discovery/topic tags only.

---

## 2. TECH STACK

| Layer | Tech | Notes |
|-------|------|-------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript | `src/app/(app)/` for pages, `src/components/` for UI |
| Styling | Tailwind CSS + shadcn/ui (Radix primitives) | `components/ui/` has all base components |
| State | TanStack Query v5 | All data fetching via custom hooks in `src/hooks/` |
| Animation | Framer Motion | Used on all pages |
| Blockchain | Solana (devnet), Anchor 0.32.1 | Two programs in `programs/` |
| Database | Supabase (PostgreSQL + JS client) | Server-side via service_role key |
| Auth | Solana wallet signature + random session tokens | No Supabase Auth -- custom implementation |
| Crypto | tweetnacl (NaCl box) | E2E encrypted chat |

---

## 3. ARCHITECTURE -- CURRENT STATE

```
Browser (Next.js client)
  |-- Solana Wallet Adapter (Phantom/Solflare)
  |-- TanStack Query hooks -> Next.js API routes
  |-- Direct Solana RPC calls for on-chain txs
  |
Next.js API Routes (src/app/api/)
  |-- src/server/auth.ts (session management via DB)
  |-- src/server/storage.ts (SupabaseStorage implements IStorage)
  |-- src/server/notifications.ts (notify helper)
  |-- src/server/rate-limit.ts (in-memory sliding window)
  |
Supabase (PostgreSQL)
  |-- 15 tables: users, profiles, services, orders, watchlist, escrows,
  |   milestones, secure_messages, reputations, ratings, channel_keys,
  |   sessions, notifications, deal_proposals, payroll_periods
  |-- RLS enabled on all tables, service_role bypasses
  |
Solana Devnet
  |-- woland_escrow program: 9yJBgVvpGvvQRWbPNzDAgv9snP8bvoXXS7A8U28nzNd9
  |-- woland_reputation program: 42PrQGNH4pCqyGwxrLMXnfkDzz5CTCFx71y2HjuHK9Vg
  |-- Fee Vault: DzTxz6pPjChXQQ2sgdVsfsrrBGz6L2N1M1vFv3gsSCtw (regular SOL wallet)
  |-- Deploy Wallet: 2MoCBYf5B5S597vXEbZSYAR73278bX2eFDn1yCbXVTAL (~3.36 SOL)
  |-- All payments in native SOL (9 decimals / lamports). No SPL tokens.
```

### Auth Flow
1. Client calls `POST /api/auth/nonce` with walletAddress -> gets random nonce
2. Client signs message `"Sign in to Wolo\nWallet: {addr}\nNonce: {nonce}"` with wallet
3. Client calls `POST /api/auth/login` with walletAddress + base64 signature
4. Server verifies signature via `nacl.sign.detached.verify`, creates user, generates random 32-byte session token, stores in `sessions` table, sets httpOnly cookie
5. All subsequent API calls check cookie via `getSessionUser()` in `src/server/auth.ts`

### On-Chain Escrow Flow (SOL-Only)
1. `initialize_escrow` -- creates PDA escrow account AND transfers SOL in one tx (phase starts at Funded)
2. `advance_phase` -- moves through Funded -> InProgress -> UnderReview (role-restricted)
3. `release_funds` -- depositor approves, lamport transfer from escrow PDA to receiver (minus 5% fee)
4. OR `refund` -- after expiry or dispute window, lamports returned to depositor
5. OR `arbiter_resolve` -- splits funds by bps after dispute
6. `release_action_payout` -- arbiter-signed, pays individual action completers from escrow (95% to completer, 5% fee)
7. `close_escrow` -- reclaims rent + unspent SOL after settlement

### Chat (Direct Messaging)
- Plain text messaging between order participants
- Messages stored in `secure_messages` table (`ciphertext` column holds plain text, `nonce = "PLAINTEXT"`)
- No encryption — all messages visible to platform admins via DB

---

## 4. FILE MAP

```
src/
  app/
    (app)/                    # Authenticated pages (wrapped in AppLayout)
      admin/page.tsx          # Admin dispute resolution panel
      dashboard/page.tsx      # Main dashboard: listings, escrows, orders, sales, chat tabs
      marketplace/page.tsx    # Browse/search services, purchase flow
      orders/[id]/page.tsx    # Single order detail with chat + milestones
      profile/page.tsx        # Profile settings (wallet, X handle, bio)
      services/[id]/page.tsx  # Single service detail
      watchlist/page.tsx      # Watched sellers
    api/
      admin/disputes/         # GET disputed escrows, POST resolve
      admin/init-config/      # GET check config status, POST initialize PlatformConfig on-chain
      auth/login|logout|nonce|user/
      cron/payroll-release/    # POST cron endpoint for auto-releasing payroll periods
      escrow/                 # CRUD + [id]/phase, [id]/milestones, [id]/sync, [id]/periods
      escrow/[id]/periods/    # GET list periods, [periodId]/dispute POST, [periodId]/resolve POST
      milestones/[id]/        # PATCH with role-based auth
      verify/milestone/[milestoneId]/ # GET Twitter/X verification oracle
      my-conversations/        # GET enriched conversation list for chat tab
      my-escrows|my-orders|my-sales|my-services|my-reputation/  # my-orders/my-sales enriched with serviceTitle, twitter handles, escrowPhase
      notifications/          # GET list, PATCH mark read
      orders/                 # CRUD + [id]/messages, [id]/escrow, [id]/verify, [id]/proposals + [proposalId]
      profiles/me/            # GET/PUT
      profiles/verify-email/  # POST send code, PATCH verify code
      ratings/                # POST with participant+duplicate checks
      reputation/[userId]/    # GET public reputation
      services/               # GET list, POST create, [id] detail, [id]/cancel POST, [id]/actions/[actionId]/retry-pay POST
      watchlist/              # CRUD + check + ids
  components/
    ChatPanel.tsx             # Plain text chat with deal proposal timeline
    CreateServiceModal.tsx    # Service/request creation form
    DealProposalCard.tsx      # Proposal diff card with accept/reject/withdraw
    ProposeChangesModal.tsx   # Modal form for creating deal proposals
    MilestonePanel.tsx        # Milestone management UI + verification oracle
    Navbar.tsx                # Top nav with NotificationBell
    NotificationBell.tsx      # Bell icon + dropdown
    PayrollTimeline.tsx       # Payroll period progress bar + timeline with dispute buttons
    PurchaseModal.tsx         # Purchase flow with escrow creation + payroll period selector
    RatingModal.tsx           # Star rating + on-chain submission
    ServiceCard.tsx           # Service listing card
    ui/alert-dialog.tsx       # shadcn/ui AlertDialog (used in service cancel confirmation)
    SolanaProvider.tsx        # Wallet adapter provider
    Providers.tsx             # All providers wrapper (Query, Wallet, Theme)
  hooks/
    use-auth.ts               # Login/logout/user mutations
    use-conversations.ts      # Conversation list hook for chat tab
    use-deal-proposals.ts     # Proposal list/create/patch hooks
    use-escrow.ts             # Escrow CRUD hooks
    use-payroll-periods.ts    # Payroll periods list + dispute hooks
    use-notifications.ts      # Notifications + unread count
    use-orders.ts             # Order CRUD hooks
    use-reputation.ts         # Reputation + rating hooks
    use-secure-messages.ts    # Plain text message send/fetch
    use-services.ts           # Service list/create hooks
    use-solana-escrow.ts      # On-chain escrow transaction builders
    use-solana-reputation.ts  # On-chain reputation transaction builders
    use-wallet.tsx            # Wallet connection state + auto-login (module-level dedup, no auto-reputation)
    use-verification.ts       # Twitter/X verification mutation hook
    use-watchlist.ts          # Watchlist hooks
  lib/
    queryClient.ts            # TanStack Query config (staleTime: Infinity)
    supabase/client.ts        # Browser Supabase client (anon key)
    supabase/server.ts        # Server Supabase client (service_role, lazy proxy)
    solana/
      deploy-wallet.ts        # Server-only deploy wallet keypair (import "server-only")
      escrow-client.ts        # Anchor escrow program client
      idl.ts                  # Hand-written IDL + program IDs
      reputation-client.ts    # Anchor reputation program client
      setup.ts                # Anchor provider/connection setup
  server/
    auth.ts                   # Session management (random tokens in DB)
    nonce-store.ts            # In-memory nonce store with auto-cleanup
    email.ts                  # Resend email wrapper (sendEmail, silent on failure)
    notifications.ts          # notify() helper for inserting notifications + optional email
    rate-limit.ts             # In-memory sliding window rate limiter
    storage.ts                # SupabaseStorage class (implements IStorage)
    twitter-client.ts         # HTTP client for twitterapi.io (retweeters, follow check)
    verification.ts           # Keyword-based contract verification (verifyContract)
    with-rate-limit.ts        # checkRateLimit(), getClientIp(), checkSessionRateLimit() helpers
  shared/
    models/auth.ts            # User + UpsertUser interfaces
    schema.ts                 # All TypeScript types + Zod schemas
    routes.ts                 # API route definitions with Zod input/output schemas

programs/
  woland_escrow/src/lib.rs    # Anchor escrow program (537+ lines)
  woland_reputation/src/lib.rs # Anchor reputation program (327 lines)

supabase/
  migration.sql               # Full schema (13 tables, indexes, RLS)
  migration-v2.sql            # V2: 4 categories, 2 pricing, contract params, drop action_completions
  migration-v3-audit.sql      # V3: unique twitter_handle, unique rating, query indexes
  migration-v3.sql            # V4: content-only categories (deactivate + constraint)
  migration-v4-keyword.sql    # V5: required_keyword on orders for buyer-specified verification
  migration-v4-content-type.sql # V5: content_type on services (posts/threads/mixed)
  migration-v5-negotiate.sql  # V6: deal_proposals table, negotiated_* on orders, email on profiles
  migration-v6-payroll.sql  # V7: payroll_periods table, recurring columns on escrows
  migration-v7-email-codes.sql # V7b: email verification codes
  migration-v8-orders-status.sql # V8: add 'pending_approval' to orders.status CHECK
  seed.sql                    # Test data (3 users, 3 content services)

_agents/                      # Multi-agent workflow coordination
  architecture.md             # Living architecture document (versioned)
  king_output.md              # King agent work log
  worker_output.md            # Worker agent work log
  audit_output.md             # Auditor agent review log
  advisor_output.md           # Advisor agent discussion log
  changelog.md                # Change history
  coder_output.md             # Archive from Cycles 1-2 (read-only)
  prompts/                    # Agent role definitions

workflow.md                   # Multi-agent workflow handbook
```

---

## 5. ON-CHAIN PROGRAM DETAILS

### Escrow Program (9yJBgVvpGvvQRWbPNzDAgv9snP8bvoXXS7A8U28nzNd9)
- **State**: PlatformConfig (1 global PDA), EscrowAccount (per-escrow PDA with 10 milestone slots)
- **Phases**: AwaitingDeposit(0, legacy) -> Funded(1) -> InProgress(2) -> UnderReview(3) -> Released(5) or Refunded(6) or Disputed(7). Also MilestoneCheck(4).
- **SOL-only**: All payments in native SOL via lamport manipulation. No SPL tokens, no vault PDA.
- **Fee**: 5% (500 bps), deducted on release/payout, sent to fee_vault
- **Instructions**: initialize_escrow (init+fund), advance_phase, release_funds, release_milestone, refund, arbiter_resolve, release_action_payout (new), close_escrow
- **Security**: PDA seeds validated, signer checks, Box<Account> for stack safety, checked arithmetic everywhere
- **Key accounts**: config PDA `[b"config"]`, escrow PDA `[b"escrow", depositor, escrow_id]` (holds SOL directly)

### Reputation Program (42PrQGNH4pCqyGwxrLMXnfkDzz5CTCFx71y2HjuHK9Vg)
- **State**: ReputationAccount (per-user PDA), RatingRecord (per-rater-per-escrow PDA)
- **Security**: record_completion/record_dispute require escrow program as CPI signer. submit_rating validates escrow account data, checks rater is participant, prevents self-rating, requires Released phase.
- **Badges**: 7 bits -- first_deal, trusted, veteran, top_performer, highly_rated, whale, clean_record

---

## 6. DATABASE TABLES (Supabase)

All snake_case in DB, mapped to camelCase in TypeScript via converter functions in storage.ts.

users, profiles (with email column), services (with required_keyword, min_post_count, posts_per_period, threads_per_period, content_type columns; category CHECK: content; pricing_category CHECK: fixed/payroll; content_type CHECK: posts/threads/mixed), orders (with UNIQUE(service_id, buyer_id) constraint, required_keyword column, 7 negotiated_* override columns), watchlist, escrows (with dispute_opened_at, is_recurring, payroll_basis, total_periods, periods_paid, amount_per_period columns), milestones, secure_messages, reputations, ratings, channel_keys, sessions, notifications, deal_proposals (with partial unique index on pending status per order), payroll_periods (with escrow_id FK, period_number, starts_at, ends_at, dispute_deadline, status CHECK, amount, payout_tx_hash, dispute/resolution fields; UNIQUE(escrow_id, period_number))

**Dropped**: action_completions table (removed in migration-v2)

RLS enabled on all. Service_role key bypasses RLS (used server-side only).

---

## 7. WHAT IS BUILT AND WORKING

- [x] Full Next.js frontend with 7 pages (marketplace, dashboard, orders, profile, services, watchlist, admin)
- [x] Supabase database with 13 tables, persistent storage
- [x] Solana wallet auth with nonce-based signature verification
- [x] Secure session management (random tokens, not wallet address)
- [x] Both smart contracts deployed to devnet
- [x] Fee vault wallet configured (SOL-only, no token accounts needed)
- [x] E2E encrypted chat with proper key exchange
- [x] On-chain escrow flow (initialize, fund, advance, release, refund, arbiter resolve, close)
- [x] On-chain reputation (initialize, record completion, submit rating with validation)
- [x] Milestone-based delivery system
- [x] Admin panel for dispute resolution
- [x] In-app notification system (bell, API, DB)
- [x] Rate limiting infrastructure
- [x] Desync recovery endpoint (POST /api/escrow/[id]/sync)
- [x] Security fixes: auth session tokens, escrow phase state machine, milestone ownership checks, rating participant/duplicate validation, deploy wallet server-only guard, mint validation on all token accounts, self-purchase prevention
- [x] TypeScript compiles clean, Next.js builds clean, Anchor builds clean
- [x] SOL-only escrow rewrite: all SPL token logic removed, native SOL via lamport manipulation, merged init+fund into single instruction, vault PDA eliminated
- [x] Marketplace V2 restructuring: content-only category, 2 pricing models (fixed/payroll), unified contract flow via Order+Escrow, automated keyword-based dispute verification, one contract per wallet per service
- [x] Profile X handle validation with "View on X" link
- [x] Landing page hydration fix (FloatingParticle client-only rendering)
- [x] Canvas2D performance fix (willReadFrequently on TransparentLogo)
- [x] Wallet login dedup fix (module-level guards in use-wallet.tsx prevent double sign-message when multiple components call useWallet)
- [x] Removed auto-reputation initialization from wallet connect flow (reputation account now created on-demand when user first interacts with rating system)
- [x] Twitter/X verification oracle: buyer can verify repost (retweeters API) and follow (relationship API) delivery before approving milestones. Like/ambassador/custom show "manual review". Uses twitterapi.io server-side, evidence-only (no auto-approve).
- [x] PlatformConfig on-chain initialization via admin API route (`POST /api/admin/init-config`): sets arbiter, fee_bps=250 (2.5%), and fee_vault. Admin page shows config status with initialize button.
- [x] Audit Pass 1 fixes: getMilestones ORDER BY (H5), idempotency check for auto-pay double-payment (H3), IP + session rate limiting with `getClientIp`/`checkSessionRateLimit` (H4), 7-day dispute refund window UI (H2), retry-pay endpoint for unpaid verified completions (M1), typed EscrowPhase (M3), `escrow_created` notification type (M2), verify-twitter GET rate limit (N3)
- [x] DB migrations completed: `action_completions` payout columns (payout_amount, payout_tx_hash, paid_at) + `escrows.dispute_opened_at`
- [x] `anchor build` successful: both programs compile, IDL + .so + TS types generated at `target/`
- [x] Audit Pass 2 — Smart Contract fixes: program ID mismatch fixed (declare_id + Anchor.toml + reputation const now match deployed IDs), `release_action_payout` completer constrained to receiver/depositor, rent-exemption checks on partial releases, MilestoneCheck->Disputed transition added, milestone guard on action payouts, fee rounding fixed (round up), minimum escrow amount (10k lamports), reputation byte offset fixed (96 not 128), checked arithmetic in event emissions
- [x] Audit Pass 2 — Backend fixes: Zod validation on service PUT (blocks `active` field injection), escrow sync endpoint validates transitions + rate limited + fixed byte offset, admin dispute resolve uses correct phase (released vs refunded), search sanitization (alphanumeric only), isInfluencer blocked from profile update API (internal-only flag), milestone verification rate limited, HMAC fallback removed (SESSION_SECRET required), twitter_handle uniqueness check, receiverId validated against service creator, escrow amount validated against service price, hasActiveOrder filters by status, price/amount fields validated as positive numbers, order creation race condition mitigated (optimistic locking)
- [x] Audit Pass 2 — UI fixes: PurchaseModal rollback on tx failure (no more false success), phase update cache invalidation (specific escrow + order keys), BigInt-safe SOL-to-lamports conversion, replace("_"," ") regex fix, verification inputs enabled per category, MilestonePanel typed props (Escrow/Milestone), error JSON parsing with .catch(), silent catch blocks log errors
- [x] DB migration-v3-audit.sql: unique twitter_handle index, unique rater+order rating index, missing query indexes
- [x] TypeScript compiles clean, Next.js builds clean after all audit fixes
- [x] Audit Pass 3 — C-3: Stack trace leakage fix: all `throw err` in API catch blocks replaced with generic 500 responses + `console.error`, all `err.message` leaks in notifications and check-blue routes fixed
- [x] Audit Pass 3 — C-4: check-blue endpoint passes `internal: true` to `updateProfile` so `isInfluencer` field actually persists
- [x] Category cleanup: removed space, ambassador, campaign categories — content-only. Updated schema, routes, verification, all UI components, landing page copy, seed data. New migration-v3.sql to enforce DB constraint.
- [x] Keyword redesign: separated discovery keywords (on Service, optional for offers) from verification keywords (on Order, required). Offers: buyer enters required keyword at purchase time in PurchaseModal. Requests: buyer sets keyword on service, auto-copied to order server-side. Verification reads `order.requiredKeyword` first, falls back to `service.requiredKeyword` for backward compat. New migration-v4-keyword.sql adds `required_keyword` column to orders table.
- [x] Content type field: services now specify content_type (posts/threads/mixed). Fixed pricing allows posts or threads. Payroll pricing allows posts, threads, or mixed. Required field in both List Service and Request Service modals. Labels adapt: "Min Thread Count" when threads selected, "Threads per Period" shown for threads/mixed payroll. New migration-v4-content-type.sql adds `content_type` and `threads_per_period` columns.
- [x] Deal negotiation in chat: either party can propose changes to price, deadline, post count, content type, keyword, etc. Proposals displayed inline in chat timeline as diff cards. Counterparty can accept/reject, proposer can withdraw. One pending proposal per order (enforced by DB partial unique index). Accepted proposals write to `orders.negotiated_*` columns. Verification routes use negotiated overrides. Price changes allowed after escrow funding (depositor notified to adjust).
- [x] Email notifications via Resend: `src/server/email.ts` wraps Resend SDK, `notify()` accepts optional `emailTo` + `emailEnabled` params. Emails only sent when `emailVerified && emailNotifications` on profile. 6-digit code verification flow via `/api/profiles/verify-email` (POST send, PATCH verify). Profile page has email input, Verify/Verified badge, code entry UI, and notifications on/off toggle with Switch. Silent no-op if `RESEND_API_KEY` env var is missing.
- [x] Deal Terms card on order detail page: shows effective values (negotiated ?? service) with "Negotiated" badge on overridden fields.
- [x] Escrow funding pre-flight checks: verifies config PDA initialized, escrow PDA doesn't already exist, and sufficient SOL balance before building transaction. Clear error messages instead of opaque simulation failures.
- [x] Proportional dispute resolution: when a seller delivers partial work (e.g. 3 of 5 required posts), funds are split proportionally instead of all-or-nothing. `depositorShareBps = 10000 - round(matchingPosts/requiredPosts * 10000)`. Full delivery → 100% to seller, zero delivery → 100% refund, partial → proportional split. Dashboard toast shows "Partial Delivery" with post counts and percentages.
- [x] One-sided messaging: users can send messages even if the counterparty hasn't unlocked encryption yet. Unencrypted messages use a sentinel nonce (`PLAINTEXT`) and are base64-encoded. Recipient sees them immediately on opening the chat. Small "unencrypted" label shown on plaintext messages.
- [x] Unread message badge on sidebar: Dashboard nav item shows a red badge with unread `message_received` notification count. Uses existing notification polling (30s).
- [x] Chat tab on Dashboard: dedicated 5th tab aggregating all conversations in one place. Shows conversation list with service title, counterparty handle, role badge, order status, and per-conversation unread count. Clicking opens the full ChatPanel in a detail view. Auto-marks unread notifications as read on open. Uses new `/api/my-conversations` endpoint and `useMyConversations` hook.
- [x] Persistent channel key caching: derived encryption keys cached in `localStorage` scoped to wallet address (`wolo_channel_key_{pubkey}`). Messages auto-unlock on return visits without wallet sign popup. Keys cleared on wallet disconnect or wallet change. Public key re-published to server on cache restore.
- [x] Dashboard → Order navigation: Escrows tab has clickable Order # links, Chat tab has ExternalLink icon per conversation, Listings tab has "View Details →" links to service pages.
- [x] PDF Fixes batch: Landing page rewritten (removed likes/reposts/follows, focus on marketing posts), "Fixed Contract" → "Fixed Price" globally, Reference URL validated to X content only, "Deadline (days)" → "Deadline (periods)" for payroll, PurchaseModal period selector changed from preset buttons to free number input, `window.location.reload()` replaced with `queryClient.invalidateQueries` in profile page (prevents wallet disconnect on X verification), escrow APIs enriched with wallet addresses to fix non-base58 error (user IDs were passed to Solana calls instead of wallet addresses), NotificationBell added to AppLayout header (visible on all app pages, not just landing).
- [x] Order detail improvements: deposit tx hash hidden from UI, standalone "Propose Changes" button between Deal Terms and Chat (removed from ChatPanel header), expandable/collapsible chat (Maximize2/Minimize2 toggle), escrow mismatch warning when negotiated price differs from escrow amount.
- [x] Price changes after escrow funding: price field always enabled in ProposeChangesModal (info text shown when escrow funded), server-side price-after-funding block removed from proposals API, depositor notified with escrow adjustment message on price-change accept.
- [x] Audit Pass 2 fixes (Worker batch): AP2-H3 oracle `twitterVerified` guard on 2 routes, AP2-M1 `escapeHtml` in email notifications, AP2-M2 date filtering in verification (tweets before contract start excluded), AP2-N2 `AbortController` 10s timeout on Twitter API calls, AP2-L1 admin wallet hardcoded fallback removed (per-handler env read with 500 on missing), AP2-L3 `TWITTER_VERIFY_SECRET` env var with `SESSION_SECRET` fallback, AP2-L2 `getClientIp` rollout across 9 routes, AP2-N1 milestones 401→403.
- [x] `ADMIN_WALLET_ADDRESS` is now a required env var for admin routes (no more hardcoded fallback). Add to `.env`.
- [x] Audit Pass 2 fixes (King batch): AP2-H2 reputation ESCROW_PROGRAM_ID bytes fixed to `9yJB...` (Rust + idl.ts + sync/route.ts fallbacks), AP2-H1 DISPUTE_WINDOW_SECONDS changed to 7 days in escrow Rust, AP2-H3 `twitterVerified` guard on dispute-resolve oracle route, AP2-M3 deadline-based oracle delay (blocks oracle until seller delivery deadline passes), AP2-N3 private rate limiter in dispute-resolve replaced with shared `checkSessionRateLimit`, AP2-M6 H3 residual cleared (action route removed).
- [x] Audit Pass 3 (confirmation pass for Fix Pass 3): 11/13 AP2 issues confirmed fixed. 2 still-open items + 3 new issues found. Full Anchor security scan on escrow lib.rs — no on-chain vulnerabilities. Redeploy of both programs still required. See `_agents/audit_output.md` for full report.
- [x] Fix Pass 4 (Worker batch): AP2-M2 cursor pagination in `getUserTweets` (up to 5 pages/200 tweets, early-stop on `contractStartDate`), AP3-M1 `getClientIp` rollout to final 9 routes (zero old `x-forwarded-for` instances remain), AP3-L1 `twitterVerified` enforced at service creation (`services/route.ts` POST returns 400 if seller X handle unverified).
- [x] Audit Pass 1 fixes: milestone ordering, rate limit helpers (getClientIp + checkSessionRateLimit), dispute window UI guard, schema payout fields, escrow_created notification type, retry-pay endpoint, verify-twitter rate limit
- [x] Audit Pass 2+3+4 fixes: reputation program ID corrected, dispute window 12h→7days on-chain, twitterVerified check in all 3 oracle routes + service creation, HTML escape in email notifications, tweet cursor pagination 200 tweets, oracle deadline guard fail-closed, admin wallet hardcoded fallback removed, getClientIp rollout to all 18 API routes, TWITTER_VERIFY_SECRET env var, Twitter API 10s timeout, shared rate limiters standardized
- [x] .env.example created documenting all required env vars
- [x] Service cancel/delete: seller can cancel active listings via AlertDialog on service detail page. API route `POST /api/services/[id]/cancel` deactivates service, cancels all active orders, and returns funded escrow info for on-chain refunds. On-chain `seller_cancel` instruction refunds depositor with zero platform fee. Dashboard listings tab links to cancel flow.
- [x] On-chain `seller_cancel` instruction: receiver-initiated full refund (Funded/InProgress/MilestoneCheck/UnderReview phases), deployed to devnet.
- [x] Backpack wallet support: SolanaProvider uses empty wallets array for Wallet Standard auto-detection (Backpack/Phantom/Solflare all auto-detected).
- [x] Landing page rebrand: hero text focuses on marketing posts from influencers, category cards updated to Promotional Posts/Threads & Reviews/Ongoing Campaigns.
- [x] UI text fixes: "Fixed Contract"→"Fixed Price" everywhere, "12-Hour Settlement"→"7-Day Settlement", "48-hour dispute window"→"7-day dispute window", dynamic deadline labels for payroll services.
- [x] Reference URL validation: X.com/twitter.com links only (Zod refine on imageUrl field).
- [x] PurchaseModal: free-form number input for contract duration (removed preset buttons), corrected settlement/dispute text.
- [x] Notification links: escrow phase and milestone notifications link to `/orders/{orderId}` instead of `/dashboard`.
- [x] NotificationBell on all pages via AppLayout header.
- [x] Profile X verification: React Query cache invalidation instead of page reload.
- [x] AI Agent integration: merged `feature/ai-agent` branch with marketplace AgentPanel, lazy Groq SDK initialization.
- [x] "Escrow" → "Payment" UI rename: all user-facing "Escrow" text replaced with "Payment"/"Payments"/"Payment Details" etc. Internal code still uses escrow naming for on-chain compatibility.
- [x] Dashboard simplified: 2 tabs only (Orders + Chat). Orders tab has 3 sections: My Listings, Buying, Selling. All escrow management moved to order detail page.
- [x] Chat panel expanded: default height 400px (was 256px), expanded 600px (was 500px). Chat section moved to full-width below order info on order detail page.
- [x] Dashboard UX overhaul: cancelled orders and inactive listings filtered out. Order cards show service title (not "Order #N"), are clickable (navigate to order detail page). Inline action buttons: Cancel Order (buyer, pre-funding only), Propose Changes (links to order page with `?propose=1`), Pay for Order (links to order page for awaiting_deposit escrows). Enriched order API responses with `serviceTitle`, `buyerTwitterHandle`/`sellerTwitterHandle`, `escrowPhase`.
- [x] Order detail page improvements: service title as heading, buyer/seller shown as X handles (with fallback to truncated wallet), 5-column grid layout (3 left for order/payment/chat, 2 right for Deal Terms + Service Details cards). "Pay for Order" button with yellow alert banner for awaiting_deposit phase. Buyer cancel restricted to pre-funding. Auto-open Propose Changes modal via `?propose=1` URL param.
- [x] "Fund Payment" → "Pay for Order" rename throughout UI.
- [x] E2E audit bug fixes B1-B4: (B1) reputation hooks now receive wallet addresses instead of UUIDs — `recordCompletion`/`recordDispute` use `solanaEscrow.walletAddress`, RatingModal receives wallet address props for on-chain `submitRating`; (B2) payroll dispute window text corrected from "7-day" to "48-hour" in PurchaseModal; (B3) `Math.round(parseFloat)` replaced with BigInt-safe `solToLamports()` in order release handler; (B4) cron payroll-release now records on-chain reputation for seller after each period release via `WolandReputationClient`.
- [x] Wallet address bug fixes (SHOWSTOPPER): MilestonePanel was passing `escrow.depositorId` (UUID) to `new PublicKey()` — fixed to `escrow.depositorWalletAddress` with null guards. Service cancel API now returns `depositorWalletAddress` (via profile lookup) instead of user ID. Service detail page cancel handler uses wallet address for on-chain refund.
- [x] Reference URL server-side validation: POST /api/services validates that the X handle in the reference URL matches the seller's verified X handle. Prevents sellers from using others' content as reference.
- [x] IDL sync: `src/lib/solana/idl/woland_escrow.json` synced with build output (was missing `seller_cancel` instruction).
- [x] Edit Listing: service detail page now has "Edit Listing" button (next to Cancel) that opens inline modal. Editable fields: title, description, price, required keyword, min posts, deadline, reference URL. Listing type and category locked (immutable). Uses existing `PUT /api/services/[id]` + `useUpdateService()` hook. Only shown when `isOwn && service.active`.
- [x] Chat encryption removed: stripped all NaCl box encryption from chat. Messages are now plain text. Removed `channel-cipher.ts`, `wallet-cipher.ts`, `use-channel-keys.ts`, `/api/channel-keys` routes. ChatPanel simplified (no "Unlock Messages", no key derivation, no encryption warnings). Schema changed: `insertSecureMessageSchema` accepts `content` field, storage maps to `ciphertext` column with `nonce="PLAINTEXT"`. PurchaseModal "Encrypted Communication" renamed to "Direct Messaging". Old encrypted messages unreadable (acceptable tradeoff).
- [x] Email notifications improved: branded HTML template with dark theme, CTA button, Wolo footer (woloapp.xyz). Notification text changed from "encrypted message" to "new message".
- [x] Submit Application fix: created `supabase/migration-v8-orders-status.sql` adding `pending_approval` to orders status CHECK constraint. Must be run in Supabase SQL Editor.
- [x] Request listing approval flow: applicants for "request" listings now enter `pending_approval` status instead of instant contract creation. Requester reviews applications and accepts/declines from dashboard or order detail page. On acceptance: order transitions to `pending`, escrow created server-side, other pending applications auto-cancelled. Applicants can withdraw applications. Dashboard shows "Awaiting Review" badge and Accept/Decline buttons. Order detail page shows pending approval status banner and actions.
- [x] Recurring payroll payments: payroll services (weekly/monthly) now support period-by-period auto-release via `release_action_payout` on-chain instruction. Buyer deposits full amount (rate x periods) into escrow. Backend auto-creates `payroll_periods` rows. Cron endpoint (`POST /api/cron/payroll-release`) activates periods when their start time arrives and releases payment after a 48-hour dispute window. Period disputes are soft (DB-only, escrow stays in_progress on-chain). Buyer can dispute individual periods before deadline; admin resolves with release or skip. PurchaseModal has period selector for payroll services (4/8/12/26/52 weeks or 1/3/6/12 months). PayrollTimeline component shows progress bar + timeline with dispute buttons on order detail page. No Anchor program changes needed — uses existing `release_action_payout` instruction signed by deploy wallet. Max contract duration capped at ~11 months (365-day on-chain limit). Payroll escrows cannot use milestones (on-chain constraint: milestone_count == 0).
- [x] Security audit fix pass 5: C-1 fixed 5 server-side routes passing user IDs (UUIDs) to `new PublicKey()` — all now look up wallet addresses from profiles table. C-2 fixed hardcoded on-chain escrow expiry days (PurchaseModal and dashboard now compute from `escrow.expiresAt`). C-3 added `refunded` to `VALID_TRANSITIONS["disputed"]` in phase route so depositor can sync refunded state after on-chain refund. C-4/H-6 fixed amount validation: normalized string comparison (`"0.5"` == `"0.50"`), uses `order.negotiatedPrice` when available, payroll `amountPerPeriod` respects negotiated rate. H-1 added error check on `createSession` supabase insert. H-3 added max length validation to service schema (title 120, description 2000, price max 1M, keyword 100, imageUrl must be valid URL). H-5 orphaned order cleanup — PurchaseModal cancels order if escrow creation fails. H-8 period resolve endpoint restricted to admin only (was depositor/receiver). M-2 logout clears all query cache (`queryClient.clear()`). M-7 wallet address null guards on all dashboard and order detail action buttons — shows toast instead of crashing on `null!`.

## 8. MVP LAUNCH CHECKLIST — TASKS FOR NEXT PROGRAMMER

Feature code is complete. Everything below is ops/infra/testing. Follow in order.

### Phase 1: Database (2 min — Supabase SQL Editor)
Migrations v3 through v5 are already applied. Only the payroll migration is pending:
- [x] `supabase/migration-v3-audit.sql` — already run
- [x] `supabase/migration-v3.sql` — already run
- [x] `supabase/migration-v4-keyword.sql` — already run
- [x] `supabase/migration-v4-content-type.sql` — already run
- [x] `supabase/migration-v5-negotiate.sql` — already run
- [x] `supabase/migration-v6-payroll.sql` — applied 2026-03-03. `payroll_periods` table + escrow recurring columns confirmed.
- [ ] `supabase/migration-v8-orders-status.sql` — **REQUIRED**: adds `pending_approval` to orders.status CHECK constraint. Run in Supabase SQL Editor. Without this, "Submit Application" on request listings returns 500.

### Phase 2: On-Chain Programs
- [x] `woland_escrow` redeployed to devnet 2026-03-03 — tx `2Qg7o6oyAEwtsR6BfwWF8cmVyEtoSTHMugSjrpcU8ErnDJ5EaVhKaoCd4vvBbKREdEGmrKEzWPUMP6gL6HcMu6aa`
- [x] `woland_reputation` redeployed to devnet 2026-03-03 — tx `3arZX2n9vLRuWweuJT7dMKs4GsDVmVfPMyHKY7pPdiwGVoyraD35vfmPkZoyk9afz1aQy8Lsyd5rBrRojLpMBYbA`
- [x] `.env` program IDs match deployed addresses

### Phase 3: IDL Sync (15 min)
- [x] IDL already synced — `idl.ts` imports directly from `target/idl/` build output (no stale copy). Fixed `REPUTATION_PROGRAM_ID` fallback from `CjNE...` to `42Pr...`.

### Phase 4: Fix Build (2 min)
- [x] `npm install resend` — installed, `next build` passes clean.

### Phase 5: Env Vars
- [x] `ADMIN_WALLET_ADDRESS` — set to `D53S...` in `.env`.
- [x] `RESEND_API_KEY` — set in `.env`.
- [x] `CRON_SECRET` — set in `.env`.

### Phase 6: Deploy to Hosting (30 min)
- [x] Deployed to Vercel. Production domain: `https://woloapp.xyz` (also accessible via `wolo-beige.vercel.app`). All 17 env vars added, daily cron configured.
- [x] Fixed lazy `PublicKey` initialization in `escrow-client.ts`, `reputation-client.ts`, `setup.ts` to prevent build-time base58 errors.
- [x] Created `.vercelignore` to exclude `target/`, `programs/`, `.anchor/`, etc.

### Phase 7: End-to-End Testing (the #1 priority)
Nobody has ever run the full flow with a real wallet. Test each path:
- [ ] **Fixed service flow**: Connect Phantom → create service → purchase with 2nd wallet → fund escrow on-chain → seller starts work → seller submits for review → buyer approves & releases → both rate → verify SOL arrived
- [ ] **Payroll service flow**: Create weekly payroll service → purchase with 4-week period → verify 4 period rows created → manually call `POST /api/cron/payroll-release` with Bearer token → verify period activates → wait for dispute deadline (or adjust DB timestamps) → call cron again → verify SOL released to seller on-chain
- [ ] **Dispute flow**: Open dispute on escrow → verify on-chain phase change → trigger oracle resolution → verify proportional split
- [ ] **Period dispute flow**: Dispute a payroll period → verify cron skips it → resolve dispute → verify release or skip
- [ ] **Chat flow**: Send message → verify plain text delivery → verify both parties see messages
- [ ] **Deal negotiation flow**: Propose price change → counterparty accepts → verify order updated

### E2E Analysis Findings (2026-03-07)

**Fixed (this session):**
- [x] MilestonePanel wallet address bug — was passing UUID to PublicKey, now uses depositorWalletAddress
- [x] Service cancel API — returns wallet address instead of user ID for on-chain refund
- [x] Service detail cancel handler — uses wallet address for sellerCancel call

**Open issues found by E2E analysis:**
- [ ] **No escrow top-up flow** — when price increases via deal negotiation after escrow is funded, there's no mechanism to add more SOL. Depositor sees a mismatch warning but can't act on it. Fix: add a `top_up` instruction to escrow program, or require cancel+re-fund workflow.
- [x] **On-chain reputation calls pass user IDs** — Fixed in B1: all 3 call sites now pass wallet addresses. RatingModal receives wallet props from parent.
- [x] **Floating-point precision in SOL calculations** — Fixed in B3: order release handler now uses `solToLamports()` (BigInt-safe). All 5 SOL conversion sites now use the same pattern.
- [ ] **Cron scheduler not verified** — payroll auto-release cron (`POST /api/cron/payroll-release`) has never been tested with real wallet. Need to verify Vercel cron triggers it correctly and on-chain release works.
- [ ] **Dispute flow untested** — arbiter_resolve, proportional split, and dispute window enforcement need real wallet testing.

### Known Tech Debt (post-launch, low urgency)
- [ ] **In-memory nonce store** (`src/server/nonce-store.ts`) — auth breaks under multi-instance serverless. Fix: move to Supabase `nonces` table. Fine for low traffic.
- [ ] **In-memory rate limiter** (`src/server/rate-limit.ts`) — per-instance limits bypassable. Fix: Upstash Redis or Supabase-backed. Fine for low traffic.
- [ ] **Two-step authority transfer** — escrow `update_config` allows single-tx authority change with no recovery. Medium risk.
- [ ] Real-time updates via Supabase Realtime (currently polling every 5-30s)
- [ ] Service image upload (imageUrl field exists but no upload flow)
- [ ] Service search improvements (full-text search, pagination)
- [ ] Mobile responsive testing
- [ ] Dark mode polish

---

## 9. ENV VARS (all in .env, gitignored)

```
SOLANA_DEPLOY_WALLET_ADDRESS=2MoCBYf5B5S597vXEbZSYAR73278bX2eFDn1yCbXVTAL
SOLANA_DEPLOY_WALLET_PRIVATE_KEY=<base58 secret key>
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_ESCROW_PROGRAM_ID=9yJBgVvpGvvQRWbPNzDAgv9snP8bvoXXS7A8U28nzNd9
# NEXT_PUBLIC_SPL_TOKEN_MINT removed — SOL-only now
NEXT_PUBLIC_REPUTATION_PROGRAM_ID=42PrQGNH4pCqyGwxrLMXnfkDzz5CTCFx71y2HjuHK9Vg
NEXT_PUBLIC_FEE_VAULT=DzTxz6pPjChXQQ2sgdVsfsrrBGz6L2N1M1vFv3gsSCtw
NEXT_PUBLIC_SUPABASE_URL=https://bmbredisugppllgumijn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
SESSION_SECRET=<hex string>
TWITTER_API_KEY=<twitterapi.io API key>
RESEND_API_KEY=<Resend API key, optional — email notifications disabled without it>
CRON_SECRET=<random string for payroll cron endpoint auth>
```

---

## 10. CONVENTIONS -- FOLLOW THESE EXACTLY

- **Imports**: `@/` for src, `@shared/` for src/shared, `@/lib/supabase/server` for server client
- **API routes**: Next.js App Router style, always check `getSessionUser()`, return `NextResponse.json()`
- **Storage**: all DB access through `storage` singleton from `src/server/storage.ts`, never raw supabaseAdmin in routes (except admin panel)
- **Types**: defined in `src/shared/schema.ts`, DB rows are snake_case, app types are camelCase, conversion in `to*()` functions in storage.ts
- **Components**: "use client", shadcn/ui components from `@/components/ui/`, framer-motion for animations
- **Hooks**: custom hooks in `src/hooks/`, all use TanStack Query, credentials: "include" on all fetches
- **Solana**: Anchor 0.32.1, `@coral-xyz/anchor`, wallet adapter from `@solana/wallet-adapter-react`, native SOL (no SPL tokens)
- **No comments** unless absolutely necessary
- **No README updates** unless asked
- **Test by building**: `npx tsc --noEmit` then `npm run build` then `anchor build`

---

## 11. COMMANDS

```bash
# Dev server
npm run dev

# TypeScript check
npx tsc --noEmit

# Next.js build
npm run build

# Anchor build (needs solana in PATH)
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
anchor build

# Anchor deploy
anchor deploy --provider.cluster devnet

# Solana CLI
solana balance
solana program show <PROGRAM_ID>

# Supabase: all schema changes via SQL Editor in dashboard
# https://supabase.com/dashboard -> SQL Editor -> New Query -> paste SQL -> Run
```

---

## 12. ADMIN

Admin wallet: `2MoCBYf5B5S597vXEbZSYAR73278bX2eFDn1yCbXVTAL` (hardcoded in admin page). This is also the deploy authority for both programs and the SPL token mint authority.
