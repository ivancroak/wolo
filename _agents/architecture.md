# Architecture Agent — Living Document

> Role: High-level design decisions, structural proposals, breaking change approvals.
> Read `workflow.md` and `context.md` before each session.
> This document is versioned — never overwrite history, only append new version blocks.

---

# Architecture — v0 — 2026-02-24

## CYCLE 0 SUMMARY
Multi-agent workflow initialized. No code changes — scaffolding only.
Full existing architecture documented in `context.md` Sections 3–5.

## FILE MAP
See `context.md` Section 4 for the complete file map.
New files/modules will be documented here as they are designed.

## DATA FLOW
See `context.md` Section 3 for existing flows (auth, escrow, E2E chat).
New flows will be designed here before Coder implements.

## STATUS TABLE
| Component | Status | Notes |
|-----------|--------|-------|
| Core platform (7 pages) | [x] Done | See context.md §7 |
| On-chain escrow + reputation | [x] Done | Deployed to devnet |
| E2E encrypted chat | [x] Done | NaCl box |
| Twitter/X verification oracle | [x] Done | twitterapi.io |
| PlatformConfig admin init | [x] Done | POST /api/admin/init-config |
| End-to-end wallet flow test | [ ] Not started | #1 priority |
| IDL regeneration | [ ] Not started | Hand-written IDL may be stale |
| Rate limiting wiring | [ ] Not started | Infra exists, not wired to routes |
| Notification emission | [ ] Not started | notify() exists, not called anywhere |

## RISKS
| Risk | Severity | Mitigation |
|------|----------|------------|
| Stale IDL causes runtime tx failures | HIGH | Regenerate from anchor build before any on-chain testing |
| No rate limiting on auth routes | HIGH | Wire checkRateLimit() into auth/nonce, auth/login, ratings, messages |
| No e2e test with real wallet yet | CRITICAL | Must be done before any production deployment |

## OPEN QUESTIONS
- Q1: Should IDL regeneration be done first (blocks e2e testing) or in parallel? — Assumption: do IDL first since e2e depends on correct IDL.
- Q2: Rate limiting per-route vs middleware? — Assumption: per-route (matches existing pattern in `with-rate-limit.ts`)
- Q3: Supabase Realtime for chat/notifications? — Assumption: defer to after production-critical gaps are closed.

## DECISIONS LOG
| Date | Decision | Reason |
|------|----------|--------|
| 2026-02-24 | Multi-agent workflow adopted | Parallel agent roles for vibecoding efficiency |

---

# Architecture — v1 — 2026-02-24

## CYCLE 1 SUMMARY

**No formal cycle was run.** Between v0 scaffolding and now, a separate audit+bug-fix pass was committed (`8eb1486`). This was done outside the multi-agent cycle process (no coder_output, no review sign-off, no security sign-off). I am treating this as a "pre-cycle" cleanup and documenting actual state below.

**Sign-off status:** N/A — Cycle 0 was scaffolding-only. No code was produced through the cycle process, so no sign-offs were required or expected. The Review and Security agents both recorded "N/A — no cycle to sign off" which is correct.

## WHAT CHANGED (v0 plan vs actual code)

The following bugs from BACKEND_AUDIT.md were fixed in commit `8eb1486`, outside the formal cycle:

| Audit Item | v0 Status | Actual Status | Source of Truth |
|-----------|-----------|---------------|-----------------|
| BUG-1: params not awaited (10 routes) | Open | **FIXED** — all routes use `await params` | Code |
| BUG-2: orders/[id]/escrow no participant check | Open | **FIXED** — depositor/receiver check added | Code |
| BUG-3: PostgREST filter injection | Open | **FIXED** — `search` sanitized with regex | Code |
| BUG-4: RLS wide-open policies | Open | **FIXED** — restrictive policies (public read on services/reputations/ratings only) | Code |
| BUG-7: Cookie name "woland_session" | Open | **FIXED** — renamed to "wolo_session" | Code |
| BUG-10: Dispute resolution off-chain only | Open | **FIXED** — builds+sends on-chain `arbiterResolve` tx | Code |
| PARTIAL-5: Escrow sync trusts client | Open | **FIXED** — reads actual on-chain account data | Code |
| Rate limiting wiring | Not started | **PARTIAL** — 5 routes wired (nonce, login, ratings, services POST, orders POST) | Code |
| Notification emission | Not started | **PARTIAL** — 5 routes call notify() (ratings, milestones, orders, messages, escrow/phase) | Code |

