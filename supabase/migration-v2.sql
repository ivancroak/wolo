-- ===========================================
-- Wolo Migration V2: Marketplace Restructuring
-- 4 categories, 2 pricing models, unified contract flow
-- Run this in Supabase Dashboard > SQL Editor AFTER migration.sql
-- ===========================================

-- Add contract parameter columns to services
ALTER TABLE services ADD COLUMN IF NOT EXISTS required_keyword text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS min_post_count integer;
ALTER TABLE services ADD COLUMN IF NOT EXISTS posts_per_period integer;

-- Update CHECK constraints for categories (4 only)
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_category_check;
ALTER TABLE services ADD CONSTRAINT services_category_check
  CHECK (category IN ('content', 'space', 'ambassador', 'campaign'));

-- Update CHECK constraints for pricing (2 only)
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_pricing_category_check;
ALTER TABLE services ADD CONSTRAINT services_pricing_category_check
  CHECK (pricing_category IN ('fixed', 'payroll'));

-- Update CHECK constraints for payroll basis
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_payroll_basis_check;
ALTER TABLE services ADD CONSTRAINT services_payroll_basis_check
  CHECK (payroll_basis IN ('weekly', 'monthly'));

-- One wallet per contract (unique constraint on orders)
ALTER TABLE orders ADD CONSTRAINT uq_orders_service_buyer
  UNIQUE (service_id, buyer_id);

-- Deactivate old-category services
UPDATE services SET active = false
  WHERE category NOT IN ('content', 'space', 'ambassador', 'campaign');

-- Drop action_completions table (no longer needed)
DROP TABLE IF EXISTS action_completions CASCADE;
