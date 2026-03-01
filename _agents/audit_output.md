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

---

## AUDIT PASS 2 — 2026-03-01
### Scope: Full production-readiness audit of entire codebase
### HEAD at time of audit: e35a891 (Proportional dispute resolution, deal negotiation, email notifications, chat improvements)
### Auditor note: Three commits landed during this session (e2c5846, 1769eaf, e35a891). All code read reflects the current HEAD. The `services/[id]/actions/[actionId]/dispute/route.ts` file referenced in prior audits no longer exists — removed in recent commits.

### Files Read (AUDIT PASS 2)

```
SMART CONTRACTS (PRIORITY 1):
  programs/woland_escrow/src/lib.rs                  (lines 1-30 re-read for declare_id + constants)
  programs/woland_reputation/src/lib.rs               (lines 1-50)

FINANCIAL LOGIC / TS LAYER (PRIORITY 2):
  src/lib/solana/idl.ts
  src/lib/solana/escrow-client.ts                    (via prior session — account orderings)
  src/hooks/use-solana-escrow.ts
  src/server/verification.ts
  src/server/twitter-client.ts
  src/components/PurchaseModal.tsx

AUTH / SESSION (PRIORITY 3):
  src/server/auth.ts                                 (via prior session)
  src/server/nonce-store.ts                          (via prior session)
  src/server/with-rate-limit.ts
  src/app/api/auth/nonce/route.ts                    (via prior session)
  src/app/api/auth/login/route.ts                    (via prior session)
  src/app/api/auth/logout/route.ts
  src/app/api/profiles/verify-twitter/route.ts

INPUT VALIDATION (PRIORITY 4):
  src/app/api/orders/route.ts
  src/app/api/orders/[id]/verify/route.ts
  src/app/api/orders/[id]/proposals/route.ts
  src/app/api/orders/[id]/messages/route.ts
  src/app/api/escrow/route.ts                        (via prior session)
  src/app/api/escrow/[id]/sync/route.ts
  src/app/api/escrow/[id]/dispute-resolve/route.ts
  src/app/api/escrow/[id]/phase/route.ts             (via prior session)
  src/app/api/escrow/[id]/milestones/route.ts
  src/app/api/admin/disputes/route.ts
  src/app/api/admin/disputes/[id]/resolve/route.ts
  src/app/api/admin/init-config/route.ts             (via prior session)
  src/app/api/ratings/route.ts
  src/app/api/verify/milestone/[milestoneId]/route.ts
  src/app/api/services/[id]/route.ts                 (via prior session)

ARCHITECTURE (PRIORITY 5):
  src/shared/schema.ts
  src/server/storage.ts                              (interface + first 80 lines)
  src/server/notifications.ts

CROSS-CUTTING:
  src/app/api/auth/user/route.ts                     (not read — low priority, omitted)
```

---

### PART 1 — EXTRA-SCRUTINY REVIEW: Last 15 Hours of Changes

Changes since session start (commits 23f0689 → e35a891) include SOL-only escrow rewrite, audit fixes, proportional dispute resolution, deal negotiation, and email notifications. The following specific deviations from prior audit assumptions were found:

**CRITICAL DEVIATION: DISPUTE_WINDOW_SECONDS is 12 hours, not 7 days**

AUDIT PASS 1 H2 assumed the on-chain dispute window was 7 days and fixed the UI to match. This assumption was incorrect. The on-chain constant at `programs/woland_escrow/src/lib.rs:8` is:
```rust
const DISPUTE_WINDOW_SECONDS: i64 = 12 * 3600; // 12 hours
```

The H2 fix (`canRefund` = `disputeOpenedAt + 7 * 86400`) made the UI MORE restrictive than the chain. A buyer can call the Rust `refund` instruction directly after 12 hours and receive a full refund — entirely bypassing the 7-day UI restriction. This is documented as AP2-H1 below.

**Completer constraint was added (option a, not just b)**

AUDIT PASS 1 H1 cleared with option (b): documentation only. But `lib.rs` now contains a `constraint =` attribute on `ReleaseActionPayout.completer`:
```rust
constraint = completer.key() == escrow.receiver || completer.key() == escrow.depositor @ WolandError::Unauthorized
```
This is option (a) — on-chain enforcement. It's a stronger fix than approved. The constraint correctly blocks arbitrary wallets from being used as completer. For current single-influencer use case, the receiver IS the completer, so this works. Noted as a design constraint (MEDIUM impact) in AP2-M5 below.

**`verifyDelivery` ghost import — DEBUNKED**

The previous session summary claimed both dispute routes imported `verifyDelivery`. **This is false.** A full `grep -r verifyDelivery` across all TypeScript files returns zero matches. Both `dispute-resolve/route.ts` and `orders/[id]/verify/route.ts` correctly import `{ verifyContract }`. No broken import exists.

---

### PART 2 — FULL PROJECT SECURITY AUDIT

---

### ⚠️ HIGH

**AP2-H1: DISPUTE_WINDOW_SECONDS on-chain (12h) contradicts UI and prior audit assumption (7d)**
Type: security / financial
Location: `programs/woland_escrow/src/lib.rs:8`; `src/app/(app)/dashboard/page.tsx` (canRefund calc)
Impact: The on-chain refund guard for disputed escrows allows refund after 12 hours:
```rust
const DISPUTE_WINDOW_SECONDS: i64 = 12 * 3600; // 12 hours
```
The `canRefund` UI flag (added in AUDIT PASS 1 H2 fix) uses 7 * 86400 seconds. This means:
1. The UI blocks the refund button for 7 days — sellers believe they have 7 days to deliver
2. On-chain, the refund instruction succeeds after only 12 hours
3. A buyer using any wallet client (Anchor CLI, custom script, Phantom + custom ix) can call `refund` directly after 12 hours and drain the escrow to themselves — bypassing all UI restrictions

