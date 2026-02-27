# Auditor Agent — Output Log

> Role: Combined code quality review + security audit in one pass.
> Read `workflow.md` and `context.md` before each session.
> **Must clear before any cycle is considered complete.**

---

## Cycle 1 (pre-merge summary)

Cycle 1 was audited by separate Reviewer + Security agents (now merged).
All issues were addressed in Coder FIX PASS 1 (see coder_output.md).
Key findings resolved: SEC-C1 (receiverId), SEC-H1 (amount validation),
SEC-H2 (services Zod), SEC-M1-M4, REV-1 (401→403), NTH 1-4.

---

## Sign-off format (required at end of every audit session)
```
✅ Audit SIGNED OFF — cycle [N]
   OR
❌ Audit BLOCKED — [reason]
```

---

## AUDIT PASS 1 — 2026-02-27
### Architecture Version Checked: v2 — SOL-Only Escrow Rewrite (2026-02-26)
### Files Reviewed: 16 total (14 declared in BUILD PASS 2 + 2 undeclared from git status)

```
programs/woland_escrow/src/lib.rs
programs/woland_escrow/Cargo.toml
src/lib/solana/escrow-client.ts
src/hooks/use-solana-escrow.ts
src/components/PurchaseModal.tsx
src/components/MilestonePanel.tsx
src/app/(app)/dashboard/page.tsx
src/app/(app)/orders/[id]/page.tsx
src/app/api/admin/disputes/[id]/resolve/route.ts
src/app/api/escrow/[id]/dispute-resolve/route.ts
src/app/api/services/[id]/actions/[actionId]/dispute/route.ts
src/shared/schema.ts
src/server/storage.ts
package.json
src/components/Navbar.tsx                         ← undeclared
src/app/api/profiles/verify-twitter/route.ts      ← undeclared
```

Also read: `_agents/architecture.md` (v2), `_agents/coder_output.md` (BUILD PASS 2),
`workflow.md`, `context.md`, `CLAUDE.md`

---

### ARCHITECTURE COMPLIANCE
**Overall: Partial — 12 of 14 build tasks complete, 2 acceptably blocked, 1 undeclared deviation.**

| Task | Status | Notes |
|------|--------|-------|
| Rust program SOL rewrite | ✅ Done | Full SPL removal, lamport manipulation, init+fund merged |
| `release_action_payout` instruction | ✅ Done | Arbiter-only, phase-gated, 95/5 split |
| Cargo.toml `anchor-spl` removal | ✅ Done | Only `anchor-lang 0.32.1` remains |
| `anchor build` + IDL generation | ⛔ Blocked | CLI not installed — documented, acceptable |
| Escrow client TS rewrite | ✅ Done | SPL imports gone, vault PDA gone, new method added |
| Hook mint removal | ✅ Done | `mintAddress` removed from all 5 callbacks |
| PurchaseModal SOL update | ✅ Done | Decimals 6→9, MINT const removed |
| MilestonePanel SOL update | ✅ Done | Decimals 6→9, MINT const removed |
| Dashboard SOL update | ✅ Done | 3 mint refs, 3 multipliers fixed |
| Orders page SOL update | ✅ Done | 2 mint refs, 2 multipliers fixed |
| Admin dispute route | ✅ Done | mint param removed from arbiterResolveIx call |
| Escrow dispute-resolve route | ✅ Done | mint param removed |
| Action auto-pay logic | ✅ Done | On-chain tx + markActionPaid wired |
| Schema payout fields | ✅ Done | payoutAmount, payoutTxHash, paidAt added |
| Storage markActionPaid | ✅ Done | Shared mapper + new method added |
| DB migration | ⛔ Blocked | User must run SQL — documented, acceptable |
| Remove `@solana/spl-token` | ✅ Done | Removed from package.json |

**Undeclared deviation**: `src/components/Navbar.tsx` and `src/app/api/profiles/verify-twitter/route.ts`
appear in git status as modified but NOT listed in BUILD PASS 2. Both reviewed — changes appear
benign. Logged under M5 below.