**Structural note:** No structural divergence. All fixes followed existing patterns (per-route `checkRateLimit()`, storage methods, existing `notify()` helper). Architecture is intact.

## OPEN QUESTIONS — UPDATE

| Q | Status | Resolution |
|---|--------|------------|
| Q1: IDL regen first? | Resolved | IDL matches generated JSON — both define 13+4 instructions correctly. No urgent regen needed unless programs change. |
| Q2: Rate limiting per-route vs middleware? | Resolved | Per-route pattern adopted and working in 5 routes. Continue this pattern. |
| Q3: Supabase Realtime? | Still open | Deferred. Still not needed for production-critical path. |

## STATUS TABLE — UPDATED

| Component | Status | Notes |
|-----------|--------|-------|
| Core platform (7 pages) | [x] Done | |
| On-chain escrow + reputation | [x] Done | Deployed to devnet |
| E2E encrypted chat | [x] Done | NaCl box |
| Twitter/X verification oracle | [x] Done | twitterapi.io |
| PlatformConfig admin init | [x] Done | |
| Audit bug fixes (BUG-1,2,3,4,7,10, sync) | [x] Done | Commit 8eb1486 |
| Rate limiting wiring | [~] In progress | 5/6 critical routes done. Missing: messages POST |
| Notification emission | [~] In progress | 5 trigger points wired. Missing: escrow creation |
| End-to-end wallet flow test | [ ] Not started | CRITICAL — #1 priority |
| IDL regeneration | [x] Not needed | Hand-written IDL matches generated IDL |
| Service edit/delete (backend + frontend) | [ ] Not started | No API endpoints or UI exist |
| Public user profile page | [ ] Not started | No /users/:id page |
| Error boundaries | [ ] Not started | No React error boundaries |
| Marketplace creator filter | [ ] Not started | Watchlist links to ?creator= but marketplace ignores it |
| Dashboard query invalidation fixes | [ ] Not started | Milestone add/update doesn't refresh myEscrows |
| Hosting/deployment | [ ] Not started | Local only |
| AI Marketing-Analyst Agent | [ ] Not started | New feature — see detailed design below |

## WHAT REMAINS (from v0 plan)

1. **Rate limiting** — 1 route remaining: `POST /api/orders/[id]/messages` needs `checkRateLimit()`
2. **Notifications** — 1 trigger remaining: escrow creation should notify receiver
3. **E2E wallet flow test** — never done, still #1 priority for production readiness
4. **Hosting/deployment** — no config exists

## RISKS — UPDATED

| Risk | Severity | Status | Mitigation |
|------|----------|--------|------------|
| No e2e wallet flow test | CRITICAL | OPEN | Must be done manually with Phantom on devnet before any public launch |
| N+1 watchlist queries | LOW | OPEN | Refactor to JOIN query if watchlist grows beyond 50 users |
| Rating race condition | LOW | OPEN | Accept — extremely unlikely with current user volume |
| Notifications bypass storage pattern | LOW | OPEN | Refactor notifications into IStorage if notification logic grows |
| `any` types in component props | LOW | OPEN | Type-tighten ServiceCard, PurchaseModal, Dashboard if doing frontend refactor |

---

## NEXT: AI MARKETING-ANALYST AGENT — ARCHITECTURE DESIGN

### CONCEPT

An AI agent embedded in the Wolo platform that:
1. Accepts natural-language marketing requests from users
2. Parses constraints (budget, targets, deadlines, thresholds)
3. Queries the Wolo marketplace for available services
4. Calculates an optimal basket of services
5. Presents the plan to the user for confirmation
6. Upon confirmation, creates orders and funds escrows on behalf of the user

### FILE MAP — New Files Required