Real attack: buyer opens dispute (funded → disputed), waits 12 hours, calls program directly with `refund` ix — full SOL refund, zero recourse for seller who planned to deliver within 7 days.

Fix: Choose one path and make on-chain match the UX expectation:
- **Option A (recommended)**: Update on-chain constant to 7 days: `const DISPUTE_WINDOW_SECONDS: i64 = 7 * 24 * 3600;` — requires recompile + redeploy
- **Option B**: Update all UI to show 12-hour window. Update `canRefund` to `disputeOpenedAt + 12 * 3600`. Update all copy ("12 hours" not "7 days"). Document seller risk prominently.
Either way, the constant and UI MUST agree. The current state is a silent lie to sellers.

---

**AP2-H2: Reputation program ESCROW_PROGRAM_ID hardcoded to stale program address — on-chain ratings broken**
Type: security / correctness
Location: `programs/woland_reputation/src/lib.rs:6`; `src/lib/solana/idl.ts:1`; `src/app/api/escrow/[id]/sync/route.ts:70`

Three separate places use `4gVLZxZQuqKKw7JxDPdMUuZ6p33Ednh65mqJWwEsgGzM`:

1. `reputation/src/lib.rs:6` — compile-time constant:
```rust
const ESCROW_PROGRAM_ID: Pubkey = Pubkey::new_from_array([54, 176, 192, 230, 85, ...]);
// comment: "raw bytes of 4gVLZxZQuqKKw7JxDPdMUuZ6p33Ednh65mqJWwEsgGzM"
```
2. `idl.ts:1` — TypeScript client fallback:
```typescript
export const ESCROW_PROGRAM_ID = process.env.NEXT_PUBLIC_ESCROW_PROGRAM_ID || "4gVLZxZQuqKKw7JxDPdMUuZ6p33Ednh65mqJWwEsgGzM";
```
3. `sync/route.ts:70` — server-side owner check:
```typescript
const ESCROW_PROGRAM_ID = process.env.NEXT_PUBLIC_ESCROW_PROGRAM_ID || "4gVLZxZQuqKKw7JxDPdMUuZ6p33Ednh65mqJWwEsgGzM";
```

But the escrow program's actual program ID (from `declare_id!`) is:
```rust
declare_id!("9yJBgVvpGvvQRWbPNzDAgv9snP8bvoXXS7A8U28nzNd9");
```

**Impact A — On-chain ratings (reputation program)**: `submit_rating` validates that the escrow account's `owner` (the Solana account owner, which IS the program that created it) equals `ESCROW_PROGRAM_ID`. Since all real escrow PDAs are owned by `9yJB...`, this check always fails. Every `submit_rating` call returns a Solana error. The entire on-chain reputation system is non-functional.

**Impact B — TS client + sync route (if env var missing)**: If `NEXT_PUBLIC_ESCROW_PROGRAM_ID` is not set in production env, both the TypeScript escrow client and the sync/route.ts owner check use `4gVL...`. Transactions would target the wrong program. The sync route would return "Account not owned by escrow program" for all escrow PDAs. This may already be happening in production if the env var is missing.

Fix:
1. Update `reputation/src/lib.rs:6` — change the bytes array to match `9yJBgVvpGvvQRWbPNzDAgv9snP8bvoXXS7A8U28nzNd9`. Recompile and redeploy reputation program.
2. Update `idl.ts:1` fallback to `"9yJBgVvpGvvQRWbPNzDAgv9snP8bvoXXS7A8U28nzNd9"`.
3. Update `sync/route.ts:70` fallback to `"9yJBgVvpGvvQRWbPNzDAgv9snP8bvoXXS7A8U28nzNd9"`.
4. Ensure `NEXT_PUBLIC_ESCROW_PROGRAM_ID` env var is explicitly set in all deployment environments to `9yJBgVvpGvvQRWbPNzDAgv9snP8bvoXXS7A8U28nzNd9`. Never rely on fallbacks for program IDs.

---

**AP2-H3: Unverified seller Twitter handle accepted by oracle — enables fraudulent delivery claims**
Type: security / financial
Location: `src/app/api/orders/[id]/verify/route.ts:41-43`; `src/app/api/verify/milestone/[milestoneId]/route.ts:46-51`; `src/app/api/escrow/[id]/dispute-resolve/route.ts:82-88`

All three verification paths check only `sellerProfile?.twitterHandle` (presence), NOT `sellerProfile?.twitterVerified` (ownership):
```typescript
// verify/route.ts:41-43
const sellerProfile = await storage.getProfile(service.creatorId);
if (!sellerProfile?.twitterHandle) {
  return NextResponse.json({ message: "Seller does not have a verified X handle" }, { status: 400 });
}
// ← twitterVerified is NOT checked here
const result = await verifyContract(effectiveService, sellerProfile.twitterHandle, ...);
```

Attack vector:
1. Malicious seller creates service and enters `twitterHandle = "@nasa"` (or any high-volume account) in their profile — no verification required for sellers
2. Buyer creates order with keyword `"moon"` (NASA tweets about moon constantly)
3. Buyer calls `POST /api/orders/{id}/verify` → oracle fetches NASA's tweets → finds `"moon"` → returns `verified`
4. Escrow releases to malicious seller who did zero work

