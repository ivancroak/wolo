# Worker Agent(s) — Output Log

> Role: Independent planner + implementer for parallel tasks.
> Multiple Worker sessions may write here. Each entry starts with
> "FILES I WILL TOUCH" as a coordination signal for other agents.
> Read `workflow.md` and `context.md` before each session.

---

## WORKER SESSION — 2026-02-27 — Audit Fix Pass (Cycle 2)
### Task: Fix 5 HIGH + 5 MEDIUM + selected N-T-H issues from Audit Pass 1
### FILES I WILL TOUCH
- `programs/woland_escrow/src/lib.rs` (H1)
- `src/server/storage.ts` (H2, H5)
- `src/shared/schema.ts` (H2, M2)
- `src/app/api/services/[id]/actions/[actionId]/dispute/route.ts` (H3, H4)
- `src/server/with-rate-limit.ts` (H4)
- `src/app/(app)/dashboard/page.tsx` (H2)
- `src/app/(app)/orders/[id]/page.tsx` (H2)
- `src/app/api/escrow/[id]/dispute-resolve/route.ts` (M3)
- `src/app/api/services/[id]/actions/[actionId]/retry-pay/route.ts` (M1 — NEW)
- `src/app/api/profiles/verify-twitter/route.ts` (N3)

### COMPLETED

### FIX PASS — Audit Pass 1 (Cycle 2)

| # | Severity | Issue | What Changed | File(s) Modified |
|---|----------|-------|-------------|-----------------|
| H5 | HIGH | getMilestones no ORDER BY — wrong milestone index on-chain | Added `.order("id", { ascending: true })` to getMilestones query | `storage.ts` |
| H1 | HIGH | `release_action_payout` completer not validated on-chain | Added `/// SECURITY:` comment documenting arbiter-trust-only design. No on-chain constraint possible without stored completer list. Chose option (b) per audit. | `lib.rs` |
| H4 | HIGH | Dispute route uses old IP rate-limiting pattern | Added `getClientIp()` and `checkSessionRateLimit()` to `with-rate-limit.ts`. Updated dispute route to use both. Also updated `verify-twitter` to use `getClientIp`. | `with-rate-limit.ts`, `dispute/route.ts`, `verify-twitter/route.ts` |
| H3 | HIGH | Double-payment race condition in auto-pay | Added idempotency check: re-reads completion after status update, skips auto-pay if `paidAt !== null` (concurrent request already paid). | `dispute/route.ts` |
| H2 | HIGH | Claim Refund button ignores 7-day dispute window | Added `disputeOpenedAt` to Escrow type, toEscrow mapper, updateEscrowPhase (sets on disputed). Dashboard + Orders page now disable button with message during 7-day window. Requires DB migration. | `schema.ts`, `storage.ts`, `dashboard/page.tsx`, `orders/[id]/page.tsx` |
| M2 | MEDIUM | NotificationType missing "escrow_created" | Added `"escrow_created"` to union type | `schema.ts` |
| M3 | MEDIUM | `as any` cast in dispute-resolve route | Replaced with typed `const phase: EscrowPhase = ...` | `dispute-resolve/route.ts` |
| M1 | MEDIUM | No retry for verified-but-unpaid completions | Created `POST /api/services/:id/actions/:actionId/retry-pay` endpoint. Checks `status === "verified" && paidAt === null`, then runs auto-pay logic. Rate-limited. Service-creator only. | `retry-pay/route.ts` (NEW) |
| N3 | NTH | verify-twitter GET has no rate limit | Added `checkRateLimit` call to GET handler (20 req/60s) | `verify-twitter/route.ts` |

### ISSUES SKIPPED

| Issue | Reason |
|-------|--------|
| M4 (auto-pay wrong escrow) | Requires DB migration (add `escrow_id` to action_completions) + schema/storage/API changes across multiple layers. Not isolated enough for Worker fix. Flag for King. |
| M5 (undeclared files) | `coder_output.md` is now read-only archive per workflow.md. Cannot update. Documentation-only issue. |
| N1 (encodeU64 precision) | Devnet only, safe in practice. Defer. |
| N2 (auto-pay monitoring) | Requires admin dashboard work. Defer. |
| N4 (N+1 escrow queries) | Low impact at current scale. Defer. |