| File | Purpose | Why Needed |
|------|---------|------------|
| `src/app/(app)/agent/page.tsx` | Agent chat UI page | User-facing conversational interface |
| `src/app/api/agent/chat/route.ts` | Agent conversation endpoint | Processes user messages, calls LLM, returns structured responses |
| `src/app/api/agent/execute/route.ts` | Agent execution endpoint | Creates orders + escrows after user confirms plan |
| `src/app/api/agent/price-feed/route.ts` | SOL/USD price lookup | Converts user's USD budget to SOL amount |
| `src/components/AgentChat.tsx` | Chat UI component | Conversational interface with structured plan display |
| `src/components/MarketingPlanCard.tsx` | Plan display component | Shows basket of services with breakdown |
| `src/hooks/use-agent.ts` | Agent conversation hook | Manages agent state, sends messages, handles execution |
| `src/server/agent/parser.ts` | Request parser | Extracts structured constraints from natural language |
| `src/server/agent/optimizer.ts` | Basket optimizer | Given constraints + available services, calculates optimal basket |
| `src/server/agent/executor.ts` | Plan executor | Creates orders and escrows for confirmed plan |
| `src/server/agent/prompts.ts` | LLM prompt templates | System prompts and few-shot examples for the agent |
| `src/server/agent/types.ts` | Agent type definitions | MarketingRequest, ServiceBasket, AgentPlan, etc. |

### DATA FLOW

```
User types natural-language request
  │
  ▼
1. POST /api/agent/chat {message, conversationId}
  │  → getSessionUser() (must be authenticated)
  │  → Parse message with LLM (Claude API / tool-use mode)
  │  → LLM extracts: {budget, targets[], deadlines[], constraints[]}
  │  → If ambiguous → LLM returns clarifying question → back to user
  │
  ▼
2. Server fetches marketplace data
  │  → GET services from storage (active=true, relevant categories)
  │  → If budget in USD → GET /api/agent/price-feed for SOL/USD rate
  │  → Convert budget to SOL
  │
  ▼
3. Optimizer calculates basket
  │  → Filter services matching targets (followers, likes, reposts, etc.)
  │  → Score services by: price-per-action, seller reputation, deadline feasibility
  │  → Knapsack-like optimization: maximize target delivery within budget
  │  → Check deadline feasibility (can services deliver by date?)
  │  → On failure (budget too low, no services match): return explanation
  │
  ▼
4. Return structured plan to user
  │  → {services: [{service, quantity, cost, expectedDelivery}], totalCost, expectedOutcome}
  │  → User sees MarketingPlanCard with full breakdown
  │
  ▼
5. User confirms → POST /api/agent/execute {planId, conversationId}
  │  → For each service in basket:
  │     a. createOrder(buyerId=user, serviceId, quantity)
  │     b. createEscrow(orderId, depositorId=user, receiverId=seller, amount)
  │  → Return list of created orders + escrows
  │  → User funds escrows via wallet (standard existing flow)
  │
  ▼
6. Standard escrow lifecycle continues
   │  → Seller delivers → buyer approves → funds released
   │  → Agent can provide status dashboard
```

**Failure handling at each step:**
1. LLM call fails → return error, retry with backoff
2. No matching services → explain to user what's available vs what they asked
3. Budget insufficient → show cheapest viable option + what it achieves
4. Order/escrow creation fails → rollback created orders, return error
5. User wallet insufficient → standard wallet error (existing handling)

### LOGIC — Decision Points

```
IF budget given in USD:
  → Fetch SOL/USD from price oracle (CoinGecko/Jupiter API)
  → Convert and round to nearest 0.1 SOL

IF "at least N followers" specified:
  → Hard constraint: basket MUST deliver >= N followers
  → If impossible within budget: explain and suggest alternatives

IF deadline specified ("by March 4th"):
  → Filter services with delivery_time <= days_until_deadline
  → If no services can deliver in time: explain constraint violation

IF "priority" or "focus" specified:
  → Weight scoring toward specified target (e.g., 70% followers, 30% likes)

IF multiple targets (followers + likes):
  → Multi-objective optimization
  → Allocate budget proportionally unless priority specified

IF "cheapest" specified:
  → Minimize cost while meeting minimum target thresholds
  → Inverse optimization: find floor, not ceiling
```