Note: Buyers ARE required to have `twitterVerified = true` (checked in `orders/route.ts:47` and `PurchaseModal.tsx:93`). The asymmetry is intentional for buyer identity but was never applied to seller verification-for-oracle purposes.

Fix: In all three routes, add after fetching seller profile:
```typescript
if (!sellerProfile.twitterVerified) {
  return NextResponse.json(
    { message: "Seller's X handle has not been verified. Cannot run oracle check." },
    { status: 400 }
  );
}
```
Additionally, enforce verified handle at service creation time in `services/route.ts` POST handler.

---

### 📌 MEDIUM

**AP2-M1: HTML injection in email notifications — user-supplied content rendered as HTML**
Type: security / XSS
Location: `src/server/notifications.ts:28-31`

```typescript
await sendEmail(
  emailTo,
  title,
  `<p>${body}</p><p><a href="${link}">View in app</a></p>`,
);
```

`body` is assembled from user-supplied content in call sites, e.g. in `orders/route.ts`:
```typescript
`You have a new order for "${service.title}"`
```
`service.title` is user-supplied. If a seller creates a service with title `<script>alert(1)</script>Buy My Tweets`, notification emails to all buyers of that service will contain raw `<script>` tags. Email clients vary in HTML rendering; many will render injected HTML elements (images, links, iframes).

Real impact depends on the email client (`sendEmail` implementation not read, likely an SMTP call). At minimum, injected `<img src="attacker.com/x">` can be used for email open tracking on victims.

Fix: Escape HTML in `body` before interpolation:
```typescript
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
// then:
`<p>${escapeHtml(body)}</p><p><a href="${link}">View in app</a></p>`
```
Apply the same to `title` in the email subject line.

---

**AP2-M2: getUserTweets limited to 40 tweets — oracle fails for high-volume accounts**
Type: correctness / financial
Location: `src/server/twitter-client.ts:66`

```typescript
export async function getUserTweets(userName: string): Promise<...[]> {
  const data = await twitterFetch("/user/last_tweets", { userName, limit: "40" });
```

The oracle (`verifyContract`) fetches the last 40 tweets and checks for keyword presence. For payroll-type services or prolific tweeters:
- A Twitter user who posts 20 times/day will have posted 280 tweets in 2 weeks
- The required keyword tweet from 3 days ago may be tweet #60 — not in the 40-tweet window
- `verifyContract` returns `not_found` → dispute-resolve triggers full refund → seller loses payment for completed work

This causes false negatives in the oracle, which AUTO-REFUNDS funds in `dispute-resolve/route.ts`. This is a financial correctness issue, not just UX.

Fix: The twitterapi.io endpoint likely supports `cursor`-based pagination (as `getRetweeters` already demonstrates in `twitter-client.ts:21-42`). Add pagination to `getUserTweets` similar to `getRetweeters`:
```typescript
export async function getUserTweets(userName: string, maxPages = 5): Promise<...[]> {
  const tweets = [];
  let cursor: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const params: Record<string, string> = { userName, limit: "100" };
    if (cursor) params.cursor = cursor;
    const data = await twitterFetch("/user/last_tweets", params);
    const batch = data?.data?.tweets ?? data?.tweets ?? [];
    tweets.push(...batch.map(...));
    const nextCursor = data?.next_cursor ?? data?.cursor;
    if (!nextCursor || batch.length === 0) break;
    cursor = nextCursor;
  }
  return tweets;
}
```
Also: filter by `createdAt >= order.createdAt` so only tweets from after contract start count.

---

**AP2-M3: Buyer can trigger immediate oracle auto-refund before seller has time to deliver**
Type: security / financial
Location: `src/app/api/escrow/[id]/dispute-resolve/route.ts:58-163`

The dispute-resolve route:
1. Checks escrow is in `disputed` phase
2. Runs oracle check on seller's tweets NOW
3. If keyword not found → immediately fires `arbiter_resolve` with `depositorShareBps = 10000` → full refund

There is NO minimum time delay between dispute opening and oracle invocation. The SYNC_ALLOWED_TRANSITIONS (`sync/route.ts:21-29`) allows `funded → disputed` and `in_progress → disputed`.

Attack path:
1. Buyer funds escrow (funded phase)
2. Buyer immediately moves to disputed via phase API (or sync)
3. Buyer immediately calls `POST /api/escrow/{id}/dispute-resolve`
4. Oracle: seller hasn't posted yet → `not_found` → full refund to buyer
5. Seller never gets a chance to deliver, even if the deadline is days away

This gives buyers a free option: if they change their mind after funding, they can "game the oracle" before the seller has started.

Fix:
- Add a minimum dispute duration before oracle can be called. E.g., require `escrow.disputeOpenedAt + MIN_ORACLE_DELAY_SECONDS < now`. Set `MIN_ORACLE_DELAY_SECONDS` to match the seller's deadline (e.g., `service.deadlineDays * 86400`).
- Alternatively, only allow the ARBITER (admin) to trigger oracle resolution, not either party directly.
- At minimum, restrict `dispute-resolve` to only the RECEIVER (seller) for self-advocacy OR require both parties to agree before oracle fires.

Current: either `depositorId` (buyer) OR `receiverId` (seller) can call `dispute-resolve`. Buyer has strongest incentive to call it immediately.

---

**AP2-M4: Nonce store is in-memory — broken across serverless instances**
Type: architecture / reliability
Location: `src/server/nonce-store.ts`