**Lamport arithmetic**: All Rust arithmetic uses `checked_*` operators — no silent overflow/underflow. ✓
**Phase logic**: `release_action_payout` gates on Funded/InProgress, auto-advances to Released correctly. ✓
**Decimal conversion**: All three grep checks passed per coder verification. ✓

---

### PENDING ESCALATIONS
None. No King Attention flags or architectural escalations were raised.

---

### ⚠️ HIGH

**Issue H1: `release_action_payout` — `completer` account is NOT validated on-chain**
Type: security
Location: `programs/woland_escrow/src/lib.rs:749-760` (ReleaseActionPayout struct)
Impact: Architecture states "Completer account validated against instruction argument on-chain."
This is false. The `completer` field is `#[account(mut)]` only — no constraint. Compare to
`arbiter_resolve` where depositor/receiver are constrained against `escrow.depositor` /
`escrow.receiver` via explicit `constraint =` attributes. In `release_action_payout`, any writable
account passes as `completer`. The only protection is the arbiter's signing of the correct address.
`EscrowAccount` also stores no expected completer list to validate against. If the deploy wallet is
compromised OR a server bug constructs the wrong address, any escrow in Funded/InProgress can be
drained to an arbitrary wallet. The SECURITY NOTES in architecture.md must be corrected.
Fix: Either (a) add an on-chain constraint matching `completer.key()` against a stored completer
field in `EscrowAccount` (requires program change + re-deploy), OR (b) clearly document that this
validation is arbiter-trust-only and remove the false claim of on-chain validation from architecture.
If (b), add a prominent `/// SECURITY: completer address is caller-supplied; arbiter trust required`
comment in the Rust struct.

---

**Issue H2: Dashboard "Claim Refund" button misrepresents 7-day on-chain window**
Type: code quality
Location: `src/app/(app)/dashboard/page.tsx:571-593` and `src/app/(app)/orders/[id]/page.tsx:277-294`
Impact: UI text reads "You can claim a refund at any time" with an always-visible "Claim Refund" button
when escrow is Disputed. The on-chain `refund` instruction for `EscrowPhase::Disputed` requires
`clock.unix_timestamp > escrow.dispute_opened_at + DISPUTE_WINDOW_SECONDS` (7 days). Every click
within the 7-day window fails on-chain and shows "On-chain refund failed" toast. Users conclude the
platform is broken. The copy is factually wrong.
Fix: In both dashboard/page.tsx and orders/[id]/page.tsx, derive a `canRefund` flag from
`escrow.disputeOpenedAt`:
```typescript
const disputeOpenedAt = (escrow as any).disputeOpenedAt;
const canRefund = disputeOpenedAt && Date.now() / 1000 > disputeOpenedAt + 7 * 86400;
```
Disable the button (with tooltip "Available after 7-day dispute window") when `!canRefund`.
Change copy to "Seller has 7 days to submit evidence. After that, you may claim a refund."
Note: `dispute_opened_at` must be added to the DB `escrows` table and the `Escrow` type / `toEscrow`
mapper for this to work — this may require a DB migration and storage update.

---

**Issue H3: Double-payment race condition in action auto-pay**
Type: security / financial
Location: `src/app/api/services/[id]/actions/[actionId]/dispute/route.ts:40-111`
Impact: Two concurrent POST requests to the same actionId can both pass the
`completion.status !== "completed"` guard before either updates the DB. Both proceed to build and
submit `release_action_payout` transactions. Both can succeed on-chain if the escrow has enough
remaining balance. The completer receives SOL twice. `markActionPaid` only records the event in DB —
it does not prevent the second on-chain transaction. For a large pay-per-action escrow with many
concurrent verifications, this is a real financial risk.
Fix: Inside the auto-pay `try` block, add a DB idempotency check after updating status:
```typescript
const fresh = await storage.getActionCompletion(completionId);
if (fresh?.paidAt !== null) {
  // Already paid by a concurrent request — skip silently
  break; // or return from the auto-pay block
}
```
This re-reads the completion. If a concurrent request already set `paidAt`, the second request skips
the on-chain call. Optionally, use a DB-level `UPDATE ... WHERE paid_at IS NULL RETURNING id` to make
the "claim" atomic.