### DEPENDENCIES

| Dependency | Purpose | Risk |
|-----------|---------|------|
| Anthropic Claude API (`@anthropic-ai/sdk`) | LLM for NLU + structured output | Latency (2-5s per call), cost (~$0.01-0.05/request), rate limits |
| CoinGecko or Jupiter Price API | SOL/USD conversion | Rate limits, stale prices. Mitigation: cache for 60s |
| x402 protocol (if used) | Machine-to-machine payment | New dependency, may not be mature. See note below. |

**x402 note:** x402 is an HTTP-native payment protocol using 402 status codes. For Wolo's current architecture, x402 is NOT needed in the first iteration. The existing escrow flow already handles payments. The agent can simply create orders + escrows, and the user funds them via their wallet. x402 would only be relevant if we wanted fully automated agent-to-service payments without user wallet interaction — this requires:
- Agent holding funds (custodial, legal/security concerns)
- OR pre-approved spending limits via smart contract (complex, new program needed)

**Recommendation:** Build v1 WITHOUT x402. The agent creates the plan + orders, user confirms and funds via wallet. Add x402 / auto-pay in a future version.

### RISKS — AGENT FEATURE

| Risk | Severity | Mitigation |
|------|----------|------------|
| LLM hallucination (inventing services) | HIGH | Agent MUST only reference real services from DB. LLM sees service list as context, not memory. |
| Budget miscalculation | HIGH | All math done in optimizer (deterministic code), not by LLM. LLM only parses, never calculates. |
| Price oracle stale/down | MEDIUM | Cache SOL/USD for 60s, show rate to user, let them confirm |
| Agent creates bad orders | MEDIUM | User MUST confirm plan before any orders are created. No auto-execution. |
| LLM API cost | LOW | ~$0.01-0.05 per agent interaction. Negligible at current scale. |
| User confusion | LOW | Clear UI: "This is an AI-assisted tool. Review the plan before confirming." |

### COMPLEXITY ASSESSMENT

| Aspect | Difficulty | Notes |
|--------|-----------|-------|
| LLM integration (Claude API) | Medium | Straightforward SDK, structured output via tool-use |
| NLU parsing | Medium | Claude handles this well with good prompts + few-shot examples |
| Basket optimizer | Medium-Hard | Knapsack-like problem, but small input size (<100 services) makes brute-force viable |
| Order/escrow creation | Easy | Reuses existing storage methods and escrow flow |
| Frontend chat UI | Medium | Standard chat interface + structured plan card |
| x402 / auto-pay | Hard | Defer to v2 |
| **Overall** | **Medium** | ~3-5 days of focused coding for v1 (no x402) |

### OPEN QUESTIONS — NEW

- Q4: Which LLM to use? — Assumption: Anthropic Claude (claude-sonnet-4-6) via `@anthropic-ai/sdk`. Sonnet for cost/speed balance.
- Q5: Should agent conversations persist in DB? — Assumption: Yes, new `agent_conversations` + `agent_messages` tables.
- Q6: Should the agent be able to fetch the user's X account data (followers count, etc.) to contextualize recommendations? — Assumption: Yes, reuse existing twitter-client.ts.
- Q7: x402 in v1 or defer? — Assumption: Defer to v2. User funds escrows manually via wallet in v1.
- Q8: Should agent orders be distinguishable from manual orders? — Assumption: Yes, add `source: 'manual' | 'agent'` field to orders table.

---

# Architecture — v2 — 2026-02-26

## CYCLE 2 SUMMARY

**SOL-Only Escrow Rewrite + Pay-Per-Action Auto-Send**

The entire payment system migrates from SPL tokens to native SOL. This eliminates the $0.30 ATA rent problem that blocks pay-per-action at scale. Additionally, the missing auto-pay feature is implemented: when a completer's action is Twitter-verified, the server automatically pays them SOL from the escrow.

**Key parameters decided in PHASE 0:**
- Native SOL (not SPL tokens) for all payment flows
- Platform commission: 5% (500 bps)
- Transaction fees deducted from commission (invisible to users)
- SOL decimals: 9 (was 6 for SPL)
- Vault PDA eliminated — escrow PDA itself holds SOL
- Pay-per-action: Option A (auto-send, arbiter-signed)
- New on-chain instruction: `release_action_payout`

