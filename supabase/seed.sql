-- ===========================================
-- Wolo Seed Data (V3)
-- Run this in Supabase Dashboard > SQL Editor AFTER migration-v3.sql
-- ===========================================

-- Seed Users
insert into users (id, first_name, created_at, updated_at) values
  ('SeedAlice111111111111111111111111111111111111', 'Alice', now(), now()),
  ('SeedBob22222222222222222222222222222222222222', 'Bob', now(), now()),
  ('SeedCarol333333333333333333333333333333333333', 'Carol', now(), now())
on conflict (id) do nothing;

-- Seed Services (content category only, fixed + payroll pricing)
insert into services (creator_id, title, description, price, category, listing_type, pricing_category, payroll_basis, deadline_days, required_keyword, min_post_count, posts_per_period, max_actions) values
  ('SeedAlice111111111111111111111111111111111111',
   'DeFi Content Campaign (5 Posts)',
   'I will create 5 high-quality posts about your Solana DeFi project. Each post will include the required keyword/hashtag and be published within the deadline.',
   '2.5', 'content', 'offer', 'fixed', null, 7, '#SolanaDefi', 5, null, 10),

  ('SeedBob22222222222222222222222222222222222222',
   'Weekly Content Creator',
   'Dedicated content creator posting 3 tweets per week mentioning your project. Monthly engagement reports included.',
   '12.0', 'content', 'offer', 'payroll', 'weekly', null, '@woloprotocol', null, 3, 5),

  ('SeedCarol333333333333333333333333333333333333',
   '[REQUEST] Need 20 Posts for Token Launch',
   'Looking for influencers to post about our new token launch. Must include our handle and hashtag. Budget is firm, 5-day deadline.',
   '4.0', 'content', 'request', 'fixed', null, 5, '@newtoken', 20, null, null);
