-- V4: Add content_type and threads_per_period columns to services table
-- content_type values: posts, threads, mixed (mixed only valid for payroll pricing)
ALTER TABLE services ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'posts';
ALTER TABLE services ADD COLUMN IF NOT EXISTS threads_per_period integer;
ALTER TABLE services ADD CONSTRAINT chk_content_type CHECK (content_type IN ('posts', 'threads', 'mixed'));