## FILE MAP

### Files Modified (no new files created)

| File | What it does | What changes |
|------|-------------|--------------|
| `programs/woland_escrow/src/lib.rs` | On-chain escrow program (Rust/Anchor) | Full rewrite: remove all SPL token logic, use lamport manipulation for SOL transfers, add `release_action_payout` instruction, merge init+fund into one instruction |
| `programs/woland_escrow/Cargo.toml` | Rust dependencies | Remove `anchor-spl` dependency entirely |
| `src/lib/solana/escrow-client.ts` | TypeScript wrapper for on-chain program | Remove all SPL imports, remove vault PDA, remove mint params from all methods, add `buildReleaseActionPayoutIx()` |
| `src/hooks/use-solana-escrow.ts` | React hook for escrow operations | Remove `mintAddress` param from 5 callbacks |
| `src/components/PurchaseModal.tsx` | Purchase flow UI | Remove MINT const, change decimals 6→9 |
| `src/components/MilestonePanel.tsx` | Milestone management UI | Remove MINT const, change decimals 6→9 |
| `src/app/(app)/dashboard/page.tsx` | Main dashboard | Remove 3 mint refs, change 3 multipliers 10^6→10^9 |
| `src/app/(app)/orders/[id]/page.tsx` | Order detail page | Remove 2 mint refs, change 2 multipliers 10^6→10^9 |
| `src/app/api/admin/disputes/[id]/resolve/route.ts` | Admin dispute resolution | Remove mint variable and param |
| `src/app/api/escrow/[id]/dispute-resolve/route.ts` | Auto dispute resolution via X verification | Remove mint variable and param |
| `src/app/api/services/[id]/actions/[actionId]/dispute/route.ts` | Action verification endpoint | Add auto-pay logic after verified status |
| `src/shared/schema.ts` | Shared type definitions | Add 3 payout fields to `ActionCompletion` |
| `src/server/storage.ts` | Database access layer | Add `markActionPaid()`, update all action completion mappers |
| `package.json` | NPM dependencies | Remove `@solana/spl-token` |

## DATA FLOW

### Flow 1: Full-Service Escrow (SOL-Only)

```
1. Buyer clicks "Purchase" on a service listing
   │
2. PurchaseModal creates order via API
   │  → POST /api/orders → storage.createOrder()
   │  → POST /api/escrow → storage.createEscrow()
   │  FAIL → show error toast, stop
   │
3. PurchaseModal calls initializeAndFund() [NEW: single instruction]
   │  → Builds initialize_escrow instruction (includes SOL transfer via system_program::transfer CPI)
   │  → Escrow PDA receives SOL directly (no vault PDA)
   │  → Phase set to Funded immediately
   │  FAIL → escrow record exists off-chain but unfunded, buyer can retry
   │
4. Seller starts work → advancePhase("in_progress") [unchanged]
   │
5. Seller submits for review → advancePhase("under_review") [unchanged]
   │
6. Buyer approves → releaseFunds()
   │  → On-chain: lamport manipulation from escrow PDA
   │     **escrow.lamports -= net_amount → receiver.lamports += net_amount
   │     **escrow.lamports -= fee → fee_vault.lamports += fee
   │  → Receiver gets 95% of amount, fee_vault gets 5%
   │  FAIL → on-chain tx rejected, escrow stays in under_review
   │
7. OR: Buyer disputes → advancePhase("disputed")
   │  → Seller submits X verification evidence
   │  → Server calls arbiter_resolve on-chain (deploy wallet signs)
   │  → Same lamport manipulation for distribution
   │
8. OR: Escrow expires → buyer calls refund()
   │  → Lamport transfer from escrow PDA back to buyer
```

### Flow 2: Pay-Per-Action Auto-Send [NEW]