### FILES MODIFIED

| File | What Changed | Why |
|------|-------------|-----|
| `programs/woland_escrow/src/lib.rs` | Added SECURITY comment to ReleaseActionPayout.completer | H1: Document arbiter-trust-only design |
| `src/server/with-rate-limit.ts` | Added `getClientIp()` and `checkSessionRateLimit()` | H4: Rate limit helpers |
| `src/server/storage.ts` | getMilestones ORDER BY + toEscrow disputeOpenedAt + updateEscrowPhase sets dispute_opened_at | H5, H2 |
| `src/shared/schema.ts` | Escrow.disputeOpenedAt + "escrow_created" NotificationType | H2, M2 |
| `src/app/api/services/[id]/actions/[actionId]/dispute/route.ts` | getClientIp + session rate limit + idempotency check | H3, H4 |
| `src/app/(app)/dashboard/page.tsx` | Dispute refund button disabled during 7-day window | H2 |
| `src/app/(app)/orders/[id]/page.tsx` | Dispute refund button disabled during 7-day window | H2 |
| `src/app/api/escrow/[id]/dispute-resolve/route.ts` | `as any` → typed EscrowPhase | M3 |
| `src/app/api/services/[id]/actions/[actionId]/retry-pay/route.ts` | NEW: retry-pay endpoint for unpaid verified completions | M1 |
| `src/app/api/profiles/verify-twitter/route.ts` | Added rate limit to GET, updated POST to use getClientIp | N3 |

### AUDITOR NOTES

Areas requiring re-review:
- **H1 (security-sensitive)**: `release_action_payout` completer validation is arbiter-trust-only. This is documented via comment now but remains a design decision — if deploy wallet is compromised, escrows can be drained. Auditor should confirm option (b) is acceptable.
- **H3 (security-sensitive)**: Idempotency check narrows the race window significantly but doesn't eliminate it entirely. A tiny window exists between the re-read and the on-chain send. However, the on-chain `released` counter provides a second layer of protection — if the escrow is fully spent, the second tx fails with `InsufficientFunds`.
- **H2 (DB migration)**: Requires `ALTER TABLE escrows ADD COLUMN dispute_opened_at TIMESTAMPTZ;` to be run in Supabase. Without this column, `disputeOpenedAt` will be null for all escrows and the refund button will remain disabled for all disputed escrows (fail-safe behavior).
- **M1 (security-sensitive)**: New `retry-pay` endpoint uses deploy wallet to sign on-chain tx. Same arbiter-trust pattern as the dispute route. Service-creator only access.

### KING ATTENTION

1. **architecture.md correction needed**: The SECURITY NOTES section states "Completer account validated against instruction argument on-chain" — this is false. H1 confirms no on-chain validation exists for the completer. King should update architecture.md to state: "completer address is arbiter-trust-only; no on-chain validation."
2. **M4 (auto-pay wrong escrow)**: The auto-pay route takes the first active escrow found for the service. If multiple buyers fund the same pay-per-action listing, the wrong buyer's escrow could be debited. Fix requires adding `escrow_id` to `action_completions` table — a schema change that needs King's decision.
3. **`getClientIp` / `checkSessionRateLimit` helpers**: These were described in coder_output.md Fix Pass 1 (SEC-M1) but were never actually implemented. I've added them now. Other routes still use the old `x-forwarded-for` pattern. King should decide whether to update all routes to use `getClientIp` in a separate pass.

### BUILD VERIFICATION

- tsc: pass (zero errors)
- build: pass (all routes compiled, including new retry-pay)
- anchor: pass (compiled with warnings only, no errors)

---

Fix pass complete — Auditor please re-confirm.