Single `Map<string, {nonce, expiresAt}>` in process memory. In Vercel, Netlify, or any multi-instance serverless deployment, each edge worker has its own memory. Nonce created on instance A → login request routed to instance B → `consumeNonce` returns `undefined` → auth fails.

The `setInterval(cleanupExpired, 60_000)` on line ~30 of nonce-store.ts is also a no-op in serverless because instances spin up and down; the interval may never fire.

Fix: Store nonces in a shared, short-TTL data store:
```sql
CREATE TABLE nonces (
  wallet_address TEXT PRIMARY KEY,
  nonce TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX nonces_expires ON nonces(expires_at);
```
`consumeNonce` → `DELETE FROM nonces WHERE wallet_address = $1 AND expires_at > NOW() RETURNING nonce`. Atomic and cross-instance.

---

**AP2-M5: Rate limiter is in-memory — per-instance limits, not global**
Type: architecture / security
Location: `src/server/rate-limit.ts` (referenced by `with-rate-limit.ts`)

Same architecture issue as nonce store. In-memory `Map` rate limits are per process. An attacker on a multi-instance deployment can send N*30 requests per minute by distributing load across N instances. `dispute-resolve/route.ts:10-22` has its own private `rateLimitMap` — also in-memory.

Fix: Use Vercel KV, Upstash Redis, or Supabase `rate_limits` table. Key on `{ip}:{endpoint}` or `{userId}:{endpoint}`. Enforce globally.

---

**AP2-M6 (Retained from CONFIRMATION PASS 1): H3 Residual — Double-payment race condition**
Type: security / financial
Location: Previously documented at H3 residual in CONFIRMATION PASS 1.
Status: OPEN — `services/[id]/actions/[actionId]/dispute/route.ts` no longer exists on disk. Confirmed via `find`. The auto-pay logic was in this file. If this functionality has been removed, H3 residual is MOOT. If it was moved to another route, that route needs the same analysis.

**King must clarify**: Was the auto-pay action route removed intentionally? If yes, H3 residual is CLEARED. If moved, provide new file path for re-audit.

---

### 🔵 LOW

**AP2-L1: Admin wallet hardcoded fallback exposed in public source**
Type: security
Location: `src/app/api/admin/disputes/route.ts:5`; `src/app/api/admin/disputes/[id]/resolve/route.ts:9`; `src/app/api/admin/init-config/route.ts`

```typescript
const ADMIN_WALLET = process.env.ADMIN_WALLET_ADDRESS || "2MoCBYf5B5S597vXEbZSYAR73278bX2eFDn1yCbXVTAL";
```

The hardcoded address `2MoCBYf5B5S597vXEbZSYAR73278bX2eFDn1yCbXVTAL` is now in public git history. Anyone who reads this code knows the admin wallet address. This alone doesn't give them access (they'd need the session + the wallet), but it narrows the target surface for social engineering.

More critically: if `ADMIN_WALLET_ADDRESS` env var is misconfigured or missing in a staging/preview deployment, admin routes silently use the hardcoded address — which may or may not be controlled by the intended admin.

Fix: Remove fallback. Fail loudly at startup:
```typescript
const ADMIN_WALLET = process.env.ADMIN_WALLET_ADDRESS;
if (!ADMIN_WALLET) throw new Error("ADMIN_WALLET_ADDRESS env var is required");
```

---

**AP2-L2: 9 routes still use old `x-forwarded-for` pattern — rate limiting degraded**
Type: security / regression
Location (confirmed in this pass):
- `src/app/api/auth/nonce/route.ts:5`
- `src/app/api/auth/login/route.ts` (approx line 10)
- `src/app/api/escrow/route.ts` (approx line 10)
- `src/app/api/orders/route.ts:10`
- `src/app/api/ratings/route.ts:10`
- `src/app/api/escrow/[id]/milestones/route.ts:12`
- `src/app/api/orders/[id]/verify/route.ts:11`
- `src/app/api/orders/[id]/proposals/route.ts:45`
- `src/app/api/orders/[id]/messages/route.ts:45`

All use: `request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"` instead of `getClientIp(request)` (which additionally checks `x-real-ip`).

If the reverse proxy / CDN sets `x-real-ip` instead of `x-forwarded-for`, all these routes return IP = "unknown" and the rate limiter key becomes `unknown:{endpoint}` — effectively all requests from all IPs share a single bucket, making the rate limit nearly useless.

Fix: One-line change per file. Replace the header extraction with:
```typescript
import { getClientIp } from "@/server/with-rate-limit";
const ip = getClientIp(request);
```
This was flagged in AUDIT PASS 1 H4 as a King decision for a global rollout. **King: decide and execute.**

---

**AP2-L3: SESSION_SECRET dual-use for session tokens and Twitter verification HMAC**
Type: security (defense-in-depth)
Location: `src/app/api/profiles/verify-twitter/route.ts:9`

`SESSION_SECRET` is used to:
1. (Presumably) sign/validate session cookies
2. Generate Twitter verification HMAC codes: `crypto.createHmac("sha256", secret).update(userId + handle)`

If the secret is compromised, an attacker can:
1. Forge valid verification codes for any userId/handle combination, bypassing Twitter account ownership verification
2. Potentially forge session tokens (depending on session implementation)

Fix: Add a separate env var `TWITTER_VERIFY_SECRET` for the HMAC key. Use `SESSION_SECRET` only for sessions.

---

### 🟢 NICE TO HAVE

