-- Migration V8: Add 'pending_approval' to orders.status CHECK constraint
-- Required for: Request fulfillment flow (listingType = "request")
-- Run in Supabase SQL Editor BEFORE deploying this code version.

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending_approval', 'pending', 'completed', 'disputed', 'cancelled'));
