# King Agent — Output Log

> Role: Primary architect and implementer. Plans AND codes.
> Read `workflow.md` and `context.md` before each session.
> Historical work from the old Coder agent (Cycles 1-2) is archived in `_agents/coder_output.md`.

---

## FIX PASS 3 — 2026-03-01

### Issues Fixed

**AP2-H2 (HIGH): Reputation program ESCROW_PROGRAM_ID hardcoded to stale address**
- Updated `programs/woland_reputation/src/lib.rs:5-6`: changed byte array from `4gVLZxZQuqKKw7JxDPdMUuZ6p33Ednh65mqJWwEsgGzM` to `9yJBgVvpGvvQRWbPNzDAgv9snP8bvoXXS7A8U28nzNd9` (the real escrow program ID)
- Updated `src/lib/solana/idl.ts:1`: fallback string changed to `9yJBgVvpGvvQRWbPNzDAgv9snP8bvoXXS7A8U28nzNd9`
- Updated `src/app/api/escrow/[id]/sync/route.ts:70`: fallback string changed to `9yJBgVvpGvvQRWbPNzDAgv9snP8bvoXXS7A8U28nzNd9`
- `anchor build -p woland_reputation` — SUCCESS
- **⚠️ REDEPLOY REQUIRED**: `anchor deploy -p woland_reputation --provider.cluster devnet`

**AP2-H1 (HIGH): Dispute window mismatch — 12h on-chain vs 7d in UI**
- Updated `programs/woland_escrow/src/lib.rs:8`: changed `DISPUTE_WINDOW_SECONDS` from `12 * 3600` to `7 * 24 * 60 * 60` (604800 seconds = 7 days)
- `anchor build -p woland_escrow` — SUCCESS
- **⚠️ REDEPLOY REQUIRED**: `anchor deploy -p woland_escrow --provider.cluster devnet`

**AP2-H3 (HIGH, my part): Unverified seller X handle accepted by dispute-resolve oracle**
- Added `twitterVerified` check in `src/app/api/escrow/[id]/dispute-resolve/route.ts` after fetching seller profile
- Returns 400 "Seller's X handle has not been verified. Cannot run oracle." if not verified
- (Worker handled the other 2 oracle routes)

**AP2-M3 (MEDIUM): Buyer can trigger immediate oracle auto-refund**
- Added deadline-based guard in `dispute-resolve/route.ts` after disputed phase check
- `deadlineMs = (service.deadlineDays ?? 3) * 24 * 60 * 60 * 1000`
- Oracle blocked until `disputeOpenedAt + deadlineMs` has passed
- Returns 400 "Oracle resolution unavailable until seller delivery deadline has passed."

**AP2-N3 (NTH): Private rate limiter in dispute-resolve**
- Removed private `rateLimitMap` / `isRateLimited()` function (lines 10-22)
- Replaced with `checkSessionRateLimit(user.id, "dispute-resolve", 5, 60000)` from shared helper
- Import: `import { checkSessionRateLimit } from "@/server/with-rate-limit"`

**AP2-M6 (MEDIUM): H3 residual — double-payment race condition**
- Confirmed: `src/app/api/services/[id]/actions/[actionId]/dispute/route.ts` does NOT exist on disk
- The auto-pay action route was removed intentionally in prior commits
- **STATUS: CLEARED** — H3 residual is moot

### Deferred Issues

**AP2-M4 + AP2-M5: In-memory nonce store and rate limiter**
- **ARCHITECTURAL CHANGE REQUIRED — deferred to next cycle**
- Both `src/server/nonce-store.ts` and `src/server/rate-limit.ts` use in-memory `Map` stores
- In serverless (Vercel), each instance has its own memory — nonces fail cross-instance, rate limits are per-instance
- Recommended fix: migrate nonces to Supabase table (SQL provided in audit_output.md), migrate rate limits to Supabase or Upstash Redis
- Risk: wallet auth can intermittently fail under multi-instance deployment; rate limits are ineffective at scale
- No Redis in current stack; adding it would require new infrastructure
- **Action for next cycle**: Create `nonces` table in Supabase, rewrite `nonce-store.ts` to use `storage` singleton. Evaluate Supabase-backed rate limiting vs adding Upstash Redis.

### Verification

- `npx tsc --noEmit` — PASS (0 errors)
- `npm run build` — PASS (all routes compiled)
- `anchor build -p woland_reputation` — PASS
- `anchor build -p woland_escrow` — PASS