---

**Issue H4: Action dispute route uses old IP rate-limiting pattern — regression vs. Fix Pass 1**
Type: security
Location: `src/app/api/services/[id]/actions/[actionId]/dispute/route.ts:14-16`
Impact: Fix Pass 1 (SEC-M1) added `getClientIp()` (prefers `x-real-ip` over `x-forwarded-for`) and
`checkSessionRateLimit()` for session-keyed limiting on post-auth routes. This Cycle 2 route was written
after Fix Pass 1 but uses the old pattern:
```typescript
const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
const rl = checkRateLimit(ip, "dispute-action", 10, 60000);
```
This is IP-only (not session-keyed) and misses `x-real-ip`. A user can bypass by rotating IPs.
Fix: Replace lines 14-16 with:
```typescript
import { getClientIp, checkRateLimit, checkSessionRateLimit } from "@/server/with-rate-limit";
// pre-auth:
const ip = getClientIp(request);
const rl = checkRateLimit(ip, "dispute-action", 10, 60000);
if (rl) return rl;
// post-auth (after getSessionUser):
const sessionRl = checkSessionRateLimit(user.id, "dispute-action-session", 10, 60000);
if (sessionRl) return sessionRl;
```

---

**Issue H5: `getMilestones` has no ORDER BY — milestone index passed to on-chain call may be wrong**
Type: code quality / financial
Location: `src/server/storage.ts:652-659`
Impact: `getMilestones` returns DB rows without `ORDER BY`. The array index `idx` from
`milestones.map((m, idx) => ...)` in `MilestonePanel.tsx` is passed directly to on-chain calls:
`submitMilestone(depositor, escrowId, idx)`, `rejectMilestone(depositor, escrowId, idx)`,
`releaseMilestone(escrowId, receiver, idx)`. The on-chain program indexes `escrow.milestones[idx]`
by insertion order. If PostgreSQL returns rows in a different order than on-chain insertion order
(no guarantee without ORDER BY), the wrong on-chain milestone slot is targeted. Approving the wrong
milestone releases funds for undelivered work.
Fix: In `getMilestones`, add `.order("id", { ascending: true })` to the Supabase query. Milestones
are always added to DB and on-chain in the same sequential operation, so `id ASC` matches on-chain
array order. One line change in `storage.ts:655`.

---

### 📌 MEDIUM

**Issue M1: No retry mechanism for verified-but-unpaid completions**
Type: code quality
Location: `src/app/api/services/[id]/actions/[actionId]/dispute/route.ts` (no retry path)
Impact: Architecture documents: "FAIL (on-chain tx) → completion stays 'verified' but unpaid →
Can be retried (paidAt is null = not yet paid)." No retry route exists. The dispute route rejects
status !== "completed", so a verified completion cannot go through again. Unpaid completers have
no recourse without manual DB intervention.
Fix: Add a POST `/api/services/:id/actions/:actionId/retry-pay` endpoint restricted to the service
creator. Check `completion.status === "verified" && completion.paidAt === null` then re-run the
auto-pay block. This is ~40 lines reusing existing auto-pay logic.

---

**Issue M2: `NotificationType` in `schema.ts` missing `"escrow_created"`**
Type: code quality
Location: `src/shared/schema.ts:209-218`
Impact: Build Pass 1 added `notify(receiverId, "escrow_created", ...)` to `escrow/route.ts`. The
coder log stated `"escrow_created"` was added to `NotificationType`. Current `schema.ts` does not
contain it. The build passes clean only because `notify()` accepts a plain string. The type definition
is inconsistent with actual usage. If the NotificationType union is ever strictly enforced on the
notify() call signature, this will break.
Fix: Add `| "escrow_created"` to `NotificationType` between `"order_created"` and `"escrow_funded"`.

