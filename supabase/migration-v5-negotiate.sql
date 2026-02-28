-- Migration v5: Deal Negotiation + Email on profiles
-- Run in Supabase SQL Editor

-- 1. Email on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_notifications boolean NOT NULL DEFAULT true;

-- 2. Negotiated override columns on orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS negotiated_price text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS negotiated_deadline_days integer;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS negotiated_min_post_count integer;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS negotiated_posts_per_period integer;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS negotiated_threads_per_period integer;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS negotiated_content_type text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS negotiated_required_keyword text;

-- 3. Deal proposals table
CREATE TABLE IF NOT EXISTS deal_proposals (
  id serial PRIMARY KEY,
  order_id integer NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  proposer_id text NOT NULL REFERENCES users(id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','rejected','withdrawn')),
  proposed_price text,
  proposed_deadline_days integer,
  proposed_min_post_count integer,
  proposed_posts_per_period integer,
  proposed_threads_per_period integer,
  proposed_content_type text CHECK (proposed_content_type IN ('posts','threads','mixed')),
  proposed_required_keyword text,
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_deal_proposals_pending ON deal_proposals (order_id) WHERE (status = 'pending');
CREATE INDEX IF NOT EXISTS idx_deal_proposals_order ON deal_proposals (order_id);
ALTER TABLE deal_proposals ENABLE ROW LEVEL SECURITY;