```
1. Creator lists a pay-per-action service
   │  → Sets budgetCap (total SOL budget) and maxActions
   │  → Price per action = budgetCap / maxActions
   │
2. Creator funds escrow for the full budgetCap
   │  → Same initialize_escrow as Flow 1
   │  → Escrow PDA holds all SOL for all future action payouts
   │
3. Completer performs action (repost, follow, like on X)
   │  → POST /api/services/:id/actions → records action_completion
   │  → Status: "completed"
   │
4. Creator (or system) triggers verification
   │  → POST /api/services/:id/actions/:actionId/dispute
   │  → Calls verifyDelivery() — checks X API for proof
   │  FAIL (X API down) → status stays "completed", returns error
   │
5. IF verified:
   │  a. Update status to "verified"
   │  b. Calculate payout: (budgetCap / maxActions) in lamports
   │  c. Build release_action_payout instruction:
   │     → Arbiter (deploy wallet) signs
   │     → Escrow PDA lamports debited
   │     → Completer wallet lamports credited (95%)
   │     → Fee vault lamports credited (5%)
   │  d. Send + confirm transaction
   │  e. Call storage.markActionPaid(id, txHash, payoutAmount)
   │  FAIL (on-chain tx) → completion stays "verified" but unpaid
   │     → Can be retried (paidAt is null = not yet paid)
   │
6. IF not_found:
   │  → Update status to "rejected"
   │  → Decrement service.actions_completed
   │  → No SOL moves
   │
7. When all actions completed (or escrow expires):
   │  → Creator can close escrow to reclaim remaining SOL + rent
```

### Flow 3: Dispute Resolution (SOL-Only)

```
1. Escrow in "disputed" phase
   │
2a. Seller submits evidence → POST /api/escrow/:id/dispute-resolve
   │  → verifyDelivery() checks X API
   │  → IF verified: arbiter_resolve(depositorShareBps=0) → 100% to seller
   │  → IF not_found: arbiter_resolve(depositorShareBps=10000) → 100% to buyer
   │  → Lamport manipulation: escrow PDA → receiver + depositor + fee_vault
   │
2b. Admin resolves → POST /api/admin/disputes/:id/resolve
   │  → Admin sets depositorShareBps manually
   │  → Same on-chain arbiter_resolve instruction
   │
FAIL at any step → escrow stays disputed, can be retried
```

## LOGIC

### Lamport Manipulation Pattern (replaces all token CPI calls)

```
IF transferring SOL FROM a PDA:
  → Cannot use system_program::transfer (PDA can't sign)
  → Must use try_borrow_mut_lamports() to directly modify balances:
    **source_account.to_account_info().try_borrow_mut_lamports()? -= amount;
    **dest_account.to_account_info().try_borrow_mut_lamports()? += amount;
  → This is safe because program owns the source PDA

IF transferring SOL FROM a user wallet (funding):
  → CAN use system_program::transfer CPI (user is signer)
  → CpiContext::new(system_program, Transfer { from, to })
```

### Merge Init + Fund

```
Old flow: initialize_escrow() → creates PDA + vault, phase=AwaitingDeposit
          fund_escrow()       → transfers SPL tokens to vault, phase=Funded

New flow: initialize_escrow() → creates PDA, transfers SOL to PDA, phase=Funded
          fund_escrow()       → DELETED (no longer needed)

WHY: No vault PDA exists. Escrow PDA holds SOL directly.
     User sends SOL in the same tx that creates the escrow.
     Eliminates AwaitingDeposit phase for new escrows.
```

### Decimal Conversion

```
Old (SPL tokens): 1 token = 1_000_000 smallest units (6 decimals)
New (native SOL): 1 SOL  = 1_000_000_000 lamports (9 decimals)

Every instance of:
  parseFloat(amount) * 1_000_000     → parseFloat(amount) * 1_000_000_000
  Math.pow(10, 6)                    → Math.pow(10, 9)
  TOKEN_DECIMALS = 6                 → SOL_DECIMALS = 9
```

### Auto-Pay Decision Tree

