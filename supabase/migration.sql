-- ===========================================
-- Wolo Supabase Migration
-- Run this in Supabase Dashboard > SQL Editor
-- ===========================================

-- Users
create table if not exists users (
  id text primary key,
  email text,
  first_name text,
  last_name text,
  profile_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Profiles
create table if not exists profiles (
  id serial primary key,
  user_id text not null unique references users(id) on delete cascade,
  wallet_address text,
  bio text,
  twitter_handle text,
  is_influencer boolean default false
);

-- Services
create table if not exists services (
  id serial primary key,
  creator_id text not null references users(id) on delete cascade,
  title text not null,
  description text not null,
  price text not null,
  category text not null check (category in ('repost','like','follow','ambassador','custom')),
  listing_type text not null default 'offer' check (listing_type in ('offer','request')),
  pricing_category text not null check (pricing_category in ('pay_per_action','full_service','payroll')),
  payroll_basis text check (payroll_basis in ('daily','weekly','monthly','annually','custom')),
  max_actions integer,
  budget_cap text,
  deadline_days integer,
  image_url text,
  active boolean not null default true,
  created_at timestamptz default now()
);

-- Orders
create table if not exists orders (
  id serial primary key,
  service_id integer not null references services(id) on delete cascade,
  buyer_id text not null references users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','completed','disputed','cancelled')),
  tx_hash text,
  requirements text,
  escrow_id integer,
  created_at timestamptz default now()
);

-- Watchlist
create table if not exists watchlist (
  id serial primary key,
  user_id text not null references users(id) on delete cascade,
  watched_user_id text not null references users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, watched_user_id)
);

-- Escrows
create table if not exists escrows (
  id serial primary key,
  order_id integer not null references orders(id) on delete cascade,
  depositor_id text not null references users(id) on delete cascade,
  receiver_id text not null references users(id) on delete cascade,
  amount text not null,
  phase text not null default 'awaiting_deposit' check (phase in ('awaiting_deposit','funded','in_progress','under_review','milestone_check','released','refunded','disputed')),
  deposit_tx_hash text,
  release_tx_hash text,
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add FK from orders.escrow_id to escrows.id after escrows table exists
alter table orders add constraint fk_orders_escrow foreign key (escrow_id) references escrows(id) on delete set null;

-- Milestones
create table if not exists milestones (
  id serial primary key,
  escrow_id integer not null references escrows(id) on delete cascade,
  title text not null,
  description text not null default '',
  amount text not null,
  target_metric integer,
  deadline_days integer,
  deadline_at timestamptz,
  status text not null default 'pending' check (status in ('pending','submitted','approved','rejected','expired')),
  proof_url text,
  completed_at timestamptz
);

-- Secure Messages
create table if not exists secure_messages (
  id serial primary key,
  order_id integer not null references orders(id) on delete cascade,
  sender_id text not null references users(id) on delete cascade,
  recipient_id text not null references users(id) on delete cascade,
  ciphertext text not null,
  ephemeral_pub text not null,
  nonce text not null,
  created_at timestamptz default now()
);

-- Reputation
create table if not exists reputations (
  id serial primary key,
  user_id text not null unique references users(id) on delete cascade,
  orders_completed integer not null default 0,
  orders_disputed integer not null default 0,
  total_earned text not null default '0',
  total_spent text not null default '0',
  avg_rating numeric,
  badges text[] not null default '{}',
  updated_at timestamptz default now()
);

-- Ratings
create table if not exists ratings (
  id serial primary key,
  order_id integer not null references orders(id) on delete cascade,
  rater_id text not null references users(id) on delete cascade,
  target_id text not null references users(id) on delete cascade,
  score integer not null check (score >= 1 and score <= 5),
  comment text,
  created_at timestamptz default now()
);

-- Channel Keys (for E2E encrypted messaging key exchange)
create table if not exists channel_keys (
  user_id text primary key references users(id) on delete cascade,
  public_key text not null,
  updated_at timestamptz not null default now()
);

-- Sessions (for secure auth tokens instead of raw wallet address)
create table if not exists sessions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

-- Indexes
create index if not exists idx_services_creator on services(creator_id);
create index if not exists idx_services_active on services(active);
create index if not exists idx_orders_buyer on orders(buyer_id);
create index if not exists idx_orders_service on orders(service_id);
create index if not exists idx_escrows_order on escrows(order_id);
create index if not exists idx_escrows_depositor on escrows(depositor_id);
create index if not exists idx_escrows_receiver on escrows(receiver_id);
create index if not exists idx_milestones_escrow on milestones(escrow_id);
create index if not exists idx_secure_messages_order on secure_messages(order_id);
create index if not exists idx_ratings_target on ratings(target_id);
create index if not exists idx_sessions_user on sessions(user_id);
create index if not exists idx_sessions_expires on sessions(expires_at);
create index if not exists idx_channel_keys_user on channel_keys(user_id);

-- Enable RLS on all tables
alter table users enable row level security;
alter table profiles enable row level security;
alter table services enable row level security;
alter table orders enable row level security;
alter table watchlist enable row level security;
alter table escrows enable row level security;
alter table milestones enable row level security;
alter table secure_messages enable row level security;
alter table reputations enable row level security;
alter table ratings enable row level security;
alter table sessions enable row level security;
alter table channel_keys enable row level security;

-- RLS policies: service_role bypasses RLS automatically.
-- Only grant anon minimal public reads where needed; all other tables deny anon by default.

create policy "Public read active services" on services for select using (active = true);
create policy "Public read reputations" on reputations for select using (true);
create policy "Public read ratings" on ratings for select using (true);

-- Notifications
create table if not exists notifications (
  id serial primary key,
  user_id text not null references users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  link_url text,
  read boolean not null default false,
  created_at timestamptz default now()
);
create index idx_notifications_user on notifications(user_id);
create index idx_notifications_unread on notifications(user_id, read);
alter table notifications enable row level security;

-- Action Completions (for pay_per_action services)
create table if not exists action_completions (
  id serial primary key,
  service_id integer not null references services(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  status text not null default 'completed' check (status in ('completed','verified','rejected')),
  created_at timestamptz default now(),
  unique(service_id, user_id)
);
create index if not exists idx_action_completions_service on action_completions(service_id);
alter table action_completions enable row level security;

-- Add actions_completed counter to services
alter table services add column if not exists actions_completed integer not null default 0;

-- Add twitter_verified to profiles
alter table profiles add column if not exists twitter_verified boolean not null default false;