**AP2-N1: `milestones/route.ts` returns 401 (Unauthenticated) instead of 403 (Forbidden)**
Location: `src/app/api/escrow/[id]/milestones/route.ts:29`
```typescript
return NextResponse.json({ message: "Only the depositor can add milestones" }, { status: 401 });
```
The user is authenticated (check passed). This should be 403. Cosmetic, but breaks REST semantics.

**AP2-N2: Twitter API has no timeout / circuit breaker**
Location: `src/server/twitter-client.ts`
`twitterFetch` has no timeout parameter. If the Twitter API hangs, `verifyContract` hangs, and `dispute-resolve` holds the HTTP connection open indefinitely. In production, this can exhaust serverless function concurrency. Add `AbortController` with a 10-second timeout.

**AP2-N3: `dispute-resolve/route.ts` has a private in-memory rate limiter (not using shared infra)**
Location: `src/app/api/escrow/[id]/dispute-resolve/route.ts:10-22`
This route implemented its own `rateLimitMap` instead of using `checkRateLimit` / `checkSessionRateLimit`. Inconsistent. Low risk (rate limit is 5/60s), but should use the standard helper for consistency and observability.

---

### CLEAN AREAS (AUDIT PASS 2)

| Component | What was checked | Status |
|-----------|-----------------|--------|
| `lib.rs` — `initialize_escrow` | Input validation, amount checks, PDA funding | Clean — MIN_ESCROW_AMOUNT enforced; MAX_ESCROW_DURATION enforced |
| `lib.rs` — `close_escrow` | Finality, lamport return | Clean — Anchor `close = depositor` ✓ |
| `lib.rs` — `calculate_fee` | Ceiling rounding arithmetic | Clean — `(amount * fee_bps + 9999) / 10_000` correct, no overflow |
| `lib.rs` — `refund` | Phase gates, timing window | Clean for logic; window duration mismatch flagged as AP2-H1 |
| `lib.rs` — `arbiter_resolve` | Signer, distribution math, fee | Clean — `distributable = remaining - fee`; `checked_*` throughout |
| `dispute-resolve/route.ts` | Import, type safety, proportional split | Clean — uses `verifyContract` ✓; typed `newPhase: EscrowPhase` ✓; math sound |
| `admin/disputes/[id]/resolve/route.ts` | Auth, Zod, on-chain call | Clean — admin-only; Zod 0–10000; account order matches Rust |
| `verify-twitter/route.ts` | HMAC, rate limit, response | Clean — HMAC correct; GET + POST both rate-limited |
| `ratings/route.ts` | Self-rating, participant check, duplicate | Clean — self-rating blocked; counterparty enforced; duplicate check present |
| `orders/route.ts` | Validations | Clean — self-purchase, maxActions, hasActiveOrder, profile verification all present |
| `escrow/route.ts` | Amount, receiver, duplicate | Clean — amount validated against service.price; receiver validated |
| `sync/route.ts` | Auth, participant, transition logic | Clean — depositor/receiver only; SYNC_ALLOWED_TRANSITIONS enforced; program ID bug (AP2-H2) |
| `schema.ts` | Types, Zod schemas | Clean — Profile has email/emailVerified/emailNotifications ✓ |
| `notifications.ts` | Logic | Clean logic flow; HTML injection flagged separately (AP2-M1) |
| `use-solana-escrow.ts` | Pre-flight checks, lamport calc | Clean — config PDA checked; balance pre-flight ✓; expiresAt server-validated by MAX_ESCROW_DURATION |
| `auth.ts` — sessions | Cookie security, entropy | Clean — httpOnly, sameSite:strict, secure in prod; 256-bit entropy ✓ |
| `nonce-store.ts` — nonce logic | Single-use, 5min TTL | Logic correct; serverless deployment issue flagged as AP2-M4 |

---

### SUMMARY

**Audit scope**: Full codebase (42 files read across 2 sessions)
**HEAD**: e35a891

| Severity | Count | Items |
|----------|-------|-------|
| HIGH | 3 | AP2-H1 (dispute window mismatch), AP2-H2 (program ID mismatch), AP2-H3 (unverified seller handle) |
| MEDIUM | 6 | AP2-M1 (HTML injection), AP2-M2 (40-tweet limit), AP2-M3 (immediate oracle), AP2-M4 (nonce in-memory), AP2-M5 (rate limit in-memory), AP2-M6 (H3 residual — status TBD) |
| LOW | 3 | AP2-L1 (admin wallet fallback), AP2-L2 (9 routes old IP pattern), AP2-L3 (dual-use secret) |
| NTH | 3 | AP2-N1 (401 vs 403), AP2-N2 (no API timeout), AP2-N3 (private rate limiter) |

**Must fix before production (real SOL at risk):**
1. **AP2-H1** — Dispute window is 12h on-chain but sellers believe 7 days. Buyers can drain escrow at 12h. Fix: update constant in Rust OR sync all UI/copy to 12h.
2. **AP2-H2** — Reputation program uses wrong program ID. On-chain ratings universally fail. TS client + sync route use wrong fallback. Fix: update bytes in Rust, rebuild rep program, update TS fallbacks.
3. **AP2-H3** — Unverified seller handles accepted by oracle. Malicious sellers can claim any famous account's tweet history. Fix: add `twitterVerified` check in all 3 oracle routes.

**Should fix before launch:**
4. **AP2-M1** — Email HTML injection. Service titles rendered raw in email bodies.
5. **AP2-M2** — 40-tweet oracle blindness. False not_found → auto-refund for prolific tweeters.
6. **AP2-M3** — Buyer can immediately trigger oracle refund before seller has started.

