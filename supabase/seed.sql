-- ===========================================
-- Woland Seed Data
-- Run this in Supabase Dashboard > SQL Editor AFTER migration.sql
-- ===========================================

-- Seed Users
insert into users (id, first_name, created_at, updated_at) values
  ('SeedAlice111111111111111111111111111111111111', 'Alice', now(), now()),
  ('SeedBob22222222222222222222222222222222222222', 'Bob', now(), now()),
  ('SeedCarol333333333333333333333333333333333333', 'Carol', now(), now())
on conflict (id) do nothing;

-- Seed Services
insert into services (creator_id, title, description, price, category, listing_type, pricing_category, max_actions, budget_cap, payroll_basis, deadline_days) values
  ('SeedAlice111111111111111111111111111111111111',
   'Twitter/X Repost Campaign (100 reposts)',
   'I will repost your tweet/X post to my 50k+ followers. Guaranteed 100 reposts from real, active accounts across crypto/DeFi niches. Includes engagement tracking report.',
   '2.5', 'repost', 'offer', 'pay_per_action', 100, '2.5', null, null),

  ('SeedBob22222222222222222222222222222222222222',
   'Instagram Likes Package (500 likes)',
   'Boost your Instagram post with 500 organic likes from real accounts. Delivery within 24 hours. Ideal for product launches and brand visibility.',
   '1.0', 'like', 'offer', 'pay_per_action', 500, '1.0', null, null),

  ('SeedCarol333333333333333333333333333333333333',
   'Crypto Twitter Follower Growth',
   'Grow your crypto Twitter presence with 1000 targeted followers. All followers are real accounts interested in DeFi, NFTs, and Solana ecosystem.',
   '5.0', 'follow', 'offer', 'full_service', null, null, null, null),

  ('SeedAlice111111111111111111111111111111111111',
   'Brand Ambassador - Weekly Social Posts',
   'Dedicated brand ambassador service. 3 posts per week across Twitter and Instagram promoting your project. Monthly engagement reports included.',
   '12.0', 'ambassador', 'offer', 'payroll', null, null, 'weekly', null),

  ('SeedBob22222222222222222222222222222222222222',
   'Custom Solana Project Promo Thread',
   'Professional thread (8-12 tweets) breaking down your Solana project. Includes custom graphics, clear call-to-actions, and pinned for 7 days.',
   '3.5', 'custom', 'offer', 'full_service', null, null, null, null),

  ('SeedCarol333333333333333333333333333333333333',
   '[REQUEST] Need 50 Quality Reposts for NFT Drop',
   'Looking for influencers to repost our upcoming NFT collection announcement. Must have 10k+ followers in the NFT/art space. Budget is firm.',
   '4.0', 'repost', 'request', 'pay_per_action', 50, '4.0', null, 3),

  ('SeedAlice111111111111111111111111111111111111',
   '[REQUEST] Ambassador for DeFi Protocol Launch',
   'Seeking an experienced crypto ambassador to promote our new DeFi protocol launch. 2 weeks of daily social media coverage required across Twitter and Discord.',
   '20.0', 'ambassador', 'request', 'payroll', null, null, 'daily', 14);