```
POST /api/services/:id/actions/:actionId/dispute
  │
  ├─ result.status === "verified"
  │    ├─ Update completion status to "verified"
  │    ├─ Check: feeVaultStr && rpcUrl && service.budgetCap && service.maxActions
  │    │    ├─ YES → Calculate payout, find active escrow, build + send tx
  │    │    │    ├─ TX SUCCESS → markActionPaid(id, sig, amount)
  │    │    │    └─ TX FAIL → log error, do NOT fail the verification
  │    │    └─ NO → Skip auto-pay (env not configured or service has no budget)
  │    └─ Return { completion, verification }
  │
  ├─ result.status === "not_found"
  │    ├─ Update completion status to "rejected"
  │    └─ Return { completion, verification }
  │
  └─ result.status === "manual_only" or "error"
       └─ Return { completion, verification } (no status change)
```

### Close Escrow (SOL-Only)

```
Old: close_escrow closes both escrow PDA + vault PDA, returns token rent + SOL rent to depositor
New: close_escrow closes only escrow PDA, returns all remaining SOL (rent + unspent) to depositor

Anchor's `close = depositor` directive:
  → Transfers ALL remaining lamports from escrow PDA to depositor
  → Zeroes account data
  → This handles both "return rent" and "return unspent balance"
```

### release_action_payout Authorization

```
WHO can call: Only the arbiter (deploy wallet / platform server)
  → Constraint: arbiter.key() == config.arbiter
  → Users CANNOT trigger payouts — prevents self-payment attacks

WHEN callable:
  → escrow.phase == Funded OR InProgress
  → amount <= (escrow.amount - escrow.released)

WHAT it does:
  → fee = amount * fee_bps / 10000
  → net = amount - fee
  → escrow_lamports -= net → completer_lamports += net
  → escrow_lamports -= fee → fee_vault_lamports += fee
  → escrow.released += amount
  → IF escrow.released >= escrow.amount → phase = Released
```

## DEPENDENCIES

| Dependency | Purpose | Change |
|-----------|---------|--------|
| `anchor-lang 0.32.1` | Solana program framework | Keep (unchanged) |
| `anchor-spl 0.32.1` | SPL token CPI helpers | **REMOVE** — no longer needed |
| `@solana/web3.js` | Solana JS client | Keep (unchanged) |
| `@solana/spl-token` | SPL token JS helpers | **REMOVE** from package.json |
| `@solana/wallet-adapter-react` | Wallet connection | Keep (unchanged) |

No new dependencies added.

## RISKS

| Risk | Severity | Mitigation |
|------|----------|------------|
| Program redeploy breaks existing devnet escrows | HIGH | Acceptable — devnet only. No production data. All existing escrows become unreadable. |
| Lamport manipulation arithmetic error | CRITICAL | All arithmetic uses `checked_sub`, `checked_add`, `checked_mul`, `checked_div`. Overflow → explicit error, not silent corruption. |
| Auto-pay sends SOL to wrong wallet | CRITICAL | Arbiter-trust-only — no on-chain completer validation. Fee vault validated against `config.fee_vault`. Relies on deploy wallet integrity. |
| Auto-pay fails silently, completer never paid | HIGH | Failure logged but doesn't block verification. `paidAt IS NULL` in DB allows querying for unpaid verified completions for retry. |
| Escrow PDA closed while auto-pay pending | MEDIUM | `close_escrow` requires phase == Released or Refunded. Auto-pay only works on Funded/InProgress. Can't close mid-payout. |
| EscrowAccount size changes, affects space calculation | MEDIUM | Removing `mint` (32 bytes) and `vault_bump` (1 byte) shrinks the account. Update `INIT_SPACE`. Anchor's `InitSpace` derive handles this automatically. |

## STATUS TABLE