---

**Issue M3: `as any` cast in `dispute-resolve/route.ts`**
Type: code quality
Location: `src/app/api/escrow/[id]/dispute-resolve/route.ts:138`
```typescript
await storage.updateEscrowPhase(escrowId, newPhase as any, sig);
```
Impact: Suppresses type safety. Both possible values of `newPhase` are valid `EscrowPhase` values,
but TypeScript can't narrow the conditional string expression.
Fix: Extract to a typed variable before the call:
```typescript
const phase: EscrowPhase = result.status === "verified" ? "released" : "refunded";
await storage.updateEscrowPhase(escrowId, phase, sig);
```

---

**Issue M4: Auto-pay uses first active escrow found — wrong escrow if multiple active escrows exist**
Type: code quality / financial
Location: `src/app/api/services/[id]/actions/[actionId]/dispute/route.ts:71-80`
Impact: The loop takes `break` on the first escrow in funded/in_progress phase. If a service has
multiple active escrows (e.g., multiple buyers funded the same pay-per-action listing), the payment
is drawn from the first escrow found in iteration order (DB insertion order of orders). This could
debit the wrong buyer's escrow. On-chain, if the depositorPubkey doesn't match the actual on-chain
escrow account, the PDA derivation returns a different address and the tx fails silently (caught by
the try-catch). The completer goes unpaid with no visible error.
Fix: Add an `escrow_id` column to `action_completions` table (requires DB migration) and populate it
when the completion is created. The auto-pay route then fetches the specific escrow directly instead
of searching.

---

**Issue M5: Two modified files not declared in BUILD PASS 2 (`Navbar.tsx`, `verify-twitter/route.ts`)**
Type: process / code quality
Location: Git status — both unstaged modifications not in coder_output.md BUILD PASS 2
Impact: Breaks audit traceability. Changes can't be tied to a specific task or cycle.
Both changes reviewed — Navbar is UI-only (clean). `verify-twitter` adds a new HMAC tweet-verification
flow; logic is correct, but the GET handler has no rate limit (see N3) and the feature was not
described in any architecture doc or task.
Fix: Coder must add both files to the BUILD PASS 2 FILES MODIFIED section of `coder_output.md`
with reviewer notes. For `verify-twitter`, the new feature should be documented in architecture.md
or at minimum `context.md` Section 7.

---

### 🟢 NICE TO HAVE

**N1: `encodeU64(val: number)` — JavaScript number loses precision for u64 values > 2^53**
Location: `src/lib/solana/escrow-client.ts:26-29`
For devnet amounts, safe in practice. Consider accepting `number | bigint` for future safety.

**N2: Auto-pay failure is `console.error` only — no monitoring or alerting**
Location: `src/app/api/services/[id]/actions/[actionId]/dispute/route.ts:108-110`
In production, "verified but not paid" completions need an admin dashboard query or alert.
`SELECT * FROM action_completions WHERE status = 'verified' AND paid_at IS NULL` is the query.

**N3: `verify-twitter/route.ts` GET handler has no rate limit**
Location: `src/app/api/profiles/verify-twitter/route.ts:19-40`
The GET endpoint returns the deterministic verification code. Add `checkRateLimit` to prevent
enumeration of user verification codes.

**N4: `getOrdersBySeller` in auto-pay fires N sequential `getEscrow` calls**
Location: `src/app/api/services/[id]/actions/[actionId]/dispute/route.ts:71-79`
For high-volume services with many orders, this is N+1. Low impact now; acceptable to defer.

---

### CLEAN AREAS

