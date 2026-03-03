-- Migration v6: Recurring Payroll Payments
-- Adds payroll columns to escrows and creates payroll_periods table

-- New columns on escrows
ALTER TABLE escrows ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false;
ALTER TABLE escrows ADD COLUMN IF NOT EXISTS payroll_basis text; -- 'weekly' | 'monthly'
ALTER TABLE escrows ADD COLUMN IF NOT EXISTS total_periods integer;
ALTER TABLE escrows ADD COLUMN IF NOT EXISTS periods_paid integer NOT NULL DEFAULT 0;
ALTER TABLE escrows ADD COLUMN IF NOT EXISTS amount_per_period text;

-- Payroll periods table
CREATE TABLE IF NOT EXISTS payroll_periods (
  id serial PRIMARY KEY,
  escrow_id integer NOT NULL REFERENCES escrows(id) ON DELETE CASCADE,
  period_number integer NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  dispute_deadline timestamptz NOT NULL, -- ends_at + 48h
  status text NOT NULL DEFAULT 'pending',
    -- pending → active → delivered → paid
    -- or: active/delivered → disputed → paid/skipped
  amount text NOT NULL,
  payout_tx_hash text,
  paid_at timestamptz,
  disputed_at timestamptz,
  disputed_by text,
  dispute_reason text,
  resolved_at timestamptz,
  resolution_note text,
  verification_result jsonb,
  matching_posts integer,
  required_posts integer,
  created_at timestamptz DEFAULT now(),

  CONSTRAINT uq_escrow_period UNIQUE (escrow_id, period_number),
  CONSTRAINT chk_period_status CHECK (status IN ('pending','active','delivered','disputed','paid','skipped'))
);

CREATE INDEX IF NOT EXISTS idx_payroll_periods_escrow ON payroll_periods(escrow_id);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_status ON payroll_periods(status);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_dispute_deadline ON payroll_periods(dispute_deadline);
