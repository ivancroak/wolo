-- ===========================================
-- Wolo Migration V3: Content-Only Categories
-- Removes space, ambassador, campaign categories
-- Run this in Supabase Dashboard > SQL Editor AFTER migration-v2.sql
-- ===========================================

-- Deactivate all non-content services
UPDATE services SET active = false
  WHERE category NOT IN ('content');

-- Rewrite category so CHECK constraint won't be violated by old rows
UPDATE services SET category = 'content'
  WHERE category NOT IN ('content');

-- Update CHECK constraint to content only
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_category_check;
ALTER TABLE services ADD CONSTRAINT services_category_check
  CHECK (category IN ('content'));