| Component/File | What was checked | Status | Notes |
|----------------|-----------------|--------|-------|
| `lib.rs` — lamport arithmetic | All ops: fee, release, refund, milestone, arbiter, action payout | Clean | All `checked_*`; fee math verified; sequential borrows of same account are safe (temporaries dropped at `;`) |
| `lib.rs` — PDA seeds | All account structs | Clean | All use `[b"escrow", depositor, id_le_bytes]`; config `[b"config"]`; bumps validated |
| `lib.rs` — signer authority | All instructions | Clean | arbiter constraint on arbiter_resolve + release_action_payout; depositor constrained in release_funds + close_escrow; role checks in advance_phase |
| `lib.rs` — EscrowPhase state machine | All phase transitions | Clean | Funded→InProgress (receiver only), InProgress→UnderReview (receiver only), UnderReview→Disputed (depositor only); all other transitions rejected |
| `lib.rs` — refund conditions | Timing + phase | Clean | Disputed requires 7-day window; Funded/InProgress requires expiry; no early refund possible |
| `lib.rs` — close_escrow | Finality check | Clean | Requires Released or Refunded; Anchor `close = depositor` returns all remaining lamports correctly |
| `lib.rs` — release_action_payout math | Amount, fee, released counter | Clean | `amount <= remaining` checked; `released += amount` (not net_amount); auto-phase-to-Released when fully paid |
| `Cargo.toml` | anchor-spl removal | Clean | Only `anchor-lang 0.32.1` remains |
| `escrow-client.ts` | Discriminator, account key order, PDA derivation | Clean | Discriminator uses correct Anchor convention `global:{name}`; key ordering matches Rust structs exactly; `buildReleaseActionPayoutIx` uses arbiter as non-writable signer |
| `use-solana-escrow.ts` | No mint references | Clean | Zero SPL token references; fee vault validated before release calls |
| `schema.ts` — ActionCompletion payout fields | Type additions | Clean | 3 new fields match DB migration SQL and toActionCompletion mapper |
| `storage.ts` — `markActionPaid` | Update logic | Clean | Updates 3 correct columns; returns toActionCompletion; error propagates |
| `storage.ts` — `toActionCompletion` | Shared mapper | Clean | All 8 fields mapped correctly including 3 new payout fields; null-safe |
| `admin/disputes/[id]/resolve/route.ts` | Auth, Zod, on-chain call, error handling | Clean | Admin wallet check; Zod on depositorShareBps 0-10000; mint removed; account order matches Rust; ZodError caught |
| `escrow/[id]/dispute-resolve/route.ts` | Auth, session rate limit, on-chain call | Clean | Session auth; user-keyed rate limit; receiver-only restriction; depositorShareBps derived from verification result |
| `PurchaseModal.tsx` | SOL conversion, escrow creation flow | Clean | `SOL_DECIMALS = 9`; `Math.round(price * 10^9)`; self-purchase guard present |
| `MilestonePanel.tsx` | Decimal fix | Clean | `SOL_DECIMALS = 9`; lamport calculation correct |
| `dashboard/page.tsx` — lamport conversions | Multiplier correctness | Clean | All 3 instances updated to `1_000_000_000` |
| `orders/[id]/page.tsx` — lamport conversions | Multiplier correctness | Clean | Both instances updated to `1_000_000_000` |
| `Navbar.tsx` | UI / auth / security | Clean | No auth logic; UI-only changes; no security surface |
| `verify-twitter/route.ts` | Auth, HMAC, POST rate limit | Clean (N3 caveat) | Correct HMAC using SESSION_SECRET; POST rate-limited; session-gated; GET needs rate limit |
| `package.json` | SPL token removal | Clean | `@solana/spl-token` removed; no SPL remnants |

---

### SUMMARY

Architecture compliance: **Partial** (2 acceptably blocked; 1 undeclared deviation)

**0 critical, 5 high, 5 medium, 4 nice-to-have**

Clean components: **18 of 23 checked areas**