**Architectural debt (fix before scale):**
7. **AP2-M4** + **AP2-M5** — In-memory nonce and rate limiting. Multi-instance deployment breaks auth and makes rate limits ineffective.

---

🔄 King/Worker required — 3 HIGH issues require code changes (1 needs Rust recompile + redeploy)

Priority order for fix pass:
1. AP2-H2 — Program ID mismatch (Rust + TS, must redeploy reputation program)
2. AP2-H1 — Dispute window constant (Rust, must redeploy escrow program OR full UI+copy update)
3. AP2-H3 — Add `twitterVerified` check in oracle routes (3 TS files, ~3 lines each)
4. AP2-M1 — HTML escape in notifications.ts (1 helper function + 1 usage)
5. AP2-M2 — Paginated tweet fetching in twitter-client.ts
6. AP2-M3 — Minimum delay before oracle fires in dispute-resolve
7. AP2-L1 — Remove admin wallet fallback (3 files)
8. AP2-L2 — Global `getClientIp` rollout (9 files, 1-line each)

---

## AUDIT PASS 3 — 2026-03-01
### Scope: Confirmation pass for Fix Pass 3 (King + Worker)
### King fixed: AP2-H1, AP2-H2, AP2-H3 (dispute-resolve), AP2-M3, AP2-N3, AP2-M6
### Worker fixed: AP2-H3 (other 2 routes), AP2-M1, AP2-M2, AP2-N2, AP2-L1, AP2-L2 (×9), AP2-L3, AP2-N1

---

### CONFIRMED FIXED ✅

| ID | Severity | Fix Verified | Notes |
|----|----------|--------------|-------|
| AP2-H1 | HIGH | `programs/woland_escrow/src/lib.rs:8` now reads `7 * 24 * 60 * 60` (604800s). `anchor build` passes. | ⚠️ REDEPLOY REQUIRED — on-chain constant unchanged until `anchor deploy -p woland_escrow` |
| AP2-H2 | HIGH | Reputation program byte array `[133,73,115,110,138,133,97,2,46,62,109,59,234,135,171,71,134,71,101,73,139,252,237,168,57,176,42,250,130,239,228,252]` verified via `bs58.encode()` = `9yJBgVvpGvvQRWbPNzDAgv9snP8bvoXXS7A8U28nzNd9`. `idl.ts:1` and `sync/route.ts:70` fallbacks both updated to match. | ⚠️ REDEPLOY REQUIRED — on-chain program ID unchanged until `anchor deploy -p woland_reputation` |
| AP2-H3 | HIGH | `twitterVerified` check present in all 3 oracle routes: `dispute-resolve/route.ts:83-88`, `orders/[id]/verify/route.ts:44-49`, `verify/milestone/[milestoneId]/route.ts:52-57`. Returns 400 in each. | ✓ Sufficient — all oracle entry points gated |
| AP2-M1 | MEDIUM | `escapeHtml()` helper at `notifications.ts:5-7`. Applied to `body` at line 36 in email template. `title` in subject line intentionally unescaped (subjects are plain text). | ✓ Sufficient |
| AP2-M2 (partial) | MEDIUM | Date filtering added to `verification.ts:33-39` — tweets with `createdAt < contractStartDate` are excluded before matching. `null` createdAt tweets kept as fail-safe. | ⚠️ PARTIAL — see STILL OPEN section |
| AP2-N2 | NTH | `AbortController` with 10-second timeout at `twitter-client.ts:11-25`. `clearTimeout()` called in `finally` block — no leak. | ✓ Sufficient |
| AP2-N3 | NTH | Private `rateLimitMap` / `isRateLimited()` removed from `dispute-resolve/route.ts`. Replaced with `checkSessionRateLimit(user.id, "dispute-resolve", 5, 60000)` at line 26. | ✓ Sufficient |
| AP2-L1 | LOW | `ADMIN_WALLET` constant with hardcoded fallback removed from all 3 admin routes. All 3 now use per-handler `process.env.ADMIN_WALLET_ADDRESS` with 500 response if missing. Module-scope throw avoided (would crash Next.js build). | ✓ Sufficient |
| AP2-L2 | LOW | `getClientIp(request)` confirmed in all 9 originally-flagged routes: `auth/nonce`, `auth/login`, `escrow/route`, `orders/route`, `ratings/route`, `escrow/[id]/milestones`, `orders/[id]/verify`, `orders/[id]/proposals`, `orders/[id]/messages`. | ✓ 9/9 original targets fixed — see NEW ISSUES for residual |
| AP2-L3 | LOW | `verify-twitter/route.ts:8` now `TWITTER_VERIFY_SECRET = process.env.TWITTER_VERIFY_SECRET ?? process.env.SESSION_SECRET!`. Existing deployments without the new env var continue working unchanged. | ✓ Sufficient |
| AP2-N1 | NTH | `escrow/[id]/milestones/route.ts:28` changed from `status: 401` to `status: 403`. | ✓ Sufficient |
| AP2-M6 | MEDIUM | `services/[id]/actions/[actionId]/dispute/route.ts` confirmed removed from disk. H3 double-payment residual is moot. | ✓ CLEARED |

---

### STILL OPEN 🔄