| Component | Status | Notes |
|-----------|--------|-------|
| Rust program SOL rewrite | [x] Done | All SPL removed, lamport manipulation, init+fund merged |
| `release_action_payout` instruction | [x] Done | Arbiter-signed, 95/5 split |
| Cargo.toml cleanup | [x] Done | anchor-spl removed |
| `anchor build` + IDL generation | [x] Done | Built successfully — .so + IDL + TS types generated |
| Escrow client TS rewrite | [x] Done | SPL imports, vault PDA, mint params removed; new method added |
| React hook mint removal | [x] Done | mintAddress removed from all 5 callbacks |
| PurchaseModal SOL update | [x] Done | MINT removed, decimals 6→9 |
| MilestonePanel SOL update | [x] Done | MINT removed, decimals 6→9 |
| Dashboard SOL update | [x] Done | 3 mint refs, 3 multipliers fixed |
| Orders page SOL update | [x] Done | 2 mint refs, 2 multipliers fixed |
| Admin dispute route update | [x] Done | Mint removed |
| Escrow dispute-resolve route update | [x] Done | Mint removed |
| Action auto-pay logic | [x] Done | Full auto-pay with on-chain tx + markActionPaid |
| Schema payout fields | [x] Done | payoutAmount, payoutTxHash, paidAt |
| Storage markActionPaid | [x] Done | New method + shared toActionCompletion mapper |
| DB migration (3 columns) | [x] Done | payout_amount, payout_tx_hash, paid_at added in Supabase |
| Remove @solana/spl-token | [x] Done | Removed from package.json |

## BUILD ORDER (Coder must follow exactly)

```
1. DB migration           → add columns first (no code depends on this yet)
2. Schema types           → ActionCompletion interface gets payout fields
3. Storage methods        → markActionPaid + update all mappers
4. Rust program           → full SOL rewrite + release_action_payout
5. Cargo.toml             → remove anchor-spl
6. anchor build           → must compile, generates new IDL
7. Escrow client (TS)     → rewrite to match new program API
8. React hook             → remove mint params (depends on client API)
9. UI components          → decimal fix + mint removal (depends on hook API)
10. API routes            → mint removal + auto-pay logic (depends on client)
11. package.json cleanup  → remove @solana/spl-token, npm install
```

## OPEN QUESTIONS

- Q9: Should `AwaitingDeposit` phase be kept for backwards compat or removed entirely? — Assumption: Keep the enum variant in Rust (breaking enum layout is dangerous) but never enter it. `initialize_escrow` always goes directly to `Funded`.
- Q10: Should the Coder check for existing `getOrdersByService` / `getEscrowByOrder` storage methods before adding them? — Assumption: Yes, check first. If they exist, reuse. If not, add minimal implementations.
- Q11: Should we update `NEXT_PUBLIC_FEE_VAULT` env documentation? — Assumption: Yes, document that it should now be a regular SOL wallet address, not a token account address. But do NOT edit .env directly.
- Q12: What happens if `release_action_payout` is called but escrow has insufficient balance? — The on-chain `InsufficientFunds` error fires and the tx is rejected. The off-chain code catches this in try-catch and logs without failing the verification.
- Q13: (M4) Auto-pay picks first active escrow — wrong if multiple buyers fund same listing. — Fix: add `escrow_id` column to `action_completions`, set at completion time. **DEFERRED** to Cycle 3. Low risk on devnet (one buyer per listing in practice). Must fix before production.

## VERIFICATION CHECKLIST (Coder runs after all changes)

```bash
npx tsc --noEmit          # Zero TS errors
npm run build             # Next.js production build succeeds
anchor build              # Solana program compiles
```

Then grep-verify:
- `grep -r "NEXT_PUBLIC_SPL_TOKEN_MINT" src/` → 0 results
- `grep -r "@solana/spl-token" src/` → 0 results
- `grep -r "1_000_000[^_]" src/` → 0 results (all should be 1_000_000_000)
- `grep -r "TokenAccount\|token::transfer\|anchor_spl" programs/` → 0 results

## SECURITY NOTES FOR AUDITOR

- `release_action_payout` is **arbiter-only** — users cannot trigger payouts
- Auto-pay failure does NOT fail verification — prevents griefing where broken payout blocks legitimate verifications
- All lamport arithmetic is `checked_*` — no overflow possible
- `completer` address is **arbiter-trust-only** — no on-chain constraint validates the completer. Security relies on the arbiter (deploy wallet) passing the correct address. If deploy wallet is compromised, payouts could be misdirected.
- Fee vault validated on-chain against `config.fee_vault`
- No new environment variables exposed client-side
- Deploy wallet private key usage is server-only (existing pattern via `getDeployWalletKeypair()`)

---

Architecture v2 ready — Coder can begin