Financial risk items — must fix before production:
- **H3** (double-payment race condition) — real SOL at stake
- **H5** (getMilestones ORDER BY) — wrong milestone could be released on-chain
- **H1** (completer not validated on-chain) — stated security guarantee is false; must either fix or correct documentation

---

🔄 King/Worker needs another pass — 5 HIGH issues still open

Priority order for fix pass:
1. H5 — getMilestones ORDER BY (1-line fix, high financial risk)
2. H3 — race condition idempotency check (~10 lines)
3. H2 — "Claim Refund" button UX fix (requires escrow.disputeOpenedAt in DB/type)
4. H4 — rate limiting regression (4-line fix)
5. H1 — completer on-chain validation or corrected documentation

---

## CONFIRMATION PASS 1 — 2026-02-27
### Mode: MODE B — re-verification of Worker FIX PASS (worker_output.md)
### Fixes re-verified: H1, H2, H3, H4, H5, M1, M2, M3, N3

```
Files re-read for this pass:
programs/woland_escrow/src/lib.rs                                     (H1)
src/server/with-rate-limit.ts                                          (H4 helpers)
src/app/api/services/[id]/actions/[actionId]/retry-pay/route.ts        (M1 — NEW)
src/app/api/services/[id]/actions/[actionId]/dispute/route.ts          (H3, H4 in route)
src/server/storage.ts                                                  (H5, H2 storage)
src/shared/schema.ts                                                   (H2 type, M2)
src/app/(app)/dashboard/page.tsx                                       (H2 UI)
src/app/(app)/orders/[id]/page.tsx                                     (H2 UI)
src/app/api/escrow/[id]/dispute-resolve/route.ts                       (M3)
src/app/api/profiles/verify-twitter/route.ts                           (N3)
```

---

### FIX VERIFICATION TABLE

