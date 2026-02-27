# Changelog — Wolo Agent Sessions

> Updated by whichever agent completes a task.
> Format: `[YYYY-MM-DD] [Agent] Short description`
> Keep entries newest-first.

---

## 2026-02-26
- [Coder] **Cycle 2 — SOL-Only Escrow Rewrite + Pay-Per-Action Auto-Send** — Full implementation of architecture v2
- [Coder] Rust program fully rewritten: removed all SPL token logic, native SOL via lamport manipulation, merged init+fund, added `release_action_payout` instruction
- [Coder] Removed `anchor-spl` dependency from Cargo.toml
- [Coder] Escrow client TS fully rewritten: removed SPL imports, vault PDA, mint params; added `buildReleaseActionPayoutIx()`
- [Coder] React hook updated: removed `mintAddress` param from all 5 callbacks
- [Coder] UI components updated: PurchaseModal, MilestonePanel, Dashboard, Orders — decimals 6→9, mint refs removed
- [Coder] API routes updated: admin dispute resolve, escrow dispute-resolve, action dispute with auto-pay logic
- [Coder] Schema + storage: added payout fields to ActionCompletion, `markActionPaid()` method, `toActionCompletion()` shared mapper
- [Coder] Removed `@solana/spl-token` from package.json
- [Coder] Verification: `tsc --noEmit` clean, `npm run build` clean, 4 grep checks pass (zero SPL/mint/token references remain)
- [Coder] Blockers: DB migration (3 columns) + `anchor build` must be run manually
- [Setup] **Multi-agent system restructured** — 4 agents: King (plan+code), Advisor (discuss), Worker (parallel plan+code), Auditor (review)
- [Setup] Created: `prompts/king.md`, `prompts/advisor.md`, `prompts/worker.md`, `king_output.md`, `advisor_output.md`, `worker_output.md`
- [Setup] Deleted: `prompts/architect.md`, `prompts/coder.md` (merged into King)
- [Setup] Updated: `prompts/auditor.md` (Coder refs → King/Worker, added skills section)
- [Setup] Rewrote `workflow.md` — parallel work streams diagram, coordination rules, updated roles/skills tables
- [Setup] `coder_output.md` preserved as read-only archive from Cycles 1-2
- [Setup] Added MODE C (Quick Fix) to Coder prompt — direct fixes without architecture plan
- [Setup] Updated workflow.md: dual-path diagram (quick fix vs full cycle), relevant skills reference table (6 of 480 skills mapped to agents)
- [Setup] Cleaned up deprecated files: deleted `prompts/reviewer.md`, `prompts/security.md`, `review_output.md`, `security_output.md`

## 2026-02-25
- [Setup] Reviewer + Security agents merged into single Auditor agent. New prompt at `_agents/prompts/auditor.md`, new output file `_agents/audit_output.md`. Updated workflow.md, Architect prompt, Coder prompt.
- [Setup] Architect agent expanded to CTO + Architect (two-phase: Phase 0 strategy discussion + Phase 1 formal planning). Updated prompt, workflow.md, agent roles table.
- [Coder] Fix Pass 1 — 12 issues addressed from Review Pass 1 + Audit Pass 1 (Cycle 1)
- [Coder] SEC-C1 CRITICAL: Escrow receiverId now derived server-side from service.creatorId (was client-controlled)
- [Coder] SEC-H1 HIGH: Numeric validation on escrow amount, milestone amount, service price
- [Coder] SEC-H2 HIGH: Zod validation added to PUT /api/services/[id]
- [Coder] SEC-M1–M4: XFF rate limit hardening (x-real-ip + session-based), notifications ZodError fix, session cleanup, dead code removal
- [Coder] REV-1: Fixed 401→403 on escrow participant checks
- [Coder] NTH 1–4: Rate limit memory leak, services GET error propagation, verification try-catch, context.md doc correction

## 2026-02-24
- [Coder] Rate limiting wired on `POST /api/orders/[id]/messages` — all 6 critical routes now rate-limited (Cycle 1)
- [Coder] Notification on escrow creation — `notify()` calls receiver when escrow is created, added `"escrow_created"` to `NotificationType` (Cycle 1)
- [Setup] Multi-agent vibecoding workflow initialized (`workflow.md`, `_agents/` directory)
- [Setup] Git pull from `workonthestreets/Woland_maindeploy` — updated to commit `8eb1486` (BACKEND_AUDIT.md, FRONTEND_AUDIT.md, reputation program updates, API route fixes, user profile page)

---

## Previous work (from context.md §7)
- PlatformConfig on-chain initialization via admin API route
- Twitter/X verification oracle for milestone delivery
- Full security audit pass: session tokens, escrow phase state machine, mint validation, self-purchase prevention
- Wallet login dedup fix (module-level guards)
- Landing page hydration fix, Canvas2D performance fix
- Full escrow + reputation on-chain flows
- E2E encrypted chat with NaCl box
- 13-table Supabase schema with RLS
