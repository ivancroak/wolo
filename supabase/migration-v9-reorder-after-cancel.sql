-- Migration V9: Allow re-ordering after cancellation
-- The old UNIQUE(service_id, buyer_id) blocked buyers from re-purchasing
-- after cancellation. Replace with partial unique index that only blocks
-- duplicate active orders.
-- Run in Supabase SQL Editor.

ALTER TABLE orders DROP CONSTRAINT IF EXISTS uq_orders_service_buyer;

CREATE UNIQUE INDEX uq_orders_service_buyer_active
  ON orders (service_id, buyer_id)
  WHERE status NOT IN ('cancelled');