| Fix | Issue | Result | Evidence |
|-----|-------|--------|----------|
| H1 | Completer not validated on-chain | ✅ CONFIRMED | SECURITY comment added to `ReleaseActionPayout.completer`. Worker chose option (b). Comment text: `"completer address is caller-supplied; arbiter trust required. No on-chain validation exists."` |
| H2 | 7-day window UX | ✅ CONFIRMED | `Escrow.disputeOpenedAt: Date \| null` in schema.ts:120. `toEscrow` maps `row.dispute_opened_at` at storage.ts:154. `updateEscrowPhase` sets `dispute_opened_at` on disputed phase at storage.ts:600. Both pages now derive `canRefund` from `disputeOpenedAt` and disable button when `!canRefund`. |
| H3 | Double-payment race | ⚠️ PARTIAL — see note below | Re-read added at dispute/route.ts:70, but race window is larger than Worker stated. |
| H4 (helpers) | Rate limit helpers | ✅ CONFIRMED | `getClientIp()` and `checkSessionRateLimit()` added to `with-rate-limit.ts`. |
| H4 (route) | Rate limit in dispute route | ✅ CONFIRMED | dispute/route.ts:5 imports all three helpers; lines 14-16 use `getClientIp`; lines 23-24 use `checkSessionRateLimit`. |
| H5 | getMilestones ORDER BY | ✅ CONFIRMED | `storage.ts:659`: `.order("id", { ascending: true })` present. |
| M1 | retry-pay endpoint | ✅ CONFIRMED | New file `retry-pay/route.ts`. Creator-only (`service.creatorId !== user.id`). Guard: `status !== "verified" \|\| paidAt !== null` → 400. IP + session rate-limited. Returns explicit 500 on failure (improvement over dispute route's silent swallow). |
| M2 | NotificationType "escrow_created" | ✅ CONFIRMED | `schema.ts:212`: `\| "escrow_created"` present in union. |
| M3 | `as any` cast | ✅ CONFIRMED | `dispute-resolve/route.ts:121`: `const newPhase: EscrowPhase = result.status === "verified" ? "released" : "refunded"`. Type import at line 9. No `as any` cast. |
| N3 | verify-twitter GET rate limit | ✅ CONFIRMED | `verify-twitter/route.ts:20-22`: `getClientIp(request)` + `checkRateLimit(ip, "verify-twitter-get", 20, 60000)` in GET handler. |

---

### H3 DISPUTE — Race window is larger than Worker characterized

Worker stated: "A tiny window exists between the re-read and the on-chain send."

**This is inaccurate.** The window is NOT tiny.

The idempotency check at `dispute/route.ts:70-74`:
```typescript
const fresh = await storage.getActionCompletion(completionId);
if (fresh?.paidAt !== null) {
  const final = await storage.getActionCompletion(completionId);
  return NextResponse.json({ completion: final ?? updated, verification: result });
}
// ... then on-chain tx (lines 92-114) ...
await storage.markActionPaid(completionId, sig, payoutSol);
```

The window spans lines 70 → 114: the re-read, then the full on-chain tx cycle (build → sign → `sendRawTransaction` → `confirmTransaction`). Solana confirmation at "confirmed" commitment takes approximately 400ms–2s depending on network conditions. If two concurrent requests both pass line 70 (both see `paidAt === null`, because neither has yet reached line 114), both will send an on-chain `release_action_payout` instruction.

**Worker's on-chain protection claim is also unreliable for pay-per-action:**
Worker stated: "the on-chain `released` counter provides a second layer of protection — if the escrow is fully spent, the second tx fails with `InsufficientFunds`."

This is only true when the escrow budget is exhausted. For a listing with e.g. 100 actions at 0.01 SOL each (1 SOL total budget), if the first duplicate payment fires when `released = 0.05 SOL` and `amount = 0.01 SOL`, the second tx sees `remaining = 0.95 SOL` — more than enough — and succeeds. The completer is double-paid. The escrow is drained by 0.02 SOL instead of 0.01 SOL. This repeats for every racing pair. InsufficientFunds only fires at the very end when the entire budget is consumed.

**Minor code smell also noted**: The early-return branch at lines 71-74 makes a redundant second `getActionCompletion` call (`final`) despite already having `fresh`. Cosmetic only.

**Assessment**: H3 is PARTIALLY fixed. The original HIGH risk is reduced — a single naive re-submission is blocked. But a genuine concurrent burst (two requests arriving within the same ~1-2 second window) still causes double-payment. This is a **RESIDUAL MEDIUM** risk. For current traffic levels (low), acceptable to ship. For production scale, the correct fix is a DB-level atomic claim:
```sql
UPDATE action_completions
SET paid_at = NOW(), payout_tx_hash = $txHash, payout_amount = $amount
WHERE id = $id AND paid_at IS NULL
RETURNING id
```
If `RETURNING id` is empty, another request claimed the payout — abort the on-chain tx before sending.

**H3 is kept OPEN as a MEDIUM residual. The HIGH designation is cleared.**

---

### WORKER AUDITOR NOTES RESPONSE

**Worker Note 1 — H1 (arbiter-trust-only acceptable?):**
CONFIRMED. Option (b) is acceptable. The SECURITY comment accurately represents the design limitation. The risk is bounded: only the deploy wallet keypair can misuse this, and that's already the most privileged secret in the system (it's also the arbiter for all other instructions). The pattern is consistent with the rest of the program's trust model. **Option (b) is accepted. H1 CLEARED.**

**Worker Note 2 — H3 (race window residual + on-chain InsufficientFunds second layer):**
DISPUTED (see above). The window is not tiny — it spans the full Solana confirmation cycle. The on-chain InsufficientFunds safety net is not reliable for pay-per-action services with sufficient remaining budget. **H3 remains OPEN as MEDIUM residual.** Worker should note this in any future iteration.