**AP2-M2 — 40-tweet pagination NOT implemented (HIGH residual)**
- **What was done:** `verification.ts` now filters pre-contract tweets by date. `_contractStartDate` renamed to `contractStartDate` and used as a filter predicate. This is correct and addresses tweet noise.
- **What remains:** `twitter-client.ts:73` still calls `getUserTweets({ userName, limit: "40" })`. No pagination loop added. For sellers with >40 tweets in the contract window, the oracle only examines the 40 most-recent tweets. Evidence of contract fulfillment beyond tweet #40 is never seen.
- **Impact:** False `not_found` or `insufficient` oracle verdicts remain possible for prolific tweeters → auto-refund when seller actually delivered. AP2-M2 as originally filed is STILL OPEN.
- **Required fix:** Add a pagination loop in `getUserTweets` using the API cursor/next_token and collect until `createdAt < contractStartDate` or no more pages.

**AP2-M3 — Null `disputeOpenedAt` guard bypass (HIGH)**
- **What was done:** `dispute-resolve/route.ts:65-73` correctly computes `deadlineMs` and blocks oracle if `Date.now() < disputedAt + deadlineMs`.
- **Critical edge case:** Line 67: `const disputedAt = escrow.disputeOpenedAt ? new Date(escrow.disputeOpenedAt).getTime() : 0`. When `disputeOpenedAt` is `null` (any escrow disputed before the AP1 H2 DB migration added the `dispute_opened_at` column), `disputedAt = 0`. The guard then evaluates `Date.now() < 259200000` (3 days past Unix epoch, year 1970). This is ALWAYS FALSE in 2026 → the deadline guard is completely bypassed for legacy escrows.
- **Impact:** Any buyer who disputed an escrow before the DB column was added can immediately trigger an oracle auto-refund, defeating the entire purpose of AP2-M3.
- **Required fix:** Treat `null` as a fail-closed condition: `if (!escrow.disputeOpenedAt) return 400 "Dispute timestamp unavailable; contact support"`. This is the safe default — block rather than allow.

**AP2-H3 residual — `twitterVerified` NOT enforced at service creation**
- **What was done:** `twitterVerified` is now checked at oracle invocation time in all 3 routes (✓ confirmed).
- **What remains:** `services/route.ts` (POST, service creation) has NO `twitterVerified` check. A seller with an unverified X handle can still create a service, receive buyer funds into escrow, and let the escrow run to expiry or dispute. Buyers see no warning that the seller's X account is unverified at purchase time.
- **Impact:** Buyers can fund escrows against services that can never pass oracle verification. Dispute is the only remedy — and the oracle will correctly fail — but the buyer UX is misleading. Lower severity than the oracle-time check (now fixed) but still a gap.
- **Note:** This was a concern raised in STEP 4 of the AP3 audit instructions. Not previously filed; see NEW ISSUES.

---

### SKIPPED — ACCEPTED RISK

| ID | Issue | Decision |
|----|-------|----------|
| AP2-M4 | In-memory nonce store (`nonce-store.ts`) — cross-instance auth failures under multi-instance serverless | Deferred by King. Requires Supabase `nonces` table migration. Risk: wallet auth intermittently fails at scale. Accepted for this cycle. |
| AP2-M5 | In-memory rate limiter (`rate-limit.ts`) — per-instance rate limits ineffective under multi-instance deployment | Deferred by King. Requires Redis (Upstash) or Supabase-backed store. Risk: rate limits bypassable by hitting different instances. Accepted for this cycle. |

---

### NEW ISSUES INTRODUCED OR DISCOVERED

**AP3-M1 (MEDIUM) — AP2-L2 incomplete: 9 additional routes still use old `x-forwarded-for` pattern**

Worker's AP2-L2 fix covered the 9 routes in the original list. A full grep scan found 9 MORE routes not in the original list still using `request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"`:

| Route | Line |
|-------|------|
| `src/app/api/watchlist/route.ts` | 19 |
| `src/app/api/services/[id]/route.ts` | 26 (PUT) |
| `src/app/api/services/[id]/route.ts` | 59 (DELETE) |
| `src/app/api/services/route.ts` | 24 (POST) |
| `src/app/api/profiles/me/route.ts` | 19 |
| `src/app/api/orders/[id]/proposals/[proposalId]/route.ts` | 26 |
| `src/app/api/orders/[id]/route.ts` | 53 |
| `src/app/api/escrow/[id]/phase/route.ts` | 42 |
| `src/app/api/milestones/[id]/route.ts` | 13 |

Same risk as AP2-L2: IP spoofing bypasses IP-based rate limits. **Worker fix recommended** — mechanical 1-line change per route.

**AP3-H1 (HIGH) — AP2-M3 null `disputeOpenedAt` guard bypass**

See STILL OPEN section above. Filing separately as a new HIGH because it makes the AP2-M3 fix ineffective for all pre-migration escrows. **King fix required** — change null fallback from `0` to a fail-closed `return 400`.

**AP3-L1 (LOW) — `twitterVerified` not enforced at service creation**

`src/app/api/services/route.ts` POST handler has no check for `twitterVerified`. Sellers without a verified X handle can create services, misleading buyers. Recommend adding a check during service creation (return 400 if service type requires X verification and handle is not verified) or surfacing a clear warning in the UI at purchase time.

---

### ANCHOR SECURITY SCAN — `programs/woland_escrow/src/lib.rs` (full file, 1027 lines)

