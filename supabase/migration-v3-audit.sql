-- ===========================================
-- Wolo Migration V3: Audit Fixes
-- Run this in Supabase Dashboard > SQL Editor AFTER migration-v2.sql
-- ===========================================

-- Unique constraint on twitter_handle (prevent two users claiming same handle)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_twitter_handle_unique
  ON profiles (twitter_handle)
  WHERE twitter_handle IS NOT NULL;

-- Unique constraint on ratings (prevent duplicate ratings per rater per order)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ratings_rater_order_unique
  ON ratings (rater_id, order_id);

-- Missing indexes for common queries
CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON watchlist (user_id);
CREATE INDEX IF NOT EXISTS idx_escrows_depositor_receiver ON escrows (depositor_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