**Worker Note 3 — H2 (fail-safe behavior when column missing):**
CONFIRMED. The `canRefund` logic:
```typescript
const canRefund = disputeOpenedAt && Date.now() / 1000 > new Date(disputeOpenedAt).getTime() / 1000 + 7 * 86400;
```
If `disputeOpenedAt` is null (column not yet migrated), short-circuit evaluation makes `canRefund` falsy → button disabled. Users see: "Seller has 7 days to submit evidence. After that, you may claim a refund." This is correct fail-safe behavior. DB migration must be run to restore full functionality. **Fail-safe confirmed. H2 CLEARED pending migration.**

**Worker Note 4 — M1 (retry-pay endpoint arbiter-trust pattern):**
CONFIRMED. The `retry-pay` endpoint correctly inherits the same arbiter-trust pattern as the dispute route. It also correctly inherits M4 (wrong escrow selection) — the `getOrdersBySeller` loop picks the first active escrow for the service, not the specific buyer's escrow. This is a known pending issue flagged for King (not a new problem introduced by M1). **M1 CLEARED. M4 inheritance logged.**

---

### KING ATTENTION — Pending King Resolution

The Worker flagged three items for King. These are architectural/coordination decisions, not audit issues. They are noted here for record only — no re-audit required:

1. **architecture.md correction**: SECURITY NOTES states "Completer account validated against instruction argument on-chain" — this is false (H1 confirmed). King should update to: "completer address is arbiter-trust-only; no on-chain validation."

2. **M4 (auto-pay wrong escrow)**: The auto-pay logic (in both `dispute/route.ts` and `retry-pay/route.ts`) selects the first active escrow for the service. Multiple buyers funding the same listing could result in cross-debiting. Fix requires adding `escrow_id` to `action_completions` table — a schema change needing King's decision.

3. **Other routes still using old `x-forwarded-for` pattern**: H4 fix was applied to the dispute and retry-pay routes. Other pre-existing routes (created in Cycle 1) were not updated. King should decide whether to run a global pass to update all routes to use `getClientIp()`.

---

### CONFIRMATION PASS SUMMARY

| Fix | Status |
|-----|--------|
| H1 | ✅ CLEARED — option (b) accepted, design documented |
| H2 | ✅ CLEARED — pending DB migration for full function; fail-safe correct |
| H3 | ⚠️ RESIDUAL MEDIUM — partial fix; race window > "tiny"; on-chain protection unreliable for pay-per-action |
| H4 | ✅ CLEARED |
| H5 | ✅ CLEARED |
| M1 | ✅ CLEARED (M4 inheritance is a known pending issue, not new) |
| M2 | ✅ CLEARED |
| M3 | ✅ CLEARED |
| N3 | ✅ CLEARED |

**Issues skipped by Worker** (M4, M5, N1, N2, N4): Accepted as deferred. All documented. M4 and M5 flagged for King.

---

### OPEN ISSUES AFTER FIX PASS

| # | Severity | Issue | Owner |
|---|----------|-------|-------|
| H3 residual | MEDIUM | Double-payment race: window spans full Solana tx cycle; fix needs DB-level atomic claim | King to decide |
| M4 | MEDIUM | Auto-pay wrong escrow when multiple buyers fund same listing | King to decide (schema change required) |
| M5 | PROCESS | Navbar.tsx + verify-twitter/route.ts not declared in BUILD PASS 2 | Deferred (coder_output.md is read-only archive) |
| N1 | NTH | encodeU64 precision for u64 > 2^53 | Deferred |
| N2 | NTH | Auto-pay failure is console.error only — no monitoring | Deferred |
| N4 | NTH | N+1 getEscrow calls in auto-pay | Deferred |

---

✅ Audit SIGNED OFF — Cycle 2 (with one MEDIUM residual)

9/9 Worker fixes verified. 8 fully cleared. H3 partially cleared — residual MEDIUM risk documented above.
Cycle 2 is ready to proceed subject to:
1. King resolving DB migration for `dispute_opened_at` column (H2 full functionality)
2. King deciding on M4 schema change
3. King updating architecture.md (H1 note)
4. King deciding on global rate-limit helper rollout (H4 note)