| Check | Result |
|-------|--------|
| PDA seeds consistent across all instructions | ✓ All use `[b"escrow", depositor.key().as_ref(), &escrow_id.to_le_bytes()]` |
| `UncheckedAccount` safety | ✓ All instances have `/// CHECK:` comment + `constraint =` guards |
| Arbiter constraint in `arbiter_resolve` | ✓ `signer.key() == config.arbiter` enforced via `#[account(constraint = ...)]` |
| Depositor/receiver constraints in `arbiter_resolve` | ✓ Both constrained against `escrow.depositor` / `escrow.receiver` fields |
| Fee vault constraint | ✓ `fee_vault.key() == config.fee_vault` enforced |
| `release_action_payout` completer | ✓ Constrained to `escrow.receiver \|\| escrow.depositor` — stronger than option (b) documented in H1 |
| `refund` dispute window guard (on-chain) | ✓ `dispute_opened_at > 0 && clock.unix_timestamp > dispute_opened_at + DISPUTE_WINDOW_SECONDS` |
| `close_escrow` rent return | ✓ `close = depositor` anchor attribute correctly returns rent lamports |
| `EscrowPhase::TryFrom<u8>` exhaustiveness | ✓ All 8 variants (0–7) covered; unknown values return `Err(())` |
| Arithmetic overflow | ✓ `u128` intermediates for fee math; `Overflow` error code defined and used |
| CPI reentrancy | ✓ All lamport borrows are temporaries at `;` — no retained borrow across CPI |
| Account type confusion | ✓ All accounts use typed `Account<PlatformConfig>` / `Account<EscrowAccount>` |
| Sysvar spoofing | ✓ `Clock::get()` used — no custom clock account accepted |
| Error codes | ✓ Comprehensive (25 codes) — no generic catch-all masking |
| Events | ✓ Emitted for all state transitions — supports off-chain monitoring |

**No new on-chain vulnerabilities found.**

Note: The on-chain `refund` guard uses `dispute_opened_at > 0` — correctly fail-closed. The TypeScript null-bypass (AP3-H1) is a server-side issue only; the Rust program itself cannot be tricked into early release via on-chain calls.

---

### ON-CHAIN REDEPLOY STATUS

Both Rust programs have been rebuilt (`anchor build` confirmed passing by King) but HAVE NOT YET BEEN REDEPLOYED to devnet. Until redeployment:

| Program | Fix pending on-chain | Command |
|---------|---------------------|---------|
| `woland_escrow` | AP2-H1 — dispute window still 12h on-chain | `anchor deploy -p woland_escrow --provider.cluster devnet` |
| `woland_reputation` | AP2-H2 — ESCROW_PROGRAM_ID still wrong on-chain | `anchor deploy -p woland_reputation --provider.cluster devnet` |

**Both must be deployed before any production or devnet testing.** TypeScript fixes (AP2-H2 fallbacks, TS oracle checks) are live on next build.

---

### CLEAN AREAS (updated)

| Area | Status |
|------|--------|
| Anchor program account validation | ✓ Clean — full scan, no issues |
| Anchor arithmetic / overflow | ✓ Clean |
| Anchor phase state machine | ✓ Clean |
| Email HTML injection | ✓ Fixed (AP2-M1) |
| Admin wallet exposure | ✓ Fixed (AP2-L1) |
| Twitter HMAC secret isolation | ✓ Fixed (AP2-L3) |
| Oracle twitterVerified gating | ✓ Fixed (AP2-H3 at oracle time) |
| Pre-contract tweet filtering | ✓ Fixed (AP2-M2 partial) |
| Dispute window on-chain (code) | ✓ Fixed (AP2-H1, pending redeploy) |
| Program ID bytes | ✓ Fixed (AP2-H2, pending redeploy) |
| Rate limiting (dispute-resolve) | ✓ Fixed (AP2-N3) |
| Twitter API timeout | ✓ Fixed (AP2-N2) |
| Milestone ordering | ✓ Fixed (H5, prior cycle) |

---

### SUMMARY

| Category | Count |
|----------|-------|
| AP2 issues confirmed fixed | 11/13 |
| AP2 issues still open (partial fix) | 1 (AP2-M2 pagination) |
| AP2 issues with new bypass discovered | 1 (AP2-M3 null guard) |
| AP2 issues accepted/deferred | 2 (AP2-M4, AP2-M5) |
| New issues from this pass | 3 (AP3-H1, AP3-M1, AP3-L1) |
| On-chain deploys required | 2 (woland_escrow, woland_reputation) |
| Anchor program vulnerabilities | 0 |

**Resolved this cycle:** AP2-H1 (code), AP2-H2 (code), AP2-H3, AP2-M1, AP2-N2, AP2-N3, AP2-L1, AP2-L2 (9/18 routes), AP2-L3, AP2-N1, AP2-M6 (cleared)

**Requires another pass (King):**
1. **AP3-H1 / AP2-M3** — null `disputeOpenedAt` bypass → fail-closed fix in `dispute-resolve/route.ts:67`
2. **AP2-M2** — Add pagination to `getUserTweets` in `twitter-client.ts`

**Requires another pass (Worker):**
3. **AP3-M1** — `getClientIp` rollout to remaining 9 routes
4. **AP3-L1** — `twitterVerified` check at service creation in `services/route.ts`

---

🔄 King/Worker required — 2 HIGH + 2 MEDIUM issues remain open before production sign-off

Priority order for Fix Pass 4:
1. AP3-H1 (King) — Null `disputeOpenedAt` bypass: `dispute-resolve/route.ts:67` → fail-closed (`return 400` when null)
2. AP2-M2 (Worker) — Add pagination loop to `getUserTweets` in `twitter-client.ts`
3. AP3-M1 (Worker) — `getClientIp` in 9 remaining routes (mechanical)
4. AP3-L1 (Worker or King) — `twitterVerified` check or UI warning at service creation
5. Devnet redeploy — `woland_escrow` + `woland_reputation` (team action required)
