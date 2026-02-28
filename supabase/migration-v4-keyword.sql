-- V4: Add required_keyword column to orders table
-- Allows buyer-specified verification keyword per order (separate from service discovery keywords)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS required_keyword text;