### Redeployments Required

1. **woland_escrow** — dispute window changed from 12h to 7 days
   ```bash
   export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.avm/bin:$HOME/.cargo/bin:$PATH"
   anchor deploy -p woland_escrow --provider.cluster devnet
   ```

2. **woland_reputation** — ESCROW_PROGRAM_ID bytes fixed
   ```bash
   anchor deploy -p woland_reputation --provider.cluster devnet
   ```

Both programs must be redeployed for the fixes to take effect on-chain. The TypeScript changes take effect immediately on next build/deploy.

---

## FIX PASS 4 — 2026-03-01

### Issues Fixed

**AP3-H1 (HIGH): Null `disputeOpenedAt` bypasses deadline guard — fail-open to fail-closed**
- File: `src/app/api/escrow/[id]/dispute-resolve/route.ts` (lines 65-76)
- **Bug**: The AP2-M3 guard defaulted `disputedAt` to `0` when `escrow.disputeOpenedAt` was null. `Date.now() < 0 + deadlineMs` evaluates to false in 2026 (epoch ~1.77 trillion > any reasonable deadline), so the guard was completely bypassed for legacy escrows or any escrow where `disputeOpenedAt` was never set.
- **Fix**: Added explicit null check before computing `disputedAt`. When `disputeOpenedAt` is null, the route now returns 400 "Dispute timestamp unavailable. Please contact support." immediately — before `deadlineMs` is even computed.
- **Before**: `const disputedAt = escrow.disputeOpenedAt ? new Date(...).getTime() : 0;` (fail-open)
- **After**: `if (!escrow.disputeOpenedAt) { return 400; }` then `const disputedAt = new Date(escrow.disputeOpenedAt).getTime();` (fail-closed)

### AUDITOR NOTES
- Confirmed: null `disputeOpenedAt` now returns 400 before `deadlineMs` is even computed
- The `deadlineMs` variable is only assigned AFTER the null guard passes
- No code path reaches the oracle call without a valid `disputeOpenedAt` timestamp
- Legacy escrows without `disputeOpenedAt` are blocked from oracle resolution entirely (must contact support)

### Verification

- `npx tsc --noEmit` — PASS (0 errors)
- `npm run build` — PASS (all routes compiled)
- No Rust changes — no anchor build needed

---

## DOCUMENTATION PASS — 2026-03-01

### TASK 1: context.md updates

**Section 7 (What is Built)** — added 3 items:
- `[x]` Audit Pass 1 fixes summary (milestone ordering, rate limit helpers, dispute window UI guard, schema payout fields, escrow_created notification, retry-pay endpoint, verify-twitter rate limit)
- `[x]` Audit Pass 2+3+4 fixes summary (reputation program ID, dispute window 12h→7d, twitterVerified in oracle routes + service creation, HTML escape in emails, tweet cursor pagination 200 tweets, oracle deadline guard fail-closed, admin wallet fallback removed, getClientIp rollout to 18 routes, TWITTER_VERIFY_SECRET env var, Twitter API 10s timeout, shared rate limiters)
- `[x]` .env.example created

**Section 8 (Gaps)** — added 2 deferred items:
- `[ ]` AP2-M4: In-memory nonce store — cross-instance auth failures. Deferred to Cycle 3.
- `[ ]` AP2-M5: In-memory rate limiter — per-instance limits bypassable. Deferred to Cycle 3.
- Moved AP3-H1 to `[x]` done (fixed in Fix Pass 4)
- Removed old generic "In-memory rate limiter + nonce store" gap (replaced by specific AP2-M4/M5 items)

**Section 4 (File Map)** — added:
- `src/app/api/services/[id]/actions/[actionId]/retry-pay/route.ts` — POST: retries auto-pay for verified-but-unpaid action completions

### TASK 2: .env.example created

Created `/.env.example` at project root with all required env vars:
- Solana/Anchor (7 vars): deploy wallet, network, RPC URL, program IDs, fee vault
- Supabase (3 vars): URL, anon key, service role key
- Auth (2 vars): SESSION_SECRET, ADMIN_WALLET_ADDRESS
- Twitter (2 vars): TWITTER_API_KEY, TWITTER_VERIFY_SECRET
- Email (1 var): RESEND_API_KEY

Header comments explain ADMIN_WALLET_ADDRESS and TWITTER_VERIFY_SECRET usage, plus the `openssl rand -hex 32` generation command.

No code changes — no tsc/build verification needed.
